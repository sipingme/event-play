import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import create_app,Engine
import create_rules

class CreationTests(unittest.TestCase):
    def setUp(self):
        self.app=create_app(':memory:');self.client=TestClient(self.app);self.client.__enter__();self.create()
    def tearDown(self):self.client.__exit__(None,None,None)
    def create(self,variant='puzzle'):
        r=self.client.post('/rooms',json=dict(name='共创',mechanic='create',createVariant=variant,theme='garden',duration=30,participants=10,teams='甲组,乙组')).json()
        self.id=r['room']['id'];self.host={'Authorization':'Bearer '+r['token']}
        p=self.client.post(f'/rooms/{self.id}/join',json={'name':'玩家','team':0}).json();self.player={'Authorization':'Bearer '+p['token']}
        self.client.post(f'/rooms/{self.id}/command',headers=self.host,json={'action':'start'})
    def act(self,action='submit',auth=None,**kw):return self.client.post(f'/rooms/{self.id}/create-action',headers=auth or self.player,json=dict(action=action,**kw))
    def cmd(self,action,**kw):return self.client.post(f'/rooms/{self.id}/create-admin',headers=self.host,json=dict(action=action,**kw))
    def public(self):return self.client.get(f'/rooms/{self.id}').json()['game']['creation']
    def own(self):return self.client.get(f'/rooms/{self.id}/create-self',headers=self.player).json()
    def test_puzzle_real_positions_leases_and_completion(self):
        a=self.act('claim').json();self.assertEqual(self.act('claim').json(),a)
        self.assertEqual(self.act('place',slot=(a['piece']+1)%16).status_code,422)
        self.assertEqual(self.act('place',slot=a['piece']).status_code,200)
        self.assertEqual(self.act('place',slot=a['piece']).status_code,409)
        for _ in range(15):
            a=self.act('claim').json();self.assertEqual(self.act('place',slot=a['piece']).status_code,200)
        self.assertEqual(len(self.public()['pieces']),16);self.assertEqual(self.act('claim').status_code,409)
    def test_puzzle_lease_expiration_and_exclusion(self):
        a=self.act('claim').json()
        p=self.client.post(f'/rooms/{self.id}/join',json={'name':'后来者','team':1}).json();other={'Authorization':'Bearer '+p['token']}
        b=self.act('claim',auth=other).json();self.assertNotEqual(a['piece'],b['piece'])
        with patch('create_rules.time.time',return_value=a['until']+1):
            self.assertEqual(self.act('place',slot=a['piece']).status_code,409)
            self.assertIsNone(self.own()['lease'])
    def test_tree_distinct_roles_and_duplicate_idempotence(self):
        self.create('tree');self.assertEqual(self.act('water').status_code,409)
        for a in ['seed','water','feed']:self.assertEqual(self.act(a).status_code,200);self.act(a)
        self.assertEqual(self.public()['tree'],dict(seed=1,water=1,feed=1));self.assertEqual(self.public()['treeStage'],3)
        p=self.client.post(f'/rooms/{self.id}/join',json={'name':'来宾二','team':1}).json()
        for a in ['seed','water','feed']:self.act(a,auth={'Authorization':'Bearer '+p['token']})
        self.assertEqual(self.public()['treeStage'],4)
    def test_moderation_revision_private_and_persistence(self):
        self.create('draw')
        strokes=[dict(color=2,points=[dict(x=100,y=100),dict(x=800,y=700)])]
        self.assertEqual(self.act(strokes=strokes,text='作品').status_code,200)
        self.assertEqual(self.public()['items'],[])
        item=self.own()['item'];self.cmd('approve',id=item['id'],revision=item['revision'])
        self.assertEqual(self.public()['items'][0]['strokes'],strokes)
        with patch('create_rules.time.time',return_value=create_rules.time.time()+2):self.act(strokes=strokes,text='新作品')
        self.assertEqual(self.public()['items'],[])
        self.assertEqual(self.cmd('approve',id=item['id'],revision=1).status_code,409)
        self.cmd('approve',id=item['id'],revision=2)
        with tempfile.TemporaryDirectory() as folder:
            filename=str(Path(folder)/'recovery.sqlite3')
            saved=Engine(filename);saved.save(self.app.state.engine.rooms[self.id]);saved.db.close()
            restored=Engine(filename)
            self.assertEqual(create_rules.public(restored.get(self.id))['creation']['items'][0]['text'],'新作品')
            self.assertEqual(restored.get(self.id)['state'],'paused')
            restored.db.close()
    def test_all_customized_variants_and_firework_lock(self):
        for v in ('map','stars','city','flowers','scroll','fireworks'):
            with self.subTest(variant=v):
                self.create(v);self.assertEqual(self.act(color=4,shape=2,city=3,text='祝福').status_code,200)
                item=self.own()['item'];self.assertEqual(item['color'],4)
                self.assertEqual(self.public()['items'],[])
                self.cmd('approve',id=item['id'],revision=1)
                self.assertEqual(len(self.public()['items']),1)
                if v=='fireworks':
                    self.assertEqual(self.cmd('launch').status_code,200);self.assertIsNotNone(self.public()['launchedAt'])
                    self.assertEqual(self.cmd('hide',id=item['id'],revision=1).status_code,409)
                    self.client.post(f'/rooms/{self.id}/command',headers=self.host,json={'action':'pause'})
                    first=self.public()['serverTime'];self.assertEqual(first,self.public()['serverTime'])
                    self.assertEqual(self.cmd('launch').status_code,409)
                    self.client.post(f'/rooms/{self.id}/command',headers=self.host,json={'action':'resume'})
                    self.assertGreaterEqual(self.public()['serverTime'],first)
                else:self.cmd('close')
                self.assertEqual(self.act().status_code,409)
    def test_authority_and_invalid_payload(self):
        self.create('draw')
        self.assertEqual(self.client.get(f'/rooms/{self.id}/create-admin',headers=self.player).status_code,403)
        self.assertEqual(self.act().status_code,422)
        self.assertEqual(self.act(strokes=[dict(color=0,points=[dict(x=1001,y=0)])]).status_code,422)
        self.client.post(f'/rooms/{self.id}/command',headers=self.host,json={'action':'pause'})
        self.assertEqual(self.act(text='pause').status_code,409)
