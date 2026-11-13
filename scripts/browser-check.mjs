import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { ClickGame } from "../src/engine.ts";
import { BRAWLERS } from "../src/data.ts";
const url = process.env.BRAWL_URL || "http://127.0.0.1:5180";
const browser = await chromium.launch(),
  checks = [],
  errors = [],
  key = "brawl-click.save.v1";
const saved = (p) =>
  p.evaluate((key) => JSON.parse(localStorage.getItem(key)).data.run, key);
const nav = (p, route) =>
  p.locator(`.rail .nav-item[data-nav="${route}"]`).click();
async function fresh(sdk = true) {
  const p = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    locale: "ru-RU",
  });
  p.on("pageerror", (e) => errors.push(e.message));
  await p.clock.install({ time: new Date("2026-10-23T10:00:00Z") });
  await p.clock.pauseAt(new Date("2026-10-23T10:00:01Z"));
  await p.addInitScript(
    ({ key, sdk }) => {
      const seed = sessionStorage.getItem("seed");
      if (seed) {
        localStorage.setItem(
          key,
          JSON.stringify({
            version: 1,
            updatedAt: Date.now(),
            data: {
              bestScore: 0,
              bestWave: 0,
              wins: 0,
              sound: false,
              music: false,
              run: JSON.parse(seed),
            },
          }),
        );
        sessionStorage.removeItem("seed");
      }
      Math.random = () => 0.5;
      window.__handlers = {};
      window.__rewardCalls = 0;
      window.__fullCalls = 0;
      if (sdk)
        window.YaGames = {
          init: async () => ({
            environment: { i18n: { lang: "ru" } },
            on: (e, f) => (window.__handlers[e] = f),
            features: {
              LoadingAPI: {
                ready() {
                  window.__ready = true;
                },
              },
              GameplayAPI: { start() {}, stop() {} },
            },
            adv: {
              showRewardedVideo({ callbacks }) {
                window.__reward = callbacks;
                window.__rewardCalls++;
                callbacks.onOpen();
              },
              showFullscreenAdv({ callbacks }) {
                window.__full = callbacks;
                window.__fullCalls++;
                callbacks.onOpen();
              },
            },
            serverTime: () => Date.now(),
          }),
        };
    },
    { key, sdk },
  );
  await p.goto(url + (sdk ? "/?platform=1" : "/"), {
    waitUntil: "networkidle",
  });
  await expect(p.locator('[data-action="rush-start"]')).toBeVisible();
  return p;
}
async function seed(p, state) {
  await p.evaluate((state) => {
    state.lastSeen = Date.now();
    sessionStorage.setItem("seed", JSON.stringify(state));
  }, state);
  await p.reload({ waitUntil: "networkidle" });
}
async function skipBox(p) {
  const skip = p.locator('[data-action="box-skip"]');
  if (await skip.isVisible()) await skip.click();
}
async function reward(p, earned) {
  await p.evaluate((earned) => {
    if (earned) {
      window.__reward.onRewarded();
      window.__reward.onRewarded();
    }
    window.__reward.onClose();
    window.__reward.onClose();
  }, earned);
}
function state() {
  const g = new ClickGame(
    undefined,
    () => 0.5,
    Date.parse("2026-10-23T10:00:01Z"),
  );
  g.state.sound = false;
  return g.state;
}
try {
  const local = await fresh(false);
  await nav(local, "rewards");
  await expect(local.locator('[data-ad="daily"]')).toBeDisabled();
  await expect(local.locator('[data-ad="wheel"]')).toBeDisabled();
  assert.equal(
    await local.locator('[data-action="daily"],[data-action="wheel"]').count(),
    0,
  );
  await local.close();
  checks.push(
    "Daily and wheel are rewarded-only; local play never simulates an ad payout",
  );
  const p = await fresh();
  assert.equal(await p.evaluate(() => window.__ready), true);
  const loaded = await p
    .locator("img")
    .evaluateAll((imgs) => imgs.every((i) => i.complete && i.naturalWidth > 0));
  assert.ok(loaded);
  assert.ok((await p.locator(".wallet-item .themed-icon").count()) === 3);
  await p.locator('[data-action="rush-start"]').click();
  for (let i = 0; i < 12; i++) {
    await p.clock.runFor(100);
    await p
      .locator("[data-rush]")
      .nth(i % 3)
      .click();
  }
  let s = await saved(p);
  assert.equal(s.rush.hits, 12);
  assert.equal(s.rush.combo, 12);
  await expect(p.locator(".rush-scene")).toHaveClass(/fever/);
  await expect(p.locator('[data-action="super"]')).toBeEnabled();
  await p.locator('[data-action="super"]').click();
  s = await saved(p);
  assert.equal(s.rush.hits, 15);
  assert.equal(s.rush.charge, 0);
  await p.clock.runFor(200);
  await p.screenshot({ path: "artifacts/desktop-rush.jpg" });
  s = await saved(p);
  const remaining = s.rush.remaining;
  await p.evaluate(() => window.__handlers.game_api_pause());
  await p.clock.runFor(5000);
  await p.locator("[data-rush]").first().click();
  s = await saved(p);
  assert.equal(s.rush.hits, 15);
  assert.equal(s.rush.remaining, remaining);
  await p.evaluate(() => window.__handlers.game_api_resume());
  await p.reload({ waitUntil: "networkidle" });
  assert.equal((await saved(p)).rush.hits, 15);
  await expect(p.locator("[data-rush]")).toHaveCount(3);
  await p.clock.runFor(26000);
  await expect(p.locator(".result-content")).toBeVisible();
  s = await saved(p);
  assert.equal(s.pending.kind, "rush");
  assert.equal(s.rushRounds, 1);
  await p.locator('[data-action="claim-result"]').click();
  checks.push(
    "25-second moving-target Rush: combo colors, multi-target Super, SDK pause blocks hits/timer, reload restores round and result once",
  );
  // Regressions from real play: stable nodes, movement, every asset and scroll position.
  await seed(p, state());
  await p.locator('[data-action="rush-start"]').click();
  const untouched = p.locator("[data-rush]").nth(1),
    uid = await untouched.getAttribute("data-rush");
  await untouched.evaluate((el) => (el.dataset.proof = "same-node"));
  const left = await untouched.evaluate((el) => el.style.left);
  await p.clock.runFor(1000);
  assert.notEqual(await untouched.evaluate((el) => el.style.left), left);
  await p.locator("[data-rush]").first().click();
  assert.equal(
    await p.locator(`[data-rush="${uid}"]`).getAttribute("data-proof"),
    "same-node",
  );
  await p.clock.runFor(8000);
  assert.ok((await p.locator(`[data-rush="${uid}"]`).count()) === 1);
  await p.locator('[data-action="ability"]').click();
  await expect(p.locator('[data-action="ability"]')).toBeDisabled();
  await p.reload({ waitUntil: "networkidle" });
  await expect(p.locator('[data-action="ability"]')).toBeDisabled();
  checks.push(
    "Untouched targets move without respawning or replacing their DOM nodes; active ability cooldown survives reload",
  );
  await seed(p, state());
  await nav(p, "rewards");
  await p.locator("main").evaluate((el) => (el.scrollTop = 500));
  const scroll = await p.locator("main").evaluate((el) => el.scrollTop);
  assert.ok(scroll > 0);
  await p
    .locator(".quest-list")
    .evaluate((el) => (el.dataset.proof = "persistent"));
  await p.clock.runFor(5000);
  assert.equal(await p.locator("main").evaluate((el) => el.scrollTop), scroll);
  assert.equal(
    await p.locator(".quest-list").getAttribute("data-proof"),
    "persistent",
  );
  checks.push(
    "Bonus countdowns update in place for five seconds without jumping scroll or rebuilding the mission list",
  );
  for (let stage = 0; stage < 12; stage++) {
    const fixture = state();
    fixture.wins = stage;
    await seed(p, fixture);
    await nav(p, "arena");
    await expect(p.locator(".boss-stage")).toHaveCount(12);
    await expect(p.locator(".boss-sprite")).toHaveAttribute(
      "src",
      /art\/bosses\/.+\.png/,
    );
    await expect(p.locator(".boss-sprite")).toHaveJSProperty("complete", true);
    assert.ok(
      await p.locator(".boss-sprite").evaluate((el) => el.naturalWidth > 0),
    );
    if (stage === 0) await p.screenshot({ path: "artifacts/desktop-boss.jpg" });
  }
  for (const [kind, roll] of [
    ["gem", 0.05],
    ["coin", 0.15],
    ["power", 0.24],
    ["rival", 0.33],
    ["bomb", 0.4],
  ]) {
    const g = new ClickGame(undefined, () => roll, Date.now());
    g.state.sound = false;
    g.startRush();
    await seed(p, g.snapshot());
    await expect(
      p.locator(`.rush-target.${kind}`).first().locator("img"),
    ).toHaveJSProperty("complete", true);
    assert.ok(
      await p
        .locator(`.rush-target.${kind}`)
        .first()
        .locator("img")
        .evaluate((el) => el.naturalWidth > 0),
      `${kind} image loaded`,
    );
    await p.locator(`.rush-target.${kind}`).first().click();
  }
  checks.push(
    "Gem, coin, power cube, two-hit rival and bomb target images load and respond to clicks",
  );
  const finale = state();
  finale.wins = 11;
  const f = new ClickGame(finale, () => 0.5, Date.now());
  f.startBattle();
  f.state.battle.hp = 1;
  await seed(p, f.snapshot());
  await p.locator('[data-action="attack"]').click();
  await expect(p.locator(".chapter-clear")).toBeVisible();
  assert.equal((await saved(p)).stars, 1);
  await p.reload({ waitUntil: "networkidle" });
  await p.locator('[data-action="claim-result"]').click();
  await expect(p.locator(".count-badge")).toContainText("2");
  assert.equal((await saved(p)).stars, 1);
  await seed(p, state());
  await nav(p, "arena");
  await p.locator('[data-action="battle"]').click();
  await p.clock.runFor(4000);
  await expect(p.locator(".boss-arena")).toHaveClass(/warning/);
  await p.locator('[data-action="dodge"]').click();
  await p.clock.runFor(1000);
  assert.equal((await saved(p)).battle.playerHp, 100);
  await p.locator('[data-action="ability"]').click();
  await expect(p.locator('[data-action="ability"]')).toBeDisabled();
  await p.screenshot({ path: "artifacts/desktop-battle.jpg" });
  checks.push(
    "Twelve full-body boss sprites load; finale pays a permanent star once, next chapter opens, windup/dodge and character skill work",
  );
  await seed(p, state());
  await nav(p, "boxes");
  await p.locator('[data-open="0"]').click();
  const committed = await saved(p);
  assert.equal(committed.pending.kind, "box");
  await p.reload({ waitUntil: "networkidle" });
  assert.equal((await saved(p)).pending.id, committed.pending.id);
  assert.equal((await saved(p)).fighters.length, 2);
  await skipBox(p);
  await p.locator('[data-action="claim-result"]').click();
  checks.push(
    "Paid box commits before animation, guarantees first brawler and recovers the same drop after reload",
  );
  await seed(p, state());
  await nav(p, "rewards");
  let before = await saved(p);
  await p.locator('[data-ad="daily"]').click();
  await reward(p, false);
  await expect(p.locator('[data-ad="daily"]')).toBeEnabled();
  s = await saved(p);
  assert.equal(s.coins, before.coins);
  assert.equal(s.dailyAt, 0);
  await p.locator('[data-ad="daily"]').click();
  await reward(p, true);
  await expect(p.locator('[data-ad="daily"]')).toBeDisabled();
  s = await saved(p);
  assert.equal(s.coins, before.coins + 200);
  assert.equal(s.gems, before.gems + 3);
  assert.equal(s.receipts.length, 1);
  assert.equal(s.pending.boxIndex, 6);
  await skipBox(p);
  await p.locator('[data-action="claim-result"]').click();
  await p.locator('[data-ad="wheel"]').click();
  await reward(p, false);
  await expect(p.locator('[data-ad="wheel"]')).toBeEnabled();
  assert.equal((await saved(p)).wheelAt, 0);
  await p.locator('[data-ad="wheel"]').click();
  await reward(p, true);
  await expect(p.locator(".result-content")).toBeVisible();
  s = await saved(p);
  assert.equal(s.pending.kind, "wheel");
  assert.equal(s.receipts.length, 2);
  await p.reload({ waitUntil: "networkidle" });
  await p.locator('[data-action="claim-result"]').click();
  await nav(p, "rewards");
  await expect(p.locator('[data-ad="wheel"]')).toBeDisabled();
  checks.push(
    "Rewarded-only daily and wheel: close pays nothing and consumes no timer; duplicate reward callbacks pay once and persist",
  );
  const adBoxes = state();
  adBoxes.trophies = 150;
  await seed(p, adBoxes);
  await nav(p, "boxes");
  for (let i = 0; i < 3; i++) {
    before = await saved(p);
    await p.locator(`[data-ad="box-${i}"]`).click();
    await reward(p, false);
    await expect(p.locator(`[data-ad="box-${i}"]`)).toBeEnabled();
    assert.equal((await saved(p)).boxes, before.boxes);
    await p.locator(`[data-ad="box-${i}"]`).click();
    await reward(p, true);
    await p.clock.runFor(1200);
    await skipBox(p);
    await expect(p.locator(".result-content")).toBeVisible();
    s = await saved(p);
    assert.equal(s.boxes, before.boxes + 1);
    assert.ok(s.coins >= before.coins);
    await p.locator('[data-action="claim-result"]').click();
    await expect(p.locator(`[data-ad="box-${i}"]`)).toBeDisabled();
  }
  s = await saved(p);
  assert.ok(s.adAt.box2 > s.adAt.box1 && s.adAt.box1 > s.adAt.box);
  checks.push(
    "All three boxes have paid and rewarded openings, separate cooldowns, no charge on cancelled video and one committed result",
  );
  const team = state();
  team.coins = 10000;
  team.gems = 100;
  team.power = 300;
  team.fighters.push(
    { id: BRAWLERS[1].id, level: 1, cards: 20 },
    { id: BRAWLERS[2].id, level: 1, cards: 0 },
  );
  await seed(p, team);
  await nav(p, "brawlers");
  await expect(p.locator(".fighter-card")).toHaveCount(30);
  await p.locator(`[data-fighter="${BRAWLERS[1].id}"]`).last().click();
  await p.locator(`[data-team="${BRAWLERS[1].id}"]`).click();
  await p.locator(`[data-level="${BRAWLERS[1].id}"]`).click();
  await p.locator(`[data-select="${BRAWLERS[1].id}"]`).click();
  s = await saved(p);
  assert.equal(s.selected, BRAWLERS[1].id);
  assert.equal(s.fighters.find((f) => f.id === BRAWLERS[1].id).level, 2);
  assert.equal(s.team.length, 2);
  await p.reload({ waitUntil: "networkidle" });
  assert.equal((await saved(p)).selected, BRAWLERS[1].id);
  checks.push(
    "Thirty themed brawlers, team assignment, upgrade with duplicate discount and selection persist",
  );
  await seed(p, state());
  await nav(p, "rewards");
  for (const type of ["coins", "power", "gems", "boost"]) {
    before = await saved(p);
    await p.locator(`[data-ad="${type}"]`).click();
    await reward(p, true);
    await expect(p.locator(`[data-ad="${type}"]`)).toBeDisabled();
    s = await saved(p);
    assert.equal(s.receipts.length, before.receipts.length + 1);
  }
  checks.push(
    "Coin/power/gem/booster slots grant once and share receipt protection; each slot has its own cooldown",
  );
  const quests = state();
  quests.totalTaps = 100;
  quests.offlineCoins = 500;
  await seed(p, quests);
  await nav(p, "rewards");
  before = await saved(p);
  await p.locator('[data-ad="quest"][data-id="tap100"]').click();
  await reward(p, true);
  await expect(p.locator('[data-quest="tap100"]')).toBeDisabled();
  assert.equal((await saved(p)).coins, before.coins + 400);
  await p.locator('[data-ad="offline"]').click();
  await reward(p, false);
  await expect(p.locator('[data-action="offline"]')).toBeEnabled();
  await p.locator('[data-action="offline"]').click();
  assert.equal((await saved(p)).offlineCoins, 0);
  checks.push(
    "Tasks can double via ad; cancelled offline ad preserves the ordinary claim",
  );
  await seed(p, state());
  await nav(p, "arena");
  await p.locator('[data-action="battle"]').click();
  const current = await p.evaluate(() => Date.now());
  await p.clock.setSystemTime(current + 185000);
  for (let i = 0; i < 100 && (await saved(p)).battle; i++) {
    await p.clock.runFor(100);
    await p.locator('[data-action="attack"]').click();
  }
  await expect(p.locator(".result-content")).toBeVisible();
  assert.equal((await saved(p)).pending.won, true);
  assert.equal(await p.evaluate(() => window.__fullCalls), 0);
  await p.locator('[data-action="claim-result"]').click();
  assert.equal(await p.evaluate(() => window.__fullCalls), 1);
  await p.evaluate(() => window.__full.onClose(true));
  await expect(p.locator('[data-action="battle"]')).toBeVisible();
  await nav(p, "home");
  assert.equal(await p.evaluate(() => window.__fullCalls), 1);
  checks.push(
    "Time-gated mandatory ad waits for the short battle to finish, opens on result continuation and respects the quiet interval",
  );
  const prestige = state();
  prestige.trophies = 300;
  prestige.upgrades.tap = 4;
  await seed(p, prestige);
  await nav(p, "road");
  await p.locator('[data-road="0"]').click();
  const roadCoins = (await saved(p)).coins;
  await p.locator('[data-action="prestige"]').click();
  await expect(p.locator('[data-action="confirm-prestige"]')).toBeVisible();
  await p.locator('[data-action="confirm-prestige"]').click();
  s = await saved(p);
  assert.equal(s.coins, 350);
  assert.equal(s.trophies, 300);
  assert.ok(s.stars > 0);
  assert.ok(roadCoins > 350);
  checks.push(
    "Trophy claims and explicit prestige reset preserve collection/trophies and pay once",
  );
  await seed(p, state());
  await p.locator(".top-settings").click();
  await p.locator('[data-action="language"]').click();
  await p.locator('[data-action="close"]').click();
  await expect(p.locator("h1")).toHaveText("Brawl Rush");
  await p.reload({ waitUntil: "networkidle" });
  await expect(p.locator("h1")).toHaveText("Brawl Rush");
  checks.push("Russian/English language selection and settings survive reload");
  for (const viewport of [
    { width: 1280, height: 720 },
    { width: 390, height: 844 },
    { width: 320, height: 720 },
    { width: 844, height: 390 },
  ]) {
    await p.setViewportSize(viewport);
    for (const route of [
      "home",
      "brawlers",
      "boxes",
      "arena",
      "road",
      "rewards",
    ]) {
      await nav(p, route);
      const fit = await p.evaluate(
        () =>
          document.documentElement.scrollWidth <= innerWidth &&
          document.body.scrollWidth <= innerWidth,
      );
      assert.ok(fit, `${route} fits ${viewport.width}`);
    }
    await nav(p, "home");
    const start = await p.locator('[data-action="rush-start"]').boundingBox(),
      bottom = await p.locator(".rail").boundingBox();
    assert.ok(
      start.y + start.height <= bottom.y,
      `start above navigation at ${viewport.width}`,
    );
    if (viewport.width === 390)
      await p.screenshot({ path: "artifacts/mobile-home.jpg" });
    await p.locator('[data-action="rush-start"]').click();
    {
      const ability = await p.locator('[data-action="ability"]').boundingBox();
      assert.ok(
        ability.y + ability.height <= bottom.y,
        `Rush skill visible at ${viewport.width}x${viewport.height}`,
      );
    }
    await seed(p, state());
    await nav(p, "arena");
    await p.locator('[data-action="battle"]').click();
    {
      const dodge = await p.locator('[data-action="dodge"]').boundingBox();
      assert.ok(
        dodge.y + dodge.height <= bottom.y,
        `dodge visible at ${viewport.width}x${viewport.height}`,
      );
    }
    if (viewport.width === 390)
      await p.screenshot({ path: "artifacts/mobile-battle.jpg" });
    await seed(p, state());
  }
  checks.push(
    "All six screens fit desktop/390/320/landscape with themed icons and the primary play control visible",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/browser-report.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
  console.log(
    JSON.stringify({ passed: checks.length, checks, errors }, null, 2),
  );
} finally {
  await browser.close();
}
