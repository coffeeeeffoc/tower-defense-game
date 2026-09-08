import assert from 'node:assert/strict';
import {
  newGame,
  build,
  upgrade,
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
const g = newGame(),
  gold = g.gold;
assert.equal(build(g, 2, 'arrow'), false);
assert.equal(build(g, NaN, 'arrow'), false);
assert.equal(build(g, 31, 'arrow'), false);
assert.equal(build(g, 0, 'toString'), false);
assert.equal(g.gold, gold);
assert.ok(build(g, 0, 'frost'));
assert.equal(g.gold, gold - 80);
assert.ok(upgrade(g, 0));
assert.equal(g.gold, gold - 130);
const refund = Math.floor(g.towers.find((t) => t.slot === 0).spent * 0.7),
  before = g.gold;
assert.ok(sell(g, 0));
assert.equal(g.gold, before + refund);
g.gold = 0;
assert.equal(build(g, 0, 'arrow'), false);
assert.equal(upgrade(g, 2), false);
function duel(kind, afraid = kind, boss = false) {
  const battle = newGame();
  battle.towers = [];
  battle.gold = 100;
  build(battle, 10, kind);
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
build(winner, 10, 'ember');
build(winner, 11, 'frost');
for (let wave = 1; wave <= 8; wave++) {
  for (const slot of [
    9, 15, 18, 19, 4, 22, 25, 27, 0, 1, 3, 5, 6, 7, 8, 12, 13, 14, 16, 17, 20,
    21, 23, 24, 26, 28, 29, 30,
  ])
    build(
      winner,
      slot,
      slot % 4 === 0 ? 'frost' : slot % 3 === 0 ? 'ember' : 'arrow',
    );
  for (const t of winner.towers) while (upgrade(winner, t.slot)) {}
  assert.ok(startWave(winner));
  assert.equal(startWave(winner), false);
  for (let ticks = 0; ticks < 12000 && winner.status === 'battle'; ticks++) {
    if (winner.enemies.filter((e) => e.hp > 0).length > 4) cast(winner);
    step(winner, 0.05);
  }
  assert.notEqual(winner.status, 'lost', `wave ${wave}`);
}
assert.equal(winner.status, 'won');
assert.equal(winner.kills, 120);
assert.equal(startWave(winner), false);
assert.equal(build(winner, 30, 'arrow'), false);
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
  `PASS: 31 slots, portrait/landscape fits, economy, attack windup, delayed impacts, three knockbacks, weakness/fear, boss resistance, ice slow, cannon splash, pause, death accounting and 8-wave victory (${winner.lives} lives).`,
);
