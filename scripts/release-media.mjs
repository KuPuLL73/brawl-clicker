import { chromium, expect } from '@playwright/test';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { ClickGame } from '../src/engine.ts';
import { BRAWLERS } from '../src/data.ts';
const out = 'artifacts/yandex';
await mkdir(out,{recursive:true});
const browser = await chromium.launch();
const asset = async path=>'data:image/png;base64,'+(await readFile('public/'+path)).toString('base64');
const art = Object.fromEntries(await Promise.all(['art/arena.png','art/shelly.png','art/bot.png','art/box.png','art/bosses/bull.png'].map(async path=>[path,await asset(path)])));
const p = await browser.newPage();
for(const language of ['ru','en']) {
  await p.setViewportSize({width:800,height:470});
  await p.setContent(`<style>*{box-sizing:border-box}body{margin:0;width:800px;height:470px;overflow:hidden;background:#123f89;font-family:Arial,sans-serif;color:white}.bg{position:absolute;width:100%;height:100%;object-fit:cover;filter:brightness(.55)}.wash{position:absolute;inset:0;background:linear-gradient(90deg,#102d80ee,#3f17b566 60%,#0c205080)}.burst{position:absolute;width:580px;height:580px;border-radius:50%;background:radial-gradient(#34c9ff70,transparent 65%);top:-60px;right:-40px}.shelly{position:absolute;height:420px;right:75px;bottom:-12px;filter:drop-shadow(0 10px 8px #071b44)}.bot{position:absolute;height:170px;right:4px;bottom:24px;transform:rotate(9deg)}.box{position:absolute;width:170px;left:300px;bottom:12px;filter:drop-shadow(0 8px 2px #07152a)}.copy{position:absolute;left:32px;top:42px;z-index:2;width:390px}small{font-size:13px;font-weight:900;letter-spacing:4px;color:#9ce5ff}h1{font-size:62px;line-height:.96;margin:18px 0 12px;font-weight:1000;letter-spacing:-3px;text-shadow:0 6px 0 #07122f;-webkit-text-stroke:1px #091e56}h1 span{color:#ffda41}h2{font-size:26px;line-height:1.08;margin:0 0 27px;text-shadow:0 3px #11204e}.pill{display:inline-block;border:2px solid #ffe271;background:#ffcb36;color:#392814;padding:11px 17px;border-radius:10px;box-shadow:0 5px #b67a10;font-size:16px;font-weight:900}</style><img class="bg" src="${art['art/arena.png']}"><div class="wash"></div><div class="burst"></div><img class="shelly" src="${art['art/shelly.png']}"><img class="bot" src="${art['art/bot.png']}"><img class="box" src="${art['art/box.png']}"><div class="copy"><small>${language==='ru'?'СОБЕРИ. ПРОКАЧАЙ. ПОБЕДИ.':'COLLECT. UPGRADE. CONQUER.'}</small><h1>BRAWL<br><span>CLICK</span></h1><h2>${language==='ru'?'РЕЙДЫ И БОССЫ':'RUSH AND BOSSES'}</h2><div class="pill">${language==='ru'?'30 БОЙЦОВ · 12 БОССОВ':'30 BRAWLERS · 12 BOSSES'}</div></div>`);
  await p.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  await p.screenshot({path:`${out}/cover-${language}.png`});
}
await p.setViewportSize({width:512,height:512});
await p.setContent(`<style>body{margin:0;width:512px;height:512px;overflow:hidden;background:radial-gradient(circle at 50% 35%,#8ee9ff,#267bdd 55%,#292786);box-shadow:inset 0 0 0 15px #091f57;position:relative}.hero{position:absolute;height:470px;right:38px;top:10px;filter:drop-shadow(0 12px 4px #061e6766)}.box{position:absolute;width:250px;bottom:-5px;left:-8px;filter:drop-shadow(0 10px 3px #06133a)}.mark{position:absolute;right:20px;bottom:12px;transform:rotate(-8deg);font:1000 92px Arial;color:#ffe14c;-webkit-text-stroke:5px #102050;text-shadow:0 8px #091b42}</style><img class="hero" src="${art['art/shelly.png']}"><img class="box" src="${art['art/box.png']}"><div class="mark">+1</div>`);
await p.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
await p.screenshot({path:`${out}/icon.png`});
await p.close();
const base = () => {
  const g = new ClickGame();
  g.state.sound=false;g.state.music=false;g.state.coins=17250;g.state.gems=36;g.state.power=240;g.state.trophies=175;
  g.state.fighters.push(...BRAWLERS.slice(1,9).map(b=>({id:b.id,level:3,cards:0})));
  g.state.team = g.state.fighters.slice(0,3).map(f=>f.id);
  return g;
};
const shots=[];
for(const [device,viewport] of [['desktop',{width:1280,height:720}],['mobile',{width:540,height:960}]]) {
  const page=await browser.newPage({viewport});
  const g=base();
  await page.addInitScript(state=>{
    if(!localStorage.getItem('media-seed')) {
      localStorage.setItem('brawl-click.save.v1',JSON.stringify({version:1,updatedAt:Date.now(),data:{sound:false,music:false,run:state}}));
      localStorage.setItem('media-seed','1');
    }
  },g.snapshot());
  await page.goto('http://127.0.0.1:5180/');
  await page.locator('[data-action="rush-start"]').click();
  await page.locator('[data-action="ability"]').click();
  await page.waitForTimeout(400);
  await page.screenshot({path:`${out}/${device}-rush.png`,animations:'disabled'});shots.push(`${device}-rush.png`);
  // A new independent page for the arena, without editing an active player's save.
  await page.close();
  for(const route of ['arena','boxes','brawlers']) {
    const q=await browser.newPage({viewport});
    const state=base().snapshot();
    await q.addInitScript(state=>localStorage.setItem('brawl-click.save.v1',JSON.stringify({version:1,updatedAt:Date.now(),data:{sound:false,music:false,run:state}})),state);
    await q.goto('http://127.0.0.1:5180/');
    await q.locator(`.nav-item[data-nav="${route}"]`).click();
    if(route==='arena') await q.locator('[data-action="battle"]').click();
    await q.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>{i.loading='eager';return i.decode().catch(()=>{})})));
    await q.screenshot({path:`${out}/${device}-${route}.png`,animations:'disabled'});shots.push(`${device}-${route}.png`);
    await q.close();
  }
}
// Genuine, uncut browser gameplay recording; no simulated ad is included.
const context=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:`${out}/raw-video`,size:{width:1280,height:720}}});
const videoPage=await context.newPage();
await videoPage.goto('http://127.0.0.1:5180/');
await videoPage.locator('[data-action="rush-start"]').click();
const started=Date.now();let used=false;
while(Date.now()-started<21000) {
  const target=videoPage.locator('.rush-target:not(.bomb)').first();
  const rect=await target.boundingBox().catch(()=>null);
  if(rect) await videoPage.mouse.click(rect.x+rect.width/2,rect.y+rect.height/2);
  if(!used && Date.now()-started>3000) {await videoPage.locator('[data-action="ability"]').click();used=true;}
  const superButton=videoPage.locator('[data-action="super"]');
  if(await superButton.isEnabled()) await superButton.click();
  await videoPage.waitForTimeout(180);
}
const video=videoPage.video();await context.close();
const videoPath=await video.path();
await writeFile(`${out}/media-manifest.json`,JSON.stringify({date:'2026-10-24',shots,videoPath,kind:'actual browser gameplay; silent recording',covers:'HTML/CSS composition using existing game art'},null,2));
console.log(JSON.stringify({shots,videoPath}));
await browser.close();
