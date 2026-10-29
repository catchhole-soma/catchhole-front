import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutEpisodeRelationships, PERSON_WIDTH, PERSON_HEIGHT, type EpisodeConnection } from '../src/app/components/catchhole/relationship/episode-relationship-layout';

const edge = (id: string, source: string, target: string): EpisodeConnection => ({ id, source, target, label: '신뢰', summary: '', direction: 'DIRECTED', ended: false });

test('dense star plus disconnected components preserve every node without card overlap', () => {
  const people = Array.from({ length: 35 }, (_, index) => ({ id: String(index), name: `인물 ${index}` }));
  const connections = people.slice(1, 30).map(person => edge(`r${person.id}`, '0', person.id));
  const { positions } = layoutEpisodeRelationships(people, connections, '0');
  assert.equal(positions.size, people.length);
  const cards = [...positions.values()];
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    assert.ok(Math.abs(cards[i].x - cards[j].x) >= PERSON_WIDTH || Math.abs(cards[i].y - cards[j].y) >= PERSON_HEIGHT, `overlap ${i}, ${j}`);
  }
});

test('layout is deterministic despite API node and edge ordering', () => {
  const people = ['c', 'b', 'a', 'd'].map(id => ({ id, name: id }));
  const edges = [edge('1', 'a', 'b'), edge('2', 'b', 'c')];
  const first = layoutEpisodeRelationships(people, edges);
  const second = layoutEpisodeRelationships([...people].reverse(), [...edges].reverse());
  assert.deepEqual(first.positions, second.positions);
});

test('reciprocal attitudes and another relation retain distinct lanes and IDs', () => {
  const people = ['a', 'b'].map(id => ({ id, name: id }));
  const edges = [edge('trust', 'a', 'b'), edge('fear', 'b', 'a'), edge('colleague', 'a', 'b')];
  const { lanes } = layoutEpisodeRelationships(people, edges);
  assert.equal(lanes.size, 3);
  assert.equal(new Set(lanes.values()).size, 3);
  assert.deepEqual(edges.map(item => item.direction), ['DIRECTED', 'DIRECTED', 'DIRECTED']);
});
