import tempfile
import unittest
import time
from fastapi.testclient import TestClient
from main import create_app

CONFIG = dict(name='测试赛马', mechanic='race', theme='gold', duration=30, participants=10, teams='红队,蓝队')


class RealtimeTests(unittest.TestCase):
    def test_reaction_hit_once_wrong_stale_pause_and_auth(self):
        created = self.client.post('/rooms', json={**CONFIG, 'mechanic': 'reaction'}).json()
        rid = created['room']['id']
        host = {'Authorization': 'Bearer ' + created['token']}
        p = self.client.post(f'/rooms/{rid}/join', json={'name':'Player','team':0}).json()
        auth = {'Authorization':'Bearer '+p['token']}
        def hit(index, cell, headers=auth):
            return self.client.post(f'/rooms/{rid}/hit', json={'index':index,'cell':cell}, headers=headers)
        self.assertEqual(hit(0, 0).status_code, 409)
        self.client.post(f'/rooms/{rid}/command', json={'action':'start'}, headers=host)
        state = self.client.get(f'/rooms/{rid}').json()
        self.assertNotIn('targets', state)
        self.assertEqual(hit(0,state['game']['cell'],{}).status_code,403)
        self.assertTrue(hit(0,state['game']['cell']).json()['accepted'])
        self.assertEqual(hit(0,state['game']['cell']).status_code,409)
        raw=self.app.state.engine.rooms[rid]
        raw['deadline'] -= 2
        state=self.client.get(f'/rooms/{rid}').json()
        self.assertEqual(hit(0,0).status_code,409)
        self.assertFalse(hit(1,(state['game']['cell']+1)%9).json()['accepted'])
        self.assertEqual(hit(1,state['game']['cell']).status_code,409)
        self.assertEqual(self.client.get(f'/rooms/{rid}').json()['scores'],[1,0])
        self.client.post(f'/rooms/{rid}/command',json={'action':'pause'},headers=host)
        self.assertEqual(hit(1,0).status_code,409)
        self.assertEqual(self.client.post(f'/rooms/{rid}/tap',json={'seq':1},headers=auth).status_code,422)

    def test_shake_and_fallback_share_sequence_and_score(self):
        created=self.client.post('/rooms',json={**CONFIG,'inputMode':'shake'}).json()
        rid=created['room']['id']
        p=self.client.post(f'/rooms/{rid}/join',json={'name':'Shake','team':0}).json()
        auth={'Authorization':'Bearer '+p['token']}
        self.client.post(f'/rooms/{rid}/command',json={'action':'start'},headers={'Authorization':'Bearer '+created['token']})
        for seq,kind in [(1,'shake'),(2,'tap')]:
            self.assertTrue(self.client.post(f'/rooms/{rid}/tap',json={'seq':seq,'kind':kind},headers=auth).json()['accepted'])
        self.assertFalse(self.client.post(f'/rooms/{rid}/tap',json={'seq':2,'kind':'shake'},headers=auth).json()['accepted'])
        self.assertEqual(self.client.get(f'/rooms/{rid}').json()['scores'],[2,0])
        other=self.join(); self.command('start')
        self.assertEqual(self.client.post(f'/rooms/{self.rid}/tap',json={'seq':1,'kind':'shake'},headers=other).status_code,422)

    def test_trials_are_isolated_expire_and_remain_trials_on_rematch(self):
        a=self.client.post('/trials',json={**CONFIG,'duration':120,'participants':200}).json()
        b=self.client.post('/trials',json=CONFIG).json()
        rid=a['room']['id']
        self.assertNotEqual(rid,b['room']['id'])
        self.assertTrue(a['room']['trial'])
        self.assertEqual(a['room']['config']['duration'],30)
        self.assertEqual(a['room']['config']['participants'],10)
        raw=self.app.state.engine.rooms[rid]
        self.assertNotIn('activityId',raw)
        raw['trialExpiresAt']=time.time()-1
        self.assertEqual(self.client.get(f'/rooms/{rid}').json()['state'],'aborted')
        self.assertEqual(self.client.get(f'/rooms/{b["room"]["id"]}').json()['state'],'waiting')
        self.assertTrue(self.client.post(f'/rooms/{rid}/rematch',headers={'Authorization':'Bearer '+a['token']}).json()['trial'])

    def test_player_and_screen_broadcast_projections(self):
        first=self.client.post(f'/rooms/{self.rid}/join',json={'name':'First','team':0}).json()
        self.join(1)
        with self.client.websocket_connect(f'/rooms/{self.rid}/stream?view=player') as ws:
            ws.send_json({'token':first['token']})
            state=ws.receive_json()
            self.assertEqual([p['id'] for p in state['players']],[first['playerId']])
            self.assertEqual(state['playerCount'],2)
            self.assertEqual(state['laneCounts'],[0,2,0])
            self.assertNotIn(first['token'],str(state))
        with self.client.websocket_connect(f'/rooms/{self.rid}/stream?view=screen') as ws:
            state=ws.receive_json()
            self.assertEqual(state['players'],[])
            self.assertEqual(state['playerCount'],2)
        from starlette.websockets import WebSocketDisconnect
        with self.assertRaises(WebSocketDisconnect):
            with self.client.websocket_connect(f'/rooms/{self.rid}/stream?view=player') as ws:
                ws.send_json({'token':'invalid'})
                ws.receive_json()

    def test_shared_broadcast_cache_converges_and_stays_public(self):
        player = self.join()
        with self.client.websocket_connect(f'/rooms/{self.rid}/stream') as first:
            with self.client.websocket_connect(f'/rooms/{self.rid}/stream') as second:
                self.assertEqual(first.receive_json()['scores'],[0,0])
                self.assertEqual(second.receive_json()['scores'],[0,0])
                self.command('start')
                self.tap(player,1)
                for socket in [first,second]:
                    latest=None
                    for _ in range(5):
                        latest=socket.receive_json()
                        if latest['scores']==[1,0]:
                            break
                    self.assertEqual(latest['scores'],[1,0])
                    self.assertNotIn('owner',latest)
                    self.assertNotIn(player['Authorization'],str(latest))

    def test_presence_auth_dedupe_expiry_and_no_secrets(self):
        player=self.join()
        path=f'/rooms/{self.rid}/presence'
        self.assertEqual(self.client.post(path,json={'role':'player'}).status_code,403)
        for _ in range(2):
            self.assertEqual(self.client.post(path,headers=player,json={'role':'player'}).status_code,200)
        self.client.post(path,json={'role':'screen','clientId':'display-1'})
        state=self.client.get(f'/rooms/{self.rid}').json()
        self.assertEqual(state['presence'],{'online':1,'offline':0,'screens':1})
        self.assertNotIn(player['Authorization'],str(state))
        for key in self.app.state.engine.presence[self.rid]:
            self.app.state.engine.presence[self.rid][key] -= 16
        self.assertEqual(self.client.get(f'/rooms/{self.rid}').json()['presence'],{'online':0,'offline':1,'screens':0})
        self.client.post(path,headers=player,json={'role':'player'})
        self.assertEqual(self.client.get(f'/rooms/{self.rid}').json()['presence']['online'],1)

    def test_screen_heartbeat_limit_does_not_block_player(self):
        path=f'/rooms/{self.rid}/presence'
        for i in range(20):
            self.assertEqual(self.client.post(path,json={'role':'screen','clientId':str(i)}).status_code,200)
        self.assertEqual(self.client.post(path,json={'role':'screen','clientId':'extra'}).status_code,429)
        self.assertEqual(self.client.post(path,headers=self.join(),json={'role':'player'}).status_code,200)

    def test_countdown_authority_cancel_and_scoring(self):
        player = self.join()
        self.assertEqual(self.client.post(f'/rooms/{self.rid}/command',headers=player,json={'action':'countdown'}).status_code,403)
        state = self.command('countdown').json()
        self.assertEqual(state['countdown'],3)
        self.assertEqual(state['state'],'waiting')
        self.assertFalse(self.tap(player,1)['accepted'])
        self.assertEqual(self.command('start').status_code,409)
        self.assertEqual(self.command('countdown').status_code,409)
        self.assertEqual(self.client.post(f'/rooms/{self.rid}/join',json={'name':'Late','team':0}).status_code,409)
        self.assertEqual(self.command('cancel_countdown').json()['countdown'],0)
        self.assertEqual(self.client.post(f'/rooms/{self.rid}/join',json={'name':'Ready','team':0}).status_code,200)
        self.command('countdown')
        self.app.state.engine.rooms[self.rid]['startsAt'] = time.time() - .1
        state = self.client.get(f'/rooms/{self.rid}').json()
        self.assertEqual(state['state'],'running')
        self.assertEqual(state['remaining'],30)
        self.assertTrue(self.tap(player,2)['accepted'])
        self.assertEqual(self.command('cancel_countdown').status_code,409)

    def test_countdown_abort_and_restart(self):
        self.join()
        self.command('countdown')
        self.command('abort')
        room = self.app.state.engine.rooms[self.rid]
        self.assertNotIn('startsAt',room)
        self.assertEqual(self.client.get(f'/rooms/{self.rid}').json()['state'],'aborted')
        with tempfile.TemporaryDirectory() as folder:
            path=folder+'/restart.sqlite3'
            with TestClient(create_app(path)) as client:
                created=client.post('/rooms',json=CONFIG).json()
                rid=created['room']['id']
                client.post(f'/rooms/{rid}/join',json={'name':'Tester','team':0})
                client.post(f'/rooms/{rid}/command',headers={'Authorization':'Bearer '+created['token']},json={'action':'countdown'})
            with TestClient(create_app(path)) as client:
                restored=client.get(f'/rooms/{rid}').json()
                self.assertEqual(restored['state'],'waiting')
                self.assertEqual(restored['countdown'],0)
                self.assertEqual(restored['remaining'],30)

    def test_public_event_fixed_entry_privacy_and_progress(self):
        headers = {'Authorization': 'Bearer ' + self.client.post('/workspaces').json()['token']}
        config = {**CONFIG, 'mechanic': 'quiz', 'quizText': '秘密题|一|二|三|四|D'}
        aid = self.client.post('/activities', headers=headers, json={'config': config}).json()['id']
        self.client.post(f'/activities/{aid}/publish', headers=headers, json={'revision': 1})
        agenda = self.client.post('/agendas', headers=headers, json={'name': '固定入口测试', 'activityIds': [aid, aid]}).json()
        path = '/events/' + agenda['id']
        initial = self.client.get(path).json()
        self.assertIsNone(initial['roomId'])
        self.assertEqual(initial['index'], -1)
        self.assertNotIn('秘密题', str(initial))
        self.assertNotIn('config', str(initial))
        self.assertNotIn(headers['Authorization'], str(initial))
        self.assertEqual(self.client.get('/events/not-existing').status_code, 404)
        previous = None
        for index in [0, 1]:
            opened = self.client.post(f"/agendas/{agenda['id']}/next", headers=headers, json={'index': index - 1}).json()
            current = self.client.get(path).json()
            self.assertEqual(current['roomId'], opened['room']['id'])
            self.assertNotEqual(previous, current['roomId'])
            self.assertEqual(current['index'], index)
            self.assertFalse(current['finished'])
            self.assertEqual(set(current), {'id', 'name', 'index', 'total', 'roomId', 'stepName', 'state', 'finished'})
            self.client.post(f"/rooms/{current['roomId']}/command", headers={'Authorization': 'Bearer ' + opened['token']}, json={'action': 'abort'})
            self.assertEqual(self.client.get(path).json()['finished'], index == 1)
            previous = current['roomId']

    def test_public_event_survives_restart(self):
        with tempfile.TemporaryDirectory() as folder:
            path = folder + '/event.sqlite3'
            with TestClient(create_app(path)) as client:
                headers = {'Authorization': 'Bearer ' + client.post('/workspaces').json()['token']}
                aid = client.post('/activities', headers=headers, json={'config': CONFIG}).json()['id']
                client.post(f'/activities/{aid}/publish', headers=headers, json={'revision': 1})
                agenda = client.post('/agendas', headers=headers, json={'name': '可恢复活动', 'activityIds': [aid]}).json()
                opened = client.post(f"/agendas/{agenda['id']}/next", headers=headers, json={'index': -1}).json()
            with TestClient(create_app(path)) as client:
                self.assertEqual(client.get(f"/events/{agenda['id']}").json()['roomId'], opened['room']['id'])

    def test_quiz_reveal_never_leaks_future_questions(self):
        rid, host, player = self.create_game('quiz')
        self.assertEqual(self.client.get(f'/rooms/{rid}').json()['game']['reveals'], [])
        self.client.post(f'/rooms/{rid}/command', headers=host, json={'action': 'start'})
        self.assertEqual(self.client.get(f'/rooms/{rid}').json()['game']['reveals'], [])
        finished = self.client.post(f'/rooms/{rid}/command', headers=host, json={'action': 'finish'}).json()
        self.assertEqual(len(finished['game']['reveals']), 1)
        self.assertEqual(finished['game']['reveals'][0]['correct'], 0)

    def test_catch_difficulty_timing(self):
        for difficulty, interval in [('easy', 3), ('normal', 2), ('hard', 1)]:
            rid, host, player = self.create_game('catch', catchDifficulty=difficulty)
            room = self.app.state.engine.rooms[rid]
            room['coinLanes'] = [1] * (30 // interval)
            self.client.post(f'/rooms/{rid}/command', headers=host, json={'action':'start'})
            room['deadline'] = time.time() + 30 - interval
            public = self.client.get(f'/rooms/{rid}').json()
            self.assertEqual(public['scores'], [1, 0])
            self.assertEqual(public['game']['interval'], interval)
        self.assertEqual(self.client.post('/rooms', json={**CONFIG,'catchDifficulty':'invalid'}).status_code,422)

    def test_draw_series_guest_identity_not_nickname(self):
        created = self.client.post('/rooms', json={**CONFIG,'mechanic':'draw','prizeName':'纪念奖'}).json()
        rid = created['room']['id']
        host = {'Authorization':'Bearer '+created['token']}
        first = self.client.post(f'/rooms/{rid}/join', json={'name':'同名','team':0}).json()
        duplicate = self.client.post(f'/rooms/{rid}/join', json={'name':'改名','team':1,'guestToken':first['guestToken']}).json()
        self.assertEqual(first['playerId'],duplicate['playerId'])
        self.assertEqual(len(self.client.get(f'/rooms/{rid}').json()['players']),1)
        self.client.post(f'/rooms/{rid}/command',headers=host,json={'action':'start'})
        result = self.client.post(f'/rooms/{rid}/command',headers=host,json={'action':'draw'}).json()
        self.assertEqual(result['game']['result']['prizeName'],'纪念奖')
        next_id = self.client.post(f'/rooms/{rid}/rematch',headers=host).json()['id']
        self.client.post(f'/rooms/{next_id}/join',json={'name':'不同名','team':0,'guestToken':first['guestToken']})
        second = self.client.post(f'/rooms/{next_id}/join',json={'name':'同名','team':1}).json()
        self.client.post(f'/rooms/{next_id}/command',headers=host,json={'action':'start'})
        won = self.client.post(f'/rooms/{next_id}/command',headers=host,json={'action':'draw'}).json()
        self.assertEqual(won['game']['result']['winners'][0]['id'],second['playerId'])
        self.assertNotIn(first['guestToken'],str(won))
        self.assertNotIn('winnerIdentities',won)

    def test_agenda_authorization_order_snapshot_and_takeover(self):
        headers = {'Authorization':'Bearer '+self.client.post('/workspaces').json()['token']}
        other = {'Authorization':'Bearer '+self.client.post('/workspaces').json()['token']}
        activity = self.client.post('/activities',headers=headers,json={'config':CONFIG}).json()
        aid = activity['id']
        self.client.post(f'/activities/{aid}/publish',headers=headers,json={'revision':1})
        agenda = self.client.post('/agendas',headers=headers,json={'name':'年会','activityIds':[aid,aid]}).json()
        agenda_id = agenda['id']
        self.assertNotIn('config',str(agenda))
        self.assertEqual(self.client.get('/agendas',headers=other).json(),[])
        self.assertEqual(self.client.post(f'/agendas/{agenda_id}/next',headers=other,json={'index':-1}).status_code,404)
        self.client.post(f'/activities/{aid}/save',headers=headers,json={'config':{**CONFIG,'duration':60},'revision':2})
        first = self.client.post(f'/agendas/{agenda_id}/next',headers=headers,json={'index':-1}).json()
        rid = first['room']['id']
        self.assertEqual(first['room']['config']['duration'],30)
        self.assertEqual(self.client.post(f'/agendas/{agenda_id}/next',headers=headers,json={'index':-1}).status_code,409)
        self.assertEqual(self.client.post(f'/agendas/{agenda_id}/next',headers=headers,json={'index':0}).status_code,409)
        takeover = self.client.post(f'/rooms/{rid}/takeover',headers=headers).json()
        self.assertEqual(self.client.get(f'/rooms/{rid}/owner',headers={'Authorization':'Bearer '+first['token']}).status_code,403)
        host = {'Authorization':'Bearer '+takeover['token']}
        self.client.post(f'/rooms/{rid}/command',headers=host,json={'action':'abort'})
        self.assertEqual(self.client.post(f'/rooms/{rid}/rematch',headers=host).status_code,409)
        second = self.client.post(f'/agendas/{agenda_id}/next',headers=headers,json={'index':0}).json()
        self.assertNotEqual(second['room']['id'],rid)
        self.assertEqual(self.app.state.engine.rooms[rid]['series'],self.app.state.engine.rooms[second['room']['id']]['series'])

    def create_game(self, mechanic, **options):
        created = self.client.post('/rooms', json={**CONFIG, 'mechanic': mechanic, **options}).json()
        rid = created['room']['id']
        host = {'Authorization': 'Bearer ' + created['token']}
        p = self.client.post(f'/rooms/{rid}/join', json={'name': 'GameTester', 'team': 0}).json()
        return rid, host, {'Authorization': 'Bearer ' + p['token']}

    def test_quiz_private_answers_and_server_grading(self):
        rid, host, player = self.create_game('quiz', quizText='1+1=?|2|3|4|5|A\n2+2=?|1|2|3|4|D')
        self.assertEqual(self.client.post(f'/rooms/{rid}/answer', headers=player, json={'index': 0, 'choice': 0}).status_code, 409)
        self.client.post(f'/rooms/{rid}/command', headers=host, json={'action': 'start'})
        state = self.client.get(f'/rooms/{rid}').json()
        self.assertNotIn('quizText', state['config'])
        self.assertNotIn('correct', str(state))
        self.assertEqual(state['game']['question']['text'], '1+1=?')
        self.assertEqual(self.client.post(f'/rooms/{rid}/answer', headers=player, json={'index': 1, 'choice': 3}).status_code, 409)
        self.assertEqual(self.client.post(f'/rooms/{rid}/answer', headers=player, json={'index': 0, 'choice': 0}).status_code, 200)
        self.assertEqual(self.client.post(f'/rooms/{rid}/answer', headers=player, json={'index': 0, 'choice': 0}).status_code, 409)
        self.assertEqual(self.client.get(f'/rooms/{rid}').json()['scores'], [0, 0])
        self.app.state.engine.rooms[rid]['deadline'] = time.time() + 14
        self.assertEqual(self.client.get(f'/rooms/{rid}').json()['scores'], [10, 0])
        self.assertEqual(self.client.post(f'/rooms/{rid}/answer', headers=player, json={'index': 0, 'choice': 0}).status_code, 409)
        self.client.post(f'/rooms/{rid}/answer', headers=player, json={'index': 1, 'choice': 3})
        finished = self.client.post(f'/rooms/{rid}/command', headers=host, json={'action': 'finish'}).json()
        self.assertEqual(finished['scores'], [20, 0])
        self.assertEqual(self.client.post(f'/rooms/{rid}/tap', headers=player, json={'seq': 99}).status_code, 422)
        self.assertEqual(self.client.post('/rooms', json={**CONFIG, 'mechanic': 'quiz', 'quizText': 'invalid'}).status_code, 422)

    def test_draw_is_authorized_unique_and_locked(self):
        rid, host, player = self.create_game('draw', winnerCount=2)
        self.assertEqual(self.client.post(f'/rooms/{rid}/command', headers=host, json={'action': 'start'}).status_code, 409)
        self.client.post(f'/rooms/{rid}/join', json={'name': 'Second', 'team': 1})
        self.client.post(f'/rooms/{rid}/command', headers=host, json={'action': 'start'})
        self.assertEqual(self.client.post(f'/rooms/{rid}/command', headers=player, json={'action': 'draw'}).status_code, 403)
        result = self.client.post(f'/rooms/{rid}/command', headers=host, json={'action': 'draw'}).json()
        repeated = self.client.post(f'/rooms/{rid}/command', headers=host, json={'action': 'draw'}).json()
        self.assertEqual(result['game']['result'], repeated['game']['result'])
        self.assertEqual(result['state'], 'completed')
        self.assertEqual(len({w['id'] for w in result['game']['result']['winners']}), 2)
        self.assertEqual(len(result['game']['result']['candidates']), 2)
        self.assertEqual(self.client.post(f'/rooms/{rid}/tap', headers=player, json={'seq': 1}).status_code, 422)

    def test_catch_server_collision_and_movement(self):
        rid, host, player = self.create_game('catch')
        room = self.app.state.engine.rooms[rid]
        room['coinLanes'][:2] = [0, 2]
        self.client.post(f'/rooms/{rid}/command', headers=host, json={'action': 'start'})
        moved = self.client.post(f'/rooms/{rid}/move', headers=player, json={'seq': 1, 'direction': 'left'}).json()
        self.assertEqual(moved['lane'], 0)
        self.assertFalse(self.client.post(f'/rooms/{rid}/move', headers=player, json={'seq': 1, 'direction': 'right'}).json()['accepted'])
        room['deadline'] = time.time() + 28
        self.assertEqual(self.client.get(f'/rooms/{rid}').json()['scores'], [1, 0])
        self.assertEqual(self.client.get(f'/rooms/{rid}').json()['scores'], [1, 0])
        room['deadline'] = time.time() + 26
        self.assertEqual(self.client.get(f'/rooms/{rid}').json()['scores'], [1, 0])
        self.client.post(f'/rooms/{rid}/command', headers=host, json={'action': 'pause'})
        self.assertEqual(self.client.post(f'/rooms/{rid}/move', headers=player, json={'seq': 2, 'direction': 'right'}).status_code, 409)
        self.assertEqual(self.client.post(f'/rooms/{rid}/tap', headers=player, json={'seq': 3}).status_code, 422)
        self.assertNotIn('coinLanes', self.client.get(f'/rooms/{rid}').json())
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

    def test_owner_recovery_verification(self):
        path = f'/rooms/{self.rid}/owner'
        before = self.client.get(f'/rooms/{self.rid}').json()
        self.assertEqual(self.client.get(path).status_code, 403)
        self.assertEqual(self.client.get(path, headers=self.join()).status_code, 403)
        self.assertEqual(self.client.get(path, headers={'Authorization': 'Bearer wrong'}).status_code, 403)
        self.assertEqual(self.client.get(path, headers=self.host).json(), {'verified': True})
        self.assertEqual(self.client.get(f'/rooms/{self.rid}').json()['state'], before['state'])

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

    def test_cloud_isolation_revision_import_and_rounds(self):
        key = self.client.post('/workspaces').json()['token']
        headers = {'Authorization': 'Bearer ' + key}
        other = {'Authorization': 'Bearer ' + self.client.post('/workspaces').json()['token']}
        self.assertEqual(self.client.get('/activities').status_code, 403)
        first = self.client.post('/activities', json={'config': CONFIG, 'sourceId': 'local-1'}, headers=headers).json()
        aid = first['id']
        duplicate = self.client.post('/activities', json={'config': {**CONFIG, 'name': 'Do not overwrite'}, 'sourceId': 'local-1'}, headers=headers).json()
        self.assertEqual(duplicate, first)
        self.assertEqual(self.client.get('/activities', headers=other).json(), [])
        self.assertEqual(self.client.post(f'/activities/{aid}/enter', headers=other).status_code, 404)
        self.assertEqual(self.client.post(f'/activities/{aid}/save', headers=other, json={'config': CONFIG, 'revision': 1}).status_code, 404)
        self.assertEqual(self.client.post(f'/activities/{aid}/enter', headers=headers).status_code, 409)
        published = self.client.post(f'/activities/{aid}/publish', headers=headers, json={'revision': 1}).json()
        self.assertEqual(published['revision'], 2)
        self.assertEqual(self.client.post(f'/activities/{aid}/save', headers=headers, json={'config': CONFIG, 'revision': 1}).status_code, 409)
        first_room = self.client.post(f'/activities/{aid}/enter', headers=headers).json()
        resumed = self.client.post(f'/activities/{aid}/enter', headers=headers).json()
        self.assertEqual(first_room['room']['id'], resumed['room']['id'])
        rid = resumed['room']['id']
        self.assertEqual(self.client.get(f'/rooms/{rid}/owner', headers={'Authorization': 'Bearer ' + first_room['token']}).status_code, 403)
        self.assertNotIn('workspace', resumed['room'])
        self.assertNotIn(key, str(resumed))
        self.assertEqual(self.client.post(f'/activities/{aid}/archive', headers=headers, json={'revision': 2}).status_code, 409)
        self.client.post(f'/activities/{aid}/save', headers=headers, json={'config': {**CONFIG, 'duration': 60}, 'revision': 2})
        self.client.post(f'/activities/{aid}/publish', headers=headers, json={'revision': 3})
        self.assertEqual(self.client.get(f'/rooms/{rid}').json()['config']['duration'], 30)
        self.client.post(f'/rooms/{rid}/command', headers={'Authorization': 'Bearer ' + resumed['token']}, json={'action': 'abort'})
        next_room = self.client.post(f'/activities/{aid}/enter', headers=headers).json()
        self.assertNotEqual(next_room['room']['id'], rid)
        self.assertEqual(next_room['room']['config']['duration'], 60)
        listed = self.client.get('/managed-rooms', headers=headers).json()
        self.assertEqual([r['round'] for r in listed], [2, 1])
        self.assertEqual(self.client.get('/managed-rooms', headers=other).json(), [])

    def test_money_input_and_pause(self):
        created = self.client.post('/rooms', json={**CONFIG, 'mechanic': 'money'}).json()
        rid = created['room']['id']
        host = {'Authorization': 'Bearer ' + created['token']}
        player = self.client.post(f'/rooms/{rid}/join', json={'name': 'Counter', 'team': 0}).json()
        headers = {'Authorization': 'Bearer ' + player['token']}
        self.client.post(f'/rooms/{rid}/command', json={'action': 'start'}, headers=host)
        self.assertEqual(self.client.post(f'/rooms/{rid}/tap', json={'seq': 1}, headers=headers).status_code, 422)
        body = {'seq': 1, 'kind': 'swipe'}
        self.assertTrue(self.client.post(f'/rooms/{rid}/tap', json=body, headers=headers).json()['accepted'])
        self.assertFalse(self.client.post(f'/rooms/{rid}/tap', json=body, headers=headers).json()['accepted'])
        self.client.post(f'/rooms/{rid}/command', json={'action': 'pause'}, headers=host)
        self.assertFalse(self.client.post(f'/rooms/{rid}/tap', json={'seq': 2, 'kind': 'swipe'}, headers=headers).json()['accepted'])
        self.assertEqual(self.client.get(f'/rooms/{rid}').json()['scores'], [1, 0])

    def test_cloud_survives_restart(self):
        with tempfile.TemporaryDirectory() as folder:
            path = folder + '/cloud.sqlite3'
            with TestClient(create_app(path)) as client:
                headers = {'Authorization': 'Bearer ' + client.post('/workspaces').json()['token']}
                item = client.post('/activities', headers=headers, json={'config': CONFIG}).json()
            with TestClient(create_app(path)) as client:
                self.assertEqual(client.get('/activities', headers=headers).json()[0]['id'], item['id'])

    def test_alternating_requires_opposite_accepted_side(self):
        created = self.client.post('/rooms', json={**CONFIG, 'mechanic': 'alternating'}).json()
        rid = created['room']['id']
        host = {'Authorization': 'Bearer ' + created['token']}
        p = self.client.post(f'/rooms/{rid}/join', json={'name': 'LeftRight', 'team': 0}).json()
        headers = {'Authorization': 'Bearer ' + p['token']}
        self.client.post(f'/rooms/{rid}/command', headers=host, json={'action': 'start'})
        def action(seq, kind):
            return self.client.post(f'/rooms/{rid}/tap', headers=headers, json={'seq': seq, 'kind': kind})
        self.assertEqual(action(1, 'tap').status_code, 422)
        self.assertTrue(action(1, 'left').json()['accepted'])
        self.assertFalse(action(2, 'left').json()['accepted'])
        self.assertTrue(action(3, 'right').json()['accepted'])
        self.client.post(f'/rooms/{rid}/command', headers=host, json={'action': 'pause'})
        self.assertFalse(action(4, 'left').json()['accepted'])
        self.client.post(f'/rooms/{rid}/command', headers=host, json={'action': 'resume'})
        self.assertTrue(action(5, 'left').json()['accepted'])
        self.assertEqual(self.client.get(f'/rooms/{rid}').json()['scores'], [3, 0])

    def test_light_goal_and_rematch_idempotency(self):
        created = self.client.post('/rooms', json={**CONFIG, 'mechanic': 'light', 'goal': 10}).json()
        rid = created['room']['id']
        host = {'Authorization': 'Bearer ' + created['token']}
        p = self.client.post(f'/rooms/{rid}/join', json={'name': 'Light', 'team': 0}).json()
        headers = {'Authorization': 'Bearer ' + p['token']}
        self.assertEqual(self.client.post(f'/rooms/{rid}/rematch', headers=headers).status_code, 403)
        self.assertEqual(self.client.post(f'/rooms/{rid}/rematch', headers=host).status_code, 409)
        self.client.post(f'/rooms/{rid}/command', headers=host, json={'action': 'start'})
        for seq in range(1, 11):
            self.assertTrue(self.client.post(f'/rooms/{rid}/tap', headers=headers, json={'seq': seq}).json()['accepted'])
        self.assertFalse(self.client.post(f'/rooms/{rid}/tap', headers=headers, json={'seq': 11}).json()['accepted'])
        finished = self.client.get(f'/rooms/{rid}').json()
        self.assertEqual(finished['state'], 'completed')
        self.assertEqual(finished['scores'], [10, 0])
        next_room = self.client.post(f'/rooms/{rid}/rematch', headers=host).json()
        repeated = self.client.post(f'/rooms/{rid}/rematch', headers=host).json()
        self.assertEqual(next_room['id'], repeated['id'])
        self.assertNotEqual(next_room['id'], rid)
        self.assertEqual(next_room['players'], [])
        self.assertEqual(next_room['scores'], [0, 0])
        self.assertEqual(self.client.get(f'/rooms/{rid}').json()['scores'], [10, 0])
        self.assertEqual(self.client.get(f"/rooms/{next_room['id']}/owner", headers=host).status_code, 200)

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
