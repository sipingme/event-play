// Isolated UI 4191 and in-memory API 8012.
const {chromium,expect}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const path=require('node:path'),os=require('node:os');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(()=>{const original=window.fetch.bind(window);window.fetch=(url,options)=>original(typeof url==='string'?url.replace(':8001/',':8012/'):url,options);const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(url,protocols){super(String(url).replace(':8001/',':8012/'),protocols);}};});
 await context.route('**:8001/rooms/**/wall-photo/**',route=>route.continue({url:route.request().url().replace(':8001/',':8012/')}));
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4191/dashboard/templates');await page.getByRole('button',{name:'签到与上墙',exact:true}).click();
 await expect(page.getByText('看效果 / 试玩',{exact:true})).toHaveCount(9);
 await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('*')].map(el=>getComputedStyle(el).backgroundImage).filter(s=>s.startsWith('url(')).map(s=>new Promise(resolve=>{const im=new Image();im.onload=resolve;im.onerror=resolve;im.src=s.slice(5,-2);})));});
 await page.screenshot({path:path.join(os.tmpdir(),'eventplay-wall-library.png'),fullPage:true});
 for(const variant of ['avatars','logo','wishes','photos','barrage','garden','cities','welcome','stars']){
  await page.goto('http://127.0.0.1:4191/dashboard/templates/wall-'+variant);
  await page.getByRole('button',{name:'创建扫码试玩',exact:true}).click();
  const player=page.frameLocator('iframe[title="试玩玩家"]');
  await player.getByRole('textbox',{name:/测试昵称/}).fill('签到来宾');await player.getByRole('button',{name:'加入活动',exact:true}).click();
  const rid=(await page.locator('iframe[title="试玩玩家"]').getAttribute('src')).split('/').pop();
  const state=async()=>(await fetch('http://127.0.0.1:8012/rooms/'+rid)).json();
  await expect.poll(async()=>(await state()).game.entries.length).toBe(1);
  await expect(player.getByRole('heading',{name:'你已签到，欢迎来到现场！',exact:true})).toBeVisible();
  if(['wishes','photos','barrage'].includes(variant)){
   await player.getByRole('textbox',{name:'上墙寄语（可选）',exact:true}).fill('审核后展示的祝福');
   if(variant==='photos'){
    const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=32;c.height=32;c.getContext('2d').fillRect(0,0,32,32);return c.toDataURL('image/png').split(',')[1];});
    await player.getByLabel('现场照片（可选，5MB以内）').setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});
   }
   await player.getByRole('button',{name:'保存资料 / 提交上墙',exact:true}).click();
   await expect(player.getByText('已提交，等待主持人审核。',{exact:true})).toBeVisible();
   expect((await state()).game.posts).toEqual([]);
   await page.getByRole('button',{name:'通过上墙',exact:true}).click();
   await expect.poll(async()=>(await state()).game.posts.length).toBe(1);
   if(variant==='photos'){
    const src=(await state()).game.posts[0].photo;expect((await fetch('http://127.0.0.1:8012'+src)).status).toBe(200);
   }
  }
  if(variant==='stars'){
   await player.getByRole('button',{name:'点亮我的星星',exact:true}).click();await expect.poll(async()=>(await state()).game.stars.length).toBe(1);
   await player.getByRole('button',{name:'点亮我的星星',exact:true}).click();expect((await state()).game.stars.length).toBe(1);
  }
  await page.getByRole('button',{name:'清屏（保留内容）',exact:true}).click();await expect.poll(async()=>(await state()).game.hidden).toBe(true);
  await page.getByRole('button',{name:'恢复画面',exact:true}).click();await expect.poll(async()=>(await state()).game.hidden).toBe(false);
  await page.getByRole('button',{name:'欢迎登场秀',exact:true}).click();await expect.poll(async()=>(await state()).game.variant).toBe('welcome');expect((await state()).game.entries.length).toBe(1);
  await page.screenshot({path:path.join(os.tmpdir(),`eventplay-wall-${variant}.png`),fullPage:true});
  await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const frame=page.frames().find(f=>f.url().includes('/live/play/'));expect(await frame.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize({width:1440,height:1000});console.log('PASS wall',variant);
 }
 expect(errors).toEqual([]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
