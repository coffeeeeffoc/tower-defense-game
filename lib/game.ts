export type TowerKind = 'arrow' | 'frost' | 'ember';
export const TYPES = {
  arrow: {
    name: '风语弩塔',
    cost: 60,
    damage: 16,
    range: 108,
    interval: 0.65,
    color: '#a4e79b',
  },
  frost: {
    name: '冰晶法塔',
    cost: 80,
    damage: 8,
    range: 100,
    interval: 0.9,
    color: '#8fd9ff',
  },
  ember: {
    name: '余烬炮塔',
    cost: 100,
    damage: 28,
    range: 105,
    interval: 1.4,
    color: '#ffb07a',
  },
};
export const PATH = [
  [40, -20],
  [40, 95],
  [270, 95],
  [270, 210],
  [100, 210],
  [100, 335],
  [310, 335],
  [310, 412],
];
export const SLOTS = [
  [115, 150],
  [190, 42],
  [320, 155],
  [200, 267],
  [43, 267],
  [190, 389],
  [290, 272],
  [43, 389],
];
export const LENGTH = PATH.slice(1).reduce(
  (n, p, i) => n + Math.hypot(p[0] - PATH[i][0], p[1] - PATH[i][1]),
  0,
);
export function position(distance: number) {
  for (let i = 1; i < PATH.length; i++) {
    const a = PATH[i - 1],
      b = PATH[i],
      length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (distance <= length)
      return [
        a[0] + ((b[0] - a[0]) * distance) / length,
        a[1] + ((b[1] - a[1]) * distance) / length,
      ];
    distance -= length;
  }
  return PATH.at(-1)!;
}
export type Enemy = {
  id: number;
  distance: number;
  hp: number;
  maxHp: number;
  speed: number;
  slow: number;
  boss: boolean;
};
export type Tower = {
  slot: number;
  kind: TowerKind;
  level: number;
  cooldown: number;
  spent: number;
};
export type Game = {
  gold: number;
  lives: number;
  wave: number;
  kills: number;
  status: 'ready' | 'battle' | 'won' | 'lost';
  paused: boolean;
  speed: number;
  towers: Tower[];
  enemies: Enemy[];
  shots: { from: number[]; to: number[]; color: string; life: number }[];
  left: number;
  spawn: number;
  nextId: number;
  spell: number;
  flash: number;
};
export function newGame(): Game {
  return {
    gold: 180,
    lives: 20,
    wave: 0,
    kills: 0,
    status: 'ready',
    paused: false,
    speed: 1,
    towers: [{ slot: 0, kind: 'arrow', level: 1, cooldown: 0, spent: 60 }],
    enemies: [],
    shots: [],
    left: 0,
    spawn: 0,
    nextId: 0,
    spell: 0,
    flash: 0,
  };
}
export function build(g: Game, slot: number, kind: TowerKind) {
  if (
    !Number.isInteger(slot) ||
    !SLOTS[slot] ||
    !Object.hasOwn(TYPES, kind) ||
    g.towers.some((t) => t.slot === slot) ||
    g.gold < TYPES[kind].cost ||
    ['won', 'lost'].includes(g.status)
  )
    return false;
  g.gold -= TYPES[kind].cost;
  g.towers.push({ slot, kind, level: 1, cooldown: 0, spent: TYPES[kind].cost });
  return true;
}
export function upgrade(g: Game, slot: number) {
  const t = g.towers.find((t) => t.slot === slot);
  if (
    !t ||
    t.level >= 3 ||
    g.gold < t.level * 50 ||
    ['won', 'lost'].includes(g.status)
  )
    return false;
  g.gold -= t.level * 50;
  t.spent += t.level * 50;
  t.level++;
  return true;
}
export function sell(g: Game, slot: number) {
  const t = g.towers.find((t) => t.slot === slot);
  if (!t || ['won', 'lost'].includes(g.status)) return false;
  g.gold += Math.floor(t.spent * 0.7);
  g.towers = g.towers.filter((t) => t.slot !== slot);
  return true;
}
export function startWave(g: Game) {
  if (g.status !== 'ready' || g.wave >= 8) return false;
  g.wave++;
  g.left = 6 + g.wave * 2;
  g.spawn = 0;
  g.status = 'battle';
  g.paused = false;
  return true;
}
export function cast(g: Game) {
  if (g.status !== 'battle' || g.paused || g.spell > 0) return false;
  for (const e of g.enemies) {
    e.hp -= 65;
    e.slow = 3;
  }
  g.spell = 18;
  g.flash = 0.65;
  return true;
}
export function step(g: Game, dt: number) {
  if (g.paused || g.status !== 'battle') return;
  g.spell = Math.max(0, g.spell - dt);
  g.flash = Math.max(0, g.flash - dt);
  g.spawn -= dt;
  for (const s of g.shots) s.life -= dt;
  g.shots = g.shots.filter((s) => s.life > 0);
  if (g.left > 0 && g.spawn <= 0) {
    const boss = g.wave % 4 === 0 && g.left === 1,
      hp = (35 + g.wave * 16) * (boss ? 6 : 1);
    g.enemies.push({
      id: g.nextId++,
      distance: 0,
      hp,
      maxHp: hp,
      speed: boss ? 23 : 31 + g.wave * 2,
      slow: 0,
      boss,
    });
    g.left--;
    g.spawn = 0.85;
  }
  // ponytail: 8 towers and at most 22 enemies; spatial buckets only for larger battles.
  for (const t of g.towers) {
    t.cooldown -= dt;
    if (t.cooldown > 0) continue;
    const spec = TYPES[t.kind],
      p = SLOTS[t.slot],
      target = g.enemies
        .filter(
          (e) =>
            e.hp > 0 &&
            Math.hypot(
              position(e.distance)[0] - p[0],
              position(e.distance)[1] - p[1],
            ) <=
              spec.range + (t.level - 1) * 12,
        )
        .sort((a, b) => b.distance - a.distance)[0];
    if (!target) continue;
    const hit = position(target.distance);
    t.cooldown = spec.interval;
    g.shots.push({ from: p, to: hit, color: spec.color, life: 0.16 });
    const damage = spec.damage * (1 + (t.level - 1) * 0.7);
    target.hp -= damage;
    if (t.kind === 'frost') target.slow = 2;
    if (t.kind === 'ember')
      for (const e of g.enemies)
        if (
          e !== target &&
          Math.hypot(
            position(e.distance)[0] - hit[0],
            position(e.distance)[1] - hit[1],
          ) < 48
        )
          e.hp -= damage * 0.7;
  }
  for (const e of g.enemies) {
    if (e.hp <= 0) {
      g.gold += e.boss ? 55 : 12;
      g.kills++;
      continue;
    }
    e.distance += e.speed * dt * (e.slow > 0 ? 0.48 : 1);
    e.slow = Math.max(0, e.slow - dt);
    if (e.distance >= LENGTH) g.lives = Math.max(0, g.lives - (e.boss ? 5 : 1));
  }
  g.enemies = g.enemies.filter((e) => e.hp > 0 && e.distance < LENGTH);
  if (g.lives <= 0) {
    g.status = 'lost';
    g.shots = [];
  } else if (!g.left && !g.enemies.length) {
    g.gold += 35;
    g.shots = [];
    g.status = g.wave === 8 ? 'won' : 'ready';
  }
}
