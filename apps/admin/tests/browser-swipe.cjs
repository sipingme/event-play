const {chromium,expect}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const path=require('node:path');const os=require('node:os');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(()=>{const f=window.fetch.bind(window);window.fetch=(u,o)=>f(typeof u==='string'?u.replace(':8001/',':8012/'):u,o);const W=window.WebSocket;window.WebSocket=class extends W{constructor(u,p){super(String(u).replace(':8001/',':8012/'),p);}};});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:4191/dashboard/templates');
  await page.getByRole('button',{name:'滑屏',exact:true}).click();
  await expect(page.getByText('看效果 / 试玩',{exact:true})).toHaveCount(4);
  for(const [variant,direction] of [['dragonboat','down'],['bicycle','alternating'],['climb','up']]){
   await page.goto('http://127.0.0.1:4191/dashboard/activities/new?template=swipe-'+variant);
   await page.getByRole('button',{name:'保存草稿',exact:true}).click();
   await page.waitForURL(/\/activities\/[^/]+\/edit/);
   const aid=page.url().split('/').at(-2);
   const saved=await page.evaluate(aid=>JSON.parse(localStorage.getItem('eventplay.activities.v1')).find(a=>a.id===aid),aid);
   expect(saved.swipeDirection).toBe(direction);expect(saved.raceVariant).toBe(variant);expect(saved.inputMode).toBe('swipe');
   await page.goto('http://127.0.0.1:4191/dashboard/templates/swipe-'+variant);
   await page.getByRole('button',{name:'创建扫码试玩',exact:true}).click();
   const frame=page.frameLocator('iframe[title="试玩玩家"]');
   await frame.getByRole('textbox',{name:/测试昵称/}).fill('滑屏玩家');
   await frame.getByRole('button',{name:'加入活动',exact:true}).click();
   const rid=(await page.locator('iframe[title="试玩玩家"]').getAttribute('src')).split('/').pop();
   const room=async()=>await (await fetch('http://127.0.0.1:8012/rooms/'+rid)).json();
   await page.getByRole('button',{name:'开始试玩',exact:true}).click();
   await expect.poll(async()=>(await room()).state,{timeout:8000}).toBe('running');
   const pad=frame.locator('[data-swipe-pad]');
   await expect(pad).toHaveAttribute('aria-disabled','false');
   async function swipe(dx,dy){
    await pad.scrollIntoViewIfNeeded();const b=await pad.boundingBox();const x=b.x+b.width/2,y=b.y+b.height/2;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+dx,y+dy,{steps:8});await page.mouse.up();
   }
   await swipe(0,0);expect((await room()).scores[0]).toBe(0);
   await swipe(direction==='alternating'?0:100,0);
   expect((await room()).scores[0]).toBe(0);
   await swipe(direction==='alternating'?-80:0,direction==='up'?-80:direction==='down'?80:0);
   await expect.poll(async()=>(await room()).scores[0]).toBe(1);
   if(direction==='alternating'){
    await expect(pad).toHaveAttribute('aria-disabled','false');await swipe(-80,0);
    await expect(frame.getByText('请左右交替滑动',{exact:true})).toBeVisible();
    expect((await room()).scores[0]).toBe(1);
    await swipe(80,0);await expect.poll(async()=>(await room()).scores[0]).toBe(2);
   }
   const screen=await context.newPage();await screen.goto('http://127.0.0.1:4191/live/screen/'+rid);
   const arena=screen.locator('[data-race-stage]');await expect(arena).toHaveAttribute('data-race-variant',variant);
   await arena.locator('image').evaluateAll(nodes=>Promise.all(nodes.map(n=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=reject;i.src=n.getAttribute('href');}))));
   await arena.screenshot({path:path.join(os.tmpdir(),'eventplay-swipe-'+variant+'.png')});
   await screen.setViewportSize({width:390,height:844});
   await arena.screenshot({path:path.join(os.tmpdir(),'eventplay-swipe-'+variant+'-mobile.png')});
   expect(await screen.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await screen.close();
   await page.getByRole('button',{name:'暂停试玩',exact:true}).click();
   await expect(pad).toHaveAttribute('aria-disabled','true');
   const score=(await room()).scores[0];await swipe(0,-80);expect((await room()).scores[0]).toBe(score);
   await page.getByRole('button',{name:'结束试玩',exact:true}).click();
   console.log('PASS',variant,'saved config, real gestures, wrong direction, scoring, pause, desktop/mobile art');
  }
  if(errors.length)throw Error(errors.join('\n'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
