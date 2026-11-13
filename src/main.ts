import { abilityFor, skillHint } from "./abilities";
import {
  BOSSES,
  bossAt,
  bossHealth,
  RUSH_LABELS,
  RUSH_MODES,
} from "./encounters";
import { BOMB_LIFETIME, type RushTarget } from "./engine";
import "./style.css";
import "./rush.css";
import "./combat.css";
import "./loot.css";
import "./team.css";
import { BRAWLERS, COLORS } from "./data";
import { ClickGame, BOXES, AD_INTERVAL, type Upgrade } from "./engine";
import { Platform } from "./platform";
import { StormAudio } from "./audio";
const platform = new Platform({
    local: "brawl-click.save.v1",
    cloud: "brawlClickV1",
  }),
  audio = new StormAudio();
const app = document.querySelector<HTMLDivElement>("#app")!,
  modal = document.querySelector<HTMLDialogElement>("#modal")!,
  toastEl = document.querySelector<HTMLDivElement>("#toast")!;
let game = new ClickGame(),
  lang: "ru" | "en" = "ru",
  route = "home",
  busy = false,
  animating = false,
  sdkPaused = false,
  focused = true,
  filter = "all",
  startedAt = Date.now(),
  lastTick = performance.now(),
  toastTimer: ReturnType<typeof setTimeout>;
const tr = (ru: string, en: string) => (lang === "ru" ? ru : en);
const fmt = (n: number) =>
  new Intl.NumberFormat(lang === "ru" ? "ru-RU" : "en-US", {
    maximumFractionDigits: n < 100 ? 1 : 0,
    notation: n >= 1e7 ? "compact" : "standard",
  }).format(n);
const art = (file: string) => import.meta.env.BASE_URL + file;
const img = (id: number) => art(`brawlers/${id}.png`);
const brawler = (id: number) => BRAWLERS.find((b) => b.id === id)!;
const name = (id: number) =>
  lang === "ru" ? brawler(id).name : brawler(id).en;
const icon = (kind: string) => {
  const themed: Record<string, string> = {
    coin: "coin",
    gem: "gems",
    power: "power",
    trophy: "trophy",
    home: "skull",
    fighters: "fighters",
    box: "box",
    arena: "super",
    road: "trophy",
    gift: "pass",
    star: "star",
    bolt: "boost",
    tap: "tap",
    auto: "team",
    crit: "crit",
    super: "super",
    boost: "boost",
  };
  if (themed[kind])
    return `<img class="themed-icon icon-${kind}" src="${art(themed[kind] === "box" ? "art/box.png" : `icons/${themed[kind]}.png`)}" alt="" aria-hidden="true" draggable="false">`;

  const paths: Record<string, string> = {
    coin: '<circle cx="12" cy="12" r="9"/><path d="M14 7h-5v10h5M9 12h4"/>',
    gem: '<path d="m3 8 4-5h10l4 5-9 13L3 8Zm0 0h18M7 3l5 18 5-18"/>',
    power: '<path d="m13 2-9 12h7l-1 8 10-13h-7l1-7Z"/>',
    trophy:
      '<path d="M7 3h10v7a5 5 0 0 1-10 0V3Zm0 2H3v3a5 5 0 0 0 5 5m9-8h4v3a5 5 0 0 1-5 5M12 15v6m-4 0h8"/>',
    home: '<path d="m3 10 9-7 9 7v11H3V10Zm6 11v-8h6v8"/>',
    fighters:
      '<path d="M5 20v-3a7 7 0 0 1 14 0v3M8 7a4 4 0 1 0 8 0 4 4 0 0 0-8 0Z"/>',
    box: '<path d="m3 7 9-4 9 4v14H3V7Zm0 1h18M12 8v13M8 3v5m8-5v5"/>',
    arena:
      '<path d="m3 3 18 18M21 3 3 21M3 3l1 6 5-5-6-1ZM21 3l-6 1 5 5 1-6ZM2 15l7 7m13-7-7 7"/>',
    road: '<path d="M4 21V3m0 1h14l-3 4 3 4H4M13 21l4-5 4 5"/>',
    gift: '<path d="M3 10h18v11H3V10Zm-1-5h20v5H2V5Zm10 0v16M12 5c-10 0-6-8 0 0Zm0 0c10 0 6-8 0 0Z"/>',
    star: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>',
    gear: '<path d="m9 3 1-2h4l1 3 3 1 3-1 2 4-2 2v4l2 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 2-2v-4L1 8l2-4 3 1 3-2Z"/><circle cx="12" cy="12" r="4"/>',
    play: '<path d="m8 4 12 8-12 8V4Z"/>',
    arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',
    bolt: '<path d="m14 2-3 8h8L9 22l2-9H4L14 2Z"/>',
    close: '<path d="m5 5 14 14M19 5 5 19"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
    sound:
      '<path d="m3 9 5 0 5-5v16l-5-5H3V9Zm14-2a7 7 0 0 1 0 10m2-13a11 11 0 0 1 0 16"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[kind] || paths.star}</svg>`;
};
const money = (n: number) =>
  `<span class="currency">${icon("coin")}${fmt(n)}</span>`;
const adButton = (type: string, label: string, extra = "", disabled = false) =>
  `<button class="ad-button" data-ad="${type}" ${extra} ${disabled || !platform.canReward ? "disabled" : ""}>${icon("play")}<span>${tr("Реклама", "Ad")} · ${label}</span></button>`;
const wait = (until: number) => {
  const n = Math.max(0, Math.ceil((until - platform.time()) / 1000));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
};
function refreshAdTimers() {
  const now = platform.time();
  const labels: Record<string, string> = {
    daily: tr("Забрать дроп", "Claim drop"),
    wheel: tr("Крутить колесо", "Spin wheel"),
    coins: tr("Получить", "Claim"),
    power: tr("Получить", "Claim"),
    gems: tr("Получить", "Claim"),
    boost: "×2",
  };
  for (const button of app.querySelectorAll<HTMLButtonElement>("[data-ad]")) {
    const type = button.dataset.ad!;
    if (type.startsWith("box-"))
      labels[type] = tr("Открыть бесплатно", "Open for free");
    if (!(type in labels)) continue;
    const key =
      type === "box-0"
        ? "box"
        : type.startsWith("box-")
          ? `box${type.slice(4)}`
          : type;
    const due =
      type === "daily"
        ? game.state.dailyAt
        : type === "wheel"
          ? game.state.wheelAt
          : game.state.adAt[key] || 0;
    const boxIndex = type.startsWith("box-") ? Number(type.slice(4)) : -1;
    button.disabled =
      !platform.canReward ||
      due > now ||
      !!game.state.rush ||
      (boxIndex >= 0 && game.state.trophies < (BOXES[boxIndex]?.unlock ?? 0));
    const label = button.querySelector("span");
    if (label)
      label.textContent = `${tr("Реклама", "Ad")} · ${due > now ? wait(due) : labels[type]}`;
  }
}
function toast(text: string) {
  toastEl.textContent = text;
  toastEl.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("visible"), 3000);
}
function error(e: unknown) {
  const key = e instanceof Error ? e.message : "";
  toast(
    (
      {
        funds: tr("Не хватает ресурсов", "Not enough resources"),
        locked: tr("Сначала выполни условие", "Complete the requirement first"),
        cooldown: tr(
          "Бонус ещё восстанавливается",
          "Bonus is still recharging",
        ),
        charge: tr("Заряди супер кликами", "Charge your Super by tapping"),
        team: tr("В команде от 1 до 3 бойцов", "Your team needs 1–3 brawlers"),
        max: tr("Максимальный уровень", "Maximum level"),
        busy: tr(
          "Сначала заверши текущее действие",
          "Finish the current action first",
        ),
      } as Record<string, string>
    )[key] || tr("Действие уже выполнено", "This action is already complete"),
  );
}
function persist() {
  game.state.lastSeen = platform.time();
  platform.save({
    bestScore: game.state.trophies,
    bestWave: game.state.wins,
    wins: game.state.wins,
    sound: game.state.sound,
    music: game.state.music,
    run: game.snapshot(),
  });
}
let pausedAt: number | null = null;
function pause() {
  const paused = busy || animating || sdkPaused || !focused || modal.open;
  const now = platform.time();
  if (paused && pausedAt === null) pausedAt = now;
  if (!paused && pausedAt !== null) {
    const elapsed = Math.max(0, now - pausedAt);
    if (game.state.boostUntil > pausedAt) game.state.boostUntil += elapsed;
    if (game.state.superUntil > pausedAt) game.state.superUntil += elapsed;
    pausedAt = null;
  }
  app.classList.toggle("paused", paused);
  audio.configure(
    game.state.sound,
    game.state.music,
    game.state.soundVolume,
    game.state.musicVolume,
  );
  audio.setScene(
    game.state.pending && ["rush", "battle"].includes(game.state.pending.kind)
      ? game.state.pending.kind === "battle" && !game.state.pending.won
        ? "lose"
        : "win"
      : game.state.battle
        ? "boss"
        : game.state.rush
          ? "rush"
          : "menu",
  );
  audio.setActive(!busy && !sdkPaused && focused);
  if (paused) platform.gameplayStop();
  else platform.gameplayStart();
  lastTick = performance.now();
}
function show(html: string) {
  modal.innerHTML = html;
  if (!modal.open) modal.showModal();
  pause();
}
function close() {
  if (busy || animating) return;
  if (game.state.pending) game.dismiss();
  modal.close();
  persist();
  render();
  pause();
}
const buttonClose = () =>
  `<button class="modal-close icon-button" data-action="close" aria-label="${tr("Закрыть", "Close")}">${icon("close")}</button>`;
let renderedRoute = "",
  renderedCombat = false;
