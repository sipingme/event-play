import unittest
from unittest.mock import patch
from fastapi import HTTPException
from main import Config, CoordinationAction
import coordination as rules

class CoordinationTests(unittest.TestCase):
    def room(self, variant):
        return dict(config=dict(mechanic='reaction',reactionVariant=variant),state='running',deadline=100,scores=[0,0]),dict(score=0,team=0)

    def test_timing_scores_replay_and_pause(self):
        for variant in rules.TIMED:
            room,player=self.room(variant)
            with patch('coordination.time.time',return_value=100): c=rules.challenge(room,player)
            elapsed=c['target']*30
            with patch('coordination.time.time',return_value=100+elapsed/1000):
                result=rules.act(room,player,CoordinationAction(token=c['token'],elapsed=elapsed))
                self.assertGreater(result['points'],0)
                with self.assertRaises(HTTPException): rules.act(room,player,CoordinationAction(token=c['token'],elapsed=elapsed))
            room['state']='paused'
            with self.assertRaises(HTTPException):rules.challenge(room,player)

    def test_invalid_time_and_resumed_ticket(self):
        room,player=self.room('basket')
        with patch('coordination.time.time',return_value=100):c=rules.challenge(room,player)
        with patch('coordination.time.time',return_value=104):
            with self.assertRaises(HTTPException):rules.act(room,player,CoordinationAction(token=c['token'],elapsed=100))
        room['deadline']=101
        with self.assertRaises(HTTPException):rules.act(room,player,CoordinationAction(token=c['token']))
        self.assertEqual(player['score'],0)

    def test_fruit_geometry_and_bomb(self):
        for bomb in [False,True]:
            room,player=self.room('fruit');c=rules.challenge(room,player)
            player['challenge'].update(x=50,y=50)
            result=rules.act(room,player,CoordinationAction(token=c['token'],x1=0 if bomb else 30,y1=50,x2=70,y2=50))
            self.assertEqual(result['points'],0 if bomb else 1)

    def test_chef_order(self):
        room,player=self.room('chef')
        with patch('coordination.time.time',return_value=100):c=rules.challenge(room,player)
        with patch('coordination.time.time',return_value=101):
            for cell in c['sequence']:result=rules.act(room,player,CoordinationAction(token=c['token'],cell=cell))
        self.assertTrue(result['done']);self.assertEqual(player['score'],3)

    def test_memory_preview_match_and_replay(self):
        room,player=self.room('memory')
        with patch('coordination.time.time',return_value=100):c=rules.challenge(room,player)
        with patch('coordination.time.time',return_value=101):
            with self.assertRaises(HTTPException):rules.act(room,player,CoordinationAction(token=c['token'],cell=0))
        clock=103
        for value in range(3):
            for cell in [i for i,v in enumerate(c['board']) if v==value]:
                with patch('coordination.time.time',return_value=clock):result=rules.act(room,player,CoordinationAction(token=c['token'],cell=cell))
                clock+=.3
        self.assertTrue(result['done']);self.assertEqual(player['score'],3)

    def test_config(self):
        for variant in rules.VARIANTS:
            self.assertEqual(Config(name='测试',mechanic='reaction',reactionVariant=variant,theme='garden',duration=30,participants=10,teams='红队,蓝队').reactionVariant,variant)

if __name__=='__main__':unittest.main()
