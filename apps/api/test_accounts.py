import tempfile
import unittest
from fastapi.testclient import TestClient
from main import create_app

CONFIG = dict(name='我的品牌赛马', mechanic='race', inputMode='shake', raceVariant='horse',
              theme='garden', duration=60, participants=100, teams='销售部,研发部', brand='品牌 A')
PASSWORD = 'Only-For-Local-Tests-2026'


class AccountTests(unittest.TestCase):
    def setUp(self):
        self.folder = tempfile.TemporaryDirectory()
        self.path = self.folder.name + '/test.sqlite3'
        self.app = create_app(self.path)
        self.client = TestClient(self.app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.folder.cleanup()

    def register(self, email='one@example.test'):
        response = self.client.post('/accounts/register', json=dict(email=email, password=PASSWORD))
        self.assertEqual(response.status_code, 200, response.text)
        value = response.json()
        return value, {'Authorization': 'Bearer ' + value['token']}

    def test_registration_login_workspace_and_password_storage(self):
        first, headers = self.register(' ONE@example.test ')
        self.assertEqual(first['user']['email'], 'one@example.test')
        self.assertEqual(self.client.get('/activities', headers=headers).json(), [])
        login = self.client.post('/accounts/login', json=dict(email='one@example.test', password=PASSWORD)).json()
        self.assertEqual(first['user']['workspace'], login['user']['workspace'])
        self.assertNotEqual(first['token'], login['token'])
        db = self.app.state.engine.db
        encoded = db.execute('SELECT password FROM accounts').fetchone()[0]
        self.assertNotIn(PASSWORD, encoded)
        hashes = str(db.execute('SELECT hash FROM account_sessions').fetchall())
        self.assertNotIn(first['token'], hashes)
        duplicate = self.client.post('/accounts/register', json=dict(email='ONE@example.test', password=PASSWORD))
        self.assertEqual(duplicate.status_code, 409)

    def test_two_users_cannot_access_or_mutate_each_others_work(self):
        _, a = self.register()
        _, b = self.register('two@example.test')
        item = self.client.post('/activities', json={'config': CONFIG}, headers=a).json()
        aid = item['id']
        self.assertEqual(self.client.get('/activities', headers=b).json(), [])
        for route, body in [('save', {'config': CONFIG, 'revision': 1}), ('publish', {'revision': 1}),
                            ('archive', {'revision': 1}), ('enter', {})]:
            self.assertEqual(self.client.post(f'/activities/{aid}/{route}', json=body, headers=b).status_code, 404)
        self.client.post(f'/activities/{aid}/publish', json={'revision': 1}, headers=a)
        room = self.client.post(f'/activities/{aid}/enter', json={}, headers=a).json()['room']
        self.assertEqual(self.client.post(f'/rooms/{room["id"]}/takeover', json={}, headers=b).status_code, 404)
        self.assertEqual(self.client.get('/managed-rooms', headers=b).json(), [])
        agenda = self.client.post('/agendas', json={'name': '专属活动', 'activityIds': [aid]}, headers=a)
        self.assertEqual(agenda.status_code, 200, agenda.text)
        for command in ['host', 'next']:
            response = self.client.post(f'/agendas/{agenda.json()["id"]}/{command}', json={'index': 0}, headers=b)
            self.assertEqual(response.status_code, 404)

    def test_draft_publish_round_snapshots_and_trial_isolation(self):
        _, headers = self.register()
        item = self.client.post('/activities', json={'config': CONFIG}, headers=headers).json()
        aid = item['id']
        self.assertEqual(self.client.post(f'/activities/{aid}/enter', json={}, headers=headers).status_code, 409)
        release = self.client.post(f'/activities/{aid}/publish', json={'revision': 1}, headers=headers).json()
        created = self.client.post(f'/activities/{aid}/enter', json={}, headers=headers).json()
        rid = created['room']['id']
        host = {'Authorization': 'Bearer ' + created['token']}
        self.client.post(f'/rooms/{rid}/command', json={'action': 'start'}, headers=host)
        saved = self.client.post(f'/activities/{aid}/save', json={'revision': release['revision'], 'config': {**CONFIG, 'name': '新版赛马'}}, headers=headers).json()
        self.assertEqual(saved['release']['config']['name'], CONFIG['name'])
        self.client.post(f'/activities/{aid}/publish', json={'revision': saved['revision']}, headers=headers)
        self.assertEqual(self.client.get(f'/rooms/{rid}').json()['config']['name'], CONFIG['name'])
        trial = self.client.post('/trials', json=CONFIG).json()['room']
        self.assertTrue(trial['trial'])
        self.assertEqual(len(self.client.get('/managed-rooms', headers=headers).json()), 1)
        self.client.post(f'/rooms/{rid}/command', json={'action': 'abort'}, headers=host)
        next_room = self.client.post(f'/activities/{aid}/enter', json={}, headers=headers).json()['room']
        self.assertNotEqual(rid, next_room['id'])
        self.assertEqual(next_room['config']['name'], '新版赛马')

    def test_brand_is_private_and_survives_another_login(self):
        _, a = self.register()
        _, b = self.register('two@example.test')
        brand = dict(name='只有 A 的品牌', color='#123456', logo='')
        self.assertEqual(self.client.post('/accounts/brand', json=brand, headers=a).status_code, 200)
        self.assertEqual(self.client.get('/accounts/brand', headers=b).json()['name'], '')
        second = self.client.post('/accounts/login', json=dict(email='one@example.test', password=PASSWORD)).json()
        self.assertEqual(self.client.get('/accounts/brand', headers={'Authorization': 'Bearer ' + second['token']}).json(), brand)
        self.assertEqual(self.client.post('/accounts/brand', json={**brand, 'logo': 'data:image/svg+xml;base64,abc'}, headers=a).status_code, 422)

    def test_logout_and_expiration_do_not_fall_back_to_legacy(self):
        value, headers = self.register()
        self.client.post('/accounts/logout', headers=headers)
        self.assertEqual(self.client.get('/accounts/me', headers=headers).status_code, 401)
        self.assertEqual(self.client.get('/activities', headers=headers).status_code, 401)
        self.assertEqual(self.client.get('/accounts/me').status_code, 401)
        _, other = self.register('other@example.test')
        self.app.state.engine.db.execute('UPDATE account_sessions SET expires=0')
        self.app.state.engine.db.commit()
        self.assertEqual(self.client.get('/activities', headers=other).status_code, 401)

    def test_password_change_revokes_all_old_device_sessions(self):
        _, headers = self.register()
        second = self.client.post('/accounts/login', json=dict(email='one@example.test', password=PASSWORD)).json()
        bad = self.client.post('/accounts/password', json=dict(currentPassword='wrong', password=PASSWORD + '-new'), headers=headers)
        self.assertEqual(bad.status_code, 400)
        changed = self.client.post('/accounts/password', json=dict(currentPassword=PASSWORD, password=PASSWORD + '-new'), headers=headers)
        self.assertEqual(changed.status_code, 200)
        for auth in [headers, {'Authorization': 'Bearer ' + second['token']}]:
            self.assertEqual(self.client.get('/accounts/me', headers=auth).status_code, 401)
        self.assertEqual(self.client.get('/accounts/me', headers={'Authorization': 'Bearer ' + changed.json()['token']}).status_code, 200)

    def test_legacy_workspace_is_not_implicitly_claimed(self):
        token = self.client.post('/workspaces').json()['token']
        legacy = {'Authorization': 'Bearer ' + token}
        self.client.post('/activities', json={'config': CONFIG}, headers=legacy)
        _, account = self.register()
        self.assertEqual(self.client.get('/activities', headers=account).json(), [])
        self.assertEqual(len(self.client.get('/activities', headers=legacy).json()), 1)
        self.assertEqual(self.client.get('/accounts/me', headers=legacy).status_code, 401)

    def test_validation_and_rate_limit(self):
        for email, password in [('invalid', PASSWORD), ('one@example.test', 'short')]:
            self.assertEqual(self.client.post('/accounts/register', json=dict(email=email, password=password)).status_code, 422)
        for _ in range(15):
            self.assertEqual(self.client.post('/accounts/login', json=dict(email='missing@example.test', password=PASSWORD)).status_code, 401)
        self.assertEqual(self.client.post('/accounts/login', json=dict(email='missing@example.test', password=PASSWORD)).status_code, 429)

    def test_account_and_draft_survive_restart(self):
        _, headers = self.register()
        self.client.post('/activities', json={'config': CONFIG}, headers=headers)
        self.client.__exit__(None, None, None)
        self.app = create_app(self.path)
        self.client = TestClient(self.app)
        self.client.__enter__()
        self.assertEqual(self.client.get('/accounts/me', headers=headers).status_code, 200)
        self.assertEqual(len(self.client.get('/activities', headers=headers).json()), 1)


if __name__ == '__main__':
    unittest.main()