function render() {
  const oldMain = app.querySelector("main");
  const combat = !!(game.state.battle || game.state.rush);
  const scrollTop =
    renderedRoute === route && renderedCombat === combat
      ? (oldMain?.scrollTop ?? 0)
      : 0;
  renderedCombat = combat;
  const queueLeft = app.querySelector(".boss-queue")?.scrollLeft ?? 0;
  renderedRoute = route;
  const nav = [
    ["home", "home", tr("Главная", "Home")],
    ["brawlers", "fighters", tr("Бойцы", "Brawlers")],
    ["boxes", "box", tr("Боксы", "Boxes")],
    ["arena", "arena", tr("Арена", "Arena")],
    ["road", "road", tr("Трофеи", "Trophies")],
    ["rewards", "gift", tr("Бонусы", "Rewards")],
  ];
  app.innerHTML = `<aside class="rail"><button class="brand" data-nav="home" aria-label="Brawl Click"><span>BRAWL</span><strong>CLICK</strong></button><nav>${nav.map(([key, i, label]) => `<button data-nav="${key}" class="nav-item ${route === key ? "active" : ""}" ${(game.state.battle && key !== "arena") || (game.state.rush && key !== "home") ? "disabled" : ""}>${icon(i)}<span>${label}</span>${key === "rewards" && game.state.dailyAt <= platform.time() ? "<i></i>" : ""}</button>`).join("")}</nav><button class="rail-settings icon-button" data-action="settings" aria-label="${tr("Настройки", "Settings")}">${icon("gear")}</button></aside><div class="game-shell"><header class="topbar"><div class="profile"><img src="${img(game.state.selected)}" alt="${name(game.state.selected)}"><div><strong>${name(game.state.selected)}</strong><span>${tr("Сила", "Power")} ${game.selected.level} <i>·</i> ${tr("Игрок", "Player")}</span></div></div><div class="wallet"><div class="wallet-item gold">${icon("coin")}<b data-stat="coins">${fmt(game.state.coins)}</b><button data-nav="rewards" aria-label="${tr("Получить монеты", "Get coins")}">+</button></div><div class="wallet-item green">${icon("gem")}<b data-stat="gems">${fmt(game.state.gems)}</b></div><div class="wallet-item pink">${icon("power")}<b data-stat="power">${fmt(game.state.power)}</b></div></div><button class="top-settings icon-button" data-action="settings" aria-label="${tr("Настройки", "Settings")}">${icon("gear")}</button></header><main>${route === "home" ? home() : route === "brawlers" ? fighters() : route === "boxes" ? boxes() : route === "arena" ? arena() : route === "road" ? road() : rewards()}</main><footer><span>${tr("Фан-игра · прогресс сохраняется", "Fan game · progress saved")}</span><span>${tr("Собери. Прокачай. Победи.", "Collect. Upgrade. Conquer.")}</span></footer></div>`;
  app.querySelector("main")?.scrollTo(0, scrollTop);
  app.querySelector(".boss-queue")?.scrollTo(queueLeft, 0);
  refresh();
  pause();
}
function heading(eyebrow: string, title: string, extra = "") {
  return `<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1></div>${extra}</div>`;
}
function rushLabel() {
  const mode =
    game.state.rush?.mode ??
    RUSH_MODES[game.state.rushRounds % RUSH_MODES.length];
  return RUSH_LABELS[mode][lang === "ru" ? 0 : 1];
}
function targetPosition(t: RushTarget) {
  const age = (t.maxLife - t.life) / 1000,
    phase = t.id * 1.7;
  return {
    x: [23, 50, 77][t.slot % 3] + Math.sin(age * 1.5 + phase) * 6,
    y: [25, 48, 71][Math.floor(t.slot / 3)] + Math.cos(age * 1.2 + phase) * 5,
  };
}
function rushTarget(t: RushTarget) {
  const src =
    t.kind === "rival"
      ? img(t.brawler)
      : art(
          (
            {
              bot: "art/bot.png",
              gem: "icons/gems.png",
              coin: "icons/coin.png",
              power: "art/cube.png",
              bomb: "art/bomb.png",
            } as const
          )[t.kind],
        );
  const label = {
    bot: tr("Робот", "Robot"),
    gem: tr("Гем: +1", "Gem: +1"),
    coin: tr("Монета: ×3", "Coin: ×3"),
    power: tr("Куб: +3 силы", "Cube: +3 power"),
    rival: tr("Соперник: два удара", "Rival: two hits"),
    bomb: tr(
      "Бомба: не трогай, исчезнет сама",
      "Bomb: do not tap, it will disappear",
    ),
  }[t.kind];
  const pos = targetPosition(t);
  return `<button class="rush-target ${t.kind}" data-rush="${t.id}" data-slot="${t.slot}" style="left:${pos.x}%;top:${pos.y}%;--fuse:${(t.expiresIn ?? BOMB_LIFETIME) / BOMB_LIFETIME}" aria-label="${label}"><img src="${src}" alt="" draggable="false">${t.kind === "rival" ? `<span class="target-hp" data-hp>${"●".repeat(t.hp)}${"○".repeat(t.maxHp - t.hp)}</span>` : t.kind === "bomb" ? `<b class="bomb-countdown" data-bomb-time>${Math.ceil((t.expiresIn ?? BOMB_LIFETIME) / 1000)}${tr("с", "s")}</b><span class="bomb-fuse" aria-hidden="true"></span>` : t.kind !== "bot" ? `<b>${t.kind === "coin" ? "×3" : t.kind === "power" ? "+3" : "+1"}</b>` : ""}</button>`;
}
function rushTargets() {
  return game.state.rush?.targets.map(rushTarget).join("") ?? "";
}
function combatControls(arena = false) {
  const active = game.state.battle ?? game.state.rush,
    ability = abilityFor(game.state.selected),
    charge = arena
      ? (game.state.battle?.charge ?? 0)
      : (game.state.rush?.charge ?? 0);
  const descriptions = arena
    ? {
        blast: tr("Мощный залп по боссу", "Burst damage to the boss"),
        summon: tr(
          "Помощник атакует 6 секунд",
          "A helper attacks for 6 seconds",
        ),
        heal: tr("Восстанавливает здоровье команды", "Restores team health"),
        shield: tr("Блокирует удары босса", "Blocks boss attacks"),
        freeze: tr("Останавливает атаки босса", "Stops boss attacks"),
        haste: tr("Временно удваивает урон", "Temporarily doubles damage"),
      }
    : {
        blast: tr(
          "Собирает все цели на поле",
          "Collects every target on the field",
        ),
        summon: tr(
          "Помощник добывает монеты 6 секунд",
          "A helper earns coins for 6 seconds",
        ),
        heal: tr(
          "+3 секунды рейда и заряд супера",
          "+3 Rush seconds and Super charge",
        ),
        shield: tr("Бомбы безопасны, монеты ×2", "Safe bombs, ×2 coins"),
        freeze: tr("Останавливает движение целей", "Stops targets moving"),
        haste: tr("Временно удваивает добычу", "Temporarily doubles earnings"),
      };
  const b = game.state.battle,
    dodgeReady =
      !!b &&
      b.attackIn <= 1100 &&
      b.skill.kind !== "freeze" &&
      b.skill.kind !== "shield" &&
      b.dodgeCooldown <= 0;
  return `<div class="combat-controls ${arena ? "arena-controls" : ""}"><button class="skill-button" data-action="ability" ${!active || active.skill.cooldown > 0 ? "disabled" : ""} title="${descriptions[ability.kind]}"><img src="${img(game.state.selected)}" alt=""><span><em class="skill-type">${tr("СКИЛЛ БОЙЦА", "BRAWLER SKILL")}</em><strong>${lang === "ru" ? ability.ru : ability.en}</strong><small>${descriptions[ability.kind]}</small></span><b data-skill-cooldown>${active?.skill.cooldown ? `${Math.ceil(active.skill.cooldown / 1000)}${tr("с", "s")}` : tr("НАЖМИ", "TAP")}</b></button><button class="super-button combat-super" data-action="super" ${!active || charge < 100 ? "disabled" : ""}><span class="super-fill" style="width:${charge}%"></span>${icon("super")}<span><strong>${tr("СУПЕР", "SUPER")}</strong><small data-stat="${arena ? "battleCharge" : "charge"}">${charge}%</small></span></button>${arena ? `<button class="dodge-button" data-action="dodge" ${dodgeReady ? "" : "disabled"}>${icon("bolt")}<strong>${tr("УКЛОНЕНИЕ", "DODGE")}</strong><small data-dodge-cooldown>${tr("Жди сигнала", "Wait for signal")}</small></button>` : ""}<span class="skill-effect" data-skill-effect></span></div>`;
}
function home() {
  const r = game.state.rush;
  return `${heading(tr("БЫСТРЕЕ. ЯРЧЕ. СИЛЬНЕЕ.", "FASTER. BRIGHTER. STRONGER."), tr("Бравл-рейд", "Brawl Rush"), `<button class="trophy-pill" data-nav="road">${icon("trophy")}<b data-stat="trophies">${fmt(game.state.trophies)}</b></button>`)}<div class="home-grid"><section class="training rush-panel"><div class="training-top"><div>${icon("arena")}<span>${r ? rushLabel() : tr("ТВОЯ СЛЕДУЮЩАЯ ПОБЕДА", "YOUR NEXT VICTORY")}</span></div><span class="rush-time" data-rush-time>${r ? Math.ceil(r.remaining / 1000) : 25} ${tr("СЕК", "SEC")}</span></div><div class="rush-scene ${r ? "playing" : "ready"}" data-rush-scene><div class="rush-backdrop"></div><div class="rush-colorwash"></div><div class="arena-rays"></div>${r ? `<div class="rush-targets">${rushTargets()}</div><div class="rush-combo"><strong data-rush-combo>${r.combo}</strong><span>COMBO</span><b data-rush-multiplier>×${game.comboMultiplier.toFixed(1)}</b></div><div class="rush-callout" data-rush-callout>${rushLabel()}</div><img class="rush-corner-hero" src="${img(game.state.selected)}" alt="${name(game.state.selected)}">` : `${game.state.selected === BRAWLERS[0].id ? `<img class="rush-ready-hero" src="${art("art/shelly.png")}" alt="${name(game.state.selected)}">` : `<img class="rush-ready-portrait" src="${img(game.state.selected)}" alt="${name(game.state.selected)}">`}<div class="rush-intro"><span class="ready-badge">${icon("bolt")}${tr("НОВЫЙ РЕЙД", "NEW RUSH")}</span><h2>${tr("ГОТОВ<br>К РАЗНОСУ?", "READY<br>TO RUSH?")}</h2><p>${tr("Собирай лут. Побеждай бойцов.<br>Бомбы не трогай!", "Grab loot. Defeat rivals.<br>Watch out for bombs!")}</p><button class="primary rush-start" data-action="rush-start">${icon("arena")}${tr("ПОГНАЛИ!", "LET’S GO!")}</button><small>${`${rushLabel()} · ${tr("25 секунд", "25 seconds")}`}</small></div><img class="rush-ready-bot" src="${art("art/bot.png")}" alt="">`}</div><div class="training-bottom"><div class="gain"><span>${r ? tr("Попадания", "Hits") : tr("Твой рекорд", "Your best")}</span><b>${icon("star")}<span data-stat="rushHits">${r ? r.hits : game.state.rushBest}</span></b></div><div class="gain"><span>${r ? tr("Очки", "Score") : tr("Сила клика", "Tap power")}</span><b>${icon(r ? "trophy" : "coin")}<span data-stat="rushScore">${r ? r.score : game.tapPower}</span></b></div></div><div class="combo-track"><span data-combo-fill style="width:${r?.charge || 0}%"></span></div>${combatControls()}</section><aside class="upgrade-panel"><div class="panel-title"><h2>${tr("ТВОЯ ПРОКАЧКА", "POWER LAB")}</h2><span>${tr("СИЛА РЕЙДА", "RUSH POWER")}</span></div>${upgradeCards()}<div class="boost-card"><span class="boost-icon">${icon("boost")}</span><div><strong>${tr("Удвоитель добычи", "Double earnings")}</strong><p>${tr("×2 монет за попадания · 2 минуты", "×2 hit coins · 2 minutes")}</p></div>${adButton("boost", "×2", "", (game.state.adAt.boost || 0) > platform.time() || !!r)}</div></aside></div><section class="below-home"><button class="mini-feature next-drop" data-nav="boxes"><img src="${art("art/box.png")}" alt=""><div><span>${tr("НОВЫЙ БОЕЦ УЖЕ ЖДЁТ", "YOUR NEXT BRAWLER AWAITS")}</span><h3>${tr("Боксы и редкий дроп", "Boxes & rare drops")}</h3><p>${tr("Забирай лут и усиливай команду", "Grab loot and power up your team")}</p></div>${icon("arrow")}</button><button class="mini-feature boss-invite" data-nav="arena"><div class="boss-symbol">${icon("super")}</div><div><span>${tr("СЛЕДУЮЩИЙ ВЫЗОВ", "YOUR NEXT CHALLENGE")}</span><h3>${tr("Лига 12 боссов", "12 Boss League")}</h3><p>${tr("Собери команду и победи", "Build your team and win")}</p></div>${icon("arrow")}</button></section>`;
}
function upgradeCards() {
  const info: [Upgrade, string, string, string, string][] = [
    [
      "tap",
      "tap",
      tr("Сила клика", "Tap power"),
      tr("+2 монеты за каждый клик", "+2 coins per tap"),
      "cyan",
    ],
    [
      "auto",
      "auto",
      tr("Тренировка команды", "Team training"),
      tr("+1,5 монеты в секунду", "+1.5 coins per second"),
      "purple",
    ],
    [
      "crit",
      "crit",
      tr("Критический удар", "Critical hit"),
      tr("+1,5% шанса на ×3", "+1.5% chance for ×3"),
      "pink",
    ],
    [
      "super",
      "super",
      tr("Мощность супера", "Super power"),
      tr("Сильнее супер-удар", "Stronger Super hit"),
      "orange",
    ],
  ];
  return info
    .map(
      ([id, i, title, desc, color]) =>
        `<button class="upgrade-card ${color}" data-upgrade="${id}" ${game.state.upgrades[id] >= (id === "crit" ? 15 : 40) ? "disabled" : ""}><span class="upgrade-icon">${icon(i)}</span><span class="upgrade-copy"><strong>${title}</strong><small>${desc}</small><em>${tr("УРОВЕНЬ", "LEVEL")} ${game.state.upgrades[id]}</em></span><span class="upgrade-price">${money(game.upgradeCost(id))}<small>+ ${tr("УЛУЧШИТЬ", "UPGRADE")}</small></span></button>`,
    )
    .join("");
}
function fighters() {
  const shown = BRAWLERS.filter(
    (b) =>
      filter === "all" ||
      (filter === "owned" && game.state.fighters.some((f) => f.id === b.id)) ||
      String(b.rarity) === filter,
  );
  return `${heading(tr("ТВОЯ КОЛЛЕКЦИЯ", "YOUR COLLECTION"), tr("Бойцы", "Brawlers"), `<span class="count-badge">${game.state.fighters.length} / ${BRAWLERS.length}</span>`)}<section class="team-strip"><div><span class="eyebrow">${tr("БОЕВАЯ КОМАНДА", "BATTLE TEAM")}</span><p>${tr("До трёх бойцов усиливают урон и доход", "Up to three brawlers boost damage and income")}</p></div><div class="team-slots">${[0, 1, 2].map((i) => (game.state.team[i] ? `<button data-fighter="${game.state.team[i]}"><img src="${img(game.state.team[i])}" alt="${name(game.state.team[i])}"><span>${game.state.fighters.find((f) => f.id === game.state.team[i])!.level}</span></button>` : `<button class="empty-slot" data-action="team-picker" aria-label="${tr("Добавить бойца в команду", "Add a brawler to your team")}">+</button>`)).join("")}</div><b>${icon("arena")} ${game.battleDamage} ${tr("урона", "damage")}</b></section><div class="filters">${[
    ["all", tr("Все", "All")],
    ["owned", tr("Открытые", "Owned")],
    ["0", tr("Редкие", "Rare")],
    ["2", tr("Эпические", "Epic")],
    ["4", tr("Легендарные", "Legendary")],
  ]
    .map(
      ([id, label]) =>
        `<button data-filter="${id}" class="${filter === id ? "selected" : ""}">${label}</button>`,
    )
    .join("")}</div><div class="fighter-grid">${shown
    .map((b) => {
      const f = game.state.fighters.find((f) => f.id === b.id);
      return `<button class="fighter-card ${f ? "owned" : "locked"} ${game.state.selected === b.id ? "chosen" : ""}" style="--rarity:${COLORS[b.rarity]}" data-fighter="${b.id}"><div class="fighter-art"><span class="rarity-mark">${icon(f ? "star" : "lock")}</span><img src="${img(b.id)}" alt="${name(b.id)}" loading="lazy" draggable="false">${f ? `<span class="fighter-level">${tr("СИЛА", "POWER")} ${f.level}</span>` : ""}</div><h3>${name(b.id)}</h3><p>${f ? (game.state.team.includes(b.id) ? tr("В команде", "In team") : tr("Доступен", "Unlocked")) : `${b.unlock} ${tr("трофеев", "trophies")}`}</p></button>`;
    })
    .join("")}</div>`;
}
function teamPicker() {
  const available = game.state.fighters.filter(
    (f) => !game.state.team.includes(f.id),
  );
  show(
    `${buttonClose()}<span class="eyebrow">${tr("БОЕВАЯ КОМАНДА", "BATTLE TEAM")}</span><h2>${tr("Добавить бойца", "Add a brawler")}</h2><p class="modal-description">${tr("Выбери открытого бойца для свободного места в команде.", "Choose an unlocked brawler for your empty team slot.")}</p>${
      available.length
        ? `<div class="team-picker">${available
            .map((f) => {
              const b = brawler(f.id);
              return `<button class="team-choice" data-add-team="${f.id}" style="--rarity:${COLORS[b.rarity]}"><img src="${img(f.id)}" alt=""><span><strong>${name(f.id)}</strong><small>${tr("Сила", "Power")} ${f.level} · ${lang === "ru" ? b.role : b.roleEn}</small><em>${lang === "ru" ? b.trait : b.traitEn}</em></span><b>+</b></button>`;
            })
            .join("")}</div>`
        : `<div class="team-picker-empty">${icon("fighters")}<h3>${tr("Все открытые бойцы уже в команде", "All unlocked brawlers are in your team")}</h3><p>${tr("Открывай боксы, чтобы пополнить коллекцию и усилить команду.", "Open boxes to grow your collection and strengthen your team.")}</p><button class="primary full" data-go="boxes">${tr("К боксам", "Go to boxes")}</button></div>`
    }`,
  );
}
function fighterModal(id: number) {
  const b = brawler(id),
    f = game.state.fighters.find((f) => f.id === id);
  show(
    `${buttonClose()}<div class="fighter-detail" style="--rarity:${COLORS[b.rarity]}"><span class="eyebrow">${lang === "ru" ? b.role : b.roleEn}</span><img src="${img(id)}" alt="${name(id)}"><h2>${name(id)}</h2><p>${f ? `${tr("Сила", "Power")} ${f.level} / 11` : tr("Открывается из боксов", "Unlocked from boxes")}</p><p class="fighter-skill"><strong>${lang === "ru" ? abilityFor(id).ru : abilityFor(id).en}</strong><br>${skillHint(abilityFor(id).kind, lang === "ru")}</p><p class="fighter-trait">${lang === "ru" ? b.trait : b.traitEn} · ${tr("Бонус работает в команде", "Bonus works while in your team")}</p>${f ? `<p>${tr("Карточки дубликатов", "Duplicate cards")}: ${f.cards} · ${tr("снижают цену очков силы", "reduce the power-point cost")}</p>` : ""}</div>${f ? `<div class="modal-actions"><button class="primary" data-select="${id}">${game.state.selected === id ? tr("Выбран", "Selected") : tr("Выбрать бойца", "Select brawler")}</button><button class="secondary" data-team="${id}">${game.state.team.includes(id) ? tr("Убрать из команды", "Remove from team") : tr("В команду", "Add to team")}</button><button class="upgrade-full" data-level="${id}" ${f.level >= 11 ? "disabled" : ""}>${icon("power")}${tr("Улучшить", "Upgrade")} · ${money(game.levelCost(id).coins)} + ${game.levelCost(id).power} ${icon("power")}</button></div>` : `<p class="modal-description">${tr("Собирай трофеи и открывай боксы. Если боец уже есть, дубликат приносит очки силы.", "Earn trophies and open boxes. Duplicate brawlers turn into power points.")}</p><div class="modal-actions"><button class="primary full" data-go="boxes">${tr("К боксам", "Go to boxes")}</button><button class="secondary" data-recruit="${id}" ${b.unlock > game.state.trophies ? "disabled" : ""}>${tr("Открыть за", "Unlock for")} ${game.recruitCost(id)} ${icon("gem")}</button></div>`}`,
  );
}
function boxImage(index: number) {
  return art(`art/${BOXES[index]?.art ?? "box"}.png`);
}
function boxes() {
  const tags = [
    tr("БЫСТРЫЙ СТАРТ", "QUICK START"),
    tr("БОЛЬШЕ РЕСУРСОВ", "MORE RESOURCES"),
    tr("РЕДКИЕ БОЙЦЫ", "RARE BRAWLERS"),
    tr("ЭПИК И ВЫШЕ", "EPIC AND ABOVE"),
    tr("ЗА ГЕМЫ", "GEMS ONLY"),
    tr("ТОЛЬКО ЗА ВИДЕО", "VIDEO ONLY"),
    tr("РАЗ В СУТКИ", "ONCE A DAY"),
  ];
  return `${heading(tr("ЛУТ И НОВЫЕ БОЙЦЫ", "LOOT & NEW BRAWLERS"), tr("Открывай. Собирай.", "Open. Collect."), `<span class="count-badge">${icon("box")} ${game.state.boxes}</span>`)}<div class="pity-banner"><span>${icon("star")}<b>${tr("Гарантия коллекции", "Collection guarantee")}</b></span><p>${tr("Новый доступный боец не позднее 8-го бокса. В боксе бойца — сразу, пока есть неоткрытые.", "An eligible new brawler by the 8th box. The Brawler Box guarantees one while any remain.")}</p><div class="pity-pips">${Array.from({ length: 8 }, (_, i) => `<i class="${i < game.state.pity ? "lit" : ""}"></i>`).join("")}</div></div><div class="box-grid">${BOXES.map(
    (box, i) => {
      if (box.currency === "daily") return "";
      const locked = game.state.trophies < box.unlock,
        due = game.state.adAt[i === 0 ? "box" : `box${i}`] || 0;
      const chance =
        box.chance === 1
          ? tr("Гарантированный новый боец*", "Guaranteed new brawler*")
          : `${Math.round(box.chance * 100)}% ${tr("нового бойца*", "new brawler*")}`;
      const button =
        box.currency === "ad"
          ? adButton(
              `box-${i}`,
              due > platform.time()
                ? wait(due)
                : tr("Забрать дроп", "Claim drop"),
              "",
              due > platform.time(),
            )
          : `<button class="primary full" data-open="${i}" ${locked ? "disabled" : ""}>${tr("Открыть", "Open")} ${box.currency === "coins" ? money(box.cost) : `${icon("gem")} ${box.cost}`}</button>`;
      return `<article class="box-card box-${i}" style="--box-color:${box.color}"><span class="eyebrow">${tags[i]}</span><h2>${lang === "ru" ? box.name : box.en}</h2><div class="box-art"><img src="${boxImage(i)}" alt="${lang === "ru" ? box.name : box.en}" draggable="false">${i === 1 || i === 2 ? `<span>×${i + 1}</span>` : ""}</div><p>${box.power}+ ${tr("очков силы", "power points")} · ${chance}<small class="box-pool">${[tr("Стартовые и редкие бойцы", "Starter and rare brawlers"), tr("Бойцы до эпической редкости", "Brawlers up to epic"), tr("От редких до легендарных", "Rare through legendary"), tr("Эпические и выше", "Epic and above"), tr("Из открытых по трофеям", "From trophy-unlocked tiers"), tr("Бойцы до мифической редкости", "Brawlers up to mythic")][i]}</small></p>${locked ? `<span class="box-unlock">${icon("trophy")}${box.unlock} ${tr("трофеев для открытия", "trophies to unlock")}</span>` : ""}<div class="box-actions">${button}${box.currency === "coins" ? adButton(`box-${i}`, due > platform.time() ? wait(due) : tr("Открыть бесплатно", "Open for free"), "", locked || due > platform.time()) : `<small class="box-special">${box.currency === "gems" ? tr("Только гемы · новый доступный боец*", "Gems only · eligible new brawler*") : box.currency === "ad" ? tr("Без монет и гемов · раз в 10 минут", "No coins or gems · every 10 minutes") : tr("Бокс + монеты + 3 гема · за видео", "Box + coins + 3 gems · via video")}</small>`}</div></article>`;
    },
  ).join(
    "",
  )}</div><p class="fineprint">* ${tr("Среди доступных по трофеям неоткрытых бойцов. Если все собраны — карточки и дополнительная сила. Эпик-бокс содержит новых бойцов эпической редкости и выше. Первый бокс гарантирует доступного нового бойца. Ресурсы действуют только в этой игре.", "Among eligible unowned brawlers. If all are owned, duplicates grant cards and extra power. Epic Box new brawlers are epic or higher. Your first box guarantees an eligible new brawler. Resources are only for this game.")}</p>`;
}
function arena() {
  const b = game.state.battle,
    stage = b?.boss ?? game.state.wins,
    boss = bossAt(stage);
  const chapter = Math.floor(stage / BOSSES.length) + 1,
    current = stage % BOSSES.length;
  const duration = boss.mechanic === "haste" ? 35 : 45;
  return `${heading(tr("ПРОЙДИ ВСЮ ЛИГУ", "CONQUER THE LEAGUE"), tr("Лига боссов", "Boss League"), `<span class="count-badge">${icon("trophy")}${tr("Глава", "Chapter")} ${chapter} · ${current + 1}/${BOSSES.length}</span>`)}
  <section class="boss-arena ${b ? "fighting" : ""} boss-${boss.mechanic}" style="--boss-color:${boss.color}">
    <div class="boss-arena-top"><div><span>${tr("БОСС", "BOSS")} ${stage + 1}</span><h2>${lang === "ru" ? boss.ru : boss.en}</h2></div><b data-battle-time>${b ? Math.ceil(b.remaining / 1000) : duration}${tr("с", "s")}</b></div>
    <div class="boss-hp"><span data-boss-fill style="width:${b ? (b.hp / b.maxHp) * 100 : 100}%"></span><strong data-boss-hp>${b ? `${fmt(b.hp)} / ${fmt(b.maxHp)}` : `${fmt(bossHealth(stage))} HP`}</strong></div>
    <p class="boss-mechanic">${icon(boss.mechanic === "armor" ? "super" : boss.mechanic === "regen" ? "power" : "bolt")}${lang === "ru" ? boss.hint : boss.hintEn}</p>
    <button class="robot-target boss-target" data-action="attack" ${b ? "" : "disabled"} aria-label="${tr("Атаковать босса", "Attack boss")}"><span class="boss-attack-alert" aria-hidden="true">${tr("АТАКА!", "ATTACK!")}</span><div class="boss-aura"></div><img class="boss-sprite" src="${art(`art/bosses/${boss.sprite}.png`)}" alt="${name(boss.brawler)}"><span>${b ? tr("ТАПАЙ И ЗАРЯЖАЙ СУПЕР", "TAP AND CHARGE SUPER") : tr("СОБЕРИ КОМАНДУ И ПРИМИ ВЫЗОВ", "BUILD YOUR TEAM AND TAKE THE CHALLENGE")}</span></button>
    <div class="player-status"><span>${tr("КОМАНДА", "TEAM")} <b data-player-hp>${b ? fmt(b.playerHp) : 100}/100</b></span><progress data-player-bar max="100" value="${b?.playerHp ?? 100}"></progress><div class="attack-cue" data-attack-cue><strong data-attack-warning>${tr("АТАКА ЧЕРЕЗ", "ATTACK IN")}</strong><b data-attack-count>5${tr("с", "s")}</b><small data-attack-help>${tr("По сигналу нажми «Уклонение»", "Tap Dodge when the signal appears")}</small></div></div><div class="battle-bottom"><div class="team-slots">${game.state.team.map((id) => `<img src="${img(id)}" alt="${name(id)}">`).join("")}</div><div><span>${tr("Базовый урон", "Base damage")}</span><strong>${game.battleDamage}</strong></div>${b ? "" : `<button class="primary" data-action="battle">${icon("arena")}${tr("В БОЙ!", "BATTLE!")}</button>`}</div>
  ${combatControls(true)}</section><div class="chapter-prize">${icon("star")}<div><strong>${tr("Финал главы", "Chapter finale")}: +1 ${tr("звезда силы", "power star")} (+5%)</strong><span>+${10 + chapter * 2} ${tr("гемов", "gems")} · +30 ${tr("очков силы", "power points")} · ${tr("следующая глава сложнее", "next chapter is harder")}</span></div></div><div class="boss-queue" aria-label="${tr("Очередь боссов", "Boss order")}">${BOSSES.map((entry, i) => `<div class="boss-stage ${i < current ? "defeated" : i === current ? "current" : "locked"}" ${i === current ? 'aria-current="step"' : ""}><span>${i < current ? "✓" : i + 1}</span><img src="${img(entry.brawler)}" alt="${name(entry.brawler)}"><b>${name(entry.brawler)}</b></div>`).join("")}</div>
  <div class="arena-info"><p>${tr("Победа открывает следующего босса. Поражение — повторный бой с тем же соперником. После финала начинается более сложная глава.", "Win to unlock the next boss. A loss means a rematch. After the finale, a harder chapter begins.")}</p><span>${tr("Вход бесплатный · прогресс сохраняется", "Free entry · progress is saved")}</span></div>`;
}
function road() {
  return `${heading(tr("ПУТЬ К ЛЕГЕНДЕ", "PATH TO LEGEND"), tr("Трофейная дорога", "Trophy Road"), `<span class="trophy-pill">${icon("trophy")} ${fmt(game.state.trophies)}</span>`)}<div class="road-grid">${[10, 30, 75, 150, 300, 500, 800, 1200].map((threshold, i) => `<article class="road-stop ${game.state.trophies >= threshold ? "ready" : ""}"><span class="road-number">${icon("trophy")}${threshold}</span><div class="road-gift">${icon(i % 2 ? "gem" : "gift")}</div><h3>${tr("Награда", "Reward")} ${i + 1}</h3><p>${money(150 + i * 150)} · ${3 + i}${icon("gem")} · ${15 + i * 5}${icon("power")}</p><button class="${game.state.road.includes(i) ? "secondary" : "primary"}" data-road="${i}" ${game.state.road.includes(i) || game.state.trophies < threshold ? "disabled" : ""}>${game.state.road.includes(i) ? tr("Получено", "Claimed") : tr("Забрать", "Claim")}</button></article>`).join("")}</div><section class="prestige-card"><div class="prestige-star">${icon("star")}</div><div><span class="eyebrow">${tr("ПРЕСТИЖ", "PRESTIGE")} ${game.state.prestige}</span><h2>${tr("Начни сильнее. Стань легендой.", "Start stronger. Become a legend.")}</h2><p>${tr("Сброс монет и четырёх улучшений. Бойцы, трофеи, сила, гемы и награды остаются. Каждая звезда даёт +5% к добыче и урону.", "Reset coins and four upgrades. Keep brawlers, trophies, power, gems and rewards. Each star adds +5% earnings and damage.")}</p><b>${game.state.stars} ${tr("звёзд", "stars")} · +${game.state.stars * 5}%</b></div><button class="primary" data-action="prestige" ${game.state.trophies < 300 * (game.state.prestige + 1) ? "disabled" : ""}>${icon("star")}${tr("Престиж", "Prestige")}<small>${300 * (game.state.prestige + 1)} ${tr("трофеев", "trophies")}</small></button></section>`;
}
function rewards() {
  const now = platform.time();
  return `${heading(tr("ПОДАРКИ И ЗАДАНИЯ", "GIFTS & MISSIONS"), tr("Бонус к каждому заходу", "Make every visit count"))}<div class="reward-grid"><article class="daily-card"><span class="eyebrow">${tr("ЕЖЕДНЕВНО", "DAILY")}</span><h2>${tr("Твой ежедневный дроп", "Your daily drop")}</h2><div class="daily-box-preview"><img src="${boxImage(6)}" alt="${tr("Бокс дня", "Daily Box")}"><div><strong>${tr("БОКС ДНЯ", "DAILY BOX")}</strong><p>${tr("140+ силы и шанс нового бойца", "140+ power and a chance of a new brawler")}</p><p>${money(200 + Math.floor(game.state.trophies / 10) * 10)} + 3 ${icon("gem")}</p></div></div><div class="claim-actions">${adButton("daily", game.state.dailyAt > now ? wait(game.state.dailyAt) : tr("Забрать дроп", "Claim drop"), "", game.state.dailyAt > now)}</div></article><article class="wheel-card"><span class="eyebrow">${tr("КАЖДЫЕ 30 МИНУТ", "EVERY 30 MINUTES")}</span><h2>${tr("Колесо удачи", "Lucky wheel")}</h2><div class="wheel-decoration">${icon("star")}</div><p>${tr("Монеты, гемы или очки силы", "Coins, gems or power points")}</p>${adButton("wheel", game.state.wheelAt > now ? wait(game.state.wheelAt) : tr("Крутить колесо", "Spin wheel"), "", game.state.wheelAt > now)}</article></div>${game.state.offlineCoins > 0 ? `<section class="offline-card"><div>${icon("clock")}<h3>${tr("Команда поработала без тебя", "Your team kept working")}</h3><p>${money(game.state.offlineCoins)} · ${tr("до 2 часов, 50% дохода", "up to 2 hours, 50% income")}</p></div><button class="primary" data-action="offline">${tr("Забрать", "Claim")}</button>${adButton("offline", tr("×2 дохода", "×2 earnings"))}</section>` : ""}<div class="section-heading"><h2>${tr("Рекламные бонусы", "Ad bonuses")}</h2><span>${tr("Дополнительные награды по желанию", "Optional extra rewards")}</span></div><div class="ad-grid">${[
    [
      "coins",
      "coin",
      tr("Кошелёк монет", "Coin stash"),
      `+${fmt(Math.max(200, game.tapPower * 40))}`,
    ],
    ["power", "power", tr("Очки силы", "Power points"), "+35"],
    ["gems", "gem", tr("Горсть гемов", "A handful of gems"), "+5"],
    [
      "boost",
      "bolt",
      tr("Удвоитель клика", "Double tap earnings"),
      "×2 · 2:00",
    ],
  ]
    .map(
      ([type, i, title, amount]) =>
        `<article class="ad-bonus-card">${icon(i)}<h3>${title}</h3><strong>${amount}</strong>${adButton(type, (game.state.adAt[type] || 0) > now ? wait(game.state.adAt[type]) : tr("Получить", "Get bonus"), "", (game.state.adAt[type] || 0) > now)}</article>`,
    )
    .join(
      "",
    )}</div>${!platform.canReward ? `<p class="sdk-note">${tr("Видео и рекламные бонусы доступны при запуске на Яндекс Играх. Здесь можно играть и получать обычные награды.", "Videos and ad bonuses are available on Yandex Games. You can still play and collect normal rewards here.")}</p>` : ""}<div class="section-heading"><h2>${tr("Твои задания", "Your missions")}</h2><span>${game.tasks().filter((t) => t.claimed).length} / ${game.tasks().length}</span></div><div class="quest-list">${game
    .tasks()
    .map(
      (q) =>
        `<article class="quest" data-quest-row="${q.id}"><span class="quest-icon">${icon(q.claimed ? "check" : "star")}</span><div><h3>${lang === "ru" ? q.ru : q.en}</h3><progress max="${q.goal}" value="${q.value}"></progress><small>${Math.min(q.value, q.goal)} / ${q.goal}</small></div><div class="quest-claim">${money(q.coins)}<button class="secondary" data-quest="${q.id}" ${q.claimed || q.value < q.goal ? "disabled" : ""}>${q.claimed ? tr("Получено", "Claimed") : tr("Забрать", "Claim")}</button>${!q.claimed && q.value >= q.goal ? adButton("quest", "×2", `data-id="${q.id}"`) : ""}</div></article>`,
    )
    .join("")}</div>`;
}
function refreshRush() {
  const r = game.state.rush,
    scene = app.querySelector<HTMLElement>("[data-rush-scene]");
  if (!r || !scene) return;
  const container = scene.querySelector<HTMLElement>(".rush-targets");
  if (container) {
    // Preserve each target node. A hit never restarts other targets' motion.
    for (const el of container.querySelectorAll<HTMLElement>("[data-rush]"))
      if (!r.targets.some((t) => t.id === Number(el.dataset.rush))) el.remove();
    for (const t of r.targets) {
      let el = container.querySelector<HTMLElement>(`[data-rush="${t.id}"]`);
      if (!el) {
        container.insertAdjacentHTML("beforeend", rushTarget(t));
        el = container.querySelector<HTMLElement>(`[data-rush="${t.id}"]`)!;
      }
      const pos = targetPosition(t);
      el.style.left = `${pos.x}%`;
      el.style.top = `${pos.y}%`;
      const countdown = el.querySelector("[data-bomb-time]");
      if (countdown) {
        countdown.textContent = `${Math.ceil((t.expiresIn ?? BOMB_LIFETIME) / 1000)}${tr("с", "s")}`;
        el.style.setProperty(
          "--fuse",
          String((t.expiresIn ?? BOMB_LIFETIME) / BOMB_LIFETIME),
        );
      }
      const hp = el.querySelector("[data-hp]");
      if (hp) hp.textContent = "●".repeat(t.hp) + "○".repeat(t.maxHp - t.hp);
    }
  }
  scene.dataset.phase = String(Math.floor(r.combo / 5) % 5);
  scene.classList.toggle("fever", r.combo >= 10);
  const set = (q: string, v: string) => {
    const e = app.querySelector(q);
    if (e) e.textContent = v;
  };
  set(
    "[data-rush-time]",
    `${Math.ceil(r.remaining / 1000)} ${tr("СЕК", "SEC")}`,
  );
  set("[data-rush-combo]", String(r.combo));
  set("[data-rush-multiplier]", `×${game.comboMultiplier.toFixed(1)}`);
  set(
    "[data-rush-callout]",
    r.combo >= 20
      ? tr("ТЫ ЛЕГЕНДА!", "LEGENDARY!")
      : r.combo >= 10
        ? tr("КОМБО-ЛИХОРАДКА!", "COMBO FEVER!")
        : r.combo >= 5
          ? tr("НЕ ОСТАНАВЛИВАЙСЯ!", "KEEP IT GOING!")
          : rushLabel(),
  );
}
function refresh() {
  refreshRush();
  const active = game.state.battle ?? game.state.rush;
  app.querySelector("main")?.classList.toggle("in-combat", !!active);
  app
    .querySelector<HTMLElement>(".rush-scene")
    ?.setAttribute("data-effect", active?.skill.kind ?? "");
  const skillButton = app.querySelector<HTMLButtonElement>(
    '[data-action="ability"]',
  );
  if (skillButton) {
    skillButton.disabled = !active || active.skill.cooldown > 0 || busy;
    const value = skillButton.querySelector("[data-skill-cooldown]");
    if (value)
      value.textContent = active?.skill.cooldown
        ? `${Math.ceil(active.skill.cooldown / 1000)}${tr("с", "s")}`
        : tr("НАЖМИ", "TAP");
  }
  const effect = app.querySelector("[data-skill-effect]");
  if (effect)
    effect.textContent =
      active?.skill.kind && active.skill.remaining > 0
        ? `${tr("СПОСОБНОСТЬ АКТИВНА", "ABILITY ACTIVE")} · ${Math.ceil(active.skill.remaining / 1000)}${tr("с", "s")}`
        : "";
  const battle = game.state.battle,
    warning =
      !!battle &&
      battle.attackIn <= 1100 &&
      battle.skill.kind !== "freeze" &&
      battle.skill.kind !== "shield";
  const dodge = app.querySelector<HTMLButtonElement>('[data-action="dodge"]');
  if (dodge) {
    dodge.disabled = !warning || !battle || battle.dodgeCooldown > 0 || busy;
    dodge.classList.toggle(
      "dodge-now",
      warning && !!battle && battle.dodgeCooldown <= 0,
    );
    const value = dodge.querySelector("[data-dodge-cooldown]");
    if (value)
      value.textContent = battle?.dodgeCooldown
        ? `${Math.ceil(battle.dodgeCooldown / 1000)}${tr("с", "s")}`
        : warning
          ? tr("ЖМИ СЕЙЧАС!", "TAP NOW!")
          : tr("Жди сигнала", "Wait for signal");
  }
  const arena = app.querySelector(".boss-arena");
  if (arena) {
    arena.classList.toggle("warning", warning);
    arena.classList.toggle("dodging", !!battle?.dodgeWindow);
    arena.classList.toggle("shielded", battle?.skill.kind === "shield");
    arena.classList.toggle("frozen", battle?.skill.kind === "freeze");
  }
  if (battle) {
    const hp = app.querySelector("[data-player-hp]"),
      bar = app.querySelector<HTMLProgressElement>("[data-player-bar]"),
      cue = app.querySelector<HTMLElement>("[data-attack-cue]"),
      label = app.querySelector("[data-attack-warning]"),
      count = app.querySelector("[data-attack-count]"),
      help = app.querySelector("[data-attack-help]");
    if (hp) hp.textContent = `${Math.ceil(battle.playerHp)}/100`;
    if (bar) bar.value = battle.playerHp;
    const feedback = (battle.attackFeedback ?? 0) > 0;
    if (warning && !feedback && cue?.dataset.state !== "warning") audio.tick();
    if (cue)
      cue.dataset.state = feedback
        ? battle.lastAttack
        : battle.skill.kind === "freeze"
          ? "frozen"
          : battle.dodgeWindow
            ? "dodging"
            : warning
              ? "warning"
              : "waiting";
    if (label)
      label.textContent = feedback
        ? battle.lastAttack === "dodged"
          ? tr("УДАР МИМО!", "DODGED!")
          : battle.lastAttack === "blocked"
            ? tr("ЩИТ ЗАЩИТИЛ!", "SHIELD BLOCKED!")
            : tr("ПРОПУЩЕН УДАР!", "YOU GOT HIT!")
        : battle.skill.kind === "freeze"
          ? tr("БОСС ЗАМОРОЖЕН", "BOSS FROZEN")
          : battle.dodgeWindow
            ? tr("УКЛОНЕНИЕ!", "DODGING!")
            : warning
              ? tr("ЖМИ УКЛОНЕНИЕ!", "DODGE NOW!")
              : tr("АТАКА ЧЕРЕЗ", "ATTACK IN");
    if (count)
      count.textContent =
        feedback || battle.skill.kind === "freeze" || battle.dodgeWindow
          ? ""
          : `${warning ? (Math.max(0, battle.attackIn) / 1000).toFixed(1).replace(".", lang === "ru" ? "," : ".") : Math.ceil(battle.attackIn / 1000)}${tr("с", "s")}`;
    if (help)
      help.textContent =
        feedback && battle.lastAttack === "hit"
          ? tr(
              "Жди красного сигнала и нажимай кнопку",
              "Watch for red, then tap Dodge",
            )
          : warning
            ? tr("Кнопка справа подсвечена", "The Dodge button is highlighted")
            : tr(
                "По красному сигналу нажми «Уклонение»",
                "Tap Dodge when the signal turns red",
              );
  }
  if (route === "rewards")
    for (const q of game.tasks()) {
      const row = app.querySelector(`[data-quest-row="${q.id}"]`);
      if (!row) continue;
      const progress = row.querySelector("progress"),
        count = row.querySelector("small"),
        claim = row.querySelector<HTMLButtonElement>("[data-quest]");
      if (progress) progress.value = Math.min(q.goal, q.value);
      if (count) count.textContent = `${Math.min(q.value, q.goal)} / ${q.goal}`;
      if (claim) claim.disabled = q.claimed || q.value < q.goal;
      if (!q.claimed && q.value >= q.goal && !row.querySelector("[data-ad]"))
        row
          .querySelector(".quest-claim")
          ?.insertAdjacentHTML(
            "beforeend",
            adButton("quest", "×2", `data-id="${q.id}"`),
          );
    }
  const values: Record<string, string> = {
    coins: fmt(game.state.coins),
    gems: fmt(game.state.gems),
    power: fmt(game.state.power),
    trophies: fmt(game.state.trophies),
    tap: fmt(
      game.tapPower *
        (platform.time() < game.state.boostUntil ? 2 : 1) *
        (platform.time() < game.state.superUntil ? 3 : 1),
    ),
    passive: fmt(game.passive),
    combo: `×${game.comboMultiplier.toFixed(1)}`,
    charge: `${game.state.rush?.charge ?? game.state.superCharge}%`,
    rushHits: String(game.state.rush?.hits ?? game.state.rushBest),
    rushScore: String(game.state.rush?.score ?? game.tapPower),
    battleCharge: `${game.state.battle?.charge ?? 0}%`,
  };
  for (const [key, value] of Object.entries(values))
    for (const el of app.querySelectorAll(`[data-stat="${key}"]`))
      el.textContent = value;
  const charge =
    game.state.rush?.charge ??
    game.state.battle?.charge ??
    game.state.superCharge;
  for (const b of app.querySelectorAll<HTMLButtonElement>(
    '[data-action="super"]',
  ))
    b.disabled = charge < 100 || busy;
  const fill = app.querySelector<HTMLElement>(".super-fill");
  if (fill) fill.style.width = `${charge}%`;
  const comboFill = app.querySelector<HTMLElement>("[data-combo-fill]");
  if (comboFill) comboFill.style.width = `${Math.min(100, charge)}%`;
  const b = game.state.battle;
  if (b) {
    const fill = app.querySelector<HTMLElement>("[data-boss-fill]");
    if (fill) fill.style.width = `${(b.hp / b.maxHp) * 100}%`;
    const hp = app.querySelector("[data-boss-hp]");
    if (hp) hp.textContent = `${fmt(b.hp)} / ${fmt(b.maxHp)}`;
    const time = app.querySelector("[data-battle-time]");
    if (time)
      time.textContent = `${Math.ceil(b.remaining / 1000)}${tr("с", "s")}`;
  }
}
function floatGain(amount: string, target: Element, critical = false) {
  const r = target.getBoundingClientRect(),
    el = document.createElement("span");
  el.className = "floating-gain" + (critical ? " critical" : "");
  el.textContent = amount;
  el.style.left = `${r.x + r.width * (0.3 + Math.random() * 0.4)}px`;
  el.style.top = `${r.y + r.height * 0.35}px`;
  document.querySelector("#effects")!.append(el);
  setTimeout(() => el.remove(), 850);
  target.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(.96)" },
      { transform: "scale(1)" },
    ],
    { duration: 140 },
  );
}
function outcome() {
  if (boxReveal()) return;
  const p = game.state.pending;
  if (!p) return;
  const title =
    p.kind === "rush"
      ? p.hits! >= 30
        ? tr("НЕ ОСТАНОВИТЬ!", "UNSTOPPABLE!")
        : p.hits! >= 15
          ? tr("ОТЛИЧНЫЙ РЕЙД!", "GREAT RUSH!")
          : tr("ЕЩЁ ОДИН РЫВОК?", "ONE MORE RUSH?")
      : p.kind === "box"
        ? p.newBrawler
          ? tr("НОВЫЙ БОЕЦ!", "NEW BRAWLER!")
          : tr("БОКС ОТКРЫТ!", "BOX OPENED!")
        : p.kind === "battle"
          ? p.won
            ? tr("ПОБЕДА!", "VICTORY!")
            : tr("ПОПРОБУЕМ ЕЩЁ?", "ONE MORE TRY?")
          : tr("ТВОЙ ПРИЗ!", "YOUR REWARD!");
  show(
    `<div class="result-content" style="--rarity:${COLORS[p.quality]}"><span class="eyebrow">${p.kind === "rush" ? tr("БРАВЛ-РЕЙД", "BRAWL RUSH") : p.kind === "box" ? (p.boxIndex !== undefined ? (lang === "ru" ? BOXES[p.boxIndex].name : BOXES[p.boxIndex].en) : tr("БРАВЛ-БОКС", "BRAWL BOX")) : p.kind === "battle" ? tr("БОЙ С БОССОМ", "BOSS FIGHT") : tr("КОЛЕСО УДАЧИ", "LUCKY WHEEL")}</span><h2>${title}</h2>${p.brawler ? `<div class="result-portrait"><img src="${img(p.brawler)}" alt="${name(p.brawler)}"></div><h3>${name(p.brawler)}</h3><p>${p.newBrawler ? tr("Уже в твоей коллекции", "Already in your collection") : tr("Дубликат превращён в очки силы", "Duplicate converted into power points")}</p>` : `<div class="result-symbol">${icon(p.kind === "battle" ? "trophy" : "gift")}</div>`}${p.chapterClear ? `<div class="chapter-clear">${icon("star")}<strong>${tr("ГЛАВА ПРОЙДЕНА!", "CHAPTER COMPLETE!")} +1 ${tr("звезда", "star")}</strong><p>${tr("Дальше — новая глава и более сильные соперники.", "A new chapter with stronger rivals awaits.")}</p></div>` : ""}${p.kind === "rush" ? `<div class="rush-result-stats"><span><b>${p.hits}</b>${tr("попаданий", "hits")}</span><span><b>${p.score}</b>${tr("очков", "score")}</span></div>` : ""}<div class="result-loot">${p.coins ? `<span>${icon("coin")}+${fmt(p.coins)}</span>` : ""}${p.power ? `<span>${icon("power")}+${p.power}</span>` : ""}${p.gems ? `<span>${icon("gem")}+${p.gems}</span>` : ""}</div><p class="result-saved">${icon("check")}${tr("Награда уже сохранена", "Reward already saved")}</p><div class="modal-actions">${p.kind === "rush" ? `<button class="primary" data-action="rush-replay">${tr("ЕЩЁ РАУНД!", "ONE MORE ROUND!")}</button>` : ""}<button class="${p.kind === "rush" ? "secondary" : "primary"}" data-action="claim-result">${tr("Забрать", "Continue")}</button>${p.coins > 0 && !p.boosted ? adButton("result", `${tr("ещё", "extra")} +${fmt(p.coins)} ${tr("монет", "coins")}`) : ""}${p.kind === "battle" && !p.won && !p.boosted && !p.revived ? adButton("revive", tr("ещё 20 секунд", "20 more seconds")) : ""}</div></div>`,
  );
  p.kind === "battle" && !p.won ? audio.lose() : audio.win();
}
function boxReveal() {
  const p = game.state.pending;
  if (!p || p.kind !== "box" || p.boxIndex === undefined) return false;
  const items = [
    { type: "coin", value: p.coins, title: tr("МОНЕТЫ", "COINS") },
    { type: "power", value: p.power, title: tr("ОЧКИ СИЛЫ", "POWER POINTS") },
    ...(p.gems
      ? [{ type: "gem", value: p.gems, title: tr("ГЕМЫ", "GEMS") }]
      : []),
    {
      type: "brawler",
      value: p.brawler ?? 0,
      title: p.newBrawler
        ? tr("НОВЫЙ БОЕЦ!", "NEW BRAWLER!")
        : tr("КАРТОЧКИ БОЙЦА", "BRAWLER CARDS"),
    },
  ];
  const step = p.revealStep ?? 0;
  if (step >= 3 + items.length) return false;
  const box = BOXES[p.boxIndex],
    item = items[step - 3],
    charging = step < 3;
  show(
    `<div class="box-opening ${charging ? `charge-${step}` : "reward-reveal"}" style="--box-color:${box.color};--rarity:${COLORS[p.quality]}"><span class="eyebrow">${lang === "ru" ? box.name : box.en}</span><button class="reveal-skip" data-action="box-skip">${tr("Пропустить", "Skip")}</button><h2>${charging ? tr("РАЗБУДИ БОКС!", "WAKE THE BOX!") : item.title}</h2>${charging ? `<button class="reveal-chest" data-action="box-reveal" aria-label="${tr("Зарядить и открыть бокс", "Charge and open the box")}"><span class="loot-rays"></span><img src="${boxImage(p.boxIndex)}" alt=""><span class="chest-sparks">✦</span></button><div class="charge-dots">${[0, 1, 2].map((i) => `<i class="${i < step ? "lit" : ""}"></i>`).join("")}</div><p>${tr("Три нажатия — и награды твои", "Three taps to reveal your rewards")}</p>` : `<div class="loot-reveal-card ${item.type}">${item.type === "brawler" ? `<img src="${img(item.value)}" alt="${name(item.value)}"><strong>${name(item.value)}</strong><small>${p.newBrawler ? tr("УЖЕ В КОЛЛЕКЦИИ", "ADDED TO COLLECTION") : tr("Карточки и сила начислены", "Cards and power added")}</small>` : `${icon(item.type)}<strong>+${fmt(item.value)}</strong>`}</div><span class="rewards-left">${tr("ОСТАЛОСЬ НАГРАД", "REWARDS LEFT")}: ${Math.max(0, items.length - (step - 3) - 1)}</span>`}<button class="primary full reveal-next" data-action="box-reveal">${charging ? tr("ОТКРЫТЬ!", "OPEN!") : step - 3 === items.length - 1 ? tr("СОБРАТЬ ВСЁ", "COLLECT ALL") : tr("СЛЕДУЮЩАЯ НАГРАДА", "NEXT REWARD")}</button><small class="reveal-safe">${tr("Награды сохранены. Нажатия раскрывают содержимое.", "Rewards are saved. Taps reveal the contents.")}</small></div>`,
  );
  return true;
}
async function openBox(index: number, receipt?: string) {
  try {
    game.openBox(index, platform.time(), receipt);
    persist();
    outcome();
  } catch (e) {
    error(e);
  } finally {
    pause();
  }
}
function adDue() {
  return (
    platform.canInterstitial &&
    platform.time() - startedAt >= AD_INTERVAL &&
    platform.time() - game.state.lastAdAt >= AD_INTERVAL
  );
}
async function breakAd(countdown = false) {
  if (busy || animating || !focused || sdkPaused || !adDue()) return;
  busy = true;
  game.state.lastAdAt = platform.time();
  persist();
  pause();
  try {
    if (countdown) {
      show(
        `<div class="ad-warning">${icon("clock")}<h2>${tr("Рекламная пауза", "Ad break")}</h2><p>${tr("Игра на паузе", "Game paused")}</p><strong id="ad-countdown">2</strong></div>`,
      );
      await new Promise((r) => setTimeout(r, 1000));
      const label = modal.querySelector("#ad-countdown");
      if (label) label.textContent = "1";
      await new Promise((r) => setTimeout(r, 1000));
      modal.close();
    }
    if (focused && !sdkPaused) await platform.interstitial();
  } finally {
    game.state.lastAdAt = platform.time();
    persist();
    busy = false;
    render();
    pause();
  }
}
async function reward(type: string, id = "") {
  if (busy || animating || !platform.canReward) return;
  const pendingId = game.state.pending?.id;
  busy = true;
  game.state.lastAdAt = platform.time();
  persist();
  pause();
  try {
    const success = await platform.rewarded();
    if (!success) {
      toast(
        tr(
          "Видео не завершено. Награда не потрачена.",
          "Video not completed. Your reward is still available.",
        ),
      );
      return;
    }
    const receipt = `${type}-${platform.time()}-${game.state.next++}`;
    if (/^box-[0-5]$/.test(type)) {
      busy = false;
      await openBox(Number(type.slice(-1)), receipt);
      return;
    }
    if (type === "daily") game.daily(platform.time(), receipt);
    else if (type === "wheel") game.wheel(platform.time(), receipt);
    else if (type === "quest") game.quest(id, receipt);
    else if (type === "result") game.boostResult(pendingId!, receipt);
    else if (type === "revive") {
      game.revive(pendingId!, platform.time(), receipt);
      modal.close();
      route = "arena";
    } else if (type === "offline") game.claimOffline(receipt);
    else
      game.adReward(
        type as "coins" | "boost" | "power" | "gems",
        platform.time(),
        receipt,
      );
    persist();
    audio.coin();
    toast(tr("Бонус получен!", "Bonus received!"));
  } catch (e) {
    error(e);
  } finally {
    game.state.lastAdAt = platform.time();
    persist();
    busy = false;
    render();
    if (game.state.pending) outcome();
    pause();
  }
}
async function navigate(next: string) {
  if (busy || animating || game.state.battle || game.state.rush) return;
  if (modal.open) return;
  if (next !== route && adDue()) await breakAd();
  route = next;
  filter = "all";
  render();
  app.querySelector("main")?.scrollTo(0, 0);
}
function settings() {
  show(
    `${buttonClose()}<span class="eyebrow">BRAWL CLICK</span><h2>${tr("Настройки", "Settings")}</h2><div class="settings-row"><span>${tr("Звуковые эффекты", "Sound effects")}</span><button class="secondary" data-action="sound">${icon("sound")}${game.state.sound ? tr("Включён", "On") : tr("Выключен", "Off")}</button></div><label class="audio-volume">${tr("Громкость эффектов", "Effects volume")}<output data-volume-label="soundVolume">${game.state.soundVolume}%</output><input type="range" min="0" max="100" step="5" value="${game.state.soundVolume}" data-audio-volume="soundVolume" aria-label="${tr("Громкость эффектов", "Effects volume")}"></label><div class="settings-row"><span>${tr("Музыка", "Music")}</span><button class="secondary" data-action="music">${icon("sound")}${game.state.music ? tr("Включена", "On") : tr("Выключена", "Off")}</button></div><label class="audio-volume">${tr("Громкость музыки", "Music volume")}<output data-volume-label="musicVolume">${game.state.musicVolume}%</output><input type="range" min="0" max="100" step="5" value="${game.state.musicVolume}" data-audio-volume="musicVolume" aria-label="${tr("Громкость музыки", "Music volume")}"></label><p class="audio-note">${tr("Меню, рейд и арена звучат по-разному. Музыка начинается после первого нажатия.", "Menu, rush and arena have different tracks. Music starts after your first tap.")}</p><div class="settings-row"><span>${tr("Язык", "Language")}</span><button class="secondary" data-action="language">${lang === "ru" ? "Русский → English" : "English → Русский"}</button></div><div class="settings-note"><p>${tr("Неофициальная фан-игра. Не связана с Supercell и не одобрена ею. Все ресурсы и бойцы существуют только здесь, переноса в Brawl Stars нет.", "Unofficial fan game. Not affiliated with or endorsed by Supercell. All resources and brawlers exist only here and cannot be transferred to Brawl Stars.")}</p><p>${tr("Реклама: добровольные бонусы и периодические паузы от 3 минут. Во время короткого боя или открытия бокса показ откладывается до завершения.", "Ads: optional bonuses and periodic breaks from 3 minutes. Short battles and box openings finish before a break.")}</p></div>`,
  );
}
document.addEventListener("click", async (ev) => {
  const button = (ev.target as Element).closest<HTMLButtonElement>("button");
  if (!button || button.disabled || busy || animating || sdkPaused || !focused)
    return;
  audio.unlock();
  const d = button.dataset;
  try {
    if (d.nav) {
      audio.ui();
      await navigate(d.nav);
      return;
    }
    if (d.go) {
      close();
      await navigate(d.go);
      return;
    }
    if (d.filter) {
      filter = d.filter;
      render();
      return;
    }
    if (d.fighter) {
      fighterModal(Number(d.fighter));
      return;
    }
    if (d.action === "team-picker") {
      teamPicker();
      return;
    }
    if (d.addTeam) {
      game.team(Number(d.addTeam));
      persist();
      modal.close();
      render();
      pause();
      toast(tr("Боец добавлен в команду", "Brawler added to your team"));
      return;
    }
    if (d.upgrade) {
      game.upgrade(d.upgrade as Upgrade);
      audio.coin();
      persist();
      render();
      return;
    }
    if (d.recruit) {
      game.recruit(Number(d.recruit));
      persist();
      render();
      fighterModal(Number(d.recruit));
      return;
    }
    if (d.select) {
      game.select(Number(d.select));
      modal.close();
      persist();
      render();
      return;
    }
    if (d.team) {
      game.team(Number(d.team));
      persist();
      render();
      fighterModal(Number(d.team));
      return;
    }
    if (d.level) {
      game.level(Number(d.level));
      persist();
      render();
      fighterModal(Number(d.level));
      return;
    }
    if (d.open !== undefined) {
      await openBox(Number(d.open));
      return;
    }
    if (d.road !== undefined) {
      const coins = game.roadClaim(Number(d.road));
      persist();
      render();
      toast(`+${fmt(coins)}`);
      return;
    }
    if (d.quest) {
      const coins = game.quest(d.quest);
      persist();
      render();
      toast(`+${fmt(coins)}`);
      return;
    }
    if (d.ad) {
      await reward(d.ad, d.id);
      return;
    }
    if (d.rush) {
      const r = game.state.rush;
      if (!r) return;
      const gain = game.rushHit(Number(d.rush), platform.time());
      if (gain) {
        floatGain(
          gain.bomb
            ? tr("БОМБА! Комбо сброшено", "BOMB! Combo reset")
            : gain.power
              ? tr("+3 силы", "+3 power")
              : gain.gem
                ? tr("+1 гем", "+1 gem")
                : `+${fmt(gain.amount)}`,
          button,
          gain.critical,
        );
        gain.bomb ? audio.bomb() : gain.critical ? audio.coin() : audio.click();
        persist();
        refresh();
      }
      return;
    }
    switch (d.action) {
      case "box-reveal":
      case "box-skip": {
        const p = game.state.pending;
        if (p) {
          game.advanceBox(p.id, d.action === "box-skip");
          persist();
          audio.setActive(true);
          game.state.pending?.revealStep === 3 ? audio.box() : audio.tick();
          outcome();
        }
        break;
      }
      case "ability": {
        const ability = game.useAbility();
        persist();
        audio.skill();
        toast(lang === "ru" ? ability.ru : ability.en);
        refresh();
        if (game.state.pending) {
          render();
          outcome();
        }
        break;
      }
      case "dodge":
        game.dodge();
        persist();
        refresh();
        audio.dodge();
        break;
      case "rush-start":
        if (adDue()) await breakAd();
        game.startRush();
        persist();
        render();
        audio.win();
        break;
      case "rush-replay":
        close();
        if (adDue()) await breakAd();
        game.startRush();
        route = "home";
        persist();
        render();
        break;
      case "tap": {
        const gain = game.tap(platform.time());
        if (gain) {
          floatGain(`+${fmt(gain.amount)}`, button, gain.critical);
          gain.critical ? audio.coin() : audio.click();
          refresh();
          persist();
        }
        break;
      }
      case "attack": {
        const hit = game.attack(platform.time());
        if (hit) {
          floatGain(`−${fmt(hit.damage)}`, button, hit.critical);
          audio.click();
          persist();
          refresh();
          if (game.state.pending) {
            render();
            outcome();
          }
        }
        break;
      }
      case "super":
        game.activateSuper(platform.time());
        persist();
        audio.skill();
        app.querySelector(".rush-scene")?.classList.add("supernova");
        setTimeout(
          () => app.querySelector(".rush-scene")?.classList.remove("supernova"),
          500,
        );
        refresh();
        if (game.state.pending) {
          render();
          outcome();
        }
        break;
      case "battle":
        game.startBattle();
        persist();
        render();
        break;
      case "offline":
        toast(`+${fmt(game.claimOffline())}`);
        persist();
        render();
        break;
      case "claim-result":
        close();
        if (adDue()) await breakAd();
        break;
      case "close":
        close();
        break;
      case "settings":
        settings();
        break;
      case "sound":
        game.state.sound = !game.state.sound;
        persist();
        settings();
        break;
      case "music":
        game.state.music = !game.state.music;
        persist();
        settings();
        break;
      case "language":
        lang = lang === "ru" ? "en" : "ru";
        game.state.language = lang;
        document.documentElement.lang = lang;
        persist();
        render();
        settings();
        break;
      case "prestige":
        show(
          `${buttonClose()}<h2>${tr("Начать новый рывок?", "Begin a new rush?")}</h2><p class="modal-description">${tr("Монеты станут 350, четыре улучшения обнулятся. Коллекция, уровни бойцов, трофеи и прочие ресурсы сохранятся.", "Coins become 350 and the four upgrades reset. Keep your collection, brawler levels, trophies and other resources.")}</p><button class="primary full" data-action="confirm-prestige">${tr("Получить звёзды престижа", "Earn prestige stars")}</button>`,
        );
        break;
      case "confirm-prestige":
        toast(`+${game.prestige()} ${tr("звёзд", "stars")}`);
        modal.close();
        persist();
        render();
        break;
      case "retry":
        await boot();
        break;
    }
  } catch (e) {
    error(e);
  }
});
document.addEventListener("input", (ev) => {
  const input = ev.target as HTMLInputElement;
  const key = input.dataset.audioVolume;
  if (key !== "soundVolume" && key !== "musicVolume") return;
  game.state[key] = Math.max(0, Math.min(100, Number(input.value) || 0));
  const label = modal.querySelector(`[data-volume-label="${key}"]`);
  if (label) label.textContent = `${game.state[key]}%`;
  persist();
  pause();
});
modal.addEventListener("cancel", (ev) => {
  ev.preventDefault();
  close();
});
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("visibilitychange", () => {
  focused = !document.hidden && document.hasFocus();
  pause();
});
window.addEventListener("blur", () => {
  focused = false;
  pause();
});
window.addEventListener("focus", () => {
  focused = true;
  pause();
});
window.addEventListener("pagehide", persist);
platform.onPause = () => {
  sdkPaused = true;
  pause();
};
platform.onResume = () => {
  sdkPaused = false;
  pause();
};
let sinceSave = 0,
  sinceRefresh = 0;
