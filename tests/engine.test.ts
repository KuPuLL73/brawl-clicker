import test from "node:test";
import assert from "node:assert/strict";
import { ClickGame, BOXES } from "../src/engine.ts";
import { BRAWLERS } from "../src/data.ts";
const fresh = (roll = 0.5) => new ClickGame(undefined, () => roll, 1000);
test("Tap income, combo and rate limit: no hold or same-frame duplication", () => {
  const g = fresh(),
    before = g.state.coins;
  assert.ok(g.tap(1000));
  assert.equal(g.tap(1001), null);
  assert.equal(g.tap(NaN), null);
  for (let i = 1; i < 21; i++) g.tap(1000 + i * 100);
  assert.equal(g.state.totalTaps, 21);
  assert.equal(g.state.trophies, 2);
  assert.ok(g.comboMultiplier > 1);
  assert.ok(g.state.coins > before);
  g.tap(9000);
  assert.equal(g.comboMultiplier, 1);
});
test("Critical, timed boost and Super are genuine bounded multipliers", () => {
  const g = fresh(0);
  const crit = g.tap(1000)!;
  assert.equal(crit.critical, true);
  g.state.superCharge = 100;
  g.activateSuper(1100);
  g.state.boostUntil = 10000;
  const boosted = g.tap(1200)!;
  assert.equal(boosted.amount, crit.amount * 6);
  assert.throws(() => g.activateSuper(1300), /charge/);
});
test("Every upgrade checks funds and limits before mutation", () => {
  const g = fresh();
  g.state.coins = 0;
  const before = g.snapshot();
  assert.throws(() => g.upgrade("auto"), /funds/);
  assert.deepEqual(g.snapshot(), before);
  g.state.coins = 10000;
  g.upgrade("auto");
  assert.equal(g.state.upgrades.auto, 1);
  assert.ok(g.passive > 0.3);
  g.state.upgrades.crit = 15;
  assert.throws(() => g.upgrade("crit"), /max/);
});
test("First box guarantees a brawler, commits one result and survives reload", () => {
  const g = fresh(0.99);
  const p = g.openBox(0, 1000);
  assert.equal(p.newBrawler, true);
  assert.equal(g.state.fighters.length, 2);
  assert.throws(() => g.openBox(0, 1000), /busy/);
  const restored = new ClickGame(g.snapshot(), () => 0, 1000);
  assert.equal(restored.state.pending?.id, p.id);
  assert.equal(restored.state.pending?.brawler, p.brawler);
  assert.equal(restored.state.coins, g.state.coins);
});
test("Pity gives a new eligible brawler by eighth box after the previous unlock", () => {
  const g = fresh(0.99);
  g.state.coins = 100000;
  g.openBox(0, 1000);
  g.dismiss();
  for (let i = 0; i < 7; i++) {
    assert.equal(g.openBox(0, 1000).newBrawler, false);
    g.dismiss();
  }
  assert.equal(g.state.pity, 7);
  assert.equal(g.openBox(0, 1000).newBrawler, true);
  assert.equal(g.state.pity, 0);
});
test("Bad RNG and receipts cannot consume a box cost or cooldown", () => {
  const g = new ClickGame(undefined, () => NaN, 1000),
    before = g.snapshot();
  assert.throws(() => g.openBox(0, 1000), /random/);
  assert.deepEqual(g.snapshot(), before);
  const ok = fresh();
  assert.throws(() => ok.openBox(0, 1000, ""), /receipt/);
  assert.equal(ok.state.adAt.box, undefined);
  ok.openBox(0, 1000, "earned");
  ok.dismiss();
  const saved = ok.snapshot();
  assert.throws(() => ok.openBox(0, 181000, "earned"), /receipt/);
  assert.deepEqual(ok.snapshot(), saved);
  assert.throws(() => ok.openBox(0, 1001, "fresh"), /cooldown/);
});
test("Result coin doubling is once, persistent and leaves other rewards unchanged", () => {
  const g = fresh(),
    p = g.openBox(0, 1000),
    before = g.snapshot();
  assert.throws(() => g.boostResult(p.id, ""), /receipt/);
  g.boostResult(p.id, "ad");
  assert.equal(g.state.coins, before.coins + p.coins);
  assert.equal(g.state.gems, before.gems);
  assert.equal(g.state.power, before.power);
  const copy = new ClickGame(g.snapshot(), undefined, 1000);
  assert.throws(() => copy.boostResult(p.id, "new"), /claimed/);
});
test("Team roles affect earnings, crit and income; team and selection enforce ownership", () => {
  const g = fresh();
  assert.throws(() => g.team(BRAWLERS[10].id), /locked/);
  g.state.fighters.push(
    { id: BRAWLERS[1].id, level: 3, cards: 0 },
    { id: BRAWLERS[2].id, level: 2, cards: 0 },
    { id: BRAWLERS[3].id, level: 1, cards: 0 },
  );
  const crit = g.critChance,
    passive = g.passive;
  g.team(BRAWLERS[1].id);
  g.team(BRAWLERS[2].id);
  assert.ok(g.critChance > crit);
  assert.ok(g.passive > passive);
  assert.throws(() => g.team(BRAWLERS[3].id), /team/);
  g.select(BRAWLERS[1].id);
  assert.equal(g.state.selected, BRAWLERS[1].id);
});
test("Duplicate cards discount power cost and are consumed exactly once", () => {
  const g = fresh();
  g.selected.cards = 20;
  assert.equal(g.levelCost(g.selected.id).power, 0);
  g.level(g.selected.id);
  assert.equal(g.selected.level, 2);
  assert.equal(g.selected.cards, 5);
  assert.equal(g.state.power, 40);
});
test("Gem recruitment checks eligibility and cannot buy a duplicate", () => {
  const g = fresh();
  assert.throws(() => g.recruit(BRAWLERS[1].id), /funds/);
  g.state.gems = 1000;
  g.recruit(BRAWLERS[1].id);
  assert.equal(g.state.gems, 970);
  assert.throws(() => g.recruit(BRAWLERS[1].id), /locked/);
  assert.throws(() => g.recruit(BRAWLERS[29].id), /locked/);
});
test("A battle can be won by taps, pauses by not ticking and pays gems on third win", () => {
  const g = fresh();
  g.state.wins = 2;
  g.startBattle();
  const before = g.snapshot();
  assert.deepEqual(g.snapshot(), before);
  for (let i = 0; g.state.battle && i < 500; i++) g.attack(1000 + i * 100);
  assert.equal(g.state.pending?.won, true);
  assert.equal(g.state.wins, 3);
  assert.equal(g.state.gems, 13);
  assert.ok(g.state.trophies > 0);
});
test("Failed battle, revive and second failure cannot provide unlimited continues", () => {
  const g = fresh();
  g.startBattle();
  for (let i = 0; i < 45; i++) g.tick(1000, 1000 + i * 1000);
  const p = g.state.pending!;
  assert.equal(p.won, false);
  g.revive(p.id, 50000, "continue");
  assert.equal(g.state.battle?.remaining, 20000);
  assert.equal(g.state.battle?.charge, 100);
  const restored = new ClickGame(g.snapshot(), undefined, 50000);
  for (let i = 0; i < 20; i++) restored.tick(1000, 50000 + i * 1000);
  assert.throws(
    () => restored.revive(restored.state.pending!.id, 80000, "new"),
    /claimed/,
  );
});
test("Daily requires an ad receipt; quest, road and offline have ordinary claims", () => {
  const g = fresh();
  g.daily(1000, "daily-receipt");
  g.dismiss();
  assert.throws(() => g.daily(1001, "next"), /cooldown/);
  g.state.totalTaps = 100;
  g.quest("tap100");
  assert.throws(() => g.quest("tap100"), /locked/);
  g.state.trophies = 10;
  g.roadClaim(0);
  assert.throws(() => g.roadClaim(0), /locked/);
  g.state.offlineCoins = 500;
  assert.equal(g.claimOffline(), 500);
  assert.throws(() => g.claimOffline(), /claimed/);
});
test("All rewarded slots require fresh receipts and persist cooldowns without leaking claims", () => {
  for (const kind of ["coins", "power", "gems", "boost"] as const) {
    const g = fresh();
    const before = g.snapshot();
    assert.throws(() => g.adReward(kind, 1000, ""), /receipt/);
    assert.deepEqual(g.snapshot(), before);
    g.adReward(kind, 1000, "ad");
    const restored = new ClickGame(g.snapshot(), undefined, 1000);
    assert.throws(() => restored.adReward(kind, 1001, "new"), /cooldown/);
    assert.throws(() => restored.daily(1000, "ad"), /receipt/);
  }
});
test("Offline accrual is capped, claimed once, and does not double on reload", () => {
  const g = fresh();
  g.state.upgrades.auto = 2;
  const restored = new ClickGame(g.snapshot(), undefined, 1000 + 86400000);
  const expected = Math.floor(g.passive * 7200 * 0.5);
  assert.equal(restored.state.offlineCoins, expected);
  const again = new ClickGame(restored.snapshot(), undefined, 1000 + 86400000);
  assert.equal(again.state.offlineCoins, expected);
  assert.equal(again.claimOffline("double"), expected * 2);
});
test("Prestige resets only declared resources and each threshold can pay once", () => {
  const g = fresh();
  g.state.trophies = 300;
  g.state.upgrades.tap = 4;
  const fighters = g.snapshot().fighters;
  g.prestige();
  assert.equal(g.state.coins, 350);
  assert.equal(g.state.upgrades.tap, 0);
  assert.deepEqual(g.state.fighters, fighters);
  assert.equal(g.state.trophies, 300);
  assert.ok(g.multiplier > 1);
  assert.throws(() => g.prestige(), /locked/);
});
test("Malformed saves reject foreign fighters, NaN, duplicate team IDs and invalid settings", () => {
  const g = fresh(),
    s = g.snapshot();
  s.fighters = [
    { id: 1, level: 999, cards: 0 },
    { id: BRAWLERS[0].id, level: NaN, cards: -1 },
    { id: BRAWLERS[0].id, level: 7, cards: 0 },
  ];
  s.coins = NaN;
  s.team = [1, BRAWLERS[0].id, BRAWLERS[0].id];
  const r = new ClickGame(s, undefined, 1000);
  assert.equal(r.state.coins, 0);
  assert.equal(r.state.fighters.length, 1);
  assert.equal(r.selected.level, 1);
  assert.equal(r.state.team.length, 1);
});

