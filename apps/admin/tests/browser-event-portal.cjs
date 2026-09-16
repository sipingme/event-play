// Dedicated test API: 8012 (:memory:); production frontend: 4191.
const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const base = 'http://127.0.0.1:8012';
async function request(path, body, token) {
  const response = await fetch(base + path, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type':'application/json', ...(token ? {Authorization:`Bearer ${token}`} : {})}, body: body === undefined ? undefined : JSON.stringify(body)});
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  return result;
}
(async () => {
  const token = (await request('/workspaces', {})).token;
  const ids = [];
  for (const mechanic of ['quiz', 'money']) {
    const activity = await request('/activities', {config:{name:`固定入口-${mechanic}`,mechanic,theme:'gold',duration:60,participants:20,teams:mechanic==='quiz'?'红队,蓝队':'红队,绿队'}}, token);
    await request(`/activities/${activity.id}/publish`, {revision:1}, token);
    ids.push(activity.id);
  }
  const agenda = await request('/agendas', {name:'一次扫码全场参与',activityIds:ids},token);
  const browser = await chromium.launch({channel:'chrome',headless:true});
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const original = window.fetch.bind(window);
    window.fetch = (url, options) => original(typeof url==='string'?url.replace(':8001/',':8012/'):url, options);
    const Socket = window.WebSocket;
    window.WebSocket = class extends Socket {constructor(url, protocols){super(String(url).replace(':8001/',':8012/'), protocols);}};
  });
  try {
    const player = await context.newPage();
    const screen = await context.newPage();
    const url = `http://127.0.0.1:4191/live/event/${agenda.id}`;
    await player.goto(url);
    await screen.goto(`http://127.0.0.1:4191/live/event-screen/${agenda.id}`);
    await expect(player.getByText('等待主持人开启首个环节', {exact:true})).toBeVisible();
    let opened = await request(`/agendas/${agenda.id}/next`, {index:-1},token);
    await expect(player.getByRole('textbox',{name:/测试昵称/})).toBeVisible({timeout:15000});
    await player.getByRole('textbox',{name:/测试昵称/}).fill('持续参与玩家');
    await expect(player.getByRole('button',{name:'加入活动',exact:true})).toBeEnabled();
    await player.getByRole('button',{name:'加入活动',exact:true}).click();
    await expect(player.getByText('已成功入场，请等待主持人开始')).toBeVisible();
    const guest = await player.evaluate(()=>localStorage.getItem('eventplay.guest.token'));
    await expect.poll(async()=>(await request(`/rooms/${opened.room.id}`)).presence.online,{timeout:15000}).toBe(1);
    await expect.poll(async()=>(await request(`/rooms/${opened.room.id}`)).presence.screens,{timeout:15000}).toBe(1);
    await player.evaluate(({rid,host,workspace})=>{localStorage.setItem(`eventplay.host.${rid}`,host);localStorage.setItem('eventplay.workspace.token',workspace);},{rid:opened.room.id,host:opened.token,workspace:token});
    const host = await context.newPage();
    await host.goto(`http://127.0.0.1:4191/live/host/${opened.room.id}`);
    await expect(host.getByRole('button',{name:'开始比赛',exact:true})).toBeDisabled();
    await host.getByLabel('大屏画面已正确投放').check();
    await host.getByLabel('音量与游戏规则已确认').check();
    await host.getByRole('button',{name:'开始比赛',exact:true}).click();
    await host.getByRole('button',{name:'确认',exact:true}).click();
    await expect(host.getByRole('button',{name:'取消倒计时，重新开放入场'})).toBeVisible();
    await expect(player.getByRole('button',{name:'A · 扫码进入',exact:true})).toBeEnabled();
    await player.getByRole('button',{name:'A · 扫码进入',exact:true}).click();
    await request(`/rooms/${opened.room.id}/command`,{action:'finish'},opened.token);
    await expect(player.getByText('本环节已结束，等待主持人推进下一环节；请保留此页面。')).toBeVisible({timeout:15000});
    host.once('dialog',(dialog)=>dialog.accept());
    await expect(host.getByRole('button',{name:'结束后进入下一环节'})).toBeEnabled({timeout:15000});
    await host.getByRole('button',{name:'结束后进入下一环节'}).click();
    await host.waitForURL((url)=>url.pathname.startsWith('/live/host/')&&!url.pathname.endsWith(opened.room.id));
    const nextId=host.url().split('/').at(-1);
    opened={room:{id:nextId},token:await host.evaluate((rid)=>localStorage.getItem(`eventplay.host.${rid}`),nextId)};
    await expect(player.getByRole('textbox',{name:/测试昵称/})).toHaveValue('持续参与玩家',{timeout:15000});
    await expect(screen.getByText('第 2/2 环节 · 固定入口-money', {exact:true})).toBeVisible({timeout:15000});
    await expect(player).toHaveURL(url);
    await expect(player.getByRole('button',{name:'加入活动',exact:true})).toBeEnabled();
    await player.getByRole('button',{name:'加入活动',exact:true}).click();
    await expect(player.getByText('已成功入场，请等待主持人开始')).toBeVisible();
    if (await player.evaluate(()=>localStorage.getItem('eventplay.guest.token')) !== guest) throw new Error('Guest identity changed between stages');
    await request(`/rooms/${opened.room.id}/command`,{action:'start'},opened.token);
    await player.reload();
    await expect(player.getByRole('button',{name:'无障碍操作：数一张'})).toBeEnabled({timeout:15000});
    await player.getByRole('button',{name:'无障碍操作：数一张'}).click();
    await expect.poll(async()=>(await request(`/rooms/${opened.room.id}`)).scores[0]).toBe(1);
    await context.setOffline(true);
    await expect(player.getByRole('button',{name:'重新同步'})).toBeVisible({timeout:15000});
    await context.setOffline(false);
    await expect(player.getByRole('button',{name:'重新同步'})).toHaveCount(0,{timeout:15000});
    await request(`/rooms/${opened.room.id}/command`,{action:'finish'},opened.token);
    await expect(player.getByText('整场活动已结束，感谢参与！')).toBeVisible({timeout:15000});
    await screen.close();
    await expect.poll(async()=>(await request(`/rooms/${opened.room.id}`)).presence.screens,{timeout:20000}).toBe(0);
    console.log('PASS: stable QR entry, waiting lobby, player/screen automatic stage switch, nickname and identity retention, refresh recovery, offline recovery, final status');
  } finally {await browser.close();}
})().catch((error)=>{console.error(error);process.exitCode=1;});
