import type { FamilyTreeInput, FamilyTreeInputEdge } from '../../src/app/components/catchhole/relationship/family-tree-layout';

export type FamilyTreeFixture = FamilyTreeInput & { id: string; label: string };

const person = (id: string, name: string) => ({ id, name });
const parent = (id: string, from: string, to: string, subtype = 'BIOLOGICAL'): FamilyTreeInputEdge =>
  ({ id, subjectCharacterId: from, objectCharacterId: to, kind: 'PARENT_OF', subtype, temporalScope: 'CURRENT' });
const spouse = (id: string, from: string, to: string, temporalScope = 'CURRENT'): FamilyTreeInputEdge =>
  ({ id, subjectCharacterId: from, objectCharacterId: to, kind: 'SPOUSE', subtype: 'UNSPECIFIED', temporalScope });
const sibling = (id: string, from: string, to: string, subtype = 'UNSPECIFIED'): FamilyTreeInputEdge =>
  ({ id, subjectCharacterId: from, objectCharacterId: to, kind: 'SIBLING', subtype, temporalScope: 'CURRENT' });

export const familyTreeFixtures: FamilyTreeFixture[] = [
  {
    id: 'ordinary', label: '일반 가족',
    nodes: [person('p1', '지훈'), person('p2', '수연'), person('c1', '도윤'), person('c2', '서윤')],
    edges: [spouse('r1', 'p1', 'p2'), { ...parent('r2', 'p1', 'c1'), subjectRole: 'FATHER', objectRole: 'SON' }, { ...parent('r3', 'p2', 'c1'), subjectRole: 'MOTHER', objectRole: 'SON' },
      { ...parent('r4', 'p1', 'c2'), subjectRole: 'FATHER', objectRole: 'DAUGHTER' }, { ...parent('r5', 'p2', 'c2'), subjectRole: 'MOTHER', objectRole: 'DAUGHTER' }, sibling('r6', 'c1', 'c2', 'FULL')],
  },
  {
    id: 'remarried', label: '재혼과 이복 형제',
    nodes: [person('p1', '지훈'), person('p2', '수연'), person('p3', '민서'), person('c1', '도윤'), person('c2', '서윤')],
    edges: [spouse('r1', 'p1', 'p2', 'HISTORICAL'), spouse('r2', 'p1', 'p3'), parent('r3', 'p1', 'c1'),
      parent('r4', 'p2', 'c1'), parent('r5', 'p1', 'c2'), parent('r6', 'p3', 'c2'), sibling('r7', 'c1', 'c2', 'HALF')],
  },
  {
    id: 'siblings-only', label: '부모가 확인되지 않은 형제',
    nodes: [person('c1', '도윤'), person('c2', '서윤'), person('c3', '하윤')],
    edges: [sibling('r1', 'c1', 'c2'), sibling('r2', 'c2', 'c3')],
  },
  {
    id: 'biological-adoptive', label: '친생 부모와 입양 부모 병존',
    nodes: [person('p1', '지훈'), person('p2', '수연'), person('p3', '민서'), person('p4', '현우'), person('c1', '도윤')],
    edges: [parent('r1', 'p1', 'c1'), parent('r2', 'p2', 'c1'), parent('r3', 'p3', 'c1', 'ADOPTIVE'),
      parent('r4', 'p4', 'c1', 'ADOPTIVE'), parent('r5', 'p1', 'c1', 'ADOPTIVE')],
  },
  {
    id: 'disconnected', label: '서로 분리된 가족과 독립 인물',
    nodes: [person('a1', '가람'), person('a2', '나래'), person('b1', '다온'), person('b2', '라온'), person('alone', '마루')],
    edges: [parent('r1', 'a1', 'a2'), spouse('r2', 'b1', 'b2')],
  },
  {
    id: 'cycle', label: '순환이 있는 관계',
    nodes: [person('a', '가람'), person('b', '나래'), person('c', '다온'), person('d', '라온')],
    edges: [parent('r1', 'a', 'b'), parent('r2', 'b', 'c'), parent('r3', 'c', 'a'), parent('r4', 'c', 'd')],
  },
  {
    id: 'generation-conflict', label: '같은 세대 정렬과 부모 방향 충돌',
    nodes: [person('a', '가람'), person('b', '나래'), person('c', '다온')],
    edges: [parent('r1', 'a', 'b'), parent('r2', 'b', 'c'), spouse('r3', 'a', 'c')],
  },
  {
    id: 'explicit-ancestry', label: '중간 계보가 생략된 조상과 후손',
    nodes: [person('a', '아르덴'), person('b', '비칼'), person('c', '에린')],
    edges: [
      { id: 'r1', subjectCharacterId: 'a', objectCharacterId: 'b', kind: 'ANCESTOR_OF',
        subtype: 'UNSPECIFIED', temporalScope: 'CURRENT', generationGap: 5 },
      { id: 'r2', subjectCharacterId: 'a', objectCharacterId: 'c', kind: 'ANCESTOR_OF',
        subtype: 'UNSPECIFIED', temporalScope: 'CURRENT', generationGap: null },
    ],
  },
  {
    id: 'mixed-ancestry', label: '자녀와 3대손·5대손·세대 미상 후손',
    nodes: [person('a', '아르덴'), person('b', '카엘'), person('c', '리아'), person('d', '로엔'), person('e', '비칼'), person('f', '에린')],
    edges: [
      { ...parent('r1', 'a', 'b'), objectRole: 'SON' },
      { ...parent('r2', 'a', 'c'), objectRole: 'DAUGHTER' },
      ...([{ id: 'r3', to: 'd', gap: 3 }, { id: 'r4', to: 'e', gap: 5 }, { id: 'r5', to: 'f', gap: null }]).map(item => ({
        id: item.id, subjectCharacterId: 'a', objectCharacterId: item.to, kind: 'ANCESTOR_OF' as const,
        generationGap: item.gap, subtype: 'UNSPECIFIED', temporalScope: 'CURRENT',
      })),
    ],
  },
];

export function createLargeFamilyFixture(size = 500): FamilyTreeFixture {
  const nodes = Array.from({ length: size }, (_, index) => person(`person-${String(index).padStart(4, '0')}`, `인물 ${index + 1}`));
  const edges = nodes.slice(1).map((node, index) => parent(`large-${index}`, nodes[Math.floor(index / 2)].id, node.id));
  return { id: 'large', label: `${size}명 경계`, nodes, edges };
}
