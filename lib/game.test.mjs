import assert from 'node:assert/strict';
import {
  newGame,
  buy,
  refreshShop,
  moveGuardian,
  locate,
  unitAt,
  canMerge,
  benchDestination,
  saleValue,
  towerDamage,
  MAX_LEVEL,
  BENCH_SIZE,
  REFRESH_COST,
  sell,
  startWave,
  cast,
  step,
  position,
  LENGTH,
  SLOTS,
  TYPES,
  BOARD,
  boardFit,
  project,
  spawnEnemy,
  shotPosition,
} from './game.ts';
const advance = (g, seconds) => {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.05) step(g, 0.05);
};
assert.equal(SLOTS.length, 31);
assert.equal(new Set(SLOTS.map((p) => p.join(','))).size, 31);
assert.deepEqual(position(0), [-28, 110]);
assert.deepEqual(position(-5), position(0));
assert.deepEqual(position(LENGTH), [396, 628]);
for (const [w, h] of [
  [280, 250],
  [370, 430],
  [744, 600],
  [1080, 690],
  [2000, 1100],
])
  for (const wide of [true, false]) {
    const f = boardFit(w, h, wide);
    assert.ok(f.width * f.scale <= w + 0.001);
    assert.ok(f.height * f.scale <= h + 0.001);
    assert.equal(f.width / f.height, wide ? 600 / 480 : 480 / 600);
    for (const p of SLOTS) {
      const [x, y] = project(p, wide);
      assert.ok(x >= 0 && x < f.width && y >= 0 && y < f.height);
    }
  }
const owned = (g) => [...g.bench.filter(Boolean), ...g.towers];
const mass = (g) => owned(g).reduce((sum, u) => sum + 2 ** (u.level - 1), 0);
const unchanged = (g, fn) => {
  const snapshot = JSON.stringify(g);
  assert.equal(fn(), false);
  assert.equal(JSON.stringify(g), snapshot);
};
const g = newGame();
assert.equal(g.bench.length, BENCH_SIZE);
assert.equal(g.shop.length, 3);
const offer = g.shop[0],
  beforeBuy = g.gold;
assert.ok(buy(g, offer.id));
assert.equal(g.gold, beforeBuy - offer.price);
assert.equal(g.shop[0], null);
assert.equal(g.bench.filter(Boolean).length, 3);
unchanged(g, () => buy(g, offer.id));
const stale = g.shop[1].id,
  old = g.shop.map((o) => o?.kind);
const beforeRefresh = g.gold;
assert.ok(refreshShop(g));
assert.equal(g.gold, beforeRefresh - REFRESH_COST);
assert.notDeepEqual(
  g.shop.map((o) => o?.kind),
  old,
);
unchanged(g, () => buy(g, stale));
g.gold = 100000;
while (g.bench.some((u) => !u)) {
  for (const o of g.shop) if (o && g.bench.some((u) => !u)) buy(g, o.id);
  if (g.bench.some((u) => !u)) refreshShop(g);
}
assert.equal(owned(g).length, 7);
refreshShop(g);
unchanged(g, () => buy(g, g.shop[0].id));
const selling = g.bench[0],
  saleGold = g.gold;
assert.ok(sell(g, selling.id));
assert.equal(g.gold, saleGold + saleValue(selling));
unchanged(g, () => sell(g, selling.id));
g.gold = 0;
unchanged(g, () => buy(g, g.shop[0].id));
unchanged(g, () => refreshShop(g));
for (const sourceZone of ['bench', 'field'])
  for (const targetZone of ['bench', 'field']) {
    const b = newGame();
    b.bench = [
      { id: 1, kind: 'arrow', level: 1, spent: 60 },
      { id: 2, kind: 'arrow', level: 1, spent: 60 },
      null,
      null,
      null,
      null,
    ];
    b.towers = [];
    const source = { zone: sourceZone, slot: sourceZone === 'bench' ? 0 : 10 },
      target = { zone: targetZone, slot: targetZone === 'bench' ? 1 : 11 };
    if (sourceZone === 'field') assert.ok(moveGuardian(b, 1, source));
    if (targetZone === 'field') assert.ok(moveGuardian(b, 2, target));
    const gold = b.gold,
      weight = mass(b);
    assert.ok(moveGuardian(b, 1, target));
    assert.equal(owned(b).length, 1);
    assert.equal(unitAt(b, target).level, 2);
    assert.equal(unitAt(b, target).id, 2);
    assert.equal(unitAt(b, target).spent, 120);
    assert.equal(mass(b), weight);
    assert.equal(b.gold, gold);
    unchanged(b, () => moveGuardian(b, 1, target));
  }
