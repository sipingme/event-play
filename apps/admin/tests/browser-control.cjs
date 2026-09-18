const {chromium,expect}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const path=require('node:path'),os=require('node:os');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const ctx=await browser.newContext({viewport:{width:1440,height:1000}});
 await ctx.addInitScript(()=>{const f=window.fetch.bind(window);window.fetch=(u,o)=>f(typeof u==='string'?u.replace(':8001/',':8012/'):u,o);const W=window.WebSocket;window.WebSocket=class extends W{constructor(u,p){super(String(u).replace(':8001/',':8012/'),p);}};});
 const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try {for(const variant of ['coins','runner','space','ski','boat','parking','maze','balance']){
   await page.goto('http://127.0.0.1:4191/dashboard/templates/control-'+variant);
   const scene=page.locator('[data-control-stage]');await expect(scene).toHaveAttribute('data-control-stage',variant);
   await scene.evaluate(async el=>{await Promise.all([...el.querySelectorAll('img')].map(i=>i.decode()));const src=getComputedStyle(el).backgroundImage.slice(5,-2);await new Promise((ok,bad)=>{const i=new Image();i.onload=ok;i.onerror=bad;i.src=src;});});
   await scene.screenshot({path:path.join(os.tmpdir(),'eventplay-control-'+variant+'.png')});
   await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1440,height:1000});
   await page.getByRole('button',{name:'创建扫码试玩',exact:true}).click();const player=page.frameLocator('iframe[title="试玩玩家"]');
   await player.getByRole('textbox',{name:/测试昵称/}).fill('控制测试');await player.getByRole('button',{name:'加入活动',exact:true}).click();
   await page.getByRole('button',{name:'开始试玩',exact:true}).click();
   const rid=(await page.locator('iframe[title="试玩玩家"]').getAttribute('src')).split('/').pop();const state=async()=>(await fetch('http://127.0.0.1:8012/rooms/'+rid)).json();
   await expect.poll(async()=>(await state()).state,{timeout:8000}).toBe('running');
   const press=async name=>{await player.getByRole('button',{name,exact:true}).click();await page.waitForTimeout(190);};
   if(variant==='maze'){for(let i=0;i<4;i++)await press('向右');for(let i=0;i<4;i++)await press('向上');}
   else if(variant==='parking'){await press('右转');for(let i=0;i<4;i++)await press('前进');await press('左转');for(let i=0;i<4;i++)await press('前进');}
   else if(variant==='balance'){for(const direction of ['向右','向上'])for(let i=0;i<4;i++){await press('刹车');await press(direction);}}
   else {const s=await state(),target=s.game.lane;if(target!==1)await press(target===0?'向左移动':'向右移动');}
   await expect.poll(async()=>(await state()).scores[0],{timeout:7000}).toBeGreaterThan(0);
   await player.locator('[data-control-stage]').screenshot({path:path.join(os.tmpdir(),'eventplay-control-player-'+variant+'.png')});
   await page.getByRole('button',{name:'暂停试玩',exact:true}).click();await expect.poll(async()=>(await state()).state).toBe('paused');
   await expect(player.getByRole('button').first()).toBeDisabled();
   await page.getByRole('button',{name:'结束试玩',exact:true}).click();
   await page.getByRole('button',{name:'用此模板创建',exact:true}).click();await expect(page.locator('[data-control-stage]')).toHaveAttribute('data-control-stage',variant);
   console.log('PASS scene, mobile, real control, score, pause, create:',variant);
 }expect(errors).toEqual([]);}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