test("Daily and wheel require rewarded receipts; missing, invalid and duplicate receipts never start cooldowns", () => {
  const g = fresh();
  const before = g.snapshot();
  assert.throws(() => g.daily(1000, ""), /receipt/);
  assert.throws(() => g.wheel(1000, ""), /receipt/);
  assert.deepEqual(g.snapshot(), before);
  assert.equal(g.daily(1000, "daily").coins, 200);
  assert.equal(g.state.gems, 13);
  const restored = new ClickGame(g.snapshot(), undefined, 1000);
  restored.dismiss();
  assert.throws(() => restored.daily(1001, "new"), /cooldown/);
  assert.throws(() => restored.wheel(1000, "daily"), /receipt/);
  assert.equal(restored.state.wheelAt, 0);
  restored.wheel(1000, "wheel");
  assert.equal(restored.state.wheelAt, 1801000);
  const persisted = new ClickGame(restored.snapshot(), undefined, 1000);
  assert.throws(() => persisted.wheel(1001, "again"), /busy/);
});

test("Rush spawns three distinct moving targets and stale target clicks cannot pay twice", () => {
  const g = fresh();
  g.startRush();
  const r = g.state.rush!;
  assert.equal(new Set(r.targets.map((t) => t.slot)).size, 3);
  const id = r.targets[0].id,
    before = g.state.coins;
  assert.ok(g.rushHit(id, 1000));
  assert.ok(g.state.coins > before);
  const coins = g.state.coins;
  assert.equal(g.rushHit(id, 1100), null);
  assert.equal(g.state.coins, coins);
  assert.equal(r.hits, 1);
  assert.throws(() => g.openBox(0, 1000), /busy/);
  assert.throws(() => g.startBattle(), /busy/);
});
test("Rush combos raise the multiplier and charge a multi-target Super", () => {
  const g = fresh();
  g.startRush();
  for (let i = 0; i < 10; i++)
    g.rushHit(g.state.rush!.targets[0].id, 1000 + i * 100);
  assert.equal(g.state.rush!.combo, 10);
  assert.equal(g.state.rush!.charge, 100);
  assert.ok(g.comboMultiplier > 1);
  const targets = g.state.rush!.targets.map((t) => t.id);
  g.activateSuper(2100);
  assert.equal(g.state.rush!.hits, 13);
  assert.equal(g.state.rush!.charge, 0);
  assert.ok(g.state.rush!.targets.every((t) => !targets.includes(t.id)));
  assert.throws(() => g.activateSuper(2200), /charge/);
});
test("A 25-second Rush resolves once; active hits, score, result and remaining time persist", () => {
  const g = fresh();
  g.startRush();
  for (let i = 0; i < 20; i++)
    g.rushHit(g.state.rush!.targets[0].id, 1000 + i * 100);
  g.tick(1000, 4000);
  const restored = new ClickGame(g.snapshot(), () => 0.5, 5000);
  assert.equal(restored.state.rush!.remaining, 24000);
  assert.equal(restored.state.rush!.hits, 20);
  for (let i = 0; i < 24; i++) restored.tick(1000, 5000 + i * 1000);
  assert.equal(restored.state.rush, null);
  assert.equal(restored.state.pending?.kind, "rush");
  assert.equal(restored.state.pending?.hits, 20);
  assert.equal(restored.state.rushRounds, 1);
  assert.ok(restored.state.rushBest > 0);
  const coins = restored.state.coins;
  assert.equal(restored.rushHit(1, 40000), null);
  assert.equal(restored.state.coins, coins);
  const again = new ClickGame(restored.snapshot(), undefined, 40000);
  assert.equal(again.state.pending?.kind, "rush");
  assert.equal(again.state.pending?.score, restored.state.pending?.score);
});
test("Untouched targets stay until round end; empty rounds give no bonus and clock jumps cannot skip time", () => {
  const g = fresh();
  g.startRush();
  g.rushHit(g.state.rush!.targets[0].id, 1000);
  g.tick(100000, 2000);
  assert.equal(g.state.rush!.remaining, 24000);
  g.tick(1000, 3000);
  g.tick(1000, 4000);
  assert.equal(g.state.rush!.combo, 1);
  const empty = fresh();
  empty.startRush();
  for (let i = 0; i < 25; i++) empty.tick(1000, 1000 + i * 1000);
  assert.equal(empty.state.pending?.coins, 0);
  assert.equal(empty.state.trophies, 0);
});
test("Each ad box has a distinct cooldown and all claims share receipt protection", () => {
  const g = fresh();
  g.state.trophies = 150;
  g.state.coins = 0;
  for (let i = 0; i < 3; i++) {
    g.openBox(i, 1000, `box${i}`);
    g.dismiss();
  }
  assert.equal(g.state.adAt.box, 181000);
  assert.equal(g.state.adAt.box1, 301000);
  assert.equal(g.state.adAt.box2, 601000);
  const restored = new ClickGame(g.snapshot(), undefined, 1000);
  assert.throws(() => restored.openBox(2, 1001, "more"), /cooldown/);
  assert.throws(() => restored.openBox(2, 601000, "box0"), /receipt/);
});

