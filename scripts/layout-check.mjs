import assert from 'node:assert/strict';
import { chromium } from "@playwright/test";
const b = await chromium.launch();
for (const viewport of [
  { width: 1280, height: 720 },
  { width: 390, height: 844 },
  { width: 320, height: 720 },
  { width: 844, height: 390 },
]) {
  const p = await b.newPage({ viewport });
  await p.goto("http://127.0.0.1:5180/");
  const start = await p.locator('[data-action="rush-start"]').boundingBox(), scene = await p.locator('.rush-scene').boundingBox(), rail = await p.locator('.rail').boundingBox();
  assert.ok(start.y >= scene.y && start.y + start.height <= scene.y + scene.height, `start not clipped at ${viewport.width}x${viewport.height}`);
  assert.ok(start.y + start.height <= rail.y, `start above navigation at ${viewport.width}`);
  await p.locator('[data-action="rush-start"]').click();
  const measure = () =>
    p.evaluate(() =>
      Object.fromEntries(
        [
          "main",
          ".rail",
          ".rush-panel",
          ".rush-scene",
          ".training-top",
          ".training-bottom",
          ".combat-controls",
          '[data-action="ability"]',
          '[data-action="dodge"]',
          ".boss-arena",
          ".boss-target",
          ".battle-bottom",
        ].map((q) => {
          const e = document.querySelector(q),
            r = e?.getBoundingClientRect();
          return [q, r ? { y: r.y, h: r.height, b: r.bottom } : null];
        }),
      ),
    );
  const skill = await p.locator('[data-action="ability"]').boundingBox();
  assert.ok(skill.y+skill.height<=rail.y, `ability fits ${viewport.width}`);
  console.log("RUSH", viewport, await measure());
  await p.screenshot({ path: `artifacts/rush-${viewport.width}.jpg` });
  await p.close();
  const a = await b.newPage({ viewport });
  await a.goto("http://127.0.0.1:5180/");
  await a.locator('.nav-item[data-nav="arena"]').click();
  await a.locator('[data-action="battle"]').click();
  await a.locator(".boss-sprite").evaluate(el=>el.decode());
  console.log(
    "BOSS",
    viewport,
    await a.evaluate(() =>
      Object.fromEntries(
        [
          "main",
          ".rail",
          ".boss-arena",
          ".boss-target",
          ".battle-bottom",
          ".combat-controls",
          '[data-action="dodge"]',
        ].map((q) => {
          const r = document.querySelector(q)?.getBoundingClientRect();
          return [q, r ? { y: r.y, h: r.height, b: r.bottom } : null];
        }),
      ),
    ),
  );
  const dodge = await a.locator('[data-action="dodge"]').boundingBox(), aRail = await a.locator('.rail').boundingBox();
  assert.ok(dodge.y+dodge.height<=aRail.y, `dodge fits ${viewport.width}`);
  await a.screenshot({ path: `artifacts/boss-${viewport.width}.jpg` });
  await a.close();
}
await b.close();
