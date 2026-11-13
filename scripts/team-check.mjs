import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { ClickGame } from '../src/engine.ts';
import { BRAWLERS } from '../src/data.ts';
const browser = await chromium.launch();
const errors = [], checks = [];
for (const viewport of [{width:390,height:844},{width:1280,height:720}]) {
  const p = await browser.newPage({viewport});
  p.on('pageerror',e=>errors.push(e.message));
  const g = new ClickGame();
  g.state.sound = false;
  g.state.fighters.push(...BRAWLERS.slice(1,4).map(b=>({id:b.id,level:1,cards:0})));
  await p.addInitScript(s=>{
    if (!localStorage.getItem('team-test')) {
      localStorage.setItem('brawl-click.save.v1',JSON.stringify({version:1,updatedAt:Date.now(),data:{sound:false,run:s}}));
      localStorage.setItem('team-test','1');
    }
  },g.snapshot());
  await p.goto('http://127.0.0.1:5180/');
  await p.locator('.nav-item[data-nav="brawlers"]').click();
  const plus = p.getByRole('button',{name:'Добавить бойца в команду',exact:true});
  await plus.first().focus();
  await p.keyboard.press('Enter');
  await expect(p.locator('#modal')).toBeVisible();
  await expect(p.locator('[data-add-team]')).toHaveCount(3);
  await expect(p.locator(`[data-add-team="${BRAWLERS[0].id}"]`)).toHaveCount(0);
  await expect(p.locator(`[data-add-team="${BRAWLERS[4].id}"]`)).toHaveCount(0);
  if(viewport.width===390) await p.screenshot({path:'artifacts/team-picker-mobile.png'});
  await p.locator(`[data-add-team="${BRAWLERS[1].id}"]`).click();
  await expect(p.locator('#modal')).not.toBeVisible();
  let state = await p.evaluate(()=>JSON.parse(localStorage.getItem('brawl-click.save.v1')).data.run);
  assert.deepEqual(state.team,[BRAWLERS[0].id,BRAWLERS[1].id]);
  await plus.click();
  await expect(p.locator('[data-add-team]')).toHaveCount(2);
  await p.locator(`[data-add-team="${BRAWLERS[2].id}"]`).click();
  await expect(plus).toHaveCount(0);
  await p.reload();
  await p.locator('.nav-item[data-nav="brawlers"]').click();
  await expect(p.locator('.team-strip [data-fighter]')).toHaveCount(3);
  checks.push(`${viewport.width}: owned-only picker, keyboard activation, direct add, team cap and reload`);
  await p.close();
}
const p = await browser.newPage();
await p.goto('http://127.0.0.1:5180/');
await p.locator('.nav-item[data-nav="brawlers"]').click();
await p.getByRole('button',{name:'Добавить бойца в команду',exact:true}).first().click();
await expect(p.getByText('Все открытые бойцы уже в команде')).toBeVisible();
await p.locator('#modal [data-go="boxes"]').click();
await expect(p.locator('.box-grid')).toBeVisible();
checks.push('new save: useful empty state and working boxes shortcut');
assert.deepEqual(errors,[]);
await writeFile('artifacts/team-check.json',JSON.stringify({checks,errors},null,2));
console.log(checks.join('\n'));
await browser.close();