test("All six Rush targets have distinct effects; rivals need two hits and bombs never pay", () => {
  for (const [roll, kind] of [
    [0.05, "gem"],
    [0.15, "coin"],
    [0.24, "power"],
    [0.33, "rival"],
    [0.4, "bomb"],
    [0.5, "bot"],
  ] as const) {
    const g = fresh(roll);
    g.startRush();
    const target = g.state.rush!.targets.find((t) => t.kind === kind)!;
    assert.ok(target, kind);
    const before = g.snapshot();
    const hit = g.rushHit(target.id, 1000)!;
    if (kind === "bomb") {
      assert.equal(hit.amount, 0);
      assert.equal(g.state.coins, before.coins);
      assert.equal(g.state.rush!.misses, 1);
    } else assert.ok(hit.amount > 0);
    if (kind === "gem") assert.equal(g.state.gems, before.gems + 1);
    if (kind === "power") assert.equal(g.state.power, before.power + 3);
    if (kind === "rival") {
      assert.equal(target.hp, 1);
      assert.ok(g.state.rush!.targets.some((t) => t.id === target.id));
      g.rushHit(target.id, 1100);
      assert.ok(!g.state.rush!.targets.some((t) => t.id === target.id));
    }
  }
});
test("Modes rotate by completed round; untouched target IDs and motion age survive tick/reload", () => {
  const g = fresh();
  g.startRush();
  const ids = g.state.rush!.targets.map((t) => t.id);
  for (let i = 0; i < 20; i++) g.tick(1000, 2000 + i * 1000);
  assert.deepEqual(
    g.state.rush!.targets.map((t) => t.id),
    ids,
  );
  assert.equal(g.state.rush!.targets[0].life, 5000);
  const restored = new ClickGame(g.snapshot(), () => 0.5, 23000);
  assert.equal(restored.state.rush!.targets[0].life, 5000);
  for (let i = 0; i < 5; i++) restored.tick(1000, 24000 + i * 1000);
  restored.dismiss();
  restored.startRush();
  assert.equal(restored.state.rush!.mode, "gem");
});
test("Boss queue advances only on victory, chapter reward pays once and next chapter is harder", () => {
  const g = fresh();
  g.state.wins = 11;
  g.startBattle();
  const hp = g.state.battle!.maxHp;
  g.state.battle!.hp = 1;
  g.attack(1000);
  assert.equal(g.state.wins, 12);
  assert.equal(g.state.pending!.chapterClear, 1);
  assert.equal(g.state.stars, 1);
  assert.equal(g.state.pending!.power, 48);
  assert.equal(g.state.pending!.gems, 15);
  const restored = new ClickGame(g.snapshot(), () => 0.5, 2000);
  restored.dismiss();
  restored.startBattle();
  assert.equal(restored.state.battle!.boss, 12);
  assert.ok(restored.state.battle!.maxHp > hp);
  assert.equal(restored.state.stars, 1);
  for (let i = 0; i < 45; i++) restored.tick(1000, 3000 + i * 1000);
  assert.equal(restored.state.wins, 12);
  restored.dismiss();
  restored.startBattle();
  assert.equal(restored.state.battle!.boss, 12);
});
test("Enemy windup, correctly timed dodge and mistimed dodge use active simulation time", () => {
  const g = fresh();
  g.startBattle();
  for (let i = 0; i < 4; i++) g.tick(1000, 2000 + i * 1000);
  assert.equal(g.state.battle!.attackIn, 1000);
  g.dodge();
  g.tick(1000, 6000);
  assert.equal(g.state.battle!.playerHp, 100);
  assert.throws(() => g.dodge(), /cooldown/);
  g.tick(1000, 7000);
  g.tick(1000, 8000);
  g.dodge();
  g.tick(1000, 9000);
  g.tick(1000, 10000);
  g.tick(1000, 11000);
  assert.equal(g.state.battle!.playerHp, 78);
});
test("Character abilities differ: burst damage, summons, healing, shield, freeze and haste", () => {
  const choose = (index: number) => {
    const g = fresh();
    g.state.fighters.push({ id: BRAWLERS[index].id, level: 1, cards: 0 });
    g.state.selected = BRAWLERS[index].id;
    g.startBattle();
    return g;
  };
  const burst = choose(2);
  const before = burst.state.battle!.hp;
  burst.useAbility();
  assert.ok(burst.state.battle!.hp < before);
  assert.throws(() => burst.useAbility(), /cooldown/);
  const summon = choose(1);
  summon.useAbility();
  const summonHp = summon.state.battle!.hp;
  summon.tick(1000, 2000);
  assert.ok(summon.state.battle!.hp < summonHp);
  const heal = choose(5);
  heal.state.battle!.playerHp = 30;
  heal.useAbility();
  assert.equal(heal.state.battle!.playerHp, 70);
  const shield = choose(6);
  shield.state.battle!.attackIn = 500;
  shield.useAbility();
  shield.tick(1000, 2000);
  assert.equal(shield.state.battle!.playerHp, 100);
  const freeze = choose(15);
  freeze.useAbility();
  freeze.tick(1000, 2000);
  assert.equal(freeze.state.battle!.attackIn, 5000);
  const haste = choose(21);
  const normal = haste.attack(1000)!.damage;
  haste.useAbility();
  assert.equal(haste.attack(1100)!.damage, normal * 2);
});
test("Ability cooldown and effects persist; a reload cannot refill the skill", () => {
  const g = fresh();
  g.startRush();
  g.useAbility();
  g.tick(1000, 2000);
  const restored = new ClickGame(g.snapshot(), () => 0.5, 20000);
  assert.equal(restored.state.rush!.skill.cooldown, 11000);
  assert.throws(() => restored.useAbility(), /cooldown/);
  for (let i = 0; i < 11; i++) restored.tick(1000, 21000 + i * 1000);
  assert.doesNotThrow(() => restored.useAbility());
});
test("Rush shield defuses bombs, healing adds time and freeze stops target movement", () => {
  for (const [index, kind] of [
    [6, "shield"],
    [5, "heal"],
    [15, "freeze"],
  ] as const) {
    const g = fresh(0.4);
    g.state.fighters.push({ id: BRAWLERS[index].id, level: 1, cards: 0 });
    g.state.selected = BRAWLERS[index].id;
    g.startRush();
    g.useAbility();
    if (kind === "shield") {
      const bomb = g.state.rush!.targets.find((t) => t.kind === "bomb")!;
      assert.equal(g.rushHit(bomb.id, 1000)!.bomb, false);
      assert.equal(g.state.rush!.misses, 0);
    }
    if (kind === "heal") assert.equal(g.state.rush!.remaining, 28000);
    if (kind === "freeze") {
      const life = g.state.rush!.targets[0].life;
      g.tick(1000, 2000);
      assert.equal(g.state.rush!.targets[0].life, life);
    }
  }
});

