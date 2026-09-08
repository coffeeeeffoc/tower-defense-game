export type TowerKind = 'arrow' | 'frost' | 'ember';
export type Point = [number, number];
export const TYPES = {
  arrow: {
    name: '游侠弓手',
    cost: 60,
    damage: 32,
    range: 135,
    interval: 1.9,
    windup: 0.65,
    color: '#c2ee96',
    detail: '拉弓点射 · 中箭退步',
  },
  frost: {
    name: '冰晶法塔',
    cost: 80,
    damage: 20,
    range: 128,
    interval: 2.6,
    windup: 0.85,
    color: '#8fe6ff',
    detail: '寒冰蓄力 · 减速哆嗦',
  },
  ember: {
    name: '重装火炮',
    cost: 100,
    damage: 68,
    range: 145,
    interval: 3.6,
    windup: 1,
    color: '#ffc08a',
    detail: '炮口后坐 · 爆炸惊退',
  },
};
export const KINDS: TowerKind[] = ['arrow', 'frost', 'ember'];
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
  return {
    width: w,
    height: h,
    scale: Math.max(0.1, Math.min(width / w, height / h)) * zoom,
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
export type Tower = {
  slot: number;
  kind: TowerKind;
  level: number;
  cooldown: number;
  spent: number;
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
  gold: number;
  lives: number;
  wave: number;
  kills: number;
  status: 'ready' | 'battle' | 'won' | 'lost';
  paused: boolean;
  speed: number;
  towers: Tower[];
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
function makeTower(slot: number, kind: TowerKind): Tower {
  return {
    slot,
    kind,
    level: 1,
    cooldown: 0,
    spent: TYPES[kind].cost,
    phase: 'idle',
    phaseTime: 0,
    target: null,
    aim: [SLOTS[slot][0] + 50, SLOTS[slot][1]],
  };
}
export function newGame(): Game {
  return {
    gold: 260,
    lives: 20,
    wave: 0,
    kills: 0,
    status: 'ready',
    paused: false,
    speed: 1,
    towers: [makeTower(2, 'arrow')],
    enemies: [],
    shots: [],
    impacts: [],
    left: 0,
    spawn: 0,
    nextId: 0,
    spell: 0,
    flash: 0,
    time: 0,
    shake: 0,
    sounds: [],
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
  g.towers.push(makeTower(slot, kind));
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
  const hp = (60 + g.wave * 23) * (boss ? 5 : 1);
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
        g.gold += e.boss ? 65 : 14;
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
      damage: spec.damage * (1 + (t.level - 1) * 0.65),
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
    g.gold += 45;
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
