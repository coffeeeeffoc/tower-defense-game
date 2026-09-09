import {
  DEFAULT_BALANCE,
  enemyHealth,
  parseBalance,
  type Balance,
} from './balance.ts';
export type TowerKind = 'arrow' | 'frost' | 'ember';
export type Point = [number, number];
export const TYPES = {
  arrow: {
    name: '游侠弓手',
    cost: 60,
    range: 135,
    interval: 1.9,
    windup: 0.65,
    color: '#c2ee96',
    detail: '拉弓点射 · 中箭退步',
  },
  frost: {
    name: '冰晶法塔',
    cost: 80,
    range: 128,
    interval: 2.6,
    windup: 0.85,
    color: '#8fe6ff',
    detail: '寒冰蓄力 · 减速哆嗦',
  },
  ember: {
    name: '重装火炮',
    cost: 100,
    range: 145,
    interval: 3.6,
    windup: 1,
    color: '#ffc08a',
    detail: '炮口后坐 · 爆炸惊退',
  },
};
export const KINDS: TowerKind[] = ['arrow', 'frost', 'ember'];
export const MAX_LEVEL = 4;
export const BENCH_SIZE = 6;
export const REFRESH_COST = 15;
export const RANKS = ['新兵', '老练', '精锐', '传奇'];
export type Guardian = {
  id: number;
  kind: TowerKind;
  level: number;
  spent: number;
};
export type Location = { zone: 'bench' | 'field'; slot: number };
export type Offer = { id: number; kind: TowerKind; price: number };
export const BOARD = { width: 480, height: 600 };
export const PATH: Point[] = [
  [-28, 110],
  [396, 110],
  [396, 270],
  [84, 270],
  [84, 450],
  [396, 450],
  [396, 628],
];
function roadDistance([x, y]: Point) {
  return Math.min(
    ...PATH.slice(1).map((b, i) => {
      const a = PATH[i],
        dx = b[0] - a[0],
        dy = b[1] - a[1],
        t = Math.max(
          0,
          Math.min(
            1,
            ((x - a[0]) * dx + (y - a[1]) * dy) / (dx * dx + dy * dy),
          ),
        );
      return Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy);
    }),
  );
}
export const SLOTS: Point[] = [40, 190, 350, 530]
  .flatMap((y) =>
    Array.from({ length: 8 }, (_, i) => [30 + i * 60, y] as Point),
  )
  .filter((p) => roadDistance(p) >= 42)
  .concat([
    [30, 270],
    [450, 270],
  ]);
