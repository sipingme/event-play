import unittest
from unittest.mock import patch
from fastapi import HTTPException
from main import Config
import control_rules as rules

class ControlTests(unittest.TestCase):
    def room(self,variant):
        room=dict(config=dict(controlVariant=variant,mechanic='catch',duration=60),remaining=60,state='running',scores=[0,0],players={})
        player=dict(score=0,seq=0,team=0,lane=1)
        room['players']['p']=player;rules.initialize(room)
        return room,player

    def test_all_config_and_wrong_mechanic(self):
        for variant in rules.VARIANTS:
            self.assertEqual(Config(name='测试',mechanic='catch',controlVariant=variant,theme='garden',duration=30,participants=10,teams='红队,蓝队').controlVariant,variant)
        with self.assertRaises(ValueError):Config(name='错配',mechanic='race',controlVariant='maze',theme='garden',duration=30,participants=10,teams='红队,蓝队')

    def test_lane_scores_once_and_penalty_floor(self):
        for variant in ['coins','runner','space','ski','boat']:
            room,p=self.room(variant);room['controlWaves'][0]=dict(lane=1,kind='coin');room['remaining']=58
            rules.advance(room);expected=1 if variant=='coins' else 2
            self.assertEqual(p['score'],expected);rules.advance(room);self.assertEqual(p['score'],expected)
            room['controlWaves'][1]=dict(lane=1 if variant=='coins' else 0,kind='bomb');room['remaining']=56
            rules.advance(room);self.assertEqual(p['score'],expected-1)

    def test_input_dedupe_pause_invalid_and_rate(self):
        room,p=self.room('boat')
        with patch('control_rules.time.time',return_value=100):
            self.assertTrue(rules.act(room,p,1,'left')['accepted'])
            self.assertFalse(rules.act(room,p,1,'right')['accepted'])
            self.assertFalse(rules.act(room,p,2,'right')['accepted'])
        with self.assertRaises(HTTPException):rules.act(room,p,3,'up')
        room['state']='paused'
        with self.assertRaises(HTTPException):rules.act(room,p,3,'left')

    def test_runner_jump_protects_only_one_wave(self):
        room,p=self.room('runner');room['controlWaves'][0]=dict(lane=0,kind='coin')
        rules.act(room,p,1,'jump');room['remaining']=58;rules.advance(room)
        self.assertEqual(p['score'],1)
        p['lastControl']=0
        self.assertFalse(rules.act(room,p,2,'jump')['accepted'])

    def drive(self,room,p,directions):
        for direction in directions:
            p['lastControl']=0;rules.act(room,p,p['seq']+1,direction)

    def test_maze_key_required_and_path(self):
        room,p=self.room('maze')
        self.drive(room,p,['up']*4+['right']*4)
        self.assertEqual(p['score'],0)
        self.drive(room,p,['down']*4+['up']*4)
        self.assertEqual(p['score'],5);self.assertEqual(p['control']['completed'],1)

    def test_parking_heading_required_and_collision(self):
        room,p=self.room('parking')
        self.drive(room,p,['forward']*4+['right']+['forward']*4)
        self.assertEqual(p['score'],0)
        # Leave and re-enter facing north.
        self.drive(room,p,['right','forward','right','right','forward'])
        self.assertEqual(p['score'],5)

    def test_ball_inertia_brake_and_goal(self):
        room,p=self.room('balance')
        self.drive(room,p,['right','right']);self.assertEqual(p['control']['x'],3)
        self.drive(room,p,['brake','right']);self.assertEqual(p['control']['x'],4)
        self.drive(room,p,['up','up','brake','up']);self.assertEqual(p['score'],5)
        self.drive(room,p,['up','right']);self.assertEqual((p['control']['x'],p['control']['y']),(0,4))
        self.assertEqual(p['score'],4)

if __name__=='__main__':unittest.main()