test("Bombs expire after four active seconds without a reward, miss or combo penalty", () => {
  const g = fresh(0.4);
  g.startRush();
  const r = g.state.rush!,
    bomb = r.targets.find((t) => t.kind === "bomb")!,
    others = r.targets.filter((t) => t.id !== bomb.id).map((t) => t.id);
  r.combo = 7;
  const before = g.state.coins;
  for (let i = 0; i < 3; i++) g.tick(1000, 2000 + i * 1000);
  assert.equal(r.targets.find((t) => t.id === bomb.id)?.expiresIn, 1000);
  g.tick(1000, 5000);
  assert.ok(!r.targets.some((t) => t.id === bomb.id));
  assert.ok(others.every((id) => r.targets.some((t) => t.id === id)));
  assert.equal(r.combo, 7);
  assert.equal(r.misses, 0);
  assert.equal(r.hits, 0);
  assert.equal(g.state.coins, before);
  assert.equal(g.rushHit(bomb.id, 5100), null);
});
test("Bomb remaining fuse survives reload, old saves migrate, and no ticking means no fuse loss", () => {
  const g = fresh(0.4);
  g.startRush();
  g.tick(1000, 2000);
  const bomb = g.state.rush!.targets.find((t) => t.kind === "bomb")!;
  const restored = new ClickGame(g.snapshot(), () => 0.5, 20000);
  assert.equal(
    restored.state.rush!.targets.find((t) => t.id === bomb.id)?.expiresIn,
    3000,
  );
  restored.tick(1000, 21000);
  restored.tick(1000, 22000);
  assert.ok(restored.state.rush!.targets.some((t) => t.id === bomb.id));
  restored.tick(1000, 23000);
  assert.ok(!restored.state.rush!.targets.some((t) => t.id === bomb.id));
  delete bomb.expiresIn;
  const legacy = new ClickGame(g.snapshot(), () => 0.5, 30000);
  assert.equal(
    legacy.state.rush!.targets.find((t) => t.id === bomb.id)?.expiresIn,
    4000,
  );
});

