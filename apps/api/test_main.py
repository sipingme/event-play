import tempfile
import unittest
from fastapi.testclient import TestClient
from main import create_app

CONFIG = dict(name='测试赛马', mechanic='race', theme='gold', duration=30, participants=10, teams='红队,蓝队')


class RealtimeTests(unittest.TestCase):
    def setUp(self):
        self.app = create_app(':memory:')
        self.client = TestClient(self.app)
        self.client.__enter__()
        created = self.client.post('/rooms', json=CONFIG).json()
        self.rid = created['room']['id']
        self.host = {'Authorization': 'Bearer ' + created['token']}

    def tearDown(self):
        self.client.__exit__(None, None, None)

    def join(self, team=0):
        result = self.client.post(f'/rooms/{self.rid}/join', json={'name': '测试玩家', 'team': team}).json()
        return {'Authorization': 'Bearer ' + result['token']}

    def command(self, action):
        return self.client.post(f'/rooms/{self.rid}/command', json={'action': action}, headers=self.host)

    def tap(self, player, seq):
        return self.client.post(f'/rooms/{self.rid}/tap', json={'seq': seq}, headers=player).json()

    def test_authorization_and_snapshot(self):
        player = self.join()
        self.assertEqual(self.client.post(f'/rooms/{self.rid}/command', json={'action': 'start'}, headers=player).status_code, 403)
        state = self.client.get(f'/rooms/{self.rid}').json()
        self.assertNotIn('owner', state)
        self.assertNotIn('token', str(state))
        with self.client.websocket_connect(f'/rooms/{self.rid}/stream') as ws:
            self.assertEqual(ws.receive_json()['id'], self.rid)

    def test_phase_dedupe_pause_and_end(self):
        p1, p2 = self.join(0), self.join(1)
        self.assertFalse(self.tap(p1, 1)['accepted'])
        self.assertEqual(self.command('start').status_code, 200)
        self.assertTrue(self.tap(p1, 2)['accepted'])
        self.assertFalse(self.tap(p1, 2)['accepted'])
        self.assertTrue(self.tap(p2, 1)['accepted'])
        self.assertEqual(self.command('pause').json()['scores'], [1, 1])
        self.assertFalse(self.tap(p1, 3)['accepted'])
        self.assertEqual(self.command('resume').status_code, 200)
        self.assertTrue(self.tap(p1, 4)['accepted'])
        self.assertEqual(self.command('finish').json()['scores'], [2, 1])
        self.assertFalse(self.tap(p1, 5)['accepted'])
        self.assertEqual(self.command('resume').status_code, 409)

    def test_limits_and_validation(self):
        self.assertEqual(self.client.post('/rooms', json={**CONFIG, 'duration': 0}).status_code, 422)
        self.assertEqual(self.client.post(f'/rooms/{self.rid}/join', json={'name': 'P', 'team': 3}).status_code, 422)
        self.assertEqual(self.command('start').status_code, 409)
        p = self.join()
        self.command('start')
        self.assertEqual(self.client.post(f'/rooms/{self.rid}/join', json={'name': 'Late', 'team': 0}).status_code, 409)
        accepted = sum(self.tap(p, i)['accepted'] for i in range(1, 31))
        self.assertLess(accepted, 30)

    def test_deadline_and_restart_persistence(self):
        p = self.join()
        self.command('start')
        self.tap(p, 1)
        self.app.state.engine.rooms[self.rid]['deadline'] = 0
        state = self.client.get(f'/rooms/{self.rid}').json()
        self.assertEqual(state['state'], 'completed')
        self.assertFalse(self.tap(p, 2)['accepted'])
        with tempfile.TemporaryDirectory() as folder:
            path = folder + '/test.sqlite3'
            with TestClient(create_app(path)) as client:
                created = client.post('/rooms', json=CONFIG).json()
            with TestClient(create_app(path)) as client:
                self.assertEqual(client.get('/rooms/' + created['room']['id']).status_code, 200)


if __name__ == '__main__':
    unittest.main()
