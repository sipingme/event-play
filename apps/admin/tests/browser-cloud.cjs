// Run with PLAYWRIGHT_MODULE pointing to an installed @playwright/test module.
// Uses a dedicated in-memory API on 8012 and a local production server on 4191.
const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const fetchOriginal = window.fetch.bind(window);
    window.fetch = (url, options) => fetchOriginal(typeof url === 'string' ? url.replace(':8001/', ':8012/') : url, options);
    const Socket = window.WebSocket;
    window.WebSocket = class extends Socket { constructor(url, protocols) { super(String(url).replace(':8001/', ':8012/'), protocols); } };
  });
  try {
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:4191/dashboard/cloud');
    await page.getByRole('button', { name: '创建云工作区', exact: true }).click();
    await expect(page.getByRole('heading', { name: '已连接云工作区' })).toBeVisible();
    await page.goto('http://127.0.0.1:4191/dashboard/activities/new?template=money-gold');
    await page.getByRole('textbox', { name: /活动名称/ }).fill('浏览器数钱验证');
    await page.getByRole('button', { name: '保存草稿', exact: true }).click();
    await page.waitForURL(/\/activities\/[^/]+\/edit/);
    const activityId = page.url().split('/').at(-2);
    await page.goto(`http://127.0.0.1:4191/dashboard/activities/${activityId}/publish`);
    await page.getByRole('button', { name: /保存.*版本/ }).click();
    await expect(page.getByRole('button', { name: /进入联机主持端/ })).toBeEnabled();
    await page.getByRole('button', { name: /进入联机主持端/ }).click();
    await page.waitForURL(/\/live\/host\//);
    const roomId = page.url().split('/').at(-1);
    const player = await context.newPage();
    await player.goto(`http://127.0.0.1:4191/live/play/${roomId}`);
    await player.getByRole('textbox', { name: /测试昵称/ }).fill('浏览器玩家');
    await expect(player.getByRole('button', { name: '加入活动', exact: true })).toBeEnabled();
    await player.getByRole('button', { name: '加入活动', exact: true }).click();
    await expect(player.getByText('已成功入场，请等待主持人开始')).toBeVisible();
    await page.getByLabel('大屏画面已正确投放').check();
    await page.getByLabel('音量与游戏规则已确认').check();
    await expect(page.getByRole('button', { name: '开始比赛', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '开始比赛', exact: true }).click();
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await expect(player.getByRole('button', { name: '无障碍操作：数一张' })).toBeEnabled();
    await player.getByRole('button', { name: '无障碍操作：数一张' }).click();
    await expect.poll(async () => (await (await fetch(`http://127.0.0.1:8012/rooms/${roomId}`)).json()).scores[0]).toBe(1);
    const card = player.getByText('EVENTPLAY · 财富积分卡').locator('..');
    const box = await card.boundingBox();
    await player.mouse.move(box.x + box.width / 2, box.y + box.height - 30);
    await player.mouse.down();
    await player.mouse.move(box.x + box.width / 2, box.y + 30, { steps: 8 });
    await player.mouse.up();
    await expect.poll(async () => (await (await fetch(`http://127.0.0.1:8012/rooms/${roomId}`)).json()).scores[0]).toBe(2);
    await page.getByRole('button', { name: '提前结算', exact: true }).click();
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await expect(player.getByRole('heading', { name: '本局贡献战报' })).toBeVisible();
    await page.goto('http://127.0.0.1:4191/dashboard/cloud');
    await expect(page.getByRole('heading', { name: '浏览器数钱验证 · 第 1 局' })).toBeVisible();
    console.log('PASS: cloud creation, activity save/publish, player join, money swipe, scoring, finish and room history');
    for (const mechanic of ['alternating', 'light', 'quiz', 'draw', 'catch']) {
      const template = {light: 'light-gold', alternating: 'alternating-space', quiz: 'quiz-space', draw: 'draw-gold', catch: 'catch-garden'}[mechanic];
      await page.goto(`http://127.0.0.1:4191/dashboard/activities/new?template=${template}`);
      await page.getByRole('textbox', { name: /活动名称/ }).fill(`浏览器验证-${mechanic}`);
      await page.getByRole('spinbutton', { name: /共同点亮目标/ }).fill('10');
      await page.getByRole('button', { name: '保存草稿', exact: true }).click();
      await page.waitForURL(/\/activities\/[^/]+\/edit/);
      const aid = page.url().split('/').at(-2);
      await page.goto(`http://127.0.0.1:4191/dashboard/activities/${aid}/publish`);
      await page.getByRole('button', { name: /保存.*版本/ }).click();
      await expect(page.getByRole('button', { name: /进入联机主持端/ })).toBeEnabled();
      await page.getByRole('button', { name: /进入联机主持端/ }).click();
      await page.waitForURL(/\/live\/host\//);
      const rid = page.url().split('/').at(-1);
      await player.goto(`http://127.0.0.1:4191/live/play/${rid}`);
      await player.getByRole('textbox', { name: /测试昵称/ }).fill('新玩法玩家');
      await expect(player.getByRole('button', { name: '加入活动', exact: true })).toBeEnabled();
      await player.getByRole('button', { name: '加入活动', exact: true }).click();
      await page.getByLabel('大屏画面已正确投放').check();
      await page.getByLabel('音量与游戏规则已确认').check();
      await expect(page.getByRole('button', { name: '开始比赛', exact: true })).toBeEnabled();
      await page.getByRole('button', { name: '开始比赛', exact: true }).click();
      await page.getByRole('button', { name: '确认', exact: true }).click();
      const count = mechanic === 'light' ? 10 : mechanic === 'alternating' ? 4 : 0;
      for (let i = 0; i < count; i++) {
        const button = player.getByRole('button', { name: mechanic === 'light' ? '贡献能量，一起点亮！' : i % 2 ? '右' : '左', exact: true });
        await expect(button).toBeEnabled();
        await button.click();
        await expect.poll(async () => (await (await fetch(`http://127.0.0.1:8012/rooms/${rid}`)).json()).scores[0]).toBe(i + 1);
      }
      if (mechanic === 'quiz') {
        const answer = player.getByRole('button', { name: 'A · 扫码进入', exact: true });
        await expect(answer).toBeEnabled();
        await answer.click();
        await expect(player.getByText('本题已提交，不可修改。')).toBeVisible();
      }
      if (mechanic === 'draw') {
        await page.getByRole('button', { name: '抽取并锁定结果', exact: true }).click();
        await page.getByRole('button', { name: '确认', exact: true }).click();
        await expect(player.getByRole('heading', { name: '本局中奖名单' })).toBeVisible();
      }
      if (mechanic === 'catch') {
        await expect(player.getByRole('button', { name: '向左移动', exact: true })).toBeEnabled();
        const snapshot = await (await fetch(`http://127.0.0.1:8012/rooms/${rid}`)).json();
        if (snapshot.game.lane !== 1) await player.getByRole('button', { name: snapshot.game.lane === 0 ? '向左移动' : '向右移动', exact: true }).click();
        await expect.poll(async () => (await (await fetch(`http://127.0.0.1:8012/rooms/${rid}`)).json()).scores[0], { timeout: 5000 }).toBeGreaterThanOrEqual(1);
      }
      if (['alternating', 'quiz', 'catch'].includes(mechanic)) {
        await page.getByRole('button', { name: '提前结算', exact: true }).click();
        await page.getByRole('button', { name: '确认', exact: true }).click();
      } else if (mechanic === 'light') await expect(page.getByText('全场点亮成功！').first()).toBeVisible();
      if (mechanic === 'quiz') await expect.poll(async () => (await (await fetch(`http://127.0.0.1:8012/rooms/${rid}`)).json()).scores[0]).toBe(10);
      const download = page.waitForEvent('download');
      await page.getByRole('button', { name: '导出本局成绩 JSON' }).click();
      if (!(await download).suggestedFilename().endsWith('.json')) throw new Error('Report filename');
      await page.getByRole('button', { name: '相同规则再来一局' }).click();
      await page.waitForURL((url) => url.pathname.startsWith('/live/host/') && !url.pathname.endsWith(rid));
      await expect(page.getByText('等待至少一位玩家加入后，即可开始比赛。')).toBeVisible();
      console.log(`PASS: ${mechanic}, score, settlement, report download and fresh rematch`);
    }
    await page.goto('http://127.0.0.1:4191/dashboard/cloud');
    await page.getByRole('textbox', { name: '整场活动名称' }).fill('浏览器整场编排');
    await page.getByRole('button', { name: '添加：浏览器数钱验证', exact: true }).click();
    await page.getByRole('button', { name: '添加：浏览器验证-quiz', exact: true }).click();
    await page.getByRole('button', { name: '上移环节2' }).click();
    await page.getByRole('button', { name: '保存整场编排' }).click();
    await expect(page.getByRole('heading', { name: '浏览器整场编排', exact: true })).toBeVisible();
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '进入首个环节' }).click();
    await page.waitForURL(/\/live\/host\//);
    const agendaRoom = page.url().split('/').at(-1);
    const screen = await context.newPage();
    await screen.goto(`http://127.0.0.1:4191/live/screen/${agendaRoom}`);
    await expect(screen.getByRole('button', { name: '进入全屏' })).toBeVisible();
    await screen.getByRole('button', { name: '启用倒计时音效' }).click();
    await expect(screen.getByRole('button', { name: '关闭音效' })).toBeVisible();
    await player.goto(`http://127.0.0.1:4191/live/play/${agendaRoom}`);
    await player.getByRole('textbox', { name: /测试昵称/ }).fill('编排玩家');
    await page.getByLabel('大屏画面已正确投放').check();
    await page.getByLabel('音量与游戏规则已确认').check();
    await expect(player.getByRole('button', { name: '加入活动', exact: true })).toBeEnabled();
    await player.getByRole('button', { name: '加入活动', exact: true }).click();
    await expect(page.getByRole('button', { name: '开始比赛', exact: true })).toBeEnabled();
    await page.getByRole('button', { name: '开始比赛', exact: true }).click();
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await expect(player.getByRole('button', { name: 'A · 扫码进入', exact: true })).toBeEnabled();
    await player.getByRole('button', { name: 'A · 扫码进入', exact: true }).click();
    await page.getByRole('button', { name: '提前结算', exact: true }).click();
    await page.getByRole('button', { name: '确认', exact: true }).click();
    await expect(player.getByRole('heading', { name: '已结束题目 · 答案揭晓' })).toBeVisible();
    await expect(screen.getByText('最终战报 · 服务器确认')).toBeVisible();
    await expect(page.getByRole('button', { name: '相同规则再来一局' })).toHaveCount(0);
    await page.getByRole('link', { name: '返回整场编排 / 下一环节' }).click();
    await page.getByRole('button', { name: '进入下一环节' }).click();
    await page.waitForURL((url)=>url.pathname.startsWith('/live/host/')&&!url.pathname.endsWith(agendaRoom));
    await expect(page.getByText('等待至少一位玩家加入后，即可开始比赛。')).toBeVisible();
    console.log('PASS: agenda ordering, frozen steps, host progression, screen sound controls, quiz reveal and settlement');
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
