import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
const b=await chromium.launch();
const p=await b.newPage({viewport:{width:390,height:844}}),errors=[],requests=[];
p.on('pageerror',e=>errors.push(e.message));
p.on('response',r=>{if(r.url().includes('/audio/'))requests.push({url:r.url(),status:r.status()});});
await p.addInitScript(()=>{
  window.audioContexts=[];window.handlers={};
  const Native=window.AudioContext;
  window.AudioContext=class extends Native {
    constructor(...args){super(...args);window.audioContexts.push(this);this.sources=[];this.gains=[];}
    createBufferSource(){const s=super.createBufferSource();this.sources.push(s);return s;}
    createGain(){const g=super.createGain();this.gains.push(g);return g;}
  };
  window.YaGames={init:async()=>({environment:{i18n:{lang:'ru'}},features:{LoadingAPI:{ready(){}},GameplayAPI:{start(){},stop(){}}},on:(e,fn)=>window.handlers[e]=fn})};
});
await p.goto('http://127.0.0.1:5180/?platform=1');
assert.equal(await p.evaluate(()=>window.audioContexts.length),0,'no sound before gesture');
await p.locator('.nav-item[data-nav="brawlers"]').click();
await expect.poll(()=>requests.some(r=>r.url.endsWith('menu.mp3')&&r.status===200)).toBe(true);
await expect.poll(()=>p.evaluate(()=>window.audioContexts[0]?.sources.filter(s=>s.loop).length)).toBe(1);
await p.locator('.top-settings').click();
await expect(p.getByText('Звуковые эффекты',{exact:true})).toBeVisible();
await expect(p.getByText('Музыка',{exact:true})).toBeVisible();
await p.locator('[data-audio-volume="musicVolume"]').fill('20');
await p.locator('[data-audio-volume="soundVolume"]').fill('80');
await p.locator('[data-action="music"]').click();
await expect.poll(()=>p.evaluate(()=>JSON.parse(localStorage.getItem('brawl-click.save.v1')).data.run.music)).toBe(false);
await p.waitForTimeout(500);
assert.ok(await p.evaluate(()=>window.audioContexts[0].gains[0].gain.value<0.02),'music bus muted');
await p.locator('[data-action="music"]').click();
await p.screenshot({path:'artifacts/audio-settings-mobile.png',animations:'disabled'});
await p.locator('[data-action="close"]').click();
await p.locator('.nav-item[data-nav="home"]').click();
await p.locator('[data-action="rush-start"]').click();
await expect.poll(()=>requests.some(r=>r.url.endsWith('rush.mp3'))).toBe(true);
await p.locator('[data-action="ability"]').click();
await expect.poll(()=>requests.some(r=>r.url.endsWith('super.mp3'))).toBe(true);
await p.evaluate(()=>window.handlers.game_api_pause());
await expect.poll(()=>p.evaluate(()=>window.audioContexts[0].state)).toBe('suspended');
const time=await p.evaluate(()=>window.audioContexts[0].currentTime);
await p.waitForTimeout(300);
assert.equal(await p.evaluate(()=>window.audioContexts[0].currentTime),time,'SDK pause freezes audio time');
await p.evaluate(()=>window.handlers.game_api_resume());
await expect.poll(()=>p.evaluate(()=>window.audioContexts[0].state)).toBe('running');
await p.reload();
await p.locator('.top-settings').click();
await expect(p.locator('[data-audio-volume="musicVolume"]')).toHaveValue('20');
await expect(p.locator('[data-audio-volume="soundVolume"]')).toHaveValue('80');
const decoded=await p.evaluate(async()=>{
  const c=window.audioContexts[0];const result={};
  for(const file of ['menu','rush','boss','win','lose','box','super','ui']){
    const r=await fetch('audio/'+file+'.mp3');const data=await c.decodeAudioData(await r.arrayBuffer());
    result[file]={duration:data.duration,channels:data.numberOfChannels};
  }
  return result;
});
assert.ok(Object.values(decoded).every(d=>d.duration>0));
assert.deepEqual(errors,[]);assert.ok(requests.every(r=>r.status===200));
await writeFile('artifacts/audio-check.json',JSON.stringify({decoded,requests,errors,checks:['gesture gate','menu/rush change','skill sample','independent controls','volume mute','SDK pause/resume','saved volume reload']},null,2));
console.log('Audio: 8 files decode; gesture, transitions, controls, mute, SDK pause/resume and persistence passed');
await b.close();
