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
} from './game.ts';
const g = newGame();
assert.deepEqual(position(0), [40, -20]);
assert.deepEqual(position(LENGTH), [310, 412]);
assert.equal(build(g, 0, 'arrow'), false);
assert.equal(build(g, -1, 'arrow'), false);
assert.equal(build(g, 1, 'frost'), true);
assert.equal(g.gold, 100);
assert.equal(build(g, 2, 'ember'), true);
assert.equal(build(g, 3, 'arrow'), false);
assert.equal(startWave(g), true);
assert.equal(startWave(g), false);
g.paused = true;
const paused = JSON.stringify(g);
step(g, 1);
assert.equal(JSON.stringify(g), paused);
g.paused = false;
step(g, 0.1);
assert.equal(cast(g), true);
assert.equal(cast(g), false);
for (let i = 0; i < 20000 && g.status === 'battle'; i++) step(g, 0.05);
assert.equal(g.status, 'ready');
assert.ok(g.kills > 0);
assert.ok(g.gold > 0);
assert.equal(upgrade(g, 0), true);
assert.equal(g.towers[0].level, 2);
const refund = Math.floor(g.towers[0].spent * 0.7),
  before = g.gold;
assert.equal(sell(g, 0), true);
assert.equal(g.gold, before + refund);
const winner = newGame();
build(winner, 1, 'frost');
build(winner, 3, 'ember');
for (let wave = 1; wave <= 8; wave++) {
  for (const slot of [2, 4, 6, 5, 7])
    build(winner, slot, slot === 6 ? 'frost' : 'arrow');
  for (const tower of winner.towers) while (upgrade(winner, tower.slot)) {}
  assert.equal(startWave(winner), true);
  for (let ticks = 0; ticks < 20000 && winner.status === 'battle'; ticks++) {
    if (winner.enemies.length > 4) cast(winner);
    step(winner, 0.05);
  }
  assert.notEqual(winner.status, 'lost', `lost wave ${wave}`);
}
assert.equal(winner.status, 'won');
assert.equal(startWave(winner), false);
assert.equal(build(winner, 0, 'arrow'), false);
const loser = newGame();
loser.towers = [];
for (let wave = 0; wave < 3 && loser.status !== 'lost'; wave++) {
  startWave(loser);
  for (let ticks = 0; ticks < 10000 && loser.status === 'battle'; ticks++)
    step(loser, 0.05);
}
assert.equal(loser.status, 'lost');
assert.equal(loser.lives, 0);
console.log(
  `PASS: economy, input guards, movement, pause, skill cooldown, combat, victory (${winner.lives} lives), defeat.`,
);
