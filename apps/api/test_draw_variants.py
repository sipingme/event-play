import unittest
from unittest.mock import patch
from fastapi import HTTPException
from main import Config
import game_rules
import draw_interactions as rules

class DrawTests(unittest.TestCase):
    def room(self,variant):
        return dict(config=dict(mechanic='draw',drawVariant=variant,goal=10,winnerCount=1,prizeName='幸运奖'),state='running',players={'a':dict(id='a',name='甲',identity='a')},scores=[0,0])
    def test_all_draws_lock_and_reveal_does_not_redraw(self):
        for variant in ['list','wheel','egg','box','capsule','balloon','treasure','train']:
            room=self.room(variant);room['drawCharge']=10
            game_rules.draw(room);result=room['drawResult']
            game_rules.draw(room)
            self.assertEqual(result,room['drawResult'])
            if variant in ('egg','box'):
                rules.act(room,room['players']['a'],'reveal');rules.act(room,room['players']['a'],'reveal')
                self.assertEqual(room['drawRevealed'],['a'])
                with self.assertRaises(HTTPException):rules.act(room,dict(id='b'),'reveal')
            self.assertEqual(result,room['drawResult'])
    def test_treasure_gate_rate_pause_and_equal_candidates(self):
        room=self.room('treasure');player=room['players']['a']
        with self.assertRaises(HTTPException):game_rules.draw(room)
        with patch('draw_interactions.time.time',return_value=100):
            self.assertTrue(rules.act(room,player,'charge')['accepted'])
            self.assertFalse(rules.act(room,player,'charge')['accepted'])
        room['state']='paused'
        with self.assertRaises(HTTPException):rules.act(room,player,'charge')
        room.update(state='running',drawCharge=10)
        room['players']['b']=dict(id='b',name='乙',identity='b')
        game_rules.draw(room)
        self.assertEqual(set(room['drawResult']['candidates']),{'a','b'})
    def test_wishes_and_configuration(self):
        room=self.room('balloon');room['state']='waiting'
        rules.act(room,room['players']['a'],'wish',2)
        self.assertEqual(room['drawWishes']['a'],'一路生花')
        room['state']='running'
        with self.assertRaises(HTTPException):rules.act(room,room['players']['a'],'wish',0)
        with self.assertRaises(ValueError):Config(name='错配',mechanic='race',drawVariant='egg',theme='garden',duration=30,participants=10,teams='红队,蓝队')
