import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { newGame, unitAt, locate, TYPES, boardFit, SLOTS, project } from './game.ts';
const source = ts.createSourceFile('page.tsx', fs.readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
function visit(node) { if (ts.isFunctionDeclaration(node) && node.name?.text === 'clickPlace') handler = node.getText(source); ts.forEachChild(node, visit); }
visit(source);
const game = newGame();
const before = JSON.stringify(game);
const context = { live: { current: game }, selected: null, suppressClick: { current: 0 }, performance, unitAt, locate, TYPES, setMessage() {}, setSelected(id) { context.selected = id; }, transfer() { assert.fail('Click must never move or merge a guardian'); } };
vm.createContext(context);
vm.runInContext(ts.transpile(handler), context);
context.clickPlace({ zone: 'field', slot: 2 });
assert.equal(context.selected, 0);
context.clickPlace({ zone: 'field', slot: 3 });
assert.equal(context.selected, null);
context.clickPlace({ zone: 'field', slot: 2 });
context.clickPlace({ zone: 'bench', slot: 0 });
assert.equal(context.selected, 1);
assert.equal(JSON.stringify(game), before);
for (const wide of [false, true]) {
  const fit = boardFit(370, 430, wide);
  assert.ok(fit.renderHeight * fit.scale <= 430);
  for (const p of SLOTS) assert.ok(project(p, wide)[1] + fit.topPadding >= 125, 'Top row must fit a level 4 guard');
}
console.log('Click-only selection and top-row clearance passed');
