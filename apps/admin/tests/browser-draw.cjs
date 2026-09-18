// Isolated UI 4191, in-memory API 8012.
const {chromium,expect}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const path=require('node:path'),os=require('node:os');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(()=>{const original=window.fetch.bind(window);window.fetch=(url,options)=>original(typeof url==='string'?url.replace(':8001/',':8012/'):url,options);const Socket=window.WebSocket;window.WebSocket=class extends Socket{constructor(url,protocols){super(String(url).replace(':8001/',':8012/'),protocols);}};});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4191/dashboard/templates');
 await page.getByRole('button',{name:'抽奖互动',exact:true}).click();
 await expect(page.getByText('看效果 / 试玩',{exact:true})).toHaveCount(8);
 await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('*')].map(el=>getComputedStyle(el).backgroundImage).filter(s=>s.startsWith('url(')).map(s=>new Promise(resolve=>{const img=new Image();img.onload=resolve;img.onerror=resolve;img.src=s.slice(5,-2);})));});
 await page.screenshot({path:path.join(os.tmpdir(),'eventplay-draw-library.png'),fullPage:true});
 for(const variant of ['gold','wheel','egg','box','capsule','balloon','treasure','train']){
  await page.goto('http://127.0.0.1:4191/dashboard/templates/draw-'+variant);
  await page.getByRole('button',{name:'创建扫码试玩',exact:true}).click();
  const player=page.frameLocator('iframe[title="试玩玩家"]');
  await player.getByRole('textbox',{name:/测试昵称/}).fill('幸运来宾');
  await player.getByRole('button',{name:'加入活动',exact:true}).click();
  if(variant==='balloon')await player.getByRole('button',{name:'一路生花',exact:true}).click();
  await page.getByRole('button',{name:'开始试玩',exact:true}).click();
  const rid=(await page.locator('iframe[title="试玩玩家"]').getAttribute('src')).split('/').pop();
  const state=async()=>(await fetch('http://127.0.0.1:8012/rooms/'+rid)).json();
  await expect.poll(async()=>(await state()).state,{timeout:8000}).toBe('running');
  if(variant==='treasure'){
   await expect(page.getByRole('button',{name:'抽取并锁定结果',exact:true})).toBeDisabled();
   await expect.poll(async()=>{const r=await state();if(r.game.charge<r.config.goal)await player.getByRole('button',{name:'点击寻宝助力',exact:true}).click();return (await state()).game.charge;},{timeout:18000,intervals:[280]}).toBe(20);
  }
  await page.getByRole('button',{name:'抽取并锁定结果',exact:true}).click();
  await expect.poll(async()=>!!(await state()).game.result).toBe(true);
  const result=(await state()).game.result;
  if(['egg','box'].includes(variant)){
   await player.getByRole('button',{name:variant==='egg'?'砸开金蛋':'打开礼盒',exact:true}).click();
   await expect.poll(async()=>(await state()).game.revealed.length).toBe(1);
   await page.getByRole('button',{name:'代揭晓全部',exact:true}).click();
  }
  await player.getByRole('button',{name:'重播揭晓动画',exact:true}).click();
  expect((await state()).game.result).toEqual(result);
  await page.screenshot({path:path.join(os.tmpdir(),`eventplay-draw-${variant}.png`),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.setViewportSize({width:1440,height:1000});
  console.log('PASS draw',variant);
 }
 expect(errors).toEqual([]);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
