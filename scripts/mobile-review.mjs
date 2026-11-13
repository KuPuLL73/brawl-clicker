import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { ClickGame } from "../src/engine.ts";
import { BRAWLERS } from "../src/data.ts";
const browser = await chromium.launch(),
  p = await browser.newPage({
    viewport: { width: 390, height: 844 },
    locale: "ru-RU",
  }),
  key = "brawl-click.save.v1",
  errors = [],
  checks = [];
p.on("pageerror", (e) => errors.push(e.message));
await p.clock.install({ time: new Date("2026-10-23T10:00:00Z") });
await p.clock.pauseAt(new Date("2026-10-23T10:00:01Z"));
await p.addInitScript(
  ({ key }) => {
    const raw = sessionStorage.getItem("seed");
    if (raw) {
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
            run: JSON.parse(raw),
          },
        }),
      );
      sessionStorage.removeItem("seed");
    }
    Math.random = () => 0.5;
    window.handlers = {};
    window.YaGames = {
      init: async () => ({
        environment: { i18n: { lang: "ru" } },
        serverTime: () => Date.now(),
        on: (event, fn) => (window.handlers[event] = fn),
        features: {
          LoadingAPI: { ready() {} },
          GameplayAPI: { start() {}, stop() {} },
        },
        adv: {
          showRewardedVideo({ callbacks }) {
            window.reward = callbacks;
            callbacks.onOpen();
          },
          showFullscreenAdv({ callbacks }) {
            callbacks.onClose(false);
          },
        },
      }),
    };
  },
  { key },
);
const saved = () =>
  p.evaluate((key) => JSON.parse(localStorage.getItem(key)).data.run, key);