test("Gem-only and ad-only boxes enforce their payment methods before any mutation", () => {
  const g = fresh();
  g.state.coins = 100000;
  g.state.gems = 100;
  const start = g.snapshot();
  assert.throws(() => g.openBox(5, 1000), /receipt/);
  assert.deepEqual(g.snapshot(), start);
  assert.throws(() => g.openBox(4, 1000, "video"), /locked/);
  assert.deepEqual(g.snapshot(), start);
  const p = g.openBox(4, 1000);
  assert.equal(g.state.gems, 40);
  assert.ok(p.newBrawler);
  assert.equal(p.boxIndex, 4);
  g.dismiss();
  const coins = g.state.coins;
  g.openBox(5, 1000, "star-video");
  assert.ok(g.state.coins >= coins);
  assert.equal(g.state.gems, 41);
  assert.equal(g.state.adAt.box5, 601000);
  g.dismiss();
  assert.throws(() => g.openBox(5, 1001, "again"), /cooldown/);
});
test("Epic price is a real coin sink; new Epic fighters meet rarity and trophy requirements", () => {
  const g = fresh(0.5);
  g.state.coins = 1000000;
  const before = g.snapshot();
  assert.throws(() => g.openBox(3, 1000), /locked/);
  assert.deepEqual(g.snapshot(), before);
  g.state.trophies = 150;
  const oldCoins = g.state.coins;
  const p = g.openBox(3, 1000);
  assert.ok(p.newBrawler);
  assert.ok(BRAWLERS.find((b) => b.id === p.brawler)!.rarity >= 2);
  assert.equal(g.state.coins, oldCoins - 240000 + p.coins);
  assert.ok(p.coins < 2400);
  for (const b of BOXES.filter((b) => b.currency === "coins"))
    assert.ok(b.coins * 1.25 < b.cost * 0.2);
});
test("Daily drop keeps 24 hours and old currencies, adds an exclusive box and cannot be bought separately", () => {
  const g = fresh();
  assert.throws(() => g.openBox(6, 1000), /locked/);
  const p = g.daily(1000, "daily");
  assert.equal(p.boxIndex, 6);
  assert.equal(p.coins, 200);
  assert.equal(p.gems, 3);
  assert.ok(p.power >= 140);
  assert.equal(g.state.dailyAt, 86401000);
  assert.equal(g.state.boxes, 1);
  const restored = new ClickGame(g.snapshot(), () => 0.5, 2000);
  assert.equal(restored.state.pending?.id, p.id);
  assert.equal(restored.state.dailyAt, 86401000);
  restored.dismiss();
  assert.throws(() => restored.daily(86400999, "too-soon"), /cooldown/);
  assert.doesNotThrow(() => restored.daily(86401000, "next-day"));
});
test("Reveal steps persist and never reroll, recharge or grant the committed contents twice", () => {
  const g = fresh();
  const p = g.openBox(0, 1000),
    awarded = g.snapshot();
  g.advanceBox(p.id);
  g.advanceBox(p.id);
  g.advanceBox(p.id);
  const restored = new ClickGame(g.snapshot(), () => 0, 2000);
  assert.equal(restored.state.pending!.revealStep, 3);
  assert.equal(restored.state.pending!.brawler, p.brawler);
  assert.equal(restored.state.coins, awarded.coins);
  restored.advanceBox(p.id, true);
  assert.equal(restored.state.pending!.revealStep, 7);
  assert.equal(restored.state.boxes, 1);
  assert.equal(restored.state.fighters.length, 2);
  assert.equal(restored.state.coins, awarded.coins);
  assert.throws(() => restored.advanceBox(p.id + 1), /claimed/);
});
test("Cancelled/duplicate daily receipts and invalid randomness do not consume the daily box", () => {
  const g = fresh();
  const before = g.snapshot();
  assert.throws(() => g.daily(1000, ""), /receipt/);
  assert.deepEqual(g.snapshot(), before);
  const bad = new ClickGame(undefined, () => NaN, 1000);
  const snapshot = bad.snapshot();
  assert.throws(() => bad.daily(1000, "valid"), /random/);
  assert.deepEqual(bad.snapshot(), snapshot);
});

