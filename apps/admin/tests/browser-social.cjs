const {chromium,expect}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const path=require('node:path'),os=require('node:os');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const errors=[];
 async function makeContext(){
  const c=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  c.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  await c.addInitScript(()=>{const original=window.fetch.bind(window);window.fetch=(url,options)=>original(typeof url==='string'?url.replace(':8001/',':8012/'):url,options);const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(url,protocols){super(String(url).replace(':8001/',':8012/'),protocols);}};});return c;
 }
 const context=await makeContext(),peerContext=await makeContext(),page=await context.newPage(),peer=await peerContext.newPage();
 await page.goto('http://127.0.0.1:4191/dashboard/templates');await page.getByRole('button',{name:'社交破冰',exact:true}).click();
 await expect(page.getByText('看效果 / 试玩',{exact:true})).toHaveCount(9);
 await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('*')].map(el=>getComputedStyle(el).backgroundImage).filter(s=>s.startsWith('url(')).map(s=>new Promise((resolve,reject)=>{const im=new Image();im.onload=resolve;im.onerror=()=>reject(new Error(s));im.src=s.slice(5,-2);})));});
 await page.screenshot({path:path.join(os.tmpdir(),'eventplay-social-library.png'),fullPage:true});
 for(const variant of ['team','interest','match','same','bingo','truth','cards','story','praise']){
  await page.goto('http://127.0.0.1:4191/dashboard/templates/social-'+variant);await page.getByRole('button',{name:'创建扫码试玩',exact:true}).click();
  const player=page.frameLocator('iframe[title="试玩玩家"]');
  await player.getByRole('textbox',{name:/测试昵称/}).fill('破冰来宾');await player.getByRole('button',{name:'加入活动',exact:true}).click();
  const src=await page.locator('iframe[title="试玩玩家"]').getAttribute('src'),rid=src.split('/').pop();
  await peer.goto('http://127.0.0.1:4191/live/play/'+rid);
  await peer.getByRole('textbox',{name:/测试昵称/}).fill('破冰伙伴');await peer.getByRole('button',{name:'加入活动',exact:true}).click();
  const state=async()=>(await fetch('http://127.0.0.1:8012/rooms/'+rid)).json();
  await expect.poll(async()=>(await state()).players.length).toBe(2);await page.getByRole('button',{name:'开始试玩',exact:true}).click();
  await expect.poll(async()=>(await state()).state,{timeout:10000}).toBe('running');
  if(variant==='cards'){await player.getByLabel('自愿交换的信息（仅双向同意后可见）').fill('PRIVATE-ALPHA');await peer.getByLabel('自愿交换的信息（仅双向同意后可见）').fill('PRIVATE-BETA');}
  await player.getByRole('button',{name:'同意并加入破冰',exact:true}).click();
  await expect.poll(async()=>(await state()).game.social.participants).toBe(1);
  await peer.getByRole('button',{name:'同意并加入破冰',exact:true}).click();await expect.poll(async()=>(await state()).game.social.participants).toBe(2);
  const frame=page.frames().find(f=>f.url().includes('/live/play/'));
  async function own(surface){return surface.evaluate(async rid=>{const p=JSON.parse(localStorage.getItem('eventplay.player.'+rid));return (await fetch('http://127.0.0.1:8012/rooms/'+rid+'/social-self',{headers:{Authorization:'Bearer '+p.token}})).json();},rid);}
  if(variant==='team'){
   const group=(await own(frame)).profile.group;let buddy;
   for(let i=0;i<2;i++){const p=await (await fetch('http://127.0.0.1:8012/rooms/'+rid+'/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'营地队友'+i,team:0})})).json();const headers={'Content-Type':'application/json',Authorization:'Bearer '+p.token};await fetch('http://127.0.0.1:8012/rooms/'+rid+'/social-action',{method:'POST',headers,body:JSON.stringify({action:'enroll'})});const s=await(await fetch('http://127.0.0.1:8012/rooms/'+rid+'/social-self',{headers})).json();if(s.profile.group===group)buddy=headers;}
   if(!buddy){const s=await peer.evaluate(rid=>JSON.parse(localStorage.getItem('eventplay.player.'+rid)),rid);buddy={'Content-Type':'application/json',Authorization:'Bearer '+s.token};}
   for(const [i,name] of ['互相介绍昵称','找到一个共同爱好','一起想一个团队口号'].entries()){await player.getByRole('button',{name,exact:true}).click();await fetch('http://127.0.0.1:8012/rooms/'+rid+'/social-action',{method:'POST',headers:buddy,body:JSON.stringify({action:'task',index:i})});}
   await expect.poll(async()=>(await state()).game.social.groups[group].tasks.every(Boolean)).toBe(true);
  }else if(variant==='truth'){
   for(const [i,t] of ['喜欢露营','养过猫','登上月球'].entries())await player.getByLabel('经历 '+(i+1),{exact:true}).fill(t);
   await player.getByLabel('哪一条是虚构的（暂时保密）').selectOption('2');await player.getByRole('button',{name:'提交三条经历',exact:true}).click();
   await page.getByRole('button',{name:'通过内容',exact:true}).click();
   await peer.getByRole('button',{name:'猜第 3 条是假',exact:true}).click();
   expect((await state()).game.social.posts[0].lie).toBeUndefined();
   await page.getByRole('button',{name:'截止破冰互动',exact:true}).click();await page.getByRole('button',{name:'揭晓所有经历',exact:true}).click();
   await expect(peer.getByText('揭晓：第 3 条是假的',{exact:true})).toBeVisible();
  }else if(variant==='story'){
   await player.getByLabel('接上团队的故事').fill('我们一起走进了奇妙森林');await player.getByRole('button',{name:'提交接龙句子',exact:true}).click();await page.getByRole('button',{name:'通过内容',exact:true}).click();
   await expect.poll(async()=>(await state()).game.social.posts.length).toBe(1);
  }else{
   await player.getByLabel('伙伴破冰码').fill((await own(peer)).profile.code);
   if(variant==='praise')await player.getByLabel('送给伙伴的鼓励').fill('感谢你的耐心与热情');
   await player.getByRole('button',{name:'向伙伴发送邀请',exact:true}).click();
   if(variant==='cards')await expect(player.getByText(/PRIVATE-BETA/)).toHaveCount(0);
   await peer.getByRole('button',{name:variant==='bingo'?'确认，我符合条件':'同意邀请',exact:true}).click();
   await expect.poll(async()=>(await state()).game.social.connections).toBe(1);
   if(variant==='match'){
    for(const name of ['室内放松','随心出发','先尝试'])await player.getByRole('button',{name,exact:true}).click();
    expect((await own(peer)).pairAnswers.results).toEqual([]);
    for(const name of ['室内放松','随心出发','先尝试'])await peer.getByRole('button',{name,exact:true}).click();
    await expect(player.getByRole('heading',{name:'默契结果 · 3 / 3 相同',exact:true})).toBeVisible();
   }
   if(variant==='cards'){await expect(player.getByText('对方自愿交换的信息：PRIVATE-BETA',{exact:true})).toBeVisible();expect(JSON.stringify((await state()).game.social)).not.toContain('PRIVATE');}
   if(variant==='bingo')expect((await own(frame)).bingo).toEqual(['0']);
   if(variant==='praise'){await page.getByRole('button',{name:'通过内容',exact:true}).click();await expect.poll(async()=>(await state()).game.social.posts.length).toBe(1);}
  }
  if(variant!=='truth')await page.getByRole('button',{name:'截止破冰互动',exact:true}).click();
  await expect.poll(async()=>(await state()).game.social.closed).toBe(true);
  const screen=await context.newPage();await screen.goto('http://127.0.0.1:4191/live/screen/'+rid);await expect(screen.locator('[data-social-variant]')).toBeVisible();await screen.screenshot({path:path.join(os.tmpdir(),'eventplay-social-'+variant+'.png'),fullPage:true});await screen.close();
  await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1440,height:1000});
  if(variant==='cards'){await peer.getByRole('button',{name:'退出破冰并撤销连接',exact:true}).click();await expect.poll(async()=>(await own(frame)).requests[0].contact).toBeUndefined();}
  console.log('PASS social',variant);
 }
 expect(errors).toEqual([]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