for (const invalid of ['kind', 'level', 'max']) {
  const b = newGame();
  b.bench[1] = {
    id: 2,
    kind: invalid === 'kind' ? 'frost' : 'arrow',
    level: invalid === 'level' ? 2 : invalid === 'max' ? 4 : 1,
    spent: 60,
  };
  if (invalid === 'max') b.bench[0].level = 4;
  unchanged(b, () => moveGuardian(b, 1, { zone: 'bench', slot: 1 }));
}
const reloc = newGame();
unchanged(reloc, () => moveGuardian(reloc, 1, { zone: 'bench', slot: 0 }));
for (const target of [
  { zone: 'bench', slot: 6 },
  { zone: 'field', slot: 31 },
  { zone: 'field', slot: NaN },
  { zone: 'bad', slot: 0 },
])
  unchanged(reloc, () => moveGuardian(reloc, 1, target));
assert.ok(moveGuardian(reloc, 1, { zone: 'field', slot: 10 }));
assert.equal(reloc.bench[0], null);
assert.equal(locate(reloc, 1).at.zone, 'field');
assert.ok(moveGuardian(reloc, 1, { zone: 'bench', slot: 5 }));
assert.equal(locate(reloc, 1).at.slot, 5);
const auto = newGame();
assert.deepEqual(benchDestination(auto, 0), { zone: 'bench', slot: 0 });
assert.ok(moveGuardian(auto, 0, benchDestination(auto, 0)));
assert.equal(auto.bench[0].level, 2);
assert.equal(auto.towers.length, 0);
const cap = newGame();
cap.towers = [];
cap.bench.fill(null);
for (let level = 1; level < MAX_LEVEL; level++) {
  cap.bench[0] = { id: 20, kind: 'arrow', level, spent: 60 * 2 ** (level - 1) };
  cap.bench[1] = { id: 21, kind: 'arrow', level, spent: 60 * 2 ** (level - 1) };
  assert.ok(moveGuardian(cap, 21, { zone: 'bench', slot: 0 }));
  assert.equal(cap.bench[0].level, level + 1);
  assert.equal(cap.bench[0].spent, 60 * 2 ** level);
}
cap.bench[1] = { ...cap.bench[0], id: 22 };
unchanged(cap, () => moveGuardian(cap, 22, { zone: 'bench', slot: 0 }));
assert.ok(towerDamage('arrow', 2) > 2 * towerDamage('arrow', 1));
function duel(kind, afraid = kind, boss = false) {
  const battle = newGame();
  battle.towers = [];
  battle.gold = 100;
  battle.bench.fill(null);
  const offer = battle.shop.find((o) => o?.kind === kind);
  assert.ok(buy(battle, offer.id));
  assert.ok(
    moveGuardian(battle, battle.bench[0].id, { zone: 'field', slot: 10 }),
  );
  startWave(battle);
  battle.left = 0;
  const e = spawnEnemy(battle, boss);
  e.distance = 180;
  e.hp = e.maxHp = 1000;
  e.afraid = afraid;
  return { battle, e };
}
for (const kind of ['arrow', 'frost', 'ember']) {
  const { battle, e } = duel(kind);
  step(battle, 0.05);
  assert.equal(battle.towers[0].phase, 'aim');
  assert.equal(battle.shots.length, 0);
  assert.equal(e.hp, 1000);
  advance(battle, TYPES[kind].windup + 0.1);
  assert.equal(battle.towers[0].phase, 'recover');
  assert.equal(battle.shots.length, 1);
  assert.equal(e.hp, 1000, 'damage waits for projectile');
  const frozen = JSON.stringify(battle);
  battle.paused = true;
  const paused = JSON.stringify(battle);
  step(battle, 0.05);
  assert.equal(JSON.stringify(battle), paused);
  battle.paused = false;
  assert.equal(JSON.stringify(battle), frozen);
  const shot = battle.shots[0],
    snapshot = JSON.stringify(shot);
  for (const wide of [true, false]) {
    shotPosition(shot, wide);
    shotPosition(shot, wide);
  }
  assert.equal(
    JSON.stringify(shot),
    snapshot,
    'rendering must never mutate projectile coordinates',
  );
  for (let i = 0; i < 30 && e.hp === 1000; i++) step(battle, 0.05);
  assert.ok(e.hp < 1000);
  assert.equal(e.reaction, kind);
  assert.ok(e.retreat > 0);
  assert.ok(e.hurt > 0);
  const atHit = e.distance;
  step(battle, 0.05);
  assert.ok(e.distance < atHit, 'weapon impact must move enemy backwards');
  if (kind === 'frost') assert.ok(e.slow > 2);
  if (kind === 'ember') assert.ok(battle.shake > 0);
}
function impact(kind, afraid, boss = false) {
  const { battle, e } = duel(kind, afraid, boss);
  battle.towers = [];
  battle.shots.push({
    id: 999,
    kind,
    from: [150, 190],
    to: position(e.distance),
    target: e.id,
    elapsed: 0.7,
    duration: 0.71,
    damage: 30,
  });
  step(battle, 0.05);
  return { battle, e };
}
const strong = impact('arrow', 'arrow'),
  normal = impact('arrow', 'ember'),
  boss = impact('arrow', 'arrow', true);
