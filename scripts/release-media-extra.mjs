import { chromium } from '@playwright/test';
import { ClickGame } from '../src/engine.ts';
import { BRAWLERS } from '../src/data.ts';
import { writeFile } from 'node:fs/promises';
const b=await chromium.launch();
for(const [device,viewport] of [['desktop',{width:1280,height:720}],['mobile',{width:540,height:960}]]) {
 for(const route of ['home','arena','boxes','brawlers']) {
  const g=new ClickGame();g.state.sound=false;g.state.music=false;g.state.language='en';g.state.coins=17250;g.state.trophies=175;
  g.state.fighters.push(...BRAWLERS.slice(1,9).map(b=>({id:b.id,level:3,cards:0})));
  const p=await b.newPage({viewport});
  await p.addInitScript(state=>localStorage.setItem('brawl-click.save.v1',JSON.stringify({version:1,updatedAt:Date.now(),data:{sound:false,music:false,run:state}})),g.snapshot());
  await p.goto('http://127.0.0.1:5180/');
  if(route==='home') await p.locator('[data-action="rush-start"]').click();
  else {await p.locator(`.nav-item[data-nav="${route}"]`).click();if(route==='arena')await p.locator('[data-action="battle"]').click();}
  await p.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>{i.loading='eager';return i.decode().catch(()=>{})})));
  await p.screenshot({path:`artifacts/yandex/${device}-${route==='home'?'rush':route}-en.png`,animations:'disabled'});
  await p.close();
 }
}
const context=await b.newContext({viewport:{width:540,height:960},recordVideo:{dir:'artifacts/yandex/raw-video',size:{width:540,height:960}}});
const p=await context.newPage();await p.goto('http://127.0.0.1:5180/');await p.locator('[data-action="rush-start"]').click();
const start=Date.now();let skill=false;
while(Date.now()-start<15000){
 const rect=await p.locator('.rush-target:not(.bomb)').first().boundingBox().catch(()=>null);
 if(rect)await p.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);
 if(!skill && Date.now()-start>3000){await p.locator('[data-action="ability"]').click();skill=true;}
 if(await p.locator('[data-action="super"]').isEnabled())await p.locator('[data-action="super"]').click();
 await p.waitForTimeout(200);
}
const video=p.video();await context.close();const videoPath=await video.path();
await writeFile('artifacts/yandex/vertical-video.json',JSON.stringify({videoPath},null,2));
console.log(videoPath);await b.close();
