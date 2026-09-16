const labels = { waiting: '等待开场', running: '点击，为战队加速！', paused: '比赛已暂停', completed: '本局已结算', aborted: '本局已中止' };
Page({
  data: { roomId: '', name: '', team: 0, teams: [], room: null, player: null, connected: false, joined: false, busy: false, error: '', actionText: '等待开场' },
  onLoad(options) { if (options.room) this.setData({ roomId: options.room }); },
  onShow() { this.active = true; if (this.data.room) this.connect(); },
  onHide() { this.disconnect(); },
  onUnload() { this.disconnect(); },
  disconnect() { this.active = false; clearTimeout(this.retry); clearTimeout(this.watchdog); if (this.socket) this.socket.close(); this.setData({ connected: false }); },
  inputRoom(e) { this.setData({ roomId: e.detail.value.trim() }); },
  inputName(e) { this.setData({ name: e.detail.value }); },
  chooseTeam(e) { this.setData({ team: Number(e.detail.value) }); },
  request(path, body, token) {
    const base = getApp().globalData.apiBase;
    return new Promise((resolve, reject) => wx.request({ url: base + path, method: body ? 'POST' : 'GET', data: body, timeout: 8000,
      header: { 'content-type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      success: (res) => res.statusCode < 300 ? resolve(res.data) : reject(new Error(typeof res.data.detail === 'string' ? res.data.detail : '输入无效')),
      fail: () => reject(new Error('连接失败，请检查后端地址与网络')) }));
  },
  async loadRoom() {
    if (!/^[\w-]{8,32}$/.test(this.data.roomId)) return this.setData({ error: '请填写有效房间 ID' });
    this.setData({ busy: true, error: '' });
    try {
      const room = await this.request('/rooms/' + this.data.roomId);
      this.session = wx.getStorageSync('eventplay.player.' + room.id) || null;
      this.setData({ room, teams: room.config.teams.split(','), joined: !!this.session });
      this.active = true; this.connect();
    } catch (e) { this.setData({ error: e.message }); }
    finally { this.setData({ busy: false }); }
  },
  connect() {
    if (!this.active || !this.data.room) return;
    if (this.socket) { this.socket.onClose(() => {}); this.socket.close(); }
    const socket = wx.connectSocket({ url: getApp().globalData.apiBase.replace(/^http/, 'ws') + '/rooms/' + this.data.roomId + '/stream' });
    this.socket = socket;
    socket.onMessage((event) => {
      if (!this.active || this.socket !== socket) return;
      const room = JSON.parse(event.data);
      const player = this.session ? room.players.find((p) => p.id === this.session.playerId) : null;
      this.setData({ room, player, connected: true, actionText: labels[room.state] });
      clearTimeout(this.watchdog);
      this.watchdog = setTimeout(() => { this.setData({ connected: false }); socket.close(); }, 5000);
    });
    socket.onClose(() => { if (this.active && this.socket === socket) { this.setData({ connected: false }); this.retry = setTimeout(() => this.connect(), 1500); } });
    socket.onError(() => socket.close());
  },
  async join() {
    if (!this.data.name.trim()) return this.setData({ error: '请输入测试昵称' });
    this.setData({ busy: true, error: '' });
    try {
      this.session = await this.request('/rooms/' + this.data.roomId + '/join', { name: this.data.name, team: this.data.team });
      this.session.seq = 0;
      wx.setStorageSync('eventplay.player.' + this.data.roomId, this.session);
      this.setData({ joined: true });
    } catch (e) { this.setData({ error: e.message }); }
    finally { this.setData({ busy: false }); }
  },
  async tap() {
    if (this.sending || !this.data.connected || this.data.room.state !== 'running' || !this.session) return;
    this.sending = true;
    this.session.seq++;
    wx.setStorageSync('eventplay.player.' + this.data.roomId, this.session);
    try {
      const result = await this.request('/rooms/' + this.data.roomId + '/tap', { seq: this.session.seq }, this.session.token);
      this.setData({ error: result.accepted ? '' : result.reason });
    } catch (e) { this.setData({ error: e.message + '；本次不补发' }); }
    finally { this.sending = false; }
  }
});