export const LENGTH = PATH.slice(1).reduce(
  (n, p, i) => n + Math.hypot(p[0] - PATH[i][0], p[1] - PATH[i][1]),
  0,
);
export function position(distance: number): Point {
  distance = Math.max(0, distance);
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
export function project(p: Point, wide: boolean): Point {
  return wide ? [p[1], BOARD.width - p[0]] : [p[0], p[1]];
}
export function boardFit(
  width: number,
  height: number,
  wide: boolean,
  zoom = 1,
) {
  const w = wide ? BOARD.height : BOARD.width,
    h = wide ? BOARD.width : BOARD.height;
  const topPadding = 100;
  return {
    width: w,
    height: h,
    topPadding,
    renderHeight: h + topPadding,
    scale: Math.max(0.1, Math.min(width / w, height / (h + topPadding))) * zoom,
  };
}
export type Enemy = {
  id: number;
  distance: number;
  hp: number;
  maxHp: number;
  speed: number;
  slow: number;
  boss: boolean;
  afraid: TowerKind;
  reaction: TowerKind | null;
  hurt: number;
  panic: number;
  retreat: number;
  brace: number;
  fall: number;
  paid: boolean;
};
export type Tower = Guardian & {
  slot: number;
  cooldown: number;
  phase: 'idle' | 'aim' | 'recover';
  phaseTime: number;
  target: number | null;
  aim: Point;
};
export type Shot = {
  id: number;
  kind: TowerKind;
  from: Point;
  to: Point;
  target: number;
  elapsed: number;
  duration: number;
  damage: number;
};
export type Impact = {
  id: number;
  at: Point;
  kind: TowerKind;
  damage: number;
  weak: boolean;
  life: number;
  kill: boolean;
};
export type Game = {
  balance: Balance;
  gold: number;
  lives: number;
  wave: number;
  kills: number;
  status: 'ready' | 'battle' | 'won' | 'lost';
  paused: boolean;
  speed: number;
  towers: Tower[];
  bench: (Guardian | null)[];
  shop: (Offer | null)[];
  shopSeed: number;
  enemies: Enemy[];
  shots: Shot[];
  impacts: Impact[];
  left: number;
  spawn: number;
  nextId: number;
  spell: number;
  flash: number;
  time: number;
  shake: number;
  sounds: TowerKind[];
};
function makeTower(slot: number, unit: Guardian, cooldown = 0): Tower {
  return {
    ...unit,
    slot,
    cooldown,
    phase: 'idle',
    phaseTime: 0,
    target: null,
    aim: [SLOTS[slot][0] + 50, SLOTS[slot][1]],
  };
}
export function newGame(balance: Balance = DEFAULT_BALANCE): Game {
  balance = parseBalance(balance);
  return {
    balance,
    gold: balance.initialGold,
    lives: 20,
    wave: 0,
    kills: 0,
    status: 'ready',
    paused: false,
    speed: 1,
    towers: [makeTower(2, { id: 0, kind: 'arrow', level: 1, spent: 60 })],
    bench: [
      { id: 1, kind: 'arrow', level: 1, spent: 60 },
      { id: 2, kind: 'frost', level: 1, spent: 80 },
      null,
      null,
      null,
      null,
    ],
    shop: KINDS.map((kind, i) => ({
      id: i + 3,
      kind,
      price: TYPES[kind].cost,
    })),
    shopSeed: 1729,
    enemies: [],
    shots: [],
    impacts: [],
    left: 0,
    spawn: 0,
    nextId: 6,
    spell: 0,
    flash: 0,
    time: 0,
    shake: 0,
    sounds: [],
  };
}
export function locate(
  g: Game,
  id: number,
): { unit: Guardian; at: Location } | undefined {
  const tower = g.towers.find((t) => t.id === id);
  if (tower) return { unit: tower, at: { zone: 'field', slot: tower.slot } };
  const slot = g.bench.findIndex((t) => t?.id === id);
  return slot < 0
    ? undefined
    : { unit: g.bench[slot]!, at: { zone: 'bench', slot } };
}
export function unitAt(g: Game, to: Location): Guardian | null {
  return to.zone === 'bench'
    ? (g.bench[to.slot] ?? null)
    : (g.towers.find((t) => t.slot === to.slot) ?? null);
}
export function canMerge(a: Guardian, b: Guardian) {
  return (
    a.id !== b.id &&
    a.kind === b.kind &&
    a.level === b.level &&
    a.level < MAX_LEVEL
  );
}
export function saleValue(unit: Guardian) {
  return Math.max(1, Math.floor(unit.spent * 0.25));
}
export function buy(g: Game, offerId: number) {
  const index = g.shop.findIndex((o) => o?.id === offerId),
    offer = g.shop[index],
    slot = g.bench.findIndex((u) => !u);
  if (
    !offer ||
    slot < 0 ||
    g.gold < offer.price ||
    ['won', 'lost'].includes(g.status)
  )
    return false;
  g.gold -= offer.price;
  g.bench[slot] = {
    id: g.nextId++,
    kind: offer.kind,
    level: 1,
    spent: offer.price,
  };
  g.shop[index] = null;
  return true;
}
export function refreshShop(g: Game) {
  if (g.gold < REFRESH_COST || ['won', 'lost'].includes(g.status)) return false;
  g.gold -= REFRESH_COST;
  const old = g.shop;
  // A tiny seeded generator makes shop changes reproducible in saves/tests.
  g.shop = Array.from({ length: 3 }, () => {
    g.shopSeed = (Math.imul(g.shopSeed, 1664525) + 1013904223) >>> 0;
    const kind = KINDS[Math.floor((g.shopSeed / 4294967296) * 3)];
    return { id: g.nextId++, kind, price: TYPES[kind].cost };
  });
  if (g.shop.every((o, i) => o?.kind === old[i]?.kind)) {
    const kind = KINDS[(KINDS.indexOf(g.shop[0]!.kind) + 1) % 3];
    g.shop[0] = { ...g.shop[0]!, kind, price: TYPES[kind].cost };
  }
  return true;
}
export function moveProblem(g: Game, id: number, to: Location): string | null {
  if (['won', 'lost'].includes(g.status)) return '挑战已结束';
  if (
    !to ||
    !['bench', 'field'].includes(to.zone) ||
    !Number.isInteger(to.slot) ||
    to.slot < 0 ||
    to.slot >= (to.zone === 'bench' ? BENCH_SIZE : SLOTS.length)
  )
    return '请选择有效的空位';
  const source = locate(g, id);
  if (!source) return '这名守卫已不在原位';
  const target = unitAt(g, to);
  if (
    g.status === 'battle' &&
    (source.at.zone !== 'bench' || to.zone !== 'field' || target)
  )
    return '战斗中仅可将守卫厅援军部署到空阵地；换位、回收和合成请等本波结束';
  if (!target) return null;
  if (target.id === id) return '已在这里';
  if (target.kind !== source.unit.kind) return '只能合成同一种守卫';
  if (target.level !== source.unit.level) return '两名守卫需要等级相同';
  if (target.level >= MAX_LEVEL) return '已达 4 级上限';
  return null;
}
function removeUnit(g: Game, id: number) {
  const slot = g.bench.findIndex((u) => u?.id === id);
  if (slot >= 0) g.bench[slot] = null;
  g.towers = g.towers.filter((t) => t.id !== id);
}
export function moveGuardian(g: Game, id: number, to: Location) {
  if (moveProblem(g, id, to)) return false;
  const source = locate(g, id)!,
    target = unitAt(g, to),
    base = target ?? source.unit;
  const unit: Guardian = {
    id: base.id,
    kind: base.kind,
    level: base.level + (target ? 1 : 0),
    spent: source.unit.spent + (target ? target.spent : 0),
  };
  const cooldown = Math.max(
    'cooldown' in source.unit ? Number(source.unit.cooldown) : 0,
    target && 'cooldown' in target ? Number(target.cooldown) : 0,
  );
  removeUnit(g, id);
  if (target) removeUnit(g, target.id);
  if (to.zone === 'bench') g.bench[to.slot] = unit;
  else g.towers.push(makeTower(to.slot, unit, cooldown));
  return true;
}
export function benchDestination(g: Game, id: number): Location | null {
  if (g.status !== 'ready') return null;
  const source = locate(g, id);
  if (!source) return null;
  let slot = g.bench.findIndex((u) => u && canMerge(source.unit, u));
  if (slot < 0) slot = g.bench.findIndex((u) => !u);
  return slot < 0 ? null : { zone: 'bench', slot };
}
export function sell(g: Game, id: number) {
  const source = locate(g, id);
  if (!source || g.status !== 'ready') return false;
  g.gold += saleValue(source.unit);
  removeUnit(g, id);
  return true;
}
export function towerDamage(
  kind: TowerKind,
  level: number,
  balance: Balance = DEFAULT_BALANCE,
) {
  return balance[`${kind}Damage`] * balance.damagePerLevel ** (level - 1);
}
export function applyBalance(g: Game, input: unknown) {
  const next = parseBalance(input);
  // Keep existing wounds: changing health must neither heal enemies nor revive corpses.
  for (const e of g.enemies) {
    if (e.hp <= 0) continue;
    const maxHp = enemyHealth(next, g.wave, e.boss);
    e.hp = (e.hp / e.maxHp) * maxHp;
    e.maxHp = maxHp;
  }
  g.balance = next;
}
export function startWave(g: Game) {
  if (g.status !== 'ready' || g.wave >= 8) return false;
  g.wave++;
  g.left = 6 + g.wave * 2;
  g.spawn = 0;
  g.status = 'battle';
  g.paused = false;
  for (const t of g.towers) {
    t.phase = 'idle';
    t.cooldown = 0;
    t.target = null;
  }
  return true;
}
function hit(g: Game, e: Enemy, kind: TowerKind, damage: number) {
  if (e.hp <= 0) return;
  const weak = e.afraid === kind,
    at = position(e.distance),
    force =
      { arrow: 12, frost: 7, ember: 29 }[kind] *
      (weak ? 1.5 : 1) *
      (e.boss ? 0.35 : 1);
  const dealt = Math.round(damage * (weak ? 1.2 : 1));
  e.hp -= dealt;
  e.reaction = kind;
  e.hurt = kind === 'frost' ? 1.1 : 0.85;
  if (kind === 'frost') e.slow = weak ? 4.2 : 3;
  if (e.brace <= 0) {
    e.retreat = force;
    e.panic = weak ? 1.3 : kind === 'ember' ? 0.65 : 0;
    e.brace = e.boss ? 2.6 : 1.5;
  }
  g.impacts.push({
    id: g.nextId++,
    at,
    kind,
    damage: dealt,
    weak,
    life: 0.85,
    kill: e.hp <= 0,
  });
  if (kind === 'ember') g.shake = 0.22;
}
export function cast(g: Game) {
  if (
    g.status !== 'battle' ||
    g.paused ||
    g.spell > 0 ||
    !g.enemies.some((e) => e.hp > 0)
  )
    return false;
  for (const e of g.enemies) hit(g, e, 'frost', 60);
  g.spell = 22;
  g.flash = 0.7;
  g.sounds.push('frost');
  return true;
}
export function spawnEnemy(g: Game, boss = false): Enemy {
  const hp = enemyHealth(g.balance, g.wave, boss);
  const e: Enemy = {
    id: g.nextId++,
    distance: 0,
    hp,
    maxHp: hp,
    speed: boss ? 13 : 17 + g.wave * 0.8,
    slow: 0,
    boss,
    afraid: KINDS[g.left % 3],
    reaction: null,
    hurt: 0,
    panic: 0,
    retreat: 0,
    brace: 0,
    fall: 0.65,
    paid: false,
  };
  g.enemies.push(e);
  return e;
}
export function step(g: Game, dt: number) {
  if (g.paused || g.status !== 'battle' || !Number.isFinite(dt) || dt <= 0)
    return;
  dt = Math.min(dt, 0.12);
  g.time += dt;
  g.spell = Math.max(0, g.spell - dt);
  g.flash = Math.max(0, g.flash - dt);
  g.shake = Math.max(0, g.shake - dt);
  g.spawn -= dt;
  for (const fx of g.impacts) fx.life -= dt;
  g.impacts = g.impacts.filter((fx) => fx.life > 0);
  if (g.left > 0 && g.spawn <= 0) {
    spawnEnemy(g, g.wave % 4 === 0 && g.left === 1);
    g.left--;
    g.spawn = 1.1;
  }
  for (const e of g.enemies) {
    if (e.hp <= 0) {
      if (!e.paid) {
        g.gold += e.boss ? g.balance.bossGold : g.balance.killGold;
        g.kills++;
        e.paid = true;
      }
      e.fall -= dt;
      continue;
    }
    e.hurt = Math.max(0, e.hurt - dt);
    e.brace = Math.max(0, e.brace - dt);
    e.panic = Math.max(0, e.panic - dt);
    e.slow = Math.max(0, e.slow - dt);
    if (e.retreat > 0) {
      const back = Math.min(e.retreat, dt * (e.boss ? 26 : 55));
      e.distance = Math.max(0, e.distance - back);
      e.retreat -= back;
    } else if (e.panic > 0)
      e.distance = Math.max(0, e.distance - e.speed * 0.3 * dt);
    else e.distance += e.speed * dt * (e.slow > 0 ? 0.42 : 1);
    if (e.distance >= LENGTH) g.lives = Math.max(0, g.lives - (e.boss ? 5 : 1));
  }
  g.enemies = g.enemies.filter((e) => e.fall > 0 && e.distance < LENGTH);
  for (const s of g.shots) {
    s.elapsed += dt;
    const target = g.enemies.find((e) => e.id === s.target && e.hp > 0);
    if (target) s.to = position(target.distance);
    if (s.elapsed < s.duration) continue;
    if (s.kind === 'ember') {
      for (const e of g.enemies)
        if (Math.hypot(...subtract(position(e.distance), s.to)) < 57)
          hit(g, e, s.kind, s.damage);
    } else if (target) hit(g, target, s.kind, s.damage);
  }
  g.shots = g.shots.filter((s) => s.elapsed < s.duration);
  // ponytail: 31 towers and 22 enemies per wave; spatial buckets only if battles grow.
  for (const t of g.towers) {
    t.cooldown = Math.max(0, t.cooldown - dt);
    t.phaseTime += dt;
    const spec = TYPES[t.kind],
      p = SLOTS[t.slot];
    const inRange = (e: Enemy) =>
      e.hp > 0 &&
      Math.hypot(...subtract(position(e.distance), p)) <=
        spec.range + (t.level - 1) * 14;
    if (t.phase === 'recover') {
      if (t.phaseTime >= 0.65) {
        t.phase = 'idle';
        t.phaseTime = 0;
      }
      continue;
    }
    if (t.phase === 'idle') {
      if (t.cooldown > 0) continue;
      const enemy = g.enemies
        .filter(inRange)
        .sort((a, b) => b.distance - a.distance)[0];
      if (!enemy) continue;
      t.target = enemy.id;
      t.phase = 'aim';
      t.phaseTime = 0;
      t.aim = position(enemy.distance);
      continue;
    }
    const target =
      g.enemies.find((e) => e.id === t.target && inRange(e)) ??
      g.enemies.filter(inRange).sort((a, b) => b.distance - a.distance)[0];
    if (!target) {
      t.phase = 'idle';
      t.target = null;
      continue;
    }
    t.aim = position(target.distance);
    if (t.phaseTime < spec.windup) continue;
    g.shots.push({
      id: g.nextId++,
      kind: t.kind,
      from: [p[0], p[1]],
      to: position(target.distance),
      target: target.id,
      elapsed: 0,
      duration: t.kind === 'ember' ? 0.75 : t.kind === 'frost' ? 0.6 : 0.4,
      damage: towerDamage(t.kind, t.level, g.balance),
    });
    t.phase = 'recover';
    t.phaseTime = 0;
    t.cooldown = spec.interval;
    g.sounds.push(t.kind);
  }
  if (g.sounds.length > 8) g.sounds = g.sounds.slice(-8);
  if (g.lives <= 0) {
    g.status = 'lost';
    g.shots = [];
    g.sounds = [];
  } else if (!g.left && !g.enemies.length && !g.shots.length) {
    g.gold += g.balance.waveGold;
    g.status = g.wave === 8 ? 'won' : 'ready';
    g.flash = 0;
    g.impacts = [];
  }
}
function subtract(a: Point, b: Point): Point {
  return [a[0] - b[0], a[1] - b[1]];
}
export function shotPosition(s: Shot, wide = false): Point {
  const t = Math.min(1, s.elapsed / s.duration);
  const from = project(s.from, wide),
    to = project(s.to, wide);
  from[1] -= s.kind === 'arrow' ? 56 : s.kind === 'frost' ? 48 : 28;
  to[1] -= 24;
  return [
    from[0] + (to[0] - from[0]) * t,
    from[1] +
      (to[1] - from[1]) * t -
      (s.kind === 'ember' ? Math.sin(t * Math.PI) * 45 : 0),
  ];
}