assert.ok(strong.e.retreat > normal.e.retreat);
assert.ok(strong.e.hp < normal.e.hp);
assert.ok(boss.e.retreat < strong.e.retreat);
assert.ok(strong.e.panic > 0);
const splash = duel('ember');
const neighbor = spawnEnemy(splash.battle);
neighbor.distance = splash.e.distance + 20;
neighbor.hp = 500;
splash.battle.towers = [];
splash.battle.shots.push({
  id: 999,
  kind: 'ember',
  from: [150, 190],
  to: position(splash.e.distance),
  target: splash.e.id,
  elapsed: 0.7,
  duration: 0.71,
  damage: 30,
});
step(splash.battle, 0.05);
assert.ok(neighbor.hp < 500, 'cannon splash hits adjacent enemies');
const cold = duel('frost');
assert.ok(cast(cold.battle));
assert.equal(cast(cold.battle), false);
assert.ok(cold.e.slow > 0);
cold.battle.towers = [];
advance(cold.battle, 1);
assert.ok(cold.battle.spell > 20);
const killed = duel('arrow');
killed.e.hp = 1;
cast(killed.battle);
const beforeDeath = killed.battle.gold;
step(killed.battle, 0.05);
assert.equal(killed.battle.gold, beforeDeath + 14);
step(killed.battle, 0.05);
assert.equal(killed.battle.gold, beforeDeath + 14, 'death pays exactly once');
assert.ok(killed.e.fall > 0, 'defeat pose stays visible');
const winner = newGame();
const slots = [
  10, 11, 9, 12, 4, 13, 18, 19, 16, 17, 20, 0, 1, 3, 5, 6, 7, 8, 14, 15, 21, 22,
  23, 24, 25, 26, 27, 28, 29, 30,
];
function deployHall(g) {
  for (const u of [...g.bench])
    if (u) {
      const match = g.towers.find((t) => canMerge(u, t));
      const slot =
        match?.slot ??
        slots.find((slot) => !g.towers.some((t) => t.slot === slot));
      if (slot !== undefined) moveGuardian(g, u.id, { zone: 'field', slot });
    }
}
for (let wave = 1; wave <= 8; wave++) {
  deployHall(winner);
  for (let tries = 0; tries < 20; tries++) {
    let bought = false;
    for (const offer of winner.shop)
      if (offer && winner.gold >= offer.price && winner.bench.some((u) => !u)) {
        buy(winner, offer.id);
        bought = true;
        deployHall(winner);
      }
    if (winner.gold < REFRESH_COST + 60) break;
    if (!bought || winner.shop.every((o) => !o)) refreshShop(winner);
    else break;
  }
  assert.ok(startWave(winner));
  assert.equal(startWave(winner), false);
  for (let ticks = 0; ticks < 15000 && winner.status === 'battle'; ticks++) {
    if (winner.enemies.filter((e) => e.hp > 0).length > 4) cast(winner);
    step(winner, 0.05);
  }
  assert.notEqual(winner.status, 'lost', 'wave ' + wave);
}
assert.equal(winner.status, 'won');
assert.equal(startWave(winner), false);
unchanged(winner, () => refreshShop(winner));
unchanged(winner, () => sell(winner, winner.towers[0].id));
const loser = newGame();
loser.towers = [];
for (let w = 0; w < 3 && loser.status !== 'lost'; w++) {
  startWave(loser);
  for (let t = 0; t < 14000 && loser.status === 'battle'; t++)
    step(loser, 0.05);
}
assert.equal(loser.status, 'lost');
assert.equal(loser.lives, 0);
console.log(
  `PASS: shop purchase/refresh/capacity/stale IDs, all four merge directions, level cap, atomic invalid moves, sale conservation, responsive coordinates, combat effects and 8-wave victory (${winner.lives} lives).`,
);
