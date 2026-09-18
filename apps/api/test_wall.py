import base64
import io
import unittest
from PIL import Image
from fastapi.testclient import TestClient
from main import create_app
import wall_rules

class WallTests(unittest.TestCase):
    def setUp(self):
        self.app=create_app(':memory:');self.client=TestClient(self.app);self.client.__enter__()
        r=self.client.post('/rooms',json=dict(name='签到',mechanic='wall',wallVariant='avatars',theme='garden',duration=30,participants=10,teams='甲组,乙组')).json()
        self.id=r['room']['id'];self.host={'Authorization':'Bearer '+r['token']}
        p=self.client.post(f'/rooms/{self.id}/join',json=dict(name='来宾',team=0)).json()
        self.player={'Authorization':'Bearer '+p['token']};self.pid=p['playerId']
    def tearDown(self):self.client.__exit__(None,None,None)
    def game(self):return self.client.get(f'/rooms/{self.id}').json()['game']
    def act(self,**data):return self.client.post(f'/rooms/{self.id}/wall-action',headers=self.player,json=data)
    def admin(self,**data):return self.client.post(f'/rooms/{self.id}/wall-admin',headers=self.host,json=data)
    def test_shared_variants_profiles_and_star_idempotence(self):
        self.assertEqual(self.act(action='profile',avatar=3,city='上海').status_code,200)
        for variant in wall_rules.VARIANTS:
            self.assertEqual(self.admin(action='variant',variant=variant).status_code,200)
            self.assertEqual(self.game()['variant'],variant)
            self.assertEqual(len(self.game()['entries']),1)
        self.act(action='star');self.act(action='star')
        self.assertEqual(self.game()['stars'],[self.pid]);self.assertEqual(self.game()['cityCounts'],{'上海':1})
    def test_moderation_authority_hide_restore_and_delete(self):
        self.assertEqual(self.client.get(f'/rooms/{self.id}/wall-admin',headers=self.player).status_code,403)
        self.assertEqual(self.act(action='post',text='只在审批后出现').status_code,200)
        self.assertEqual(self.game()['posts'],[])
        post=self.client.get(f'/rooms/{self.id}/wall-admin',headers=self.host).json()['posts'][0]
        self.assertEqual(self.client.post(f'/rooms/{self.id}/wall-admin',headers=self.player,json=dict(action='approve',id=post['id'])).status_code,403)
        self.admin(action='approve',id=post['id']);self.assertEqual(len(self.game()['posts']),1)
        self.admin(action='pin',id=post['id']);self.assertTrue(self.game()['posts'][0]['pinned'])
        self.admin(action='clear');self.assertEqual(self.game()['posts'],[])
        self.admin(action='restore');self.assertEqual(len(self.game()['posts']),1)
        self.admin(action='hide',id=post['id']);self.assertEqual(self.game()['posts'],[])
        self.admin(action='delete',id=post['id']);self.assertEqual(self.client.get(f'/rooms/{self.id}/wall-admin',headers=self.host).json()['posts'],[])
    def test_photo_sanitized_and_only_public_when_approved(self):
        out=io.BytesIO();Image.new('RGB',(32,32),'red').save(out,format='PNG')
        self.assertEqual(self.act(action='post',photo='data:image/png;base64,'+base64.b64encode(out.getvalue()).decode()).status_code,200)
        post=self.client.get(f'/rooms/{self.id}/wall-admin',headers=self.host).json()['posts'][0]
        url=f"/rooms/{self.id}/wall-photo/{post['id']}"
        self.assertEqual(self.client.get(url).status_code,404)
        self.admin(action='approve',id=post['id']);self.assertEqual(self.game()['posts'][0]['photo'],url)
        response=self.client.get(url);self.assertEqual(response.headers['content-type'],'image/jpeg');self.assertEqual(response.status_code,200)
        self.admin(action='hide',id=post['id']);self.assertEqual(self.client.get(url).status_code,404)
    def test_running_join_pause_and_bad_upload(self):
        self.assertEqual(self.act(action='post',photo='data:image/png;base64,bad').status_code,422)
        self.client.post(f'/rooms/{self.id}/command',headers=self.host,json={'action':'start'})
        self.assertEqual(self.client.post(f'/rooms/{self.id}/join',json=dict(name='迟到来宾',team=1)).status_code,200)
        self.client.post(f'/rooms/{self.id}/command',headers=self.host,json={'action':'pause'})
        self.assertEqual(self.act(action='star').status_code,409)
        self.client.post(f'/rooms/{self.id}/command',headers=self.host,json={'action':'finish'})
        self.assertEqual(self.act(action='profile').status_code,409)
