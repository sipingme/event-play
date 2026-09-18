// Run against isolated UI 4191 and in-memory API 8012.
const {chromium,expect}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const path=require('node:path'),os=require('node:os');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(()=>{const original=window.fetch.bind(window);window.fetch=(url,options)=>original(typeof url==='string'?url.replace(':8001/',':8012/'):url,options);const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(url,protocols){super(String(url).replace(':8001/',':8012/'),protocols);}};});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4191/dashboard/templates');
 await page.getByRole('button',{name:'投票与评分',exact:true}).click();
 await expect(page.getByText('看效果 / 试玩',{exact:true})).toHaveCount(9);
 await page.screenshot({path:path.join(os.tmpdir(),'eventplay-vote-library.png'),fullPage:true});
 for(const variant of ['poll','score','support','product','stance','proposal','satisfaction','story','bracket']){
  await page.goto('http://127.0.0.1:4191/dashboard/templates/vote-'+variant);
  await page.getByRole('button',{name:'创建扫码试玩',exact:true}).click();
  const player=page.frameLocator('iframe[title="试玩玩家"]');
  await player.getByRole('textbox',{name:/测试昵称/}).fill('投票来宾');
  await player.getByRole('button',{name:'加入活动',exact:true}).click();
  const rid=(await page.locator('iframe[title="试玩玩家"]').getAttribute('src')).split('/').pop();
  const state=async()=>(await fetch('http://127.0.0.1:8012/rooms/'+rid)).json();
  await expect.poll(async()=>(await state()).players.length).toBe(1);
  await page.getByRole('button',{name:'开始试玩',exact:true}).click();
  await expect.poll(async()=>(await state()).state,{timeout:10000}).toBe('running');
  const rounds=variant==='bracket'?3:variant==='story'?2:1;
  for(let round=0;round<rounds;round++){
   const label=(await state()).game.options[0];
   const button=['score','proposal'].includes(variant)?player.getByRole('button',{name:label+' 5分',exact:true}):player.getByRole('button',{name:'选择 · '+label,exact:true});
   await button.click();
   await expect.poll(async()=>(await state()).game.voters).toBe(1);
   if(['score','proposal'].includes(variant))expect((await state()).game.results).toBeNull();
   await page.getByRole('button',{name:'截止本轮',exact:true}).click();
   await expect.poll(async()=>(await state()).game.closed).toBe(true);
   await page.getByRole('button',{name:'揭晓本轮',exact:true}).click();
   await expect.poll(async()=>(await state()).game.voteRevealed).toBe(true);
   expect((await state()).game.results[0].count).toBe(1);
   await page.getByRole('button',{name:'进入下一轮 / 推进剧情',exact:true}).click();
   await expect.poll(async()=>(await state()).game.round).toBe(round+1);
  }
  if(['story','bracket'].includes(variant))expect((await state()).game.finished).toBe(true);
  await page.screenshot({path:path.join(os.tmpdir(),'eventplay-vote-'+variant+'.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const frame=page.frames().find(f=>f.url().includes('/live/play/'));
  expect(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize({width:1440,height:1000});
  console.log('PASS vote',variant);
 }
 expect(errors).toEqual([]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
