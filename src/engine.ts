import {
  abilityFor,
  freshSkill,
  restoreSkill,
  type SkillState,
} from "./abilities";
import { BRAWLERS } from "./data";
import { bossAt, bossHealth, RUSH_MODES, type RushMode } from "./encounters";
export const AD_INTERVAL = 180000,
  DAY = 86400000;
export const BOMB_LIFETIME = 4000;
export interface BoxDefinition {
  id: string;
  name: string;
  en: string;
  cost: number;
  currency: "coins" | "gems" | "ad" | "daily";
  power: number;
  chance: number;
  coins: number;
  gems: number;
  cards: number;
  cooldown: number;
  unlock: number;
  minRarity: number;
  maxRarity: number;
  art: string;
  color: string;
}
export const BOXES: readonly BoxDefinition[] = [
  {
    id: "small",
    name: "Бравл-бокс",
    en: "Brawl Box",
    cost: 500,
    currency: "coins",
    power: 20,
    chance: 0.25,
    coins: 60,
    gems: 0,
    cards: 6,
    cooldown: 180000,
    unlock: 0,
    minRarity: 0,
    maxRarity: 1,
    art: "box",
    color: "#4cb4ff",
  },
  {
    id: "big",
    name: "Большой бокс",
    en: "Big Box",
    cost: 12500,
    currency: "coins",
    power: 65,
    chance: 0.45,
    coins: 140,
    gems: 1,
    cards: 12,
    cooldown: 300000,
    unlock: 0,
    minRarity: 0,
    maxRarity: 2,
    art: "box",
    color: "#a77aff",
  },
  {
    id: "mega",
    name: "Мегабокс",
    en: "Mega Box",
    cost: 60000,
    currency: "coins",
    power: 150,
    chance: 0.7,
    coins: 350,
    gems: 2,
    cards: 24,
    cooldown: 600000,
    unlock: 75,
    minRarity: 1,
    maxRarity: 4,
    art: "box",
    color: "#ffbc55",
  },
  {
    id: "epic",
    name: "Эпик-бокс",
    en: "Epic Box",
    cost: 240000,
    currency: "coins",
    power: 320,
    chance: 0.85,
    coins: 800,
    gems: 4,
    cards: 40,
    cooldown: 1200000,
    unlock: 150,
    minRarity: 2,
    maxRarity: 4,
    art: "boxes/epic",
    color: "#e376ff",
  },
  {
    id: "fighter",
    name: "Бокс бойца",
    en: "Brawler Box",
    cost: 60,
    currency: "gems",
    power: 220,
    chance: 1,
    coins: 250,
    gems: 0,
    cards: 35,
    cooldown: 0,
    unlock: 0,
    minRarity: 0,
    maxRarity: 4,
    art: "boxes/fighter",
    color: "#74f5ac",
  },
  {
    id: "starr",
    name: "Звёздный дроп",
    en: "Starr Drop",
    cost: 0,
    currency: "ad",
    power: 80,
    chance: 0.55,
    coins: 100,
    gems: 1,
    cards: 18,
    cooldown: 600000,
    unlock: 0,
    minRarity: 0,
    maxRarity: 3,
    art: "boxes/starr",
    color: "#ffe67a",
  },
  {
    id: "daily",
    name: "Бокс дня",
    en: "Daily Box",
    cost: 0,
    currency: "daily",
    power: 140,
    chance: 0.75,
    coins: 200,
    gems: 3,
    cards: 28,
    cooldown: DAY,
    unlock: 0,
    minRarity: 0,
    maxRarity: 3,
    art: "boxes/daily",
    color: "#73d6ff",
  },
];
export type Upgrade = "tap" | "auto" | "crit" | "super";
export interface Fighter {
  id: number;
  level: number;
  cards: number;
}
export interface Outcome {
  id: number;
  kind: "box" | "battle" | "wheel" | "rush";
  coins: number;
  gems: number;
  power: number;
  brawler?: number;
  newBrawler?: boolean;
  won?: boolean;
  boosted: boolean;
  quality: number;
  revived?: boolean;
  hits?: number;
  score?: number;
  chapterClear?: number;
  boxIndex?: number;
  revealStep?: number;
}
export interface RushTarget {
  id: number;
  slot: number;
  kind: "bot" | "gem" | "coin" | "power" | "rival" | "bomb";
  hp: number;
  maxHp: number;
  brawler: number;
  life: number;
  maxLife: number;
  expiresIn?: number;
}
export interface Rush {
  skill: SkillState;
  mode: RushMode;
  remaining: number;
  hits: number;
  misses: number;
  combo: number;
  bestCombo: number;
  score: number;
  charge: number;
  targets: RushTarget[];
}
export interface Battle {
  attackFeedback?: number;
  lastAttack?: "dodged" | "blocked" | "hit";
  skill: SkillState;
  playerHp: number;
  maxPlayerHp: number;
  attackIn: number;
  dodgeCooldown: number;
  dodgeWindow: number;
  hp: number;
  maxHp: number;
  remaining: number;
  hits: number;
  boss: number;
  charge: number;
  revived?: boolean;
}
export interface Save {
  version: 1;
  coins: number;
  gems: number;
  power: number;
  trophies: number;
  totalTaps: number;
  totalCoins: number;
  boxes: number;
  wins: number;
  pity: number;
  prestige: number;
  stars: number;
  upgrades: Record<Upgrade, number>;
  fighters: Fighter[];
  selected: number;
  team: number[];
  superCharge: number;
  superUntil: number;
  boostUntil: number;
  dailyAt: number;
  wheelAt: number;
  adAt: Record<string, number>;
  lastAdAt: number;
  lastSeen: number;
  offlineCoins: number;
  quests: string[];
  road: number[];
  receipts: string[];
  next: number;
  pending: Outcome | null;
  battle: Battle | null;
  rush: Rush | null;
  rushRounds: number;
  rushBest: number;
  sound: boolean;
  music: boolean;
  soundVolume: number;
  musicVolume: number;
  language: "auto" | "ru" | "en";
}
const number = (v: unknown, max = 1e15) =>
  typeof v === "number" && Number.isFinite(v)
    ? Math.max(0, Math.min(max, v))
    : 0;
