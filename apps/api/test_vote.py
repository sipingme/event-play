import unittest
from fastapi.testclient import TestClient
from main import create_app,Config
import vote_rules

class VoteTests(unittest.TestCase):
    def setUp(self):
        self.app=create_app(':memory:');self.client=TestClient(self.app);self.client.__enter__();self.create()
    def tearDown(self):self.client.__exit__(None,None,None)
    def create(self,variant='poll',**extra):
        r=self.client.post('/rooms',json=dict(name='投票',mechanic='vote',voteVariant=variant,voteOptions='A\nB\nC\nD',theme='garden',duration=30,participants=10,teams='甲组,乙组',**extra)).json()
        self.id=r['room']['id'];self.host={'Authorization':'Bearer '+r['token']}
        p=self.client.post(f'/rooms/{self.id}/join',json={'name':'玩家','team':0}).json();self.player={'Authorization':'Bearer '+p['token']}
        p=self.client.post(f'/rooms/{self.id}/join',json={'name':'玩家二','team':1}).json();self.other={'Authorization':'Bearer '+p['token']}
        self.client.post(f'/rooms/{self.id}/command',headers=self.host,json={'action':'start'})
    def game(self):return self.client.get(f'/rooms/{self.id}').json()['game']
    def vote(self,choice=0,score=1,auth=None,round=None):return self.client.post(f'/rooms/{self.id}/ballot',headers=auth or self.player,json=dict(round=self.game()['round'] if round is None else round,choice=choice,score=score))
    def command(self,action):return self.client.post(f'/rooms/{self.id}/vote-command',headers=self.host,json={'action':action,'round':self.game()['round']})
    def finish_round(self):self.command('close');self.command('reveal')
    def test_one_vote_modify_and_stale_round(self):
        self.assertEqual(self.vote().status_code,200);self.assertEqual(self.vote(1).status_code,409)
        self.assertEqual(self.game()['voters'],1)
        self.finish_round();self.assertEqual(self.vote().status_code,409);self.command('next')
        self.assertEqual(self.vote(round=0).status_code,409);self.assertEqual(self.vote(1).status_code,200)
        self.create(voteChange=True);self.vote();self.vote(1)
        self.assertEqual([r['count'] for r in self.game()['results']],[0,1,0,0]);self.assertEqual(self.game()['voters'],1)
    def test_private_rating_average_and_no_empty_zero(self):
        self.create('score',voteLive=False)
        self.vote(0,3);self.vote(0,5,auth=self.other);self.vote(1,4)
        self.assertIsNone(self.game()['results']);self.command('close');self.assertIsNone(self.game()['results']);self.command('reveal')
        rows=self.game()['results'];self.assertEqual(rows[0],dict(label='A',count=2,total=8));self.assertEqual(rows[2]['count'],0)
        self.assertNotIn('ballots',self.game())
        own=self.client.get(f'/rooms/{self.id}/vote-self',headers=self.player).json();self.assertEqual(own['ballot'],{'0':3,'1':4})
    def test_host_authority_and_pause(self):
        self.assertEqual(self.client.post(f'/rooms/{self.id}/vote-command',headers=self.player,json={'action':'close','round':0}).status_code,403)
        self.client.post(f'/rooms/{self.id}/command',headers=self.host,json={'action':'pause'})
        self.assertEqual(self.vote().status_code,409)
    def test_story_tie_runoff_and_real_branch(self):
        self.create('story');self.vote(0);self.vote(1,auth=self.other);self.finish_round()
        self.assertEqual(self.command('next').status_code,409);self.assertEqual(self.command('runoff').status_code,200)
        self.vote(0);self.finish_round();self.command('next');self.assertIn('打造新产品',self.game()['title'])
        self.vote(1);self.finish_round();self.command('next');self.assertTrue(self.game()['finished']);self.assertIn('智慧未来',self.game()['title'])
    def test_bracket_to_champion(self):
        self.create('bracket')
        for choice in [0,1,1]:self.vote(choice);self.finish_round();self.assertEqual(self.command('next').status_code,200)
        self.assertTrue(self.game()['finished']);self.assertEqual(self.game()['options'],['D'])
        self.assertEqual(len(self.game()['history']),3)
    def test_graph_rejects_cycles_and_invalid_references(self):
        for graph in ['{"start":{"title":"t","choices":[{"label":"a","next":[]},{"label":"b","next":"start"}]}}','{"start":{"title":"t","choices":[{"label":"a","next":"start"},{"label":"b","next":"start"}]}}']:
            with self.assertRaises(ValueError):vote_rules.story(graph)
