import type {
  CharacterDetailResponse,
  CharacterSettingResponse,
  CharacterSettingUpdateRequest,
} from '../../../api/generated/types.gen';

type SettingValueType = CharacterSettingUpdateRequest['valueType'];

function setting(
  id: string,
  key: string,
  displayName: string,
  value: string,
  valueType: SettingValueType = 'STRING',
  properties: Array<{
    key: string;
    displayName: string;
    value: string;
    valueType?: SettingValueType;
  }> = [],
): CharacterSettingResponse {
  return {
    characterFactId: id,
    key,
    displayName,
    value,
    valueType,
    properties: properties.map(property => ({
      key: property.key,
      displayName: property.displayName,
      value: property.value,
      valueType: property.valueType ?? 'STRING',
    })),
    hasEvidence: true,
  };
}

const INITIAL_DEMO_CHARACTERS: CharacterDetailResponse[] = [
  {
    id: 'sua',
    name: '수아',
    roleLabel: '주인공',
    currentAge: 23,
    currentAgeFact: { characterFactId: 'sua-age', hasEvidence: true },
    currentLevel: 15,
    currentLevelFact: { characterFactId: 'sua-level', hasEvidence: true },
    firstAppearanceEpisode: { id: 'demo-episode-1', episodeNo: 1 },
    profile: [
      setting('sua-gender', 'profile.gender', '성별', '여성'),
      setting('sua-species', 'profile.species', '종족', '인간'),
      setting('sua-affiliation', 'profile.affiliation', '소속', '왕립 검술학교'),
      setting('sua-occupation', 'profile.occupation', '직업', '검사 지망생'),
      setting('sua-eye', 'profile.eye_color', '눈 색깔', '갈색'),
      setting('sua-description', 'profile.description', '설명', '왕립 검술학교에 재학 중인 검사 지망생'),
    ],
    stats: [
      setting('sua-strength', 'stats.strength', '근력', '42', 'NUMBER'),
      setting('sua-agility', 'stats.agility', '민첩', '58', 'NUMBER'),
      setting('sua-mana', 'stats.mana', '마력', '31', 'NUMBER'),
    ],
    skills: [
      setting('sua-skill-1', 'skill.basic_sword', '기본 검술', 'Lv.3', 'JSON', [
        { key: 'name', displayName: '이름', value: '기본 검술' },
        { key: 'level', displayName: '레벨', value: '3', valueType: 'NUMBER' },
      ]),
      setting('sua-skill-2', 'skill.magic_sense', '마력 감지', 'Lv.1', 'JSON', [
        { key: 'name', displayName: '이름', value: '마력 감지' },
        { key: 'level', displayName: '레벨', value: '1', valueType: 'NUMBER' },
      ]),
    ],
    items: [
      setting('sua-item-1', 'item.training_sword', '훈련용 검', '1개', 'JSON', [
        { key: 'name', displayName: '이름', value: '훈련용 검' },
        { key: 'quantity', displayName: '수량', value: '1', valueType: 'NUMBER' },
      ]),
      setting('sua-item-2', 'item.student_id', '학생증', '보유', 'JSON', [
        { key: 'name', displayName: '이름', value: '학생증' },
        { key: 'state', displayName: '상태', value: '보유' },
      ]),
    ],
    statuses: [
      setting('sua-status', 'status.normal', '정상', '정상', 'JSON', [
        { key: 'name', displayName: '이름', value: '정상' },
      ]),
    ],
  },
  {
    id: 'min', name: '강민준', roleLabel: '남자주인공', currentAge: 28, currentLevel: 21,
    firstAppearanceEpisode: { id: 'demo-episode-2', episodeNo: 2 },
    profile: [setting('min-job', 'profile.occupation', '직업', '왕실 기사')],
    stats: [], skills: [], items: [], statuses: [],
  },
  {
    id: 'lena', name: '이레나', roleLabel: '라이벌', currentAge: 24, currentLevel: 18,
    firstAppearanceEpisode: { id: 'demo-episode-3', episodeNo: 3 },
    profile: [setting('lena-job', 'profile.occupation', '직업', '마법 연구원')],
    stats: [], skills: [], items: [], statuses: [],
  },
];

export function createInitialDemoCharacters(): CharacterDetailResponse[] {
  return structuredClone(INITIAL_DEMO_CHARACTERS);
}
