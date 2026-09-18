import unittest
import tempfile
from fastapi.testclient import TestClient
from pydantic import ValidationError
from storyboard import Storyboard


def fixture():
    return dict(version=1, nodes=[dict(id=kind, kind=kind, x=0, y=0, title=kind, seconds=3) for kind in ['gather', 'race', 'awards']], edges=[dict(source='gather', target='race'), dict(source='race', target='awards')])


class StoryboardTests(unittest.TestCase):
    def test_api_draft_publish_and_release_snapshot(self):
        from main import create_app
        with tempfile.TemporaryDirectory() as folder:
            with TestClient(create_app(folder + '/story.sqlite3')) as client:
                token = client.post('/workspaces', json={}).json()['token']
                headers = {'Authorization': 'Bearer ' + token}
                config = dict(name='故事板测试', mechanic='race', theme='garden', duration=60, participants=100, teams='红队,蓝队', brand='测试', storyboard=fixture(), raceBackdrop='night', raceHorse='purple')
                created = client.post('/activities', json={'config': config}, headers=headers)
                self.assertEqual(created.status_code, 200, created.text)
                item = created.json()
                self.assertEqual(item['storyboard']['nodes'][0]['title'], 'gather')
                released = client.post(f'/activities/{item["id"]}/publish', json={'revision': item['revision']}, headers=headers).json()
                self.assertEqual(released['release']['config']['raceBackdrop'], 'night')
                self.assertEqual(released['release']['config']['raceHorse'], 'purple')
                config['participationMode'] = 'individual'
                config['participants'] = 20
                config['storyboard']['edges'] = []
                saved = client.post(f'/activities/{item["id"]}/save', json={'config': config, 'revision': released['revision']}, headers=headers)
                self.assertEqual(saved.status_code, 200, saved.text)
                self.assertEqual(saved.json()['participationMode'], 'individual')
                self.assertEqual(saved.json()['release']['config']['participationMode'], 'team')
                self.assertEqual(len(saved.json()['release']['config']['storyboard']['edges']), 2)
                denied = client.post(f'/activities/{item["id"]}/publish', json={'revision': saved.json()['revision']}, headers=headers)
                self.assertEqual(denied.status_code, 422)

    def test_complete_and_serialization(self):
        board = Storyboard.model_validate(fixture())
        self.assertIsNone(board.publish_error())
        self.assertEqual(Storyboard.model_validate(board.model_dump()), board)

    def test_incomplete_draft_allowed_but_not_publish(self):
        data = fixture()
        data['edges'] = []
        self.assertIsNotNone(Storyboard.model_validate(data).publish_error())

    def test_missing_nodes_and_invalid_coordinates(self):
        data = fixture()
        data['edges'][0]['target'] = 'missing'
        with self.assertRaises(ValidationError):
            Storyboard.model_validate(data)
        data = fixture()
        data['nodes'][0]['x'] = float('nan')
        with self.assertRaises(ValidationError):
            Storyboard.model_validate(data)

    def test_branch_and_reverse_rejected(self):
        data = fixture()
        data['edges'].append(dict(source='gather', target='awards'))
        self.assertIsNotNone(Storyboard.model_validate(data).publish_error())
        data = fixture()
        data['edges'] = [dict(source='awards', target='race')]
        self.assertIsNotNone(Storyboard.model_validate(data).publish_error())
