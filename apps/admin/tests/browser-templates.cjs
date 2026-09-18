// Isolated production UI 4191 + in-memory API 8012. No production activity writes.
const {chromium,expect}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const path=require('node:path');
const os=require('node:os');
const base='http://127.0.0.1:4191';
const api='http://127.0.0.1:8012';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(()=>{
   const original=window.fetch.bind(window);
   window.fetch=(url,options)=>original(typeof url==='string'?url.replace(':8001/',':8012/'):url,options);
   const Socket=window.WebSocket;
   window.WebSocket=class extends Socket{constructor(url,protocols){super(String(url).replace(':8001/',':8012/'),protocols);}};
 });
 const page=await context.newPage(); const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try {
  await page.goto(base+'/dashboard');
  await expect(page.getByRole('heading',{name:'先玩一下，再变成你的活动'})).toBeVisible();
  await page.goto(base+'/dashboard/templates');
  for(const name of ['摇一摇','滑屏','点击','手眼协调','控制']) {
    await page.getByRole('button',{name,exact:true}).click();
    await expect(page.getByText('看效果 / 试玩',{exact:true})).toHaveCount(name==='摇一摇'?8:name==='滑屏'?4:name==='点击'?9:name==='手眼协调'||name==='控制'?8:1);
  }
  await page.getByRole('button',{name:'全部',exact:true}).click();
  await page.screenshot({path:path.join(os.tmpdir(),'eventplay-template-library.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize({width:1440,height:1000});
  for(const id of ['shake-race','swipe-money','click-sprint','reaction-mole','control-coins']) {
    await page.goto(base+'/dashboard/templates/'+id);
    await page.getByRole('button',{name:'创建扫码试玩',exact:true}).click();
    const player=page.frameLocator('iframe[title="试玩玩家"]');
    await player.getByRole('textbox',{name:/测试昵称/}).fill('体验玩家');
    await player.getByRole('button',{name:'加入活动',exact:true}).click();
    await page.getByRole('button',{name:'开始试玩',exact:true}).click();
    const rid=(await page.locator('iframe[title="试玩玩家"]').getAttribute('src')).split('/').pop();
    const state=async()=> (await fetch(api+'/rooms/'+rid)).json();
    await expect.poll(async()=> (await state()).state,{timeout:8000}).toBe('running');
    if(id==='shake-race') {
      await player.getByRole('button',{name:'开启摇动',exact:true}).click();
      const frame=page.frames().find(f=>f.url().includes('/live/play/'));
      await expect.poll(async()=> { const score=(await state()).scores[0]; if(score) return score; await frame.evaluate(()=>{for(const x of [0,25])window.dispatchEvent(new DeviceMotionEvent('devicemotion',{accelerationIncludingGravity:{x,y:0,z:9.8}}));}); return 0; },{intervals:[350],timeout:7000}).toBeGreaterThan(0);
      const before=(await state()).scores[0];
      await player.getByRole('button',{name:'点击备用加速'}).click();
      await expect.poll(async()=> (await state()).scores[0]).toBe(before+1);
    } else if(id==='swipe-money') {
      await expect(player.getByRole('button',{name:'无障碍操作：数一张',exact:true})).toBeEnabled();
      const card=player.getByText('EVENTPLAY · 财富积分卡',{exact:true}).locator('..');
      await card.scrollIntoViewIfNeeded(); const box=await card.boundingBox();
      await page.mouse.move(box.x+box.width/2,box.y+box.height-25);await page.mouse.down();
      await page.mouse.move(box.x+box.width/2,box.y+30,{steps:8});await page.mouse.up();
      await expect.poll(async()=> (await state()).scores[0]).toBe(1);
    } else if(id==='click-sprint') {
      await player.getByRole('button',{name:'左',exact:true}).click();
      await expect.poll(async()=> (await state()).scores[0]).toBe(1);
      await player.getByRole('button',{name:'右',exact:true}).click();
      await expect.poll(async()=> (await state()).scores[0]).toBe(2);
    } else if(id==='reaction-mole') {
      await player.locator('[data-target="true"]').click();
      await expect.poll(async()=> (await state()).scores[0]).toBe(1);
      await expect(player.getByText('命中！+1 分',{exact:true})).toBeVisible();
      await expect(player.getByRole('button',{name:'洞口 1',exact:true})).toBeDisabled();
    } else {
      const room=await state(); const target=room.game.lane;
      if(target!==1) await player.getByRole('button',{name:target===0?'向左移动':'向右移动',exact:true}).click();
      await expect.poll(async()=> (await state()).scores[0],{timeout:8000}).toBeGreaterThan(0);
    }
    await page.screenshot({path:path.join(os.tmpdir(),`eventplay-trial-${id}.png`),fullPage:true});
    await page.getByRole('button',{name:'暂停试玩',exact:true}).click();
    await expect.poll(async()=> (await state()).state).toBe('paused');
    const scores=(await state()).scores;
    await page.getByRole('button',{name:'结束试玩',exact:true}).click();
    await expect(page.getByRole('button',{name:'重新试玩',exact:true})).toBeVisible();
    expect((await state()).scores).toEqual(scores);
    await page.getByRole('button',{name:'用此模板创建',exact:true}).click();
    await expect(page).toHaveURL(new RegExp('activities/new\\?template='+id));
    await expect(page.getByRole('button',{name:'保存草稿',exact:true})).toBeVisible();
    console.log('PASS template, real input, pause/abort, independent trial and create:',id);
  }
  if(errors.length) throw new Error(errors.join('\n'));
 } catch(error) { console.log('PAGE', await page.locator('body').innerText()); console.log('FRAMES', page.frames().map(f=>f.url()), errors); await page.screenshot({path:path.join(os.tmpdir(),'eventplay-template-error.png'),fullPage:true}); throw error; } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