const seed = async (s) => {
  s.lastSeen = await p.evaluate(() => Date.now());
  await p.evaluate((s) => sessionStorage.setItem("seed", JSON.stringify(s)), s);
  await p.reload({ waitUntil: "networkidle" });
};
const base = () => {
  const g = new ClickGame(
    undefined,
    () => 0.5,
    Date.parse("2026-10-23T10:00:01Z"),
  );
  g.state.sound = false;
  g.state.coins = 28000;
  g.state.gems = 75;
  g.state.power = 550;
  g.state.trophies = 150;
  g.state.fighters[0].level = 5;
  g.state.fighters.push({ id: BRAWLERS[2].id, level: 5, cards: 0 });
  return g;
};
const nav = (r) => p.locator(`.nav-item[data-nav="${r}"]`).click();
async function shot(name, fullPage = false) {
  await p
    .locator("img")
    .evaluateAll((images) => images.forEach((i) => (i.loading = "eager")));
  await expect
    .poll(() =>
      p
        .locator("img")
        .evaluateAll((images) =>
          images.every((i) => i.complete && i.naturalWidth > 0),
        ),
    )
    .toBe(true);
  await p.screenshot({ path: `artifacts/mobile-${name}.png`, fullPage });
}
async function controlsFit(arena = false) {
  const skill = await p.locator('[data-action="ability"]').boundingBox(),
    superB = await p.locator('[data-action="super"]').boundingBox(),
    rail = await p.locator(".rail").boundingBox();
  assert.ok(Math.abs(skill.y - superB.y) < 3);
  assert.ok(superB.x >= skill.x + skill.width - 1);
  assert.ok(
    Math.max(skill.y + skill.height, superB.y + superB.height) <= rail.y,
  );
  if (arena) {
    const dodge = await p.locator('[data-action="dodge"]').boundingBox();
    assert.ok(dodge.y + dodge.height <= rail.y);
  }
  await expect(p.locator(".skill-type")).toContainText("СКИЛЛ");
}
try {
  await p.goto("http://127.0.0.1:5180/?platform=1", {
    waitUntil: "networkidle",
  });
  await seed(base().snapshot());
  await shot("home");
  const rush = base();
  rush.state.selected = BRAWLERS[2].id;
  rush.startRush();
  Object.assign(rush.state.rush, {
    hits: 15,
    score: 290,
    combo: 9,
    bestCombo: 9,
    charge: 100,
  });
  const bomb = rush.state.rush.targets[2];
  Object.assign(bomb, { kind: "bomb", expiresIn: 4000 });
  await seed(rush.snapshot());
  await controlsFit();
  await shot("rush");
  await expect(p.locator("[data-bomb-time]")).toHaveText("4с");
  await p.clock.runFor(3000);
  await expect(p.locator("[data-bomb-time]")).toHaveText("1с");
  await p.evaluate(() => window.handlers.game_api_pause());
  await p.clock.runFor(5000);
  await expect(p.locator("[data-bomb-time]")).toHaveText("1с");
  await p.evaluate(() => window.handlers.game_api_resume());
  await p.clock.runFor(1000);
  await expect(p.locator(`[data-rush="${bomb.id}"]`)).toHaveCount(0);
  checks.push(
    "Bomb fuse is visible, lasts four active seconds, pauses with SDK, then expires without touching other targets",
  );
  const boss = base();
  boss.state.selected = BRAWLERS[2].id;
  boss.state.wins = 2;
  boss.startBattle();
  Object.assign(boss.state.battle, {
    attackIn: 1800,
    playerHp: 78,
    charge: 100,
  });
  await seed(boss.snapshot());
  await expect(p.locator('[data-action="dodge"]')).toBeDisabled();
  await p.clock.runFor(800);
  await expect(p.locator('[data-action="dodge"]')).toBeEnabled();
  await expect(p.locator("[data-attack-warning]")).toHaveText("ЖМИ УКЛОНЕНИЕ!");
  await controlsFit(true);
  await shot("boss-warning");
  await p.locator('[data-action="dodge"]').click();
  await p.clock.runFor(1000);
  await expect(p.locator("[data-player-hp]")).toHaveText("78/100");
  await expect(p.locator("[data-attack-warning]")).toHaveText("УДАР МИМО!");
  checks.push(
    "Large attack countdown, visible warning and highlighted Dodge gate the correct timing; successful dodge shows green feedback",
  );
  await seed(base().snapshot());
  await nav("boxes");
  await expect(p.locator(".box-card")).toHaveCount(6);
  assert.equal(
    await p
      .locator('[data-open="5"],[data-open="6"],[data-ad="box-4"]')
      .count(),
    0,
  );
  const cards = await p.locator(".box-card").evaluateAll((cards) =>
    cards.map((card) => {
      const image = card.querySelector(".box-art img").getBoundingClientRect(),
        button = card
          .querySelector(".box-actions>button")
          .getBoundingClientRect();
      return { imageWidth: image.width, buttonY: button.y };
    }),
  );
  for (let i = 0; i < cards.length; i += 2) {
    assert.ok(cards[i].imageWidth > 140);
    assert.ok(
      Math.abs(cards[i].buttonY - cards[i + 1].buttonY) < 2,
      "paired buttons align",
    );
  }
  await shot("boxes");
  await shot("boxes-full", true);
  const before = await saved();
  await p.locator('[data-open="4"]').click();
  await expect(p.locator(".box-opening")).toBeVisible();
  const committed = await saved();
  assert.equal(committed.gems, before.gems - 60);
  assert.equal(committed.pending.boxIndex, 4);
  await p.locator(".reveal-next").click();
  await p.reload({ waitUntil: "networkidle" });
  assert.equal((await saved()).pending.revealStep, 1);
  assert.equal((await saved()).pending.id, committed.pending.id);
  await p.locator(".reveal-next").click();
  await shot("opening");
  await p.locator(".reveal-next").click();
  await shot("loot");
  await p.locator('[data-action="box-skip"]').click();
  await expect(p.locator(".result-content")).toBeVisible();
  assert.equal((await saved()).gems, committed.gems);
  await p.locator('[data-action="claim-result"]').click();
  checks.push(
    "Six store boxes render; daily box stays in bonuses; gem-only/ad-only/daily-only buttons are distinct; charge/reward animation resumes the committed outcome without another payment",
  );
  await seed(base().snapshot());
  await nav("rewards");
  await p.clock.runFor(3500);
  await shot("rewards");
  await p.locator('[data-ad="daily"]').click();
  await p.evaluate(() => {
    window.reward.onRewarded();
    window.reward.onRewarded();
    window.reward.onClose();
  });
  await expect(p.locator(".box-opening")).toBeVisible();
  const gift = await saved();
  assert.equal(gift.pending.boxIndex, 6);
  assert.equal(gift.dailyAt, await p.evaluate(() => Date.now() + 86400000));
  assert.equal(gift.receipts.length, 1);
  await p.reload({waitUntil:"networkidle"});
  assert.equal((await saved()).pending.id,gift.pending.id);
  await p.locator('[data-action="box-skip"]').click();
  await p.locator('[data-action="claim-result"]').click();
  await expect(p.locator('[data-ad="daily"]')).toBeDisabled();
  checks.push(
    "Daily remains 24h; the exclusive daily box plus coins/gems commits once even with duplicate SDK reward callback",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    "artifacts/mobile-review.json",
    JSON.stringify({ viewport: "390x844", checks, errors }, null, 2),
  );
  console.log(
    JSON.stringify({ passed: checks.length, checks, errors }, null, 2),
  );
} finally {
  await browser.close();
}
