// Run against isolated API 8012 and production UI 4191. Screenshots go to the OS temp folder.
const { chromium, expect } = require(process.env.PLAYWRIGHT_MODULE || '@playwright/test');
const os = require('node:os');
const path = require('node:path');
const base = 'http://127.0.0.1:8012';
async function api(route, body, token) {
  const result = await fetch(base + route, {method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  if(!result.ok) throw new Error(await result.text());
  return result.json();
}
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1080},reducedMotion:'reduce'});
  await context.addInitScript(()=>{
    const original=window.fetch.bind(window);
    window.fetch=(url,options)=>original(typeof url==='string'?url.replace(':8001/',':8012/'):url,options);
    const Socket=window.WebSocket;
    window.WebSocket=class extends Socket{constructor(url,protocols){super(String(url).replace(':8001/',':8012/'),protocols);}};
  });
  const errors=[];
  try{
    const page=await context.newPage();
    page.on('pageerror',(e)=>errors.push(e.message));
    for(const mechanic of ['race','quiz','draw']){
      const config={name:{race:'全员冲刺 · 巅峰对决',quiz:'灵感交锋 · 品牌知识挑战',draw:'热爱有回响 · 幸运盛典'}[mechanic],mechanic,theme:mechanic==='quiz'?'space':'gold',brand:'EVENTPLAY 年度盛典',duration:120,participants:20,teams:'销售部,研发部,市场部',winnerCount:3,prizeName:'年度幸运奖',quizText:'现场互动的主角，应该是谁？|每一位参与者|只有主持人|只有获奖者|只有工作人员|A\n品牌体验来自什么？|共同参与和真实反馈|只看宣传资料|等待散场|关闭大屏|A'};
      const created=await api('/rooms',config);
      const rid=created.room.id;
      const command=(action)=>api(`/rooms/${rid}/command`,{action},created.token);
      const players=[];
      for(let i=0;i<3;i++) players.push(await api(`/rooms/${rid}/join`,{name:['林晓','陈予安','周一诺'][i],team:i}));
      await page.goto(`http://127.0.0.1:4191/live/screen/${rid}`);
      await expect(page.getByRole('heading',{name:config.name,exact:true})).toBeVisible();
      if(mechanic==='race') {
        for(const asset of ['stadium-cartoon-v2.png', ...['red','blue','green','purple'].map(color=>`horse-cartoon-${color}-v2.png`)]) {
          const response=await page.request.get(`http://127.0.0.1:4191/games/race/${asset}`);
          if(!response.ok()) throw new Error(`Missing race asset: ${asset}`);
        }
        await expect(page.locator('[data-horse-color="red"]')).toBeVisible();
        await expect(page.locator('[data-horse-color="blue"]')).toBeVisible();
        await expect(page.locator('[data-horse-color="green"]')).toBeVisible();
        await expect(page.getByText('微信扫码 · 加入战队',{exact:true})).toBeVisible();
        await page.getByRole('region',{name:'团队赛马场景'}).screenshot({path:path.join(os.tmpdir(),'eventplay-race-waiting.png')});
        await command('countdown');
        await expect(page.getByRole('status').getByText('准备开场',{exact:true})).toBeVisible();
        await expect(page.getByRole('region',{name:'团队赛马场景'})).toHaveAttribute('data-phase','running',{timeout:7000});
      } else await command('start');
      if(mechanic==='race'){
        for(let i=0;i<3;i++) for(let seq=1;seq<=78-i*19;seq++) await api(`/rooms/${rid}/tap`,{seq},players[i].token);
        await expect(page.getByText('领先中',{exact:true}).first()).toBeVisible();
        await page.emulateMedia({reducedMotion:'no-preference'});
        const horse=page.locator('[data-race-stage] span').filter({hasText:/^$/});
        await expect.poll(()=>horse.evaluateAll(nodes=>nodes.some(node=>getComputedStyle(node).animationName.includes('gallop')))).toBe(true);
        await page.emulateMedia({reducedMotion:'reduce'});
      }
      if(mechanic==='quiz') await expect(page.getByRole('heading',{name:'现场互动的主角，应该是谁？',exact:true})).toBeVisible();
      if(mechanic==='draw'){
        await expect(page.getByRole('heading',{name:'幸运，即将揭晓'})).toBeVisible();
        await command('pause');
        await expect(page.getByRole('heading',{name:'抽奖已暂停'})).toBeVisible();
        await command('resume');
        await command('draw');
        await expect(page.getByRole('heading',{name:'本局中奖名单'})).toBeVisible();
      }
      const arena=page.locator('section').filter({has:page.getByRole('heading',{name:config.name,exact:true})});
      const screenshot=path.join(os.tmpdir(),`eventplay-visual-${mechanic}.png`);
      await arena.screenshot({path:screenshot,animations:'disabled'});
      console.log(`SCREENSHOT ${screenshot}`);
      if(mechanic==='race') {
        await page.getByText('投屏设置与连接状态',{exact:true}).click();
        await page.getByRole('button',{name:'进入全屏',exact:true}).click();
        await expect.poll(()=>page.evaluate(()=>document.fullscreenElement?.hasAttribute('data-race-stage'))).toBe(true);
        await page.evaluate(()=>document.exitFullscreen());
        await page.getByText('投屏设置与连接状态',{exact:true}).click();
      }
      await page.setViewportSize({width:390,height:844});
      await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
      await arena.screenshot({path:path.join(os.tmpdir(),`eventplay-visual-${mechanic}-mobile.png`),animations:'disabled'});
      await page.setViewportSize({width:1440,height:1080});
      if(mechanic==='quiz'){
        await page.evaluate(({rid,player})=>localStorage.setItem(`eventplay.player.${rid}`,JSON.stringify({...player,seq:0})),{rid,player:players[0]});
        const phone=await context.newPage();
        await phone.setViewportSize({width:390,height:844});
        await phone.goto(`http://127.0.0.1:4191/live/play/${rid}`);
        await expect(phone.getByRole('button',{name:'A · 每一位参与者',exact:true})).toBeEnabled();
        await phone.getByRole('button',{name:'A · 每一位参与者',exact:true}).click();
        await expect(phone.getByText('本题已提交，不可修改。')).toBeVisible();
        await expect(phone.getByRole('button',{name:'A · 每一位参与者',exact:true})).toBeDisabled();
        await command('finish');
        await expect(page.getByRole('heading',{name:'已结束题目 · 答案揭晓'})).toBeVisible();
        await expect(page.getByText('每一位参与者',{exact:true})).toBeVisible();
        await phone.close();
      }else if(mechanic==='race'){
        await command('pause');
        await expect(page.getByText('比赛已暂停 · 请等待主持人继续',{exact:true})).toBeVisible();
        await arena.screenshot({path:path.join(os.tmpdir(),'eventplay-race-paused.png')});
        await expect(arena).toHaveAttribute('data-moving','false');
        const animationNames=await arena.locator('span').evaluateAll((nodes)=>nodes.map((node)=>getComputedStyle(node).animationName));
        if(animationNames.some((name)=>name!=='none')) throw new Error('Reduced-motion preference ignored');
        await command('abort');
        await expect(page.getByText('本轮已中止 · 不评定胜负',{exact:true})).toBeVisible();
        const finalRoom=await api('/rooms',config);
        const finalPlayer=await api(`/rooms/${finalRoom.room.id}/join`,{name:'验收玩家',team:0});
        await api(`/rooms/${finalRoom.room.id}/command`,{action:'start'},finalRoom.token);
        await api(`/rooms/${finalRoom.room.id}/tap`,{seq:1},finalPlayer.token);
        await api(`/rooms/${finalRoom.room.id}/command`,{action:'finish'},finalRoom.token);
        await page.goto(`http://127.0.0.1:4191/live/screen/${finalRoom.room.id}`);
        await expect(page.getByRole('status').getByText('销售部 · 本轮获胜',{exact:true})).toBeVisible();
        await expect(page.getByRole('list',{name:'战队最终排名'}).getByRole('listitem')).toHaveCount(3);
        await expect(page.getByRole('list',{name:'战队最终排名'}).getByRole('listitem').first()).toContainText('销售部');
        await page.getByRole('region',{name:'团队赛马场景'}).screenshot({path:path.join(os.tmpdir(),'eventplay-race-completed.png')});
        const fourTeams=await api('/rooms',{...config,teams:'销售部,研发部,市场部,运营部'});
        await page.goto(`http://127.0.0.1:4191/live/screen/${fourTeams.room.id}`);
        await expect(page.locator('[data-horse-color="purple"]')).toBeVisible();
        await page.getByRole('region',{name:'团队赛马场景'}).screenshot({path:path.join(os.tmpdir(),'eventplay-race-four-teams.png')});
      }
      console.log(`PASS ${mechanic}: desktop/mobile, actual state, reduced motion and no horizontal overflow`);
    }
    if(errors.length) throw new Error(errors.join('\n'));
  }finally{await browser.close();}
})().catch((e)=>{console.error(e);process.exitCode=1;});
