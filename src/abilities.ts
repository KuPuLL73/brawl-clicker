import { BRAWLERS } from "./data";
export type SkillKind =
  | "blast"
  | "summon"
  | "heal"
  | "shield"
  | "freeze"
  | "haste";
const specs = [
  ["Дробовой залп", "Shell Blast", "blast", 8],
  ["Медведь Брюс", "Bruce Bear", "summon", 1.8],
  ["Свинцовый дождь", "Bullet Rain", "blast", 10],
  ["Разгон быка", "Bull Charge", "shield", 5],
  ["Ракетный удар", "Rocket Strike", "blast", 12],
  ["Целительный аккорд", "Healing Chord", "heal", 40],
  ["Крепкие корни", "Strong Roots", "shield", 6],
  ["Супер-рикошет", "Super Ricochet", "blast", 9],
  ["Двойной перекат", "Double Roll", "shield", 5],
  ["Корабельная пушка", "Ship Cannon", "summon", 2],
  ["Летающая кирка", "Flying Pickaxe", "blast", 9],
  ["Подземный грохот", "Ground Rumble", "freeze", 4],
  ["Охотничьи мины", "Hunter Mines", "blast", 11],
  ["Точный выстрел", "Perfect Shot", "blast", 14],
  ["Мамина забота", "Mama Care", "heal", 45],
  ["Оглушающий молот", "Stunning Hammer", "freeze", 5],
  ["Домашний забег", "Home Run", "freeze", 3],
  ["Пчелиный рой", "Bee Swarm", "summon", 2.1],
  ["Жатва душ", "Soul Harvest", "heal", 30],
  ["Чёрная дыра", "Black Hole", "freeze", 4],
  ["Волшебная рука", "Magic Hand", "blast", 11],
  ["Полный разгон", "Maximum Speed", "haste", 6],
  ["Атака носильщиков", "Porter Attack", "summon", 2],
  ["Живая изгородь", "Living Hedge", "freeze", 5],
  ["Колючее поле", "Spiky Field", "summon", 2.2],
  ["Ядовитые кинжалы", "Poison Daggers", "summon", 2.2],
  ["Дымовая завеса", "Smoke Screen", "shield", 6],
  ["Песчаная буря", "Sandstorm", "freeze", 5],
  ["Огненный след", "Fire Trail", "summon", 2.3],
  ["Энергетический скачок", "Energy Surge", "haste", 6],
] as const;
export const abilityFor = (id: number) => {
  const index = Math.max(
    0,
    BRAWLERS.findIndex((b) => b.id === id),
  );
  const [ru, en, kind, power] = specs[index];
  return { ru, en, kind: kind as SkillKind, power, cooldown: 12000 };
};
export const skillHint = (kind: SkillKind, ru: boolean) =>
  ({
    blast: ru
      ? "Залп по боссу / сбор всех целей рейда"
      : "Boss burst / collect all Rush targets",
    summon: ru
      ? "Помощник наносит урон 6 секунд"
      : "A helper deals damage for 6 seconds",
    heal: ru
      ? "Лечит команду / +3 секунды рейда"
      : "Heal the team / +3 Rush seconds",
    shield: ru
      ? "Защита от атак / бомб и ×2 монеты"
      : "Block attacks / bombs and earn ×2 coins",
    freeze: ru
      ? "Замораживает босса / движение целей"
      : "Freeze boss attacks / target movement",
    haste: ru
      ? "×2 урон и добыча на время"
      : "Temporary ×2 damage and earnings",
  })[kind];
export interface SkillState {
  cooldown: number;
  remaining: number;
  kind: SkillKind | null;
  power: number;
}
export const freshSkill = (): SkillState => ({
  cooldown: 0,
  remaining: 0,
  kind: null,
  power: 0,
});
export const restoreSkill = (raw?: Partial<SkillState>): SkillState => ({
  cooldown: Math.min(
    12000,
    Math.max(0, Number.isFinite(raw?.cooldown) ? raw!.cooldown! : 0),
  ),
  remaining: Math.min(
    6000,
    Math.max(0, Number.isFinite(raw?.remaining) ? raw!.remaining! : 0),
  ),
  kind:
    raw?.kind &&
    ["blast", "summon", "heal", "shield", "freeze", "haste"].includes(raw.kind)
      ? raw.kind
      : null,
  power: Math.min(
    50,
    Math.max(0, Number.isFinite(raw?.power) ? raw!.power! : 0),
  ),
});