const int = (v: unknown, max = 1e15) => Math.floor(number(v, max));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
export class ClickGame {
  state: Save;
  private lastTap = -Infinity;
  private combo = 0;
  constructor(
    raw?: unknown,
    private rng = () => Math.random(),
    now = Date.now(),
  ) {
    this.state = {
      version: 1,
      coins: 600,
      gems: 10,
      power: 40,
      trophies: 0,
      totalTaps: 0,
      totalCoins: 0,
      boxes: 0,
      wins: 0,
      pity: 0,
      prestige: 0,
      stars: 0,
      upgrades: { tap: 0, auto: 0, crit: 0, super: 0 },
      fighters: [{ id: BRAWLERS[0].id, level: 1, cards: 0 }],
      selected: BRAWLERS[0].id,
      team: [BRAWLERS[0].id],
      superCharge: 0,
      superUntil: 0,
      boostUntil: 0,
      dailyAt: 0,
      wheelAt: 0,
      adAt: {},
      lastAdAt: 0,
      lastSeen: now,
      offlineCoins: 0,
      quests: [],
      road: [],
      receipts: [],
      next: 1,
      pending: null,
      battle: null,
      rush: null,
      rushRounds: 0,
      rushBest: 0,
      sound: true,
      music: true,
      soundVolume: 65,
      musicVolume: 35,
      language: "auto",
    };
    if (!raw || typeof raw !== "object" || (raw as Save).version !== 1) return;
    const s = raw as Partial<Save>,
      t = this.state;
    for (const k of [
      "coins",
      "gems",
      "power",
      "trophies",
      "totalTaps",
      "totalCoins",
      "boxes",
      "wins",
      "pity",
      "prestige",
      "stars",
      "superCharge",
      "superUntil",
      "boostUntil",
      "dailyAt",
      "wheelAt",
      "lastAdAt",
      "offlineCoins",
      "next",
      "rushRounds",
      "rushBest",
    ] as const)
      t[k] = int(s[k]);
    t.next = Math.max(1, t.next);
    t.superCharge = Math.min(100, t.superCharge);
    t.prestige = Math.min(30, t.prestige);
    for (const k of ["tap", "auto", "crit", "super"] as Upgrade[])
      t.upgrades[k] = int(s.upgrades?.[k], k === "crit" ? 15 : 40);
    const ids = new Set<number>();
    t.fighters = Array.isArray(s.fighters)
      ? s.fighters
          .filter(
            (f) =>
              f &&
              BRAWLERS.some((b) => b.id === f.id) &&
              !ids.has(f.id) &&
              ids.add(f.id),
          )
          .map((f) => ({
            id: f.id,
            level: Math.max(1, int(f.level, 11)),
            cards: int(f.cards, 10000),
          }))
      : t.fighters;
    if (!t.fighters.length)
      t.fighters = [{ id: BRAWLERS[0].id, level: 1, cards: 0 }];
    t.selected = t.fighters.some((f) => f.id === s.selected)
      ? s.selected!
      : t.fighters[0].id;
    t.team = Array.isArray(s.team)
      ? [
          ...new Set(
            s.team.filter((id) => t.fighters.some((f) => f.id === id)),
          ),
        ].slice(0, 3)
      : [t.selected];
    if (!t.team.length) t.team = [t.selected];
    t.quests = Array.isArray(s.quests)
      ? [...new Set(s.quests.filter((x) => typeof x === "string"))].slice(-100)
      : [];
    t.road = Array.isArray(s.road)
      ? [...new Set(s.road.filter((x) => Number.isInteger(x) && x >= 0))].slice(
          0,
          20,
        )
      : [];
    t.receipts = Array.isArray(s.receipts)
      ? s.receipts
          .filter((x) => typeof x === "string" && x.length < 150)
          .slice(-200)
      : [];
    if (s.adAt && typeof s.adAt === "object")
      for (const k of [
        "coins",
        "boost",
        "box",
        "box1",
        "box2",
        "box3",
        "box4",
        "box5",
        "power",
        "gems",
        "draft",
      ])
        t.adAt[k] = int(s.adAt[k]);
    t.sound = s.sound !== false;
    t.music = typeof s.music === "boolean" ? s.music : t.sound;
    t.soundVolume =
      typeof s.soundVolume === "number" && Number.isFinite(s.soundVolume)
        ? int(s.soundVolume, 100)
        : 65;
    t.musicVolume =
      typeof s.musicVolume === "number" && Number.isFinite(s.musicVolume)
        ? int(s.musicVolume, 100)
        : 35;
    t.language =
      s.language === "ru" || s.language === "en" ? s.language : "auto";
    if (
      s.pending &&
      ["box", "battle", "wheel", "rush"].includes(s.pending.kind) &&
      int(s.pending.id) > 0
    ) {
      const p = s.pending;
      t.pending = {
        id: int(p.id),
        kind: p.kind,
        coins: int(p.coins),
        gems: int(p.gems),
        power: int(p.power),
        quality: int(p.quality, 4),
        boosted: p.boosted === true,
        revived: p.revived === true,
        hits: int(p.hits),
        score: int(p.score),
        chapterClear: int(p.chapterClear),
        ...(p.kind === "box" && p.boxIndex !== undefined
          ? {
              boxIndex: int(p.boxIndex, BOXES.length - 1),
              revealStep: int(p.revealStep, 7),
            }
          : {}),
        ...(BRAWLERS.some((b) => b.id === p.brawler)
          ? { brawler: p.brawler, newBrawler: p.newBrawler === true }
          : {}),
        ...(typeof p.won === "boolean" ? { won: p.won } : {}),
      };
    }
    if (
      !t.pending &&
      s.battle &&
      number(s.battle.hp) > 0 &&
      number(s.battle.maxHp) > 0
    )
      t.battle = {
        skill: restoreSkill(s.battle.skill),
        attackFeedback: number(s.battle.attackFeedback, 900),
        lastAttack: ["dodged", "blocked", "hit"].includes(
          s.battle.lastAttack ?? "",
        )
          ? s.battle.lastAttack
          : undefined,
        playerHp:
          s.battle.playerHp === undefined
            ? 100
            : number(s.battle.playerHp, 100),
        maxPlayerHp: 100,
        attackIn:
          s.battle.attackIn === undefined
            ? 5000
            : number(s.battle.attackIn, 5000),
        dodgeCooldown: number(s.battle.dodgeCooldown, 2500),
        dodgeWindow: number(s.battle.dodgeWindow, 1100),
        hp: Math.min(number(s.battle.hp), number(s.battle.maxHp)),
        maxHp: number(s.battle.maxHp),
        remaining: number(s.battle.remaining, 45000),
        hits: int(s.battle.hits),
        boss: int(s.battle.boss, 10000),
        charge: int(s.battle.charge, 100),
        revived: s.battle.revived === true,
      };
    if (
      !t.pending &&
      !t.battle &&
      s.rush &&
      number(s.rush.remaining) > 0 &&
      Array.isArray(s.rush.targets)
    ) {
      const r = s.rush,
        slots = new Set<number>(),
        ids = new Set<number>();
      const targets = r.targets
        .filter(
          (x) =>
            x &&
            Number.isInteger(x.slot) &&
            x.slot >= 0 &&
            x.slot < 9 &&
            !slots.has(x.slot) &&
            slots.add(x.slot) &&
            Number.isInteger(x.id) &&
            x.id > 0 &&
            !ids.has(x.id) &&
            ids.add(x.id),
        )
        .slice(0, 3)
        .map((x) => ({
          id: x.id,
          slot: x.slot,
          kind: (["gem", "coin", "power", "rival", "bomb"].includes(x.kind)
            ? x.kind
            : "bot") as RushTarget["kind"],
          hp: Math.max(1, int(x.hp, 2)),
          maxHp: Math.max(1, int(x.maxHp, 2)),
          brawler: BRAWLERS.some((b) => b.id === x.brawler)
            ? x.brawler
            : BRAWLERS[0].id,
          life: Math.max(1, number(x.life, 33000)),
          maxLife: Math.max(1, number(x.maxLife, 33000)),
          ...(x.kind === "bomb"
            ? {
                expiresIn:
                  x.expiresIn === undefined
                    ? BOMB_LIFETIME
                    : number(x.expiresIn, BOMB_LIFETIME),
              }
            : {}),
        }));
      if (targets.length === 3)
        t.rush = {
          skill: restoreSkill(r.skill),
          mode: RUSH_MODES.includes(r.mode) ? r.mode : "mix",
          remaining: number(r.remaining, 33000),
          hits: int(r.hits),
          misses: int(r.misses),
          combo: int(r.combo),
          bestCombo: int(r.bestCombo),
          score: int(r.score),
          charge: int(r.charge, 100),
          targets,
        };
    }
    t.offlineCoins += Math.floor(
      Math.min(7200, Math.max(0, (now - int(s.lastSeen)) / 1000)) *
        this.passive *
        0.5,
    );
    t.lastSeen = now;
  }
  snapshot() {
    return clone(this.state);
  }
  get selected() {
    return this.state.fighters.find((f) => f.id === this.state.selected)!;
  }
  get multiplier() {
    return 1 + this.state.stars * 0.05;
  }
  private roleLevels(role: string) {
    return this.state.team.reduce(
      (sum, id) =>
        sum +
        (BRAWLERS.find((b) => b.id === id)?.role === role
          ? this.state.fighters.find((f) => f.id === id)!.level
          : 0),
      0,
    );
  }
  get tapPower() {
    return Math.round(
      (4 + this.state.upgrades.tap * 2 + this.selected.level * 2) *
        this.multiplier *
        (1 + this.roleLevels("Штурмовик") * 0.025),
    );
  }
  get passive() {
    return (
      Math.round(
        (this.state.upgrades.auto * 1.5 +
          this.state.team.reduce(
            (a, id) =>
              a +
              (this.state.fighters.find((f) => f.id === id)?.level ?? 0) * 0.25,
            0,
          ) +
          this.roleLevels("Снайпер") * 0.3) *
          this.multiplier *
          10,
      ) / 10
    );
  }
  get critChance() {
    return Math.min(
      0.65,
      0.05 +
        this.state.upgrades.crit * 0.015 +
        this.roleLevels("Контроль") * 0.005,
    );
  }
  get comboMultiplier() {
    if (this.state.rush)
      return 1 + Math.min(2, Math.floor(this.state.rush.combo / 5) * 0.2);
    return 1 + Math.min(1, Math.floor(this.combo / 10) * 0.1);
  }
  private random() {
    const r = this.rng();
    if (!Number.isFinite(r) || r < 0 || r >= 1) throw Error("random");
    return r;
  }
  private idle() {
    if (this.state.pending || this.state.battle || this.state.rush)
      throw Error("busy");
  }
  private receipt(r: string) {
    if (!r || this.state.receipts.includes(r)) throw Error("receipt");
    this.state.receipts.push(r);
    this.state.receipts = this.state.receipts.slice(-200);
  }
  private earn(amount: number) {
    this.state.coins += amount;
    this.state.totalCoins += amount;
  }
  tap(now = Date.now()) {
    if (
      !Number.isFinite(now) ||
      now - this.lastTap < 70 ||
      this.state.pending ||
      this.state.battle ||
      this.state.rush
    )
      return null;
    const critical = this.random() < this.critChance;
    this.combo = now - this.lastTap < 850 ? this.combo + 1 : 1;
    this.lastTap = now;
    const amount = Math.ceil(
      this.tapPower *
        this.comboMultiplier *
        (critical ? 3 : 1) *
        (now < this.state.boostUntil ? 2 : 1) *
        (now < this.state.superUntil ? 3 : 1),
    );
    this.earn(amount);
    this.state.totalTaps++;
    this.state.superCharge = Math.min(100, this.state.superCharge + 4);
    if (this.state.totalTaps % 10 === 0) this.state.trophies++;
    return { amount, critical, combo: this.combo };
  }
  tick(ms: number, now = Date.now()) {
    if (!Number.isFinite(ms) || ms <= 0) return false;
    ms = Math.min(ms, 1000);
    this.state.lastSeen = now;
    const active = this.state.rush ?? this.state.battle;
    if (active) {
      const skill = active.skill;
      skill.cooldown = Math.max(0, skill.cooldown - ms);
      const effectMs = Math.min(ms, skill.remaining);
      if (skill.kind === "summon" && effectMs > 0) {
        if (this.state.battle) {
          const b = this.state.battle;
          b.hp = Math.max(
            0,
            b.hp - (this.battleDamage * skill.power * effectMs) / 1000,
          );
          if (!b.hp) {
            this.finishBattle(true);
            return true;
          }
        } else this.earn((this.tapPower * skill.power * effectMs) / 1000);
      }
      skill.remaining = Math.max(0, skill.remaining - ms);
      if (!skill.remaining) skill.kind = null;
    }
    if (this.state.rush) {
      const r = this.state.rush;
      r.remaining = Math.max(0, r.remaining - ms);
      if (!r.remaining) {
        this.finishRush();
        return true;
      }
      // Ordinary targets persist. Bombs leave safely after four active seconds.
      for (let i = 0; i < r.targets.length; i++) {
        const target = r.targets[i];
        if (r.skill.kind !== "freeze")
          target.life = Math.max(0, target.life - ms);
        if (target.kind === "bomb") {
          target.expiresIn = Math.max(
            0,
            (target.expiresIn ?? BOMB_LIFETIME) - ms,
          );
          if (!target.expiresIn)
            r.targets[i] = this.rushTarget(
              r.targets.map((t) => t.slot),
              r.combo,
            );
        }
      }
    } else if (this.state.battle) {
      const b = this.state.battle;
      b.attackFeedback = Math.max(0, (b.attackFeedback ?? 0) - ms);
      b.dodgeCooldown = Math.max(0, b.dodgeCooldown - ms);
      if (b.skill.kind !== "freeze") b.attackIn -= ms;
      if (b.attackIn <= 0) {
        b.lastAttack = b.dodgeWindow
          ? "dodged"
          : b.skill.kind === "shield"
            ? "blocked"
            : "hit";
        b.attackFeedback = 900;
        if (!b.dodgeWindow && b.skill.kind !== "shield")
          b.playerHp = Math.max(
            0,
            b.playerHp - (22 + Math.floor(b.boss / 12) * 4),
          );
        b.attackIn = bossAt(b.boss).mechanic === "haste" ? 3600 : 5000;
        if (!b.playerHp) {
          this.finishBattle(false);
          return true;
        }
      }
      b.dodgeWindow = Math.max(0, b.dodgeWindow - ms);
      if (bossAt(b.boss).mechanic === "regen")
        b.hp = Math.min(b.maxHp, b.hp + (b.maxHp * 0.004 * ms) / 1000);
      this.state.battle.remaining = Math.max(
        0,
        this.state.battle.remaining - ms,
      );
      if (!this.state.battle.remaining) {
        this.finishBattle(false);
        return true;
      }
    } else if (!this.state.pending) this.earn((this.passive * ms) / 1000);
    return false;
  }
  upgradeCost(kind: Upgrade) {
    return Math.ceil(
      { tap: 70, auto: 120, crit: 200, super: 180 }[kind] *
        Math.pow(1.42, this.state.upgrades[kind]),
    );
  }
  upgrade(kind: Upgrade) {
    this.idle();
    const cost = this.upgradeCost(kind);
    if (this.state.upgrades[kind] >= (kind === "crit" ? 15 : 40))
      throw Error("max");
    if (this.state.coins < cost) throw Error("funds");
    this.state.coins -= cost;
    this.state.upgrades[kind]++;
    return cost;
  }
  levelCost(id: number) {
    const f = this.state.fighters.find((f) => f.id === id);
    if (!f) throw Error("locked");
    return {
      coins: Math.round(100 * Math.pow(1.6, f.level - 1)),
      power: Math.max(0, 15 * f.level - f.cards),
    };
  }
  level(id: number) {
    this.idle();
    const f = this.state.fighters.find((f) => f.id === id);
    if (!f) throw Error("locked");
    if (f.level >= 11) throw Error("max");
    const q = this.levelCost(id);
    if (this.state.coins < q.coins || this.state.power < q.power)
      throw Error("funds");
    this.state.coins -= q.coins;
    this.state.power -= q.power;
    f.cards = Math.max(0, f.cards - 15 * f.level);
    f.level++;
  }
  recruitCost(id: number) {
    const b = BRAWLERS.find((b) => b.id === id);
    if (!b) throw Error("locked");
    return 30 + b.rarity * 20;
  }
  recruit(id: number) {
    this.idle();
    const b = BRAWLERS.find((b) => b.id === id);
    if (
      !b ||
      b.unlock > this.state.trophies ||
      this.state.fighters.some((f) => f.id === id)
    )
      throw Error("locked");
    const cost = this.recruitCost(id);
    if (this.state.gems < cost) throw Error("funds");
    this.state.gems -= cost;
    this.state.fighters.push({ id, level: 1, cards: 0 });
  }
  select(id: number) {
    this.idle();
    if (!this.state.fighters.some((f) => f.id === id)) throw Error("locked");
    this.state.selected = id;
  }
  team(id: number) {
    this.idle();
    if (!this.state.fighters.some((f) => f.id === id)) throw Error("locked");
    if (this.state.team.includes(id)) {
      if (this.state.team.length === 1) throw Error("team");
      this.state.team = this.state.team.filter((x) => x !== id);
    } else {
      if (this.state.team.length >= 3) throw Error("team");
      this.state.team.push(id);
    }
  }
  activateSuper(now = Date.now()) {
    if (this.state.pending || !Number.isFinite(now)) throw Error("busy");
    const r = this.state.rush;
    if (r) {
      if (r.charge < 100) throw Error("charge");
      const targets = [this.rushTarget([], r.combo)];
      targets.push(
        this.rushTarget(
          targets.map((t) => t.slot),
          r.combo,
        ),
      );
      targets.push(
        this.rushTarget(
          targets.map((t) => t.slot),
          r.combo,
        ),
      );
      let bombs = 0;
      for (const target of targets)
        if (target.kind === "bomb" && ++bombs > 1) target.kind = "coin";
      r.charge = 0;
      r.hits += 3;
      r.combo += 3;
      r.bestCombo = Math.max(r.bestCombo, r.combo);
      r.score += 75;
      this.earn(this.tapPower * (12 + this.state.upgrades.super));
      r.targets = targets;
      return;
    }
    const b = this.state.battle;
    if ((b ? b.charge : this.state.superCharge) < 100) throw Error("charge");
    if (b) {
      b.charge = 0;
      b.hp = Math.max(
        0,
        b.hp -
          this.battleDamage *
            (8 + this.state.upgrades.super + this.roleLevels("Танк") * 0.2),
      );
      if (!b.hp) this.finishBattle(true);
    } else {
      this.state.superCharge = 0;
      this.state.superUntil = now + 6000 + this.state.upgrades.super * 500;
    }
  }
  openBox(index: number, now = Date.now(), receipt?: string) {
    return this.grantBox(index, now, receipt, false);
  }
  private grantBox(
    index: number,
    now: number,
    receipt: string | undefined,
    daily: boolean,
  ) {
    this.idle();
    const box = BOXES[index];
    if (!box) throw Error("box");
    if (!Number.isFinite(now)) throw Error("cooldown");
    if (this.state.trophies < box.unlock) throw Error("locked");
    if (box.currency === "daily" && !daily) throw Error("locked");
    if (daily && (box.currency !== "daily" || now < this.state.dailyAt))
      throw Error("cooldown");
    const adKey = index === 0 ? "box" : `box${index}`;
    if (receipt === undefined) {
      if (box.currency === "ad" || box.currency === "daily")
        throw Error("receipt");
      if (this.state[box.currency] < box.cost) throw Error("funds");
    } else {
      if (box.currency === "gems") throw Error("locked");
      if (!daily && now < (this.state.adAt[adKey] || 0))
        throw Error("cooldown");
      if (!receipt || this.state.receipts.includes(receipt))
        throw Error("receipt");
    }
    const roll = this.random(),
      pick = this.random(),
      coinRoll = this.random();
    const available = BRAWLERS.filter(
      (b) =>
        !this.state.fighters.some((f) => f.id === b.id) &&
        b.unlock <= this.state.trophies &&
        b.rarity >= box.minRarity &&
        b.rarity <= box.maxRarity,
    );
    const fresh =
      available.length > 0 &&
      (this.state.boxes === 0 || this.state.pity >= 7 || roll < box.chance);
    const owned = BRAWLERS.filter((b) =>
      this.state.fighters.some((f) => f.id === b.id),
    );
    const pool = fresh ? available : owned;
    const brawler = pool[Math.floor(pick * pool.length)];
    if (receipt !== undefined) {
      this.receipt(receipt);
      if (daily) this.state.dailyAt = now + DAY;
      else this.state.adAt[adKey] = now + box.cooldown;
    } else if (box.currency === "coins" || box.currency === "gems")
      this.state[box.currency] -= box.cost;
    const coins = daily
      ? 200 + Math.floor(this.state.trophies / 10) * 10
      : Math.floor(box.coins * (0.75 + coinRoll * 0.5));
    const gems =
        box.gems +
        (box.currency !== "gems" && !daily && coinRoll > 0.85 ? 1 : 0),
      power = box.power + (fresh ? 0 : box.cards);
    if (fresh) {
      this.state.fighters.push({ id: brawler.id, level: 1, cards: 0 });
      this.state.pity = 0;
    } else {
      this.state.pity++;
      this.state.fighters.find((f) => f.id === brawler.id)!.cards += box.cards;
    }
    this.earn(coins);
    this.state.gems += gems;
    this.state.power += power;
    this.state.boxes++;
    return this.outcome({
      kind: "box",
      coins,
      gems,
      power,
      brawler: brawler.id,
      newBrawler: fresh,
      quality: brawler.rarity,
      boxIndex: index,
      revealStep: 0,
    });
  }
  advanceBox(event: number, skip = false) {
    const p = this.state.pending;
    if (!p || p.id !== event || p.kind !== "box" || p.boxIndex === undefined)
      throw Error("claimed");
    p.revealStep = skip ? 7 : Math.min(7, (p.revealStep ?? 0) + 1);
  }
  private outcome(p: Omit<Outcome, "id" | "boosted">) {
    const result = { id: this.state.next++, boosted: false, ...p };
    this.state.pending = result;
    return result;
  }
  dismiss() {
    this.state.pending = null;
  }
  boostResult(event: number, receipt: string) {
    const p = this.state.pending;
    if (!p || p.id !== event || p.boosted || p.coins <= 0)
      throw Error("claimed");
    this.receipt(receipt);
    this.earn(p.coins);
    p.boosted = true;
    return p.coins;
  }
  daily(now: number, receipt: string) {
    return this.grantBox(6, now, receipt, true);
  }
  wheel(now: number, receipt: string) {
    this.idle();
    if (!Number.isFinite(now) || now < this.state.wheelAt)
      throw Error("cooldown");
    const i = Math.floor(this.random() * 6),
      coins = [80, 150, 250, 400, 0, 0][i],
      power = i === 4 ? 40 : 0,
      gems = i === 5 ? 8 : 0;
    this.receipt(receipt);
    this.earn(coins);
    this.state.power += power;
    this.state.gems += gems;
    this.state.wheelAt = now + 1800000;
    return this.outcome({
      kind: "wheel",
      coins,
      gems,
      power,
      quality: i > 2 ? 2 : 0,
    });
  }
  get battleDamage() {
    return Math.round(
      (22 +
        this.state.upgrades.tap * 3 +
        this.state.team.reduce(
          (sum, id) =>
            sum +
            (this.state.fighters.find((f) => f.id === id)?.level ?? 1) * 8,
          0,
        )) *
        this.multiplier,
    );
  }
  private rushTarget(
    occupied: number[],
    _combo: number,
    mode: RushMode = this.state.rush?.mode ?? "mix",
  ): RushTarget {
    const free = Array.from({ length: 9 }, (_, i) => i).filter(
      (i) => !occupied.includes(i),
    );
    const slot = free[Math.floor(this.random() * free.length)],
      roll = this.random();
    let kind: RushTarget["kind"] =
      roll < 0.1
        ? "gem"
        : roll < 0.2
          ? "coin"
          : roll < 0.28
            ? "power"
            : roll < 0.38
              ? "rival"
              : roll < 0.44
                ? "bomb"
                : "bot";
    if (roll >= 0.44 && roll < 0.78 && mode !== "mix")
      kind = (
        { gem: "gem", gold: "coin", duel: "rival", power: "power" } as const
      )[mode];
    // Always leave collectible targets available; a bomb never fills all slots.
    if (
      kind === "bomb" &&
      this.state.rush?.targets.some((t) => t.kind === "bomb")
    )
      kind = "coin";
    const hp = kind === "rival" ? 2 : 1;
    const life = this.state.rush?.remaining ?? 25000;
    return {
      id: this.state.next++,
      slot,
      kind,
      life,
      maxLife: life,
      ...(kind === "bomb" ? { expiresIn: BOMB_LIFETIME } : {}),
      hp,
      maxHp: hp,
      brawler: BRAWLERS[(this.state.next * 7) % BRAWLERS.length].id,
    };
  }
  startRush() {
    this.idle();
    const mode = RUSH_MODES[this.state.rushRounds % RUSH_MODES.length];
    const targets: RushTarget[] = [];
    for (let i = 0; i < 3; i++) {
      const target = this.rushTarget(
        targets.map((t) => t.slot),
        0,
        mode,
      );
      if (target.kind === "bomb" && targets.some((t) => t.kind === "bomb"))
        target.kind = "coin";
      targets.push(target);
    }
    if (mode === "mix" && targets.every((t) => t.kind === "bot")) {
      targets[1].kind = "rival";
      targets[1].hp = targets[1].maxHp = 2;
      targets[2].kind = "coin";
    }
    this.state.rush = {
      skill: freshSkill(),
      mode,
      remaining: 25000,
      hits: 0,
      misses: 0,
      combo: 0,
      bestCombo: 0,
      score: 0,
      charge: 0,
      targets,
    };
    this.lastTap = -Infinity;
  }
  rushHit(id: number, now: number) {
    const r = this.state.rush;
    if (!r || !Number.isFinite(now) || now - this.lastTap < 70) return null;
    const index = r.targets.findIndex((t) => t.id === id);
    if (index < 0) return null;
    const target = r.targets[index],
      destroyed = target.hp <= 1;
    const replacement = destroyed
      ? this.rushTarget(
          r.targets.map((t) => t.slot),
          r.combo,
        )
      : null;
    const critical = this.random() < this.critChance;
    this.lastTap = now;
    if (target.kind === "bomb" && r.skill.kind !== "shield") {
      r.targets[index] = replacement!;
      r.combo = 0;
      r.misses++;
      r.charge = Math.max(0, r.charge - 15);
      return {
        amount: 0,
        critical: false,
        combo: 0,
        gem: false,
        power: 0,
        bomb: true,
        slot: target.slot,
      };
    }
    r.combo++;
    r.hits++;
    r.score += 10 + Math.min(50, r.combo) * 2;
    r.bestCombo = Math.max(r.bestCombo, r.combo);
    r.charge = Math.min(100, r.charge + 10);
    if (replacement) r.targets[index] = replacement;
    else target.hp--;
    const amount = Math.ceil(
      this.tapPower *
        this.comboMultiplier *
        (critical ? 3 : 1) *
        (target.kind === "coin"
          ? 3
          : target.kind === "rival" && destroyed
            ? 4
            : target.kind === "gem" || target.kind === "power"
              ? 2
              : 1) *
        (now < this.state.boostUntil ? 2 : 1) *
        (r.skill.kind === "haste" || r.skill.kind === "shield" ? 2 : 1),
    );
    this.earn(amount);
    this.state.totalTaps++;
    if (this.state.totalTaps % 10 === 0) this.state.trophies++;
    if (target.kind === "gem") this.state.gems++;
    const power = target.kind === "power" ? 3 : 0;
    this.state.power += power;
    return {
      amount,
      critical,
      combo: r.combo,
      gem: target.kind === "gem",
      power,
      bomb: false,
      slot: target.slot,
    };
  }
  missRush() {
    if (this.state.rush) {
      this.state.rush.combo = 0;
      this.state.rush.misses++;
    }
  }
  private finishRush() {
    const r = this.state.rush!,
      coins = r.hits ? 50 + r.hits * 4 : 0,
      power = r.hits >= 10 ? 5 + Math.floor(r.hits / 10) : 0;
    this.earn(coins);
    this.state.power += power;
    this.state.trophies += Math.floor(r.hits / 5);
    this.state.rushRounds++;
    this.state.rushBest = Math.max(this.state.rushBest, r.score);
    this.state.rush = null;
    return this.outcome({
      kind: "rush",
      coins,
      power,
      gems: 0,
      quality: r.hits >= 35 ? 4 : r.hits >= 20 ? 2 : 0,
      hits: r.hits,
      score: r.score,
      won: r.hits >= 15,
    });
  }
  dodge() {
    const b = this.state.battle;
    if (!b || this.state.pending) throw Error("busy");
    if (b.dodgeCooldown > 0) throw Error("cooldown");
    b.dodgeWindow = 1100;
    b.dodgeCooldown = 2500;
  }
  useAbility() {
    const active = this.state.battle ?? this.state.rush;
    if (!active || this.state.pending) throw Error("busy");
    if (active.skill.cooldown > 0) throw Error("cooldown");
    const ability = abilityFor(this.state.selected),
      s = active.skill;
    s.cooldown = ability.cooldown;
    s.kind = ability.kind;
    s.power = ability.power;
    s.remaining =
      ability.kind === "summon"
        ? 6000
        : ability.kind === "haste" ||
            ability.kind === "shield" ||
            ability.kind === "freeze"
          ? ability.power * 1000
          : 0;
    const b = this.state.battle,
      r = this.state.rush;
    if (ability.kind === "heal") {
      if (b) {
        b.playerHp = Math.min(100, b.playerHp + ability.power);
        b.hp = Math.max(0, b.hp - this.battleDamage * 3);
      }
      if (r) {
        r.remaining += 3000;
        r.charge = Math.min(100, r.charge + 20);
      }
    }
    if (ability.kind === "blast") {
      if (b)
        b.hp = Math.max(
          0,
          b.hp -
            this.battleDamage *
              ability.power *
              (1 + (this.selected.level - 1) * 0.08),
        );
      if (r) {
        const good = r.targets.filter((t) => t.kind !== "bomb");
        this.state.gems += good.filter((t) => t.kind === "gem").length;
        this.state.power += good.filter((t) => t.kind === "power").length * 3;
        this.earn(this.tapPower * ability.power);
        r.hits += good.length;
        r.combo += good.length;
        r.bestCombo = Math.max(r.bestCombo, r.combo);
        r.score += good.length * 50;
        r.charge = Math.min(100, r.charge + good.length * 10);
        const targets: RushTarget[] = [];
        for (let i = 0; i < 3; i++) {
          const t = this.rushTarget(
            targets.map((x) => x.slot),
            r.combo,
          );
          if (t.kind === "bomb" && targets.some((x) => x.kind === "bomb"))
            t.kind = "coin";
          targets.push(t);
        }
        r.targets = targets;
      }
    }
    if (b && !b.hp) this.finishBattle(true);
    return ability;
  }
  startBattle() {
    this.idle();
    const hp = bossHealth(this.state.wins);
    this.state.battle = {
      skill: freshSkill(),
      playerHp: 100,
      maxPlayerHp: 100,
      attackIn: 5000,
      dodgeCooldown: 0,
      dodgeWindow: 0,
      hp,
      maxHp: hp,
      remaining: bossAt(this.state.wins).mechanic === "haste" ? 35000 : 45000,
      hits: 0,
      boss: this.state.wins,
      charge: 0,
    };
    this.lastTap = -Infinity;
  }
  attack(now: number) {
    const b = this.state.battle;
    if (!b || !Number.isFinite(now) || now - this.lastTap < 70) return null;
    const crit = this.random() < this.critChance;
    const damage = Math.round(
      this.battleDamage *
        (crit ? 3 : 1) *
        (bossAt(b.boss).mechanic === "armor" ? 0.7 : 1) *
        (b.skill.kind === "haste" ? 2 : 1),
    );
    this.lastTap = now;
    b.hp = Math.max(0, b.hp - damage);
    b.hits++;
    b.charge = Math.min(100, b.charge + 5);
    if (!b.hp) this.finishBattle(true);
    return { damage, critical: crit };
  }
  private finishBattle(won: boolean) {
    const b = this.state.battle!;
    const coins = won
      ? Math.round(
          (250 + b.boss * 65) * (1 + this.roleLevels("Поддержка") * 0.03),
        )
      : 30;
    this.earn(coins);
    const power = won ? 18 + ((b.boss + 1) % 12 === 0 ? 30 : 0) : 3;
    this.state.power += power;
    if (won) {
      this.state.wins++;
      this.state.trophies += 30 + b.boss * 3;
    }
    const chapterClear =
      won && this.state.wins % 12 === 0 ? this.state.wins / 12 : 0;
    const gems =
      (won && this.state.wins % 3 === 0 ? 3 : 0) +
      (chapterClear ? 10 + chapterClear * 2 : 0);
    if (chapterClear) this.state.stars++;
    this.state.gems += gems;
    this.state.battle = null;
    return this.outcome({
      kind: "battle",
      won,
      coins,
      power,
      gems,
      quality: won ? 3 : 0,
      chapterClear,
      revived: b.revived === true,
    });
  }
  revive(event: number, now: number, receipt: string) {
    const p = this.state.pending;
    if (
      !p ||
      p.id !== event ||
      p.kind !== "battle" ||
      p.won ||
      p.boosted ||
      p.revived
    )
      throw Error("claimed");
    this.receipt(receipt);
    p.boosted = true;
    this.state.pending = null;
    const hp = bossHealth(this.state.wins);
    this.state.battle = {
      skill: freshSkill(),
      playerHp: 60,
      maxPlayerHp: 100,
      attackIn: 5000,
      dodgeCooldown: 0,
      dodgeWindow: 0,
      hp: Math.round(hp * 0.35),
      maxHp: hp,
      remaining: 20000,
      hits: 0,
      boss: this.state.wins,
      charge: 100,
      revived: true,
    };
    this.lastTap = now;
  }
  claimOffline(receipt?: string) {
    this.idle();
    if (!this.state.offlineCoins) throw Error("claimed");
    if (receipt !== undefined) this.receipt(receipt);
    const coins = this.state.offlineCoins * (receipt !== undefined ? 2 : 1);
    this.state.offlineCoins = 0;
    this.earn(coins);
    return coins;
  }
  tasks() {
    return [
      {
        id: "tap100",
        ru: "Сделай 100 кликов",
        en: "Make 100 taps",
        value: this.state.totalTaps,
        goal: 100,
        coins: 200,
      },
      {
        id: "box3",
        ru: "Открой 3 бокса",
        en: "Open 3 boxes",
        value: this.state.boxes,
        goal: 3,
        coins: 350,
      },
      {
        id: "win1",
        ru: "Победи первого босса",
        en: "Defeat the first boss",
        value: this.state.wins,
        goal: 1,
        coins: 300,
      },
      {
        id: "team3",
        ru: "Собери 3 бойцов",
        en: "Collect 3 brawlers",
        value: this.state.fighters.length,
        goal: 3,
        coins: 500,
      },
      {
        id: "tap1000",
        ru: "Сделай 1000 кликов",
        en: "Make 1000 taps",
        value: this.state.totalTaps,
        goal: 1000,
        coins: 1200,
      },
      {
        id: "win10",
        ru: "Победи 10 боссов",
        en: "Defeat 10 bosses",
        value: this.state.wins,
        goal: 10,
        coins: 2500,
      },
    ].map((t) => ({ ...t, claimed: this.state.quests.includes(t.id) }));
  }
  quest(id: string, receipt?: string) {
    this.idle();
    const q = this.tasks().find((q) => q.id === id);
    if (!q || q.claimed || q.value < q.goal) throw Error("locked");
    if (receipt !== undefined) this.receipt(receipt);
    this.earn(q.coins * (receipt !== undefined ? 2 : 1));
    this.state.quests.push(id);
    return q.coins * (receipt !== undefined ? 2 : 1);
  }
  roadClaim(index: number) {
    this.idle();
    const threshold = [10, 30, 75, 150, 300, 500, 800, 1200][index];
    if (
      threshold === undefined ||
      this.state.trophies < threshold ||
      this.state.road.includes(index)
    )
      throw Error("locked");
    const coins = 150 + index * 150;
    this.earn(coins);
    this.state.gems += 3 + index;
    this.state.power += 15 + index * 5;
    this.state.road.push(index);
    return coins;
  }
  adReward(
    kind: "coins" | "boost" | "power" | "gems",
    now: number,
    receipt: string,
  ) {
    this.idle();
    if (!Number.isFinite(now) || now < (this.state.adAt[kind] || 0))
      throw Error("cooldown");
    this.receipt(receipt);
    this.state.adAt[kind] =
      now + { coins: 120000, boost: 180000, power: 300000, gems: 600000 }[kind];
    if (kind === "coins") {
      const amount = Math.max(200, this.tapPower * 40);
      this.earn(amount);
      return amount;
    }
    if (kind === "power") {
      this.state.power += 35;
      return 35;
    }
    if (kind === "gems") {
      this.state.gems += 5;
      return 5;
    }
    this.state.boostUntil = Math.max(now, this.state.boostUntil) + 120000;
    return 120;
  }
  prestige() {
    this.idle();
    if (this.state.trophies < 300 * (this.state.prestige + 1))
      throw Error("locked");
    const stars = 3 + Math.floor(this.state.trophies / 150);
    this.state.stars += stars;
    this.state.prestige++;
    this.state.coins = 350;
    this.state.upgrades = { tap: 0, auto: 0, crit: 0, super: 0 };
    this.state.superCharge = 0;
    this.state.superUntil = 0;
    return stars;
  }
}
