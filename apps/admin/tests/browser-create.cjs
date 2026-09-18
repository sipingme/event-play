// Isolated UI 4191 / in-memory API 8012.
const {chromium,expect}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const path=require('node:path'),os=require('node:os');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(()=>{const original=window.fetch.bind(window);window.fetch=(url,options)=>original(typeof url==='string'?url.replace(':8001/',':8012/'):url,options);const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(url,protocols){super(String(url).replace(':8001/',':8012/'),protocols);}};});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4191/dashboard/templates');
 await page.getByRole('button',{name:'群体共创',exact:true}).click();
 await expect(page.getByText('看效果 / 试玩',{exact:true})).toHaveCount(11);
 await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('*')].map(el=>getComputedStyle(el).backgroundImage).filter(s=>s.startsWith('url(')).map(s=>new Promise((resolve,reject)=>{const im=new Image();im.onload=resolve;im.onerror=()=>reject(new Error('图片加载失败: '+s));im.src=s.slice(5,-2);})));});
 await page.screenshot({path:path.join(os.tmpdir(),'eventplay-create-library.png'),fullPage:true});
 for(const variant of ['puzzle','tree','map','draw','stars','city','flowers','scroll','fireworks']){
  await page.goto('http://127.0.0.1:4191/dashboard/templates/create-'+variant);
  await page.getByRole('button',{name:'创建扫码试玩',exact:true}).click();
  const player=page.frameLocator('iframe[title="试玩玩家"]');
  await player.getByRole('textbox',{name:/测试昵称/}).fill('共创来宾');
  await player.getByRole('button',{name:'加入活动',exact:true}).click();
  const rid=(await page.locator('iframe[title="试玩玩家"]').getAttribute('src')).split('/').pop();
  const state=async()=>(await fetch('http://127.0.0.1:8012/rooms/'+rid)).json();
  await expect.poll(async()=>(await state()).players.length).toBe(1);
  await page.getByRole('button',{name:'开始试玩',exact:true}).click();
  await expect.poll(async()=>(await state()).state,{timeout:10000}).toBe('running');
  if(variant==='puzzle'){
   await player.getByRole('button',{name:'领取一块拼图',exact:true}).click();
   const frame=page.frames().find(f=>f.url().includes('/live/play/'));
   const own=await frame.evaluate(async rid=>{const p=JSON.parse(localStorage.getItem('eventplay.player.'+rid));return (await fetch('http://127.0.0.1:8012/rooms/'+rid+'/create-self',{headers:{Authorization:'Bearer '+p.token}})).json();},rid);
   await player.getByRole('button',{name:'放置到位置 '+(own.lease.piece+1),exact:true}).click();
   await expect.poll(async()=>(await state()).game.creation.pieces.length).toBe(1);
  }else if(variant==='tree'){
   for(const name of ['播种','浇水','施肥'])await player.getByRole('button',{name,exact:true}).click();
   await expect.poll(async()=>(await state()).game.creation.treeStage).toBe(3);
  }else{
   if(variant==='map')await player.getByLabel('选择来源城市').selectOption('3');
   else{
    await player.getByRole('button',{name:'颜色 5',exact:true}).click();
    if(variant!=='draw')await player.locator('#creation-shape').selectOption('1');
    await player.getByLabel('祝福 / 作品名称（可选，60字以内）').fill('全场共创的祝福');
    if(['draw','scroll'].includes(variant)){
     const box=await player.getByLabel('我的共创画布').boundingBox();
     await page.mouse.move(box.x+30,box.y+30);await page.mouse.down();
     await page.mouse.move(box.x+box.width*.7,box.y+box.height*.6,{steps:12});await page.mouse.up();
    }
   }
   await player.getByRole('button',{name:'提交我的作品',exact:true}).click();
   await expect.poll(async()=>(await state()).game.creation.total).toBe(1);
   if(variant!=='map'){
    expect((await state()).game.creation.items).toEqual([]);
    await page.getByRole('button',{name:'通过作品',exact:true}).click();
   }
   await expect.poll(async()=>(await state()).game.creation.items.length).toBe(1);
   const item=(await state()).game.creation.items[0];
   if(variant!=='map')expect(item.color).toBe(4);
   if(['draw','scroll'].includes(variant))expect(item.strokes[0].points.length).toBeGreaterThan(1);
  }
  if(variant==='fireworks'){await page.getByRole('button',{name:'点火 · 燃放全场烟花',exact:true}).click();await expect.poll(async()=>(await state()).game.creation.launchedAt).not.toBeNull();}
  else await page.getByRole('button',{name:'收官并锁定作品',exact:true}).click();
  await expect.poll(async()=>(await state()).game.creation.closed).toBe(true);
  await page.screenshot({path:path.join(os.tmpdir(),'eventplay-create-'+variant+'.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const frame=page.frames().find(f=>f.url().includes('/live/play/'));
  expect(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize({width:1440,height:1000});
  console.log('PASS create',variant);
 }
 expect(errors).toEqual([]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
