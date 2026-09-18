import json
import time
import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import create_app

class SocialTests(unittest.TestCase):
    def setUp(self):
        self.app=create_app(':memory:');self.client=TestClient(self.app);self.client.__enter__();self.create()
    def tearDown(self):self.client.__exit__(None,None,None)
    def create(self,v='match',n=4):
        self.variant=v
        r=self.client.post('/rooms',json=dict(name='破冰',mechanic='social',socialVariant=v,theme='garden',duration=30,participants=max(12,n),teams='甲组,乙组')).json()
        self.id=r['room']['id'];self.host={'Authorization':'Bearer '+r['token']};self.players=[]
        for i in range(n):
            p=self.client.post(f'/rooms/{self.id}/join',json=dict(name='来宾'+str(i),team=i%2)).json();self.players.append({'Authorization':'Bearer '+p['token']})
        self.client.post(f'/rooms/{self.id}/command',headers=self.host,json={'action':'start'})
        for i in range(n):self.act(i,'enroll',interests=[0],contact='PRIVATE-CONTACT-'+str(i))
    def act(self,i,action,**data):return self.client.post(f'/rooms/{self.id}/social-action',headers=self.players[i],json=dict(action=action,**data))
    def own(self,i):return self.client.get(f'/rooms/{self.id}/social-self',headers=self.players[i]).json()
    def public(self):return self.client.get(f'/rooms/{self.id}').json()['game']['social']
    def admin(self):return self.client.get(f'/rooms/{self.id}/social-admin',headers=self.host).json()
    def cmd(self,action,**data):return self.client.post(f'/rooms/{self.id}/social-admin',headers=self.host,json=dict(action=action,**data))
    def invite(self,a=0,b=1,**data):
        r=self.act(a,'invite',code=self.own(b)['profile']['code'],**data);self.assertEqual(r.status_code,200,r.text)
        return self.own(a)['requests'][-1]['id']
    def test_consent_independent_answers_cancel(self):
        rid=self.invite();self.assertIsNone(self.own(0)['pairAnswers'])
        self.assertEqual(self.act(2,'accept',id=rid).status_code,403)
        self.act(1,'accept',id=rid)
        self.assertEqual(self.act(0,'answer',id='stale-pair',index=0,choice=0).status_code,409)
        for q in range(3):self.assertEqual(self.act(0,'answer',id=rid,index=q,choice=1).status_code,200)
        self.assertFalse(self.own(1)['pairAnswers']['ready']);self.assertEqual(self.own(1)['pairAnswers']['results'],[])
        self.assertEqual(self.act(0,'answer',id=rid,index=0,choice=0).status_code,409)
        for q in range(3):self.act(1,'answer',id=rid,index=q,choice=1)
        self.assertTrue(self.own(0)['pairAnswers']['ready']);self.assertTrue(all(r['same'] for r in self.own(0)['pairAnswers']['results']))
        self.assertNotIn('answers',json.dumps(self.public()))
        self.act(1,'cancel',id=rid);self.assertIsNone(self.own(0)['pairAnswers'])
    def test_interest_same_and_expiry(self):
        self.create('interest');self.act(1,'enroll',interests=[1])
        self.assertEqual(self.act(0,'invite',code=self.own(1)['profile']['code']).status_code,409)
        self.assertEqual(self.act(0,'invite').status_code,200)
        rid=self.own(0)['requests'][-1]['id']
        with patch('social_rules.time.time',return_value=time.time()+121):
            self.assertEqual(self.own(0)['requests'][-1]['status'],'expired')
            self.assertEqual(self.act(2,'accept',id=rid).status_code,409)
        self.create('same')
        self.assertEqual(self.act(0,'invite',code=self.own(2)['profile']['code']).status_code,409)
        rid=self.invite();self.act(1,'decline',id=rid);self.assertEqual(self.public()['connections'],0)
    def test_cards_private_and_revocation(self):
        self.create('cards');rid=self.invite()
        for output in [self.public(),self.admin(),self.own(1),self.own(2)]:
            # own profiles may contain their own contact, never someone else's.
            self.assertNotIn('PRIVATE-CONTACT-0',json.dumps(output))
        self.act(1,'accept',id=rid)
        self.assertEqual(self.own(0)['requests'][0]['contact'],'PRIVATE-CONTACT-1')
        self.assertNotIn('PRIVATE-CONTACT',json.dumps(self.public())+json.dumps(self.admin()))
        self.cmd('close');self.act(1,'leave')
        self.assertNotIn('contact',self.own(0)['requests'][0])
        self.assertEqual(self.public()['connections'],0)
    def test_bingo_requires_nine_distinct_partners(self):
        self.create('bingo',10);base=time.time()
        for i in range(9):
            with patch('social_rules.time.time',return_value=base+i*2):
                rid=self.invite(0,i+1,index=i);self.assertEqual(self.act(i+1,'accept',id=rid).status_code,200)
                if i==0:self.assertEqual(self.act(0,'invite',code=self.own(1)['profile']['code'],index=1).status_code,409)
        self.assertEqual(len(self.own(0)['bingo']),9);self.assertEqual(self.public()['bingoCompleted'],1)
    def test_team_distinct_confirmations(self):
        self.create('team')
        group=self.own(0)['profile']['group'];other=next(i for i in range(1,4) if self.own(i)['profile']['group']==group)
        self.act(0,'task',index=0);self.act(0,'task',index=0)
        self.assertFalse(self.public()['groups'][group]['tasks'][0])
        self.act(other,'task',index=0);self.assertTrue(self.public()['groups'][group]['tasks'][0])
    def test_truth_moderation_and_hidden_lie(self):
        self.create('truth');self.act(0,'post',statements=['喜欢露营','养了猫','登上月球'],choice=2)
        post=self.own(0)['posts'][0];self.assertEqual(self.public()['posts'],[])
        self.assertNotIn('lie',self.admin()['posts'][0])
        self.cmd('approve',id=post['id']);self.assertNotIn('lie',self.public()['posts'][0])
        self.assertEqual(self.act(0,'guess',id=post['id'],choice=2).status_code,409)
        self.assertEqual(self.act(1,'guess',id=post['id'],choice=2).status_code,200)
        self.assertEqual(self.act(1,'guess',id=post['id'],choice=1).status_code,409)
        self.assertEqual(self.cmd('reveal').status_code,409);self.cmd('close');self.cmd('reveal')
        self.assertEqual(self.public()['posts'][0]['lie'],2)
    def test_story_actual_turn_and_praise_ack(self):
        self.create('story')
        first=next(i for i in range(4) if self.own(i)['myTurn']);group=self.own(first)['profile']['group']
        other=next(i for i in range(4) if i!=first and self.own(i)['profile']['group']==group)
        self.assertEqual(self.act(other,'post',text='抢先').status_code,409)
        self.act(first,'post',text='我们走进森林');p=self.own(first)['posts'][0]
        self.assertEqual(self.act(first,'post',text='重复').status_code,409)
        self.cmd('approve',id=p['id']);self.assertTrue(self.own(other)['myTurn'])
        self.act(other,'post',text='发现一座城堡');self.cmd('approve',id=self.own(other)['posts'][0]['id'])
        self.assertEqual(len(self.public()['posts']),2)
        self.create('praise');rid=self.invite(text='感谢你的耐心')
        self.assertEqual(self.cmd('approve',id=rid).status_code,409)
        self.act(1,'accept',id=rid);self.cmd('approve',id=rid);self.assertEqual(len(self.public()['posts']),1)
        self.act(1,'leave');self.assertEqual(self.public()['posts'],[])
    def test_authority_pause_and_withdraw(self):
        self.assertEqual(self.client.get(f'/rooms/{self.id}/social-admin',headers=self.players[0]).status_code,403)
        self.client.post(f'/rooms/{self.id}/command',headers=self.host,json={'action':'pause'})
        self.assertEqual(self.act(0,'invite',code=self.own(1)['profile']['code']).status_code,409)
        self.assertEqual(self.act(0,'leave').status_code,200);self.assertFalse(self.own(0)['profile']['active'])
