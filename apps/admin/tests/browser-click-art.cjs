const {chromium,expect}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const path=require('node:path'),os=require('node:os');
(async()=>{const b=await chromium.launch({channel:'chrome',headless:true});const ctx=await b.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
await ctx.addInitScript(()=>{const f=fetch.bind(window);window.fetch=(u,o)=>f(typeof u==='string'?u.replace(':8001/',':8012/'):u,o);const W=WebSocket;window.WebSocket=class extends W{constructor(u,p){super(String(u).replace(':8001/',':8012/'),p)}}});
const api=async(route,body,token)=>{const r=await fetch('http://127.0.0.1:8012'+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error(await r.text());return r.json()};
try{for(const v of ['flower','tower','popcorn','balloon','rocket','brand','boss','tug']){
const coop=['flower','rocket','brand','boss'].includes(v),teams=v==='tug'?'红队,蓝队':'红队,蓝队,绿队,紫队';
const c=await api('/rooms',{name:v,clickVariant:v,mechanic:coop?'light':v==='tug'?'tug':'race',theme:'garden',goal:10,duration:60,participants:20,teams});const id=c.room.id;
const p=await api('/rooms/'+id+'/join',{name:'状态测试',team:0});const page=await ctx.newPage();await page.goto('http://127.0.0.1:4191/live/screen/'+id);const stage=page.locator('[data-click-stage]');const art=stage.locator('[data-click-art]').first();await expect(art).toHaveAttribute('data-art-progress','0');
await api('/rooms/'+id+'/command',{action:'start'},c.token);
for(let seq=1;seq<=3;seq++)await api('/rooms/'+id+'/tap',{seq},p.token);
if(v==='flower')await expect(art).toHaveAttribute('data-art-stage','1');
for(let seq=4;seq<=10;seq++)await api('/rooms/'+id+'/tap',{seq},p.token);
if(v!=='tug')await expect(art).toHaveAttribute('data-art-progress','1');
if(v==='flower')await expect(art).toHaveAttribute('data-art-stage','2');
if(v==='tower')await expect(art.locator('[data-floor]')).toHaveCount(6);
if(coop){await expect(stage).toHaveAttribute('data-moving','false');await expect(stage.getByRole('status')).toBeVisible();}
else {await api('/rooms/'+id+'/command',{action:'pause'},c.token);await expect(stage).toHaveAttribute('data-moving','false');}
await page.setViewportSize({width:390,height:844});await expect.poll(async()=>(await stage.boundingBox()).width).toBeLessThanOrEqual(390);
await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
await page.close();console.log('PASS illustrated states: zero, goal, paused/completed, mobile:',v);
}}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