test("Audio settings migrate muted saves, clamp volumes and survive reload", () => {
  const old = fresh().snapshot() as any;
  delete old.music; delete old.soundVolume; delete old.musicVolume;
  old.sound = false;
  const g = new ClickGame(old);
  assert.equal(g.state.music, false);
  assert.equal(g.state.soundVolume, 65);
  assert.equal(g.state.musicVolume, 35);
  old.music = true; old.soundVolume = Infinity; old.musicVolume = 200;
  const migrated = new ClickGame(old);
  assert.equal(migrated.state.music, true);
  assert.equal(migrated.state.soundVolume, 65);
  assert.equal(migrated.state.musicVolume, 100);
  migrated.state.musicVolume = 20;
  assert.equal(new ClickGame(migrated.snapshot()).state.musicVolume, 20);
});
test("Cheap boxes cannot unlock higher tiers and expensive boxes keep their distinct pools",()=>{
 const g=fresh(.1);g.state.coins=100000;g.state.trophies=1000;
 for(let i=0;i<20;i++){const p=g.openBox(0,1000);if(p.newBrawler)assert.ok(BRAWLERS.find(b=>b.id===p.brawler)!.rarity<=1);g.dismiss()}
 const higher=BRAWLERS.filter(b=>b.rarity>1);assert.ok(higher.every(b=>!g.state.fighters.some(f=>f.id===b.id)));
});