setInterval(() => {
  const time = performance.now(),
    dt = Math.min(1000, time - lastTick);
  lastTick = time;
  if (!busy && !animating && !sdkPaused && focused && !modal.open) {
    const ended = game.tick(dt, platform.time());
    if (ended) {
      persist();
      render();
      outcome();
    } else refresh();
    sinceSave += dt;
    if (sinceSave >= 2000) {
      persist();
      sinceSave = 0;
    }
  }
  sinceRefresh += dt;
  if (sinceRefresh >= 1000) {
    sinceRefresh = 0;
    if (!busy && !animating && !modal.open) refreshAdTimers();
  }
}, 100);
async function boot() {
  try {
    const init = await platform.init();
    game = new ClickGame(platform.load().run, undefined, platform.time());
    lang = game.state.language === "auto" ? init.lang : game.state.language;
    if (game.state.pending)
      route =
        game.state.pending.kind === "battle"
          ? "arena"
          : game.state.pending.kind === "box"
            ? game.state.pending.boxIndex === 6
              ? "rewards"
              : "boxes"
            : game.state.pending.kind === "wheel"
              ? "rewards"
              : "home";
    document.documentElement.lang = lang;
    startedAt = platform.time();
    focused = !document.hidden;
    render();
    persist();
    platform.ready();
    if (game.state.pending) outcome();
    else if (game.state.rush) {
      route = "home";
      render();
    } else if (game.state.battle) {
      route = "arena";
      render();
    }
    if (!game.state.battle && game.state.offlineCoins > 0)
      toast(
        tr(
          "Команда заработала монеты, пока тебя не было. Забери их в бонусах.",
          "Your team earned coins while you were away. Claim them in Rewards.",
        ),
      );
  } catch {
    app.innerHTML = `<div class="loading"><h1>BRAWL CLICK</h1><p>${tr("Не удалось подключиться к платформе", "Could not connect to the platform")}</p><button class="primary" data-action="retry">${tr("Повторить", "Retry")}</button></div>`;
  }
}
void boot();
