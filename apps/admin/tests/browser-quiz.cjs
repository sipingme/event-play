// Use isolated UI 4191 and in-memory API 8012.
const {chromium,expect}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const path=require('node:path');
const os=require('node:os');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  await context.addInitScript(()=>{
    const original=window.fetch.bind(window);
    window.fetch=(url,options)=>original(typeof url==='string'?url.replace(':8001/',':8012/'):url,options);
    const Socket=window.WebSocket;
    window.WebSocket=class extends Socket{constructor(url,protocols){super(String(url).replace(':8001/',':8012/'),protocols);}};
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4191/dashboard/templates');
  await page.getByRole('button',{name:'知识答题',exact:true}).click();
  await expect(page.getByText('看效果 / 试玩',{exact:true})).toHaveCount(8);
  await page.screenshot({path:path.join(os.tmpdir(),'eventplay-quiz-library.png'),fullPage:true});
  for(const variant of ['space','boolean','buzzer','race','picture','clues','tower','boss']){
    await page.goto('http://127.0.0.1:4191/dashboard/templates/quiz-'+variant);
    await page.getByRole('button',{name:'创建扫码试玩',exact:true}).click();
    const player=page.frameLocator('iframe[title="试玩玩家"]');
    await player.getByRole('textbox',{name:/测试昵称/}).fill('知识玩家');
    await player.getByRole('button',{name:'加入活动',exact:true}).click();
    await page.getByRole('button',{name:'开始试玩',exact:true}).click();
    const rid=(await page.locator('iframe[title="试玩玩家"]').getAttribute('src')).split('/').pop();
    const state=async()=> (await fetch('http://127.0.0.1:8012/rooms/'+rid)).json();
    await expect.poll(async()=>(await state()).state,{timeout:8000}).toBe('running');
    if(variant==='buzzer')await player.getByRole('button',{name:'立即抢答',exact:true}).click();
    await player.getByRole('button',{name:/^A · /}).click();
    await expect(player.getByText('本题已提交，不可修改。',{exact:true})).toBeVisible();
    if(variant==='picture')await expect(player.getByAltText('本题题图')).toBeVisible();
    if(variant==='clues')await expect(player.getByText(/线索 1 ·/)).toBeVisible();
    await expect.poll(async()=>(await state()).scores[0],{timeout:18000}).toBeGreaterThan(0);
    await page.getByRole('button',{name:'暂停试玩',exact:true}).click();
    await expect.poll(async()=>(await state()).state).toBe('paused');
    await expect(player.getByRole('button',{name:/^A · /})).toBeDisabled();
    await page.screenshot({path:path.join(os.tmpdir(),`eventplay-quiz-${variant}.png`),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.setViewportSize({width:1440,height:1000});
    await page.getByRole('button',{name:'结束试玩',exact:true}).click();
    console.log('PASS quiz',variant);
  }
  expect(errors).toEqual([]);
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
