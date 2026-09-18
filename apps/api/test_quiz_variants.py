import unittest
from fastapi import HTTPException
from main import Config
import game_rules as rules

class QuizVariantTests(unittest.TestCase):
    def room(self, variant='adventure', text='题目|对|错|三|四|A'):
        room = dict(config=dict(mechanic='quiz', quizVariant=variant, quizText=text, duration=30), remaining=30, state='running', scores=[0,0], players={})
        p = dict(id='one', score=0, team=0)
        room['players']['one']=p
        rules.initialize(room)
        return room,p

    def test_variants_grade_once_and_no_early_reveal(self):
        for variant in ['adventure','boolean','race','picture','tower','boss']:
            room,p=self.room(variant)
            self.assertNotIn('correct',rules.public_game(room)['question'])
            rules.answer(room,p,0,0)
            self.assertEqual(p['score'],0)
            with self.assertRaises(HTTPException): rules.answer(room,p,0,0)
            room['remaining']=0
            rules.advance(room,final=True);rules.advance(room,final=True)
            self.assertEqual(p['score'],10)

    def test_buzzer_exclusive_pause_and_next_question(self):
        room,p=self.room('buzzer','题目|对|错|三|四|A\n下一题|对|错|三|四|A')
        other=dict(id='two',score=0,team=1)
        with self.assertRaises(HTTPException): rules.answer(room,p,0,0)
        rules.buzz(room,p,0)
        rules.buzz(room,p,0)
        with self.assertRaises(HTTPException): rules.buzz(room,other,0)
        with self.assertRaises(HTTPException): rules.answer(room,other,0,0)
        room['state']='paused'
        with self.assertRaises(HTTPException): rules.answer(room,p,0,0)
        room['state']='running'; rules.answer(room,p,0,1)
        room['remaining']=15; rules.advance(room)
        self.assertEqual(p['score'],0)
        self.assertIsNone(rules.public_game(room)['buzzer'])
        rules.buzz(room,other,1)

    def test_clues_server_stages_and_score(self):
        for elapsed,expected in [(0,30),(10,20),(20,10)]:
            room,p=self.room('clues','谜语|答案|错|三|四|A||第一~第二~第三')
            room['remaining']=30-elapsed
            public=rules.public_game(room)
            self.assertEqual(len(public['question']['clues']),elapsed//10+1)
            rules.answer(room,p,0,0)
            room['remaining']=0;rules.advance(room,True)
            self.assertEqual(p['score'],expected)

    def test_boolean_and_config_validation(self):
        room,p=self.room('boolean')
        self.assertEqual(rules.public_game(room)['question']['options'],['对','错'])
        with self.assertRaises(HTTPException):rules.answer(room,p,0,2)
        base=dict(name='测试',mechanic='quiz',theme='garden',duration=30,participants=10,teams='红队,蓝队')
        for variant in ['picture','clues','boolean']:
            with self.assertRaises(ValueError):Config(**base,quizVariant=variant)
        with self.assertRaises(ValueError):rules.parse_quiz('题|A|B|C|D|A|https://example.com/test.png')

if __name__=='__main__':unittest.main()
