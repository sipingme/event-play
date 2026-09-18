const {chromium,expect}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const path=require('node:path'),os=require('node:os');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addInitScript(()=>{const f=window.fetch.bind(window);window.fetch=(u,o)=>f(typeof u==='string'?u.replace(':8001/',':8012/'):u,o);const W=window.WebSocket;window.WebSocket=class extends W{constructor(u,p){super(String(u).replace(':8001/',':8012/'),p);}};});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try {for(const variant of ['mole','rhythm','stack','basket','fruit','chef','fish','memory']){
   await page.goto('http://127.0.0.1:4191/dashboard/templates/reaction-'+variant);
   const stage=page.locator('[data-coordination-stage]');await expect(stage).toHaveAttribute('data-coordination-stage',variant);
   await stage.evaluate(async el=>{await Promise.all([...el.querySelectorAll('img')].map(i=>i.decode()));const src=getComputedStyle(el).backgroundImage.slice(5,-2);await new Promise((ok,bad)=>{const i=new Image();i.onload=ok;i.onerror=bad;i.src=src;});});
   await stage.screenshot({path:path.join(os.tmpdir(),'eventplay-coordination-'+variant+'.png')});
   await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.setViewportSize({width:1440,height:1000});
   await page.getByRole('button',{name:'创建扫码试玩',exact:true}).click();
   const player=page.frameLocator('iframe[title="试玩玩家"]');await player.getByRole('textbox',{name:/测试昵称/}).fill('协调测试');await player.getByRole('button',{name:'加入活动',exact:true}).click();
   await page.getByRole('button',{name:'开始试玩',exact:true}).click();
   const rid=(await page.locator('iframe[title="试玩玩家"]').getAttribute('src')).split('/').pop();const state=async()=>(await fetch('http://127.0.0.1:8012/rooms/'+rid)).json();
   await expect.poll(async()=>(await state()).state,{timeout:8000}).toBe('running');
   if(variant==='mole') {await player.locator('[data-target=true]').click();}
   else {
     const response=page.waitForResponse(r=>r.url().endsWith('/challenge')&&r.request().method()==='POST');
     await player.getByRole('button',{name:'开始挑战',exact:true}).click();const c=await (await response).json();
     if(['rhythm','stack','basket','fish'].includes(variant)){
       const frame=page.frames().find(f=>f.url().includes('/live/play/'));
       await frame.waitForFunction(target=>{const el=document.querySelector('[class*=needle]')||document.querySelector('[class*=block]:not([class*=base])');return el&&Math.abs(parseFloat(el.style.left)-target)<3;},c.target,{polling:10});
       await player.getByRole('button',{name:{rhythm:'敲鼓',stack:'落下楼层',basket:'投篮',fish:'收竿'}[variant],exact:true}).click();
     } else if(variant==='chef') {await page.waitForTimeout(200);for(const cell of c.sequence)await player.getByRole('button',{name:['面包','生菜','芝士','肉饼'][cell],exact:true}).click();}
     else if(variant==='memory') {await page.waitForTimeout(2100);for(const value of [0,1,2]){for(const cell of c.board.map((v,i)=>v===value?i:-1).filter(i=>i>=0)){await player.getByRole('button',{name:'卡片 '+(cell+1),exact:true}).click();await page.waitForTimeout(220);}await page.waitForTimeout(750);}}
     else {await player.getByLabel('滑动切苹果，避开炸弹').scrollIntoViewIfNeeded();const box=await player.getByLabel('滑动切苹果，避开炸弹').boundingBox();await page.mouse.move(box.x+(c.x-10)/100*box.width,box.y+c.y/100*box.height);await page.mouse.down();await page.mouse.move(box.x+(c.x+10)/100*box.width,box.y+c.y/100*box.height,{steps:8});await page.mouse.up();}
   }
   await expect.poll(async()=>(await state()).scores[0]).toBeGreaterThan(0);
   await page.getByRole('button',{name:'暂停试玩',exact:true}).click();await expect.poll(async()=>(await state()).state).toBe('paused');
   await page.getByRole('button',{name:'结束试玩',exact:true}).click();
   await page.getByRole('button',{name:'用此模板创建',exact:true}).click();await expect(page.locator('[data-coordination-stage]')).toHaveAttribute('data-coordination-stage',variant);
   console.log('PASS preview, mobile, real input and score, pause, create:',variant);
 }expect(errors).toEqual([]);}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
