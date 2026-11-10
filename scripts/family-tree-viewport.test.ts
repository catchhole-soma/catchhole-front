import assert from 'node:assert/strict';
import test from 'node:test';
import { familyViewportAnchor, familyViewports, FAMILY_TREE_READABLE_ZOOM } from '../src/app/components/catchhole/relationship/family-tree-viewport';

const person = (id: string, x = 0, y = 0) => ({ id, name: id, position: { x, y }, width: 192, height: 88 });

test('small bounds fit completely while wide or tall bounds start at readable scale', () => {
  const anchor = person('a', 2500, 200);
  const small = familyViewports({ width: 400, height: 200 }, 1200, 580, anchor, false);
  assert.equal(small.needsFocus, false);
  assert.deepEqual(small.initial, small.overview);
  for (const bounds of [{ width: 5000, height: 200 }, { width: 400, height: 5000 }]) {
    const large = familyViewports(bounds, 1200, 580, anchor, false);
    assert.ok(large.overview.zoom < FAMILY_TREE_READABLE_ZOOM);
    assert.equal(large.initial.zoom, 1);
    assert.equal(large.initial.x + anchor.position.x + anchor.width / 2, 600);
    assert.equal(large.initial.y + anchor.position.y + anchor.height / 2, 256);
  }
});

test('the same family uses overview on desktop and readable focus on a narrow canvas', () => {
  const bounds = { width: 500, height: 300 }, anchor = person('a');
  assert.equal(familyViewports(bounds, 1200, 580, anchor, false).needsFocus, false);
  assert.equal(familyViewports(bounds, 256, 400, anchor, false).needsFocus, true);
  assert.equal(familyViewports(bounds, 1200, 580, anchor, true).needsFocus, true);
});

test('anchor honors explicit focus then unique family neighbors with stable ties', () => {
  const a = person('a'), b = person('b'), c = person('c');
  const edges = [{ source: 'a', target: 'b' }, { source: 'b', target: 'a' }, { source: 'b', target: 'c' }];
  assert.equal(familyViewportAnchor([a, b, c], edges, '')?.id, 'b');
  assert.equal(familyViewportAnchor([a, b, c], edges, 'c')?.id, 'c');
  assert.equal(familyViewportAnchor([b, a], edges.slice(0, 2), '')?.id, 'a');
  assert.equal(familyViewportAnchor([{ ...b, nodeType: 'MENTION' }, a], edges, '')?.id, 'a');
  assert.equal(familyViewportAnchor([], [], ''), undefined);
});
