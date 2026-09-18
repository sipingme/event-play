const {chromium,expect}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const path=require('node:path');const os=require('node:os');
const base='http://127.0.0.1:8012';
async function api(route,body,token){const r=await fetch(base+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error(await r.text());return r.json();}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(()=>{const f=window.fetch.bind(window);window.fetch=(u,o)=>f(typeof u==='string'?u.replace(':8001/',':8012/'):u,o);const W=window.WebSocket;window.WebSocket=class extends W{constructor(u,p){super(String(u).replace(':8001/',':8012/'),p);}};});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.goto('http://127.0.0.1:4191/dashboard/templates');await page.getByRole('button',{name:'摇一摇',exact:true}).click();await expect(page.getByText('看效果 / 试玩',{exact:true})).toHaveCount(8);
 await page.screenshot({path:path.join(os.tmpdir(),'eventplay-shake-library.png'),fullPage:true});
 for(const variant of ['yacht','car','motorbike','spaceship','rocket','penguin','balloon']){
   for(const kind of ['bg','sprite']) {
     const response=await page.request.get(`http://127.0.0.1:4191/games/race/illustrated/${variant}-${kind}-v2.png`);
     expect(response.ok()).toBe(true);expect(response.headers()['content-type']).toContain('image/png');
   }
   await page.goto(`http://127.0.0.1:4191/dashboard/activities/new?template=shake-${variant}`);
   await page.getByRole('button',{name:'保存草稿',exact:true}).click();await page.waitForURL(/\/activities\/[^/]+\/edit/);
   const aid=page.url().split('/').at(-2);
   const saved=await page.evaluate(aid=>JSON.parse(localStorage.getItem('eventplay.activities.v1')).find(a=>a.id===aid),aid);
   expect(saved.raceVariant).toBe(variant);expect(saved.inputMode).toBe('shake');
   const created=await api('/rooms',{...saved,participants:10,duration:60,teams:'阳光队,闪电队,追风队,梦想队'});const rid=created.room.id;
   const command=action=>api(`/rooms/${rid}/command`,{action},created.token);
   const p=await api(`/rooms/${rid}/join`,{name:'验收玩家',team:0});
   await page.goto(`http://127.0.0.1:4191/live/screen/${rid}`);
   const arena=page.locator('[data-race-stage]');await expect(arena).toHaveAttribute('data-race-variant',variant);
   await expect(page.locator(`[data-race-vehicle="${variant}"]`)).toHaveCount(4);
   await arena.locator('image').evaluateAll(nodes=>Promise.all(nodes.map(node=>new Promise((resolve,reject)=>{const img=new Image();img.onload=resolve;img.onerror=reject;img.src=node.getAttribute('href');}))));
   await command('start');await api(`/rooms/${rid}/tap`,{seq:1,kind:'shake'},p.token);
   await expect(arena).toHaveAttribute('data-moving','true');await expect(page.getByText('领先中',{exact:true})).toBeVisible();
   await arena.screenshot({path:path.join(os.tmpdir(),`eventplay-${variant}.png`)});
   await page.setViewportSize({width:390,height:844});await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   await arena.screenshot({path:path.join(os.tmpdir(),`eventplay-${variant}-mobile.png`)});
   await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({reducedMotion:'no-preference'});await command('pause');await expect(arena).toHaveAttribute('data-moving','false');
   expect(await arena.locator('svg[data-race-vehicle]').evaluateAll(xs=>xs.map(x=>getComputedStyle(x.parentElement).animationName))).toEqual(['none','none','none','none']);
   await command('finish');await expect(page.getByRole('list',{name:'战队最终排名'}).getByRole('listitem')).toHaveCount(4);
   await page.emulateMedia({reducedMotion:'reduce'});console.log('PASS',variant,'draft, actual room, scoring, mobile, pause, final ranking');
 }
 if(errors.length)throw Error(errors.join('\n'));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
