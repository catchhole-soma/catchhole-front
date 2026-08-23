import type {
  CharacterDetailResponse,
  CharacterFactEvidenceResponse,
  CharacterSettingResponse,
  CharacterTimelineFactResponse,
  CharacterTimelineSummaryResponse,
  WorldSettingDetailResponse,
} from '../../api/generated/types.gen';

export type DemoEvidenceTone = 'character' | 'neutral' | 'world';

export type DemoManuscriptParagraph = {
  id: string;
  text: string;
  tone?: DemoEvidenceTone;
};

export type DemoCharacterName = '도리안 베일' | '리아 모렌' | '세리아 노크' | '에단 렌' | '카엘 로스크';
export type DemoCharacterSettingCategory = '스킬' | '스탯' | '아이템' | '프로필' | '상태';

export type DemoCharacterEvidence = {
  episode: number;
  episodeTitle: string;
  id: string;
  quote: string;
};

export type DemoCharacterSetting = {
  category: DemoCharacterSettingCategory;
  evidence?: DemoCharacterEvidence;
  settingName: string;
  updated?: boolean;
  value: string;
};

export type DemoCharacterTimelineFact = DemoCharacterSetting & {
  current: boolean;
  evidence: DemoCharacterEvidence;
};

export type DemoCharacterFixture = {
  age: string;
  firstEpisode: string;
  level: string;
  name: DemoCharacterName;
  representativeLabel: string;
  representativeValue: string;
  role: string;
  settings: DemoCharacterSetting[];
  timeline: DemoCharacterTimelineFact[];
  updated?: boolean;
};

export const INTERACTIVE_DEMO_MANUSCRIPT = {
  workTitle: '마나 0의 짐꾼',
  episode: '6화',
  title: '숨겨진 전직',
  fileName: '06화_숨겨진_전직.txt',
  paragraphs: [
    {
      id: 'opening',
      text: '거꾸로숲의 새벽은 늘 땅 아래에서 시작됐다. 검은 뿌리 사이로 붉은 해가 떠오르자 원정대가 멈춰 섰다.',
    },
    {
      id: 'formation',
      text: '세리아는 은월창으로 젖은 흙을 두 번 두드렸다. 선두의 정찰병들이 흩어지고, 에단은 대열 한가운데에서 균열석 운반대의 봉인을 다시 조였다.',
    },
    {
      id: 'warning',
      text: '“해가 완전히 떠오르기 전에 귀환문을 찾아야 해.” 도리안이 황동 단안경을 접으며 말했다. 어제까지 있던 길은 검은 뿌리에 삼켜져 흔적도 남지 않았다.',
    },
    {
      id: 'attack',
      text: '숲이 뒤집히듯 흔들리자 운반대 안의 재액이 한꺼번에 끓어올랐다. 에단은 달아나는 대신 손바닥을 봉인판에 얹고 재액 적재를 발동했다.',
    },
    {
      id: 'choice',
      text: '붉은 기운이 그의 팔을 타고 올라왔다. 마나가 없는 몸은 재액을 밀어내지 못했지만, 그 대신 흩어지는 저주를 하나의 무게로 받아 냈다.',
    },
    {
      id: 'character-evidence',
      tone: 'character',
      text: '“조건을 모두 충족했습니다. 전직을 확정합니다. 직업 변경: 짐꾼 → 재액 운반자.”',
    },
    {
      id: 'aftermath',
      text: '허공의 문장이 사라지자 운반대의 진동도 멎었다. 세리아는 에단의 팔에 번진 검은 문양을 확인하고 원정대 전원에게 후퇴 신호를 보냈다.',
    },
    {
      id: 'world-evidence',
      tone: 'world',
      text: '수호자의 이름이 지워지는 순간, 숲에 남아 있던 귀환문들이 일제히 빛을 잃었다.',
    },
    {
      id: 'weak-evidence',
      tone: 'neutral',
      text: '나뭇가지 사이로 검은 달이 떠 있었다. 에단은 이유를 알 수 없는 불길함을 느꼈다.',
    },
    {
      id: 'closing',
      text: '마지막 귀환문이 닫히기 직전, 리아가 반쯤 무너진 석문 너머에서 희미한 맥박을 찾아냈다. 원정대는 돌아갈 길 대신 숲의 중심부로 방향을 틀었다.',
    },
  ] satisfies DemoManuscriptParagraph[],
} as const;

export const INTERACTIVE_DEMO_ANALYSIS_PHASES = [
  '원문 저장 완료',
  '원문 청킹 중',
  '청크 저장 완료',
  'LLM 전처리 중',
  'LLM 전처리 완료',
  'AI 설정 추출 중',
  '설정 후보 생성 완료',
] as const;

export const INTERACTIVE_DEMO_CANDIDATES = {
  character: {
    id: 'character-job',
    type: '캐릭터',
    subject: '에단 렌',
    settingName: '직업',
    beforeValue: '짐꾼',
    proposedValue: '재액 운반자',
    evidence: '“전직을 확정합니다. 직업 변경: 짐꾼 → 재액 운반자.”',
    reasoning: '전직 조건 달성과 직업 변경이 원문에 명시되어 있어 현재 설정에 반영할 수 있습니다.',
  },
  world: {
    id: 'world-return-gate',
    type: '세계관',
    subject: '거꾸로숲',
    settingName: '귀환문의 조건',
    beforeValue: '없음',
    proposedValue: '수호자의 이름이 지워지면 귀환문이 닫힌다.',
    evidence: '“수호자의 이름이 지워지는 순간, 숲에 남아 있던 귀환문들이 일제히 빛을 잃었다.”',
    reasoning: '새로운 세계관 규칙이지만 대상과 범위를 조금 더 명확하게 다듬을 수 있습니다.',
  },
  unsupported: {
    id: 'world-black-moon',
    type: '세계관',
    subject: '검은 달',
    settingName: '징조',
    beforeValue: '없음',
    proposedValue: '검은 달은 왕실의 멸망을 예고한다.',
    evidence: '“나뭇가지 사이로 검은 달이 떠 있었다.”',
    reasoning: '검은 달이 등장했다는 사실만 확인되며 왕실의 멸망과 연결할 근거는 없습니다.',
  },
} as const;

export const INTERACTIVE_DEMO_CHARACTERS: DemoCharacterFixture[] = [
  {
    age: '27세', firstEpisode: '1화', level: '8', name: '에단 렌',
    representativeLabel: '직업', representativeValue: '재액 운반자', role: '주인공', updated: true,
    settings: [
      { category: '프로필', settingName: '직업', value: '재액 운반자', updated: true, evidence: { id: 'ethan-job-6', episode: 6, episodeTitle: '숨겨진 전직', quote: '“전직을 확정합니다. 직업 변경: 짐꾼 → 재액 운반자.”' } },
      { category: '프로필', settingName: '역할', value: '저주 운반 및 봉인', evidence: { id: 'ethan-role-6', episode: 6, episodeTitle: '숨겨진 전직', quote: '마나가 없는 몸은 재액을 밀어내지 못했지만, 그 대신 흩어지는 저주를 하나의 무게로 받아 냈다.' } },
      { category: '프로필', settingName: '소속', value: '백야 원정대 임시 협력자', evidence: { id: 'ethan-affiliation-4', episode: 4, episodeTitle: '백야의 계약', quote: '세리아는 에단에게 백야 원정대의 임시 인장을 건넸다.' } },
      { category: '스탯', settingName: '현재 레벨', value: '8', evidence: { id: 'ethan-level-6', episode: 6, episodeTitle: '숨겨진 전직', quote: '재액을 봉인한 대가로 에단의 등급 표식이 여덟 번째 눈금을 밝혔다.' } },
      { category: '스킬', settingName: '재액 적재', value: 'Lv.2 · 저주를 무게로 전환', evidence: { id: 'ethan-skill-5', episode: 5, episodeTitle: '무게 없는 저주', quote: '재액 적재의 두 번째 고리가 열리며 흩어진 저주가 운반대 안으로 빨려 들었다.' } },
      { category: '아이템', settingName: '균열석 운반대', value: '봉인 슬롯 3칸', evidence: { id: 'ethan-item-2', episode: 2, episodeTitle: '첫 운반', quote: '낡은 운반대에는 균열석을 고정할 봉인 슬롯이 세 칸 남아 있었다.' } },
      { category: '상태', settingName: '마나 회로', value: '폐쇄 · 자연 회복 불가', evidence: { id: 'ethan-status-1', episode: 1, episodeTitle: '마나 0의 짐꾼', quote: '측정구의 바늘은 끝내 움직이지 않았다. 에단의 마나 회로는 완전히 닫혀 있었다.' } },
    ],
    timeline: [
      { category: '프로필', settingName: '직업', value: '짐꾼', current: false, evidence: { id: 'ethan-job-1', episode: 1, episodeTitle: '마나 0의 짐꾼', quote: '길드 명부의 에단 옆에는 전투직이 아닌 짐꾼이라는 두 글자만 적혀 있었다.' } },
      { category: '상태', settingName: '마나 회로', value: '폐쇄 · 자연 회복 불가', current: true, evidence: { id: 'ethan-status-1', episode: 1, episodeTitle: '마나 0의 짐꾼', quote: '측정구의 바늘은 끝내 움직이지 않았다. 에단의 마나 회로는 완전히 닫혀 있었다.' } },
      { category: '아이템', settingName: '균열석 운반대', value: '봉인 슬롯 3칸', current: true, evidence: { id: 'ethan-item-2', episode: 2, episodeTitle: '첫 운반', quote: '낡은 운반대에는 균열석을 고정할 봉인 슬롯이 세 칸 남아 있었다.' } },
      { category: '프로필', settingName: '소속', value: '백야 원정대 임시 협력자', current: true, evidence: { id: 'ethan-affiliation-4', episode: 4, episodeTitle: '백야의 계약', quote: '세리아는 에단에게 백야 원정대의 임시 인장을 건넸다.' } },
      { category: '스킬', settingName: '재액 적재', value: 'Lv.2 · 저주를 무게로 전환', current: true, evidence: { id: 'ethan-skill-5', episode: 5, episodeTitle: '무게 없는 저주', quote: '재액 적재의 두 번째 고리가 열리며 흩어진 저주가 운반대 안으로 빨려 들었다.' } },
      { category: '프로필', settingName: '직업', value: '재액 운반자', current: true, updated: true, evidence: { id: 'ethan-job-6', episode: 6, episodeTitle: '숨겨진 전직', quote: '“전직을 확정합니다. 직업 변경: 짐꾼 → 재액 운반자.”' } },
      { category: '스탯', settingName: '현재 레벨', value: '8', current: true, evidence: { id: 'ethan-level-6', episode: 6, episodeTitle: '숨겨진 전직', quote: '재액을 봉인한 대가로 에단의 등급 표식이 여덟 번째 눈금을 밝혔다.' } },
    ],
  },
  {
    age: '31세', firstEpisode: '2화', level: '12', name: '세리아 노크',
    representativeLabel: '소속', representativeValue: '백야 원정대', role: '백야 원정대장',
    settings: [
      { category: '프로필', settingName: '직책', value: '백야 원정대장', evidence: { id: 'seria-role-2', episode: 2, episodeTitle: '첫 운반', quote: '백야 원정대장 세리아가 직접 선발 명부를 펼쳤다.' } },
      { category: '프로필', settingName: '소속', value: '백야 원정대', evidence: { id: 'seria-affiliation-2', episode: 2, episodeTitle: '첫 운반', quote: '그녀의 어깨에는 백야 원정대의 은빛 문장이 달려 있었다.' } },
      { category: '스탯', settingName: '현재 레벨', value: '12', evidence: { id: 'seria-level-4', episode: 4, episodeTitle: '백야의 계약', quote: '열두 개의 창 문양이 세리아의 발밑에서 차례로 빛났다.' } },
      { category: '스킬', settingName: '백야 진형', value: '반경 30m 방어 진형', evidence: { id: 'seria-skill-4', episode: 4, episodeTitle: '백야의 계약', quote: '세리아가 창끝을 세우자 대원들을 잇는 백야 진형이 펼쳐졌다.' } },
      { category: '아이템', settingName: '은월창', value: '귀환문 반응 감지', evidence: { id: 'seria-item-3', episode: 3, episodeTitle: '거꾸로숲', quote: '은월창의 홈이 푸르게 떨리며 가까운 귀환문의 방향을 가리켰다.' } },
      { category: '상태', settingName: '왼팔 흉터', value: '무저갱 관문 원정에서 발생', evidence: { id: 'seria-status-5', episode: 5, episodeTitle: '무게 없는 저주', quote: '왼팔의 오래된 흉터가 관문의 파장에 맞춰 다시 붉어졌다.' } },
    ],
    timeline: [
      { category: '프로필', settingName: '직책', value: '백야 원정대장', current: true, evidence: { id: 'seria-role-2', episode: 2, episodeTitle: '첫 운반', quote: '백야 원정대장 세리아가 직접 선발 명부를 펼쳤다.' } },
      { category: '아이템', settingName: '은월창', value: '귀환문 반응 감지', current: true, evidence: { id: 'seria-item-3', episode: 3, episodeTitle: '거꾸로숲', quote: '은월창의 홈이 푸르게 떨리며 가까운 귀환문의 방향을 가리켰다.' } },
      { category: '스킬', settingName: '백야 진형', value: '반경 30m 방어 진형', current: true, evidence: { id: 'seria-skill-4', episode: 4, episodeTitle: '백야의 계약', quote: '세리아가 창끝을 세우자 대원들을 잇는 백야 진형이 펼쳐졌다.' } },
      { category: '상태', settingName: '왼팔 흉터', value: '무저갱 관문 원정에서 발생', current: true, evidence: { id: 'seria-status-5', episode: 5, episodeTitle: '무게 없는 저주', quote: '왼팔의 오래된 흉터가 관문의 파장에 맞춰 다시 붉어졌다.' } },
    ],
  },
  {
    age: '54세', firstEpisode: '3화', level: '—', name: '도리안 베일',
    representativeLabel: '직업', representativeValue: '유적 감정사', role: '조력자',
    settings: [
      { category: '프로필', settingName: '직업', value: '유적 감정사', evidence: { id: 'dorian-job-3', episode: 3, episodeTitle: '거꾸로숲', quote: '왕립유물원 출신 감정사 도리안이 석문의 연대를 짚어 냈다.' } },
      { category: '프로필', settingName: '전 소속', value: '왕립유물원 제2연구실', evidence: { id: 'dorian-affiliation-3', episode: 3, episodeTitle: '거꾸로숲', quote: '그는 왕립유물원 제2연구실의 낡은 조사표를 꺼냈다.' } },
      { category: '스킬', settingName: '잔향 판독', value: '사물에 남은 마력 기억 해석', evidence: { id: 'dorian-skill-5', episode: 5, episodeTitle: '무게 없는 저주', quote: '도리안은 석판에 남은 마력의 잔향을 문장처럼 읽어 냈다.' } },
      { category: '아이템', settingName: '황동 단안경', value: '고대 문자 확대·파장 분리', evidence: { id: 'dorian-item-3', episode: 3, episodeTitle: '거꾸로숲', quote: '황동 단안경의 세 겹 렌즈가 겹치며 지워진 문자를 되살렸다.' } },
      { category: '상태', settingName: '시력', value: '왼눈 마력 시야 손상', evidence: { id: 'dorian-status-5', episode: 5, episodeTitle: '무게 없는 저주', quote: '도리안은 흐려진 왼눈 대신 단안경의 마지막 렌즈를 내렸다.' } },
    ],
    timeline: [
      { category: '프로필', settingName: '직업', value: '유적 감정사', current: true, evidence: { id: 'dorian-job-3', episode: 3, episodeTitle: '거꾸로숲', quote: '왕립유물원 출신 감정사 도리안이 석문의 연대를 짚어 냈다.' } },
      { category: '아이템', settingName: '황동 단안경', value: '고대 문자 확대·파장 분리', current: true, evidence: { id: 'dorian-item-3', episode: 3, episodeTitle: '거꾸로숲', quote: '황동 단안경의 세 겹 렌즈가 겹치며 지워진 문자를 되살렸다.' } },
      { category: '스킬', settingName: '잔향 판독', value: '사물에 남은 마력 기억 해석', current: true, evidence: { id: 'dorian-skill-5', episode: 5, episodeTitle: '무게 없는 저주', quote: '도리안은 석판에 남은 마력의 잔향을 문장처럼 읽어 냈다.' } },
    ],
  },
  {
    age: '23세', firstEpisode: '4화', level: '7', name: '리아 모렌',
    representativeLabel: '직업', representativeValue: '봉합술사', role: '원정대 의무관',
    settings: [
      { category: '프로필', settingName: '직업', value: '봉합술사', evidence: { id: 'lia-job-4', episode: 4, episodeTitle: '백야의 계약', quote: '리아는 끊어진 마력 회로까지 꿰매는 봉합술사였다.' } },
      { category: '프로필', settingName: '소속', value: '백야 원정대 의무반', evidence: { id: 'lia-affiliation-4', episode: 4, episodeTitle: '백야의 계약', quote: '의무반 완장을 찬 리아가 부상자 사이를 빠르게 오갔다.' } },
      { category: '스킬', settingName: '맥박 추적', value: '차폐 너머 생체 반응 감지', evidence: { id: 'lia-skill-6', episode: 6, episodeTitle: '숨겨진 전직', quote: '리아가 반쯤 무너진 석문 너머에서 희미한 맥박을 찾아냈다.' } },
      { category: '아이템', settingName: '은실 봉합침', value: '마력 회로 임시 연결', evidence: { id: 'lia-item-4', episode: 4, episodeTitle: '백야의 계약', quote: '은실 봉합침이 끊어진 회로의 양 끝을 임시로 이어 붙였다.' } },
      { category: '상태', settingName: '청각 과민', value: '맥박 추적 사용 후 심화', evidence: { id: 'lia-status-6', episode: 6, episodeTitle: '숨겨진 전직', quote: '맥박 추적을 거둔 뒤에도 리아는 작은 심장 소리마다 고개를 돌렸다.' } },
    ],
    timeline: [
      { category: '프로필', settingName: '직업', value: '봉합술사', current: true, evidence: { id: 'lia-job-4', episode: 4, episodeTitle: '백야의 계약', quote: '리아는 끊어진 마력 회로까지 꿰매는 봉합술사였다.' } },
      { category: '아이템', settingName: '은실 봉합침', value: '마력 회로 임시 연결', current: true, evidence: { id: 'lia-item-4', episode: 4, episodeTitle: '백야의 계약', quote: '은실 봉합침이 끊어진 회로의 양 끝을 임시로 이어 붙였다.' } },
      { category: '스킬', settingName: '맥박 추적', value: '차폐 너머 생체 반응 감지', current: true, evidence: { id: 'lia-skill-6', episode: 6, episodeTitle: '숨겨진 전직', quote: '리아가 반쯤 무너진 석문 너머에서 희미한 맥박을 찾아냈다.' } },
      { category: '상태', settingName: '청각 과민', value: '맥박 추적 사용 후 심화', current: true, evidence: { id: 'lia-status-6', episode: 6, episodeTitle: '숨겨진 전직', quote: '맥박 추적을 거둔 뒤에도 리아는 작은 심장 소리마다 고개를 돌렸다.' } },
    ],
  },
  {
    age: '29세', firstEpisode: '5화', level: '11', name: '카엘 로스크',
    representativeLabel: '소속', representativeValue: '회색 장막', role: '추적자',
    settings: [
      { category: '프로필', settingName: '소속', value: '회색 장막', evidence: { id: 'kael-affiliation-5', episode: 5, episodeTitle: '무게 없는 저주', quote: '회색 장막의 추적자 카엘이 무너진 회랑 끝에 모습을 드러냈다.' } },
      { category: '프로필', settingName: '목표', value: '에단의 재액 회수', evidence: { id: 'kael-goal-6', episode: 6, episodeTitle: '숨겨진 전직', quote: '카엘의 표식은 에단의 팔에 번진 재액 문양을 향하고 있었다.' } },
      { category: '스킬', settingName: '그림자 표식', value: '대상 위치를 3시간 추적', evidence: { id: 'kael-skill-5', episode: 5, episodeTitle: '무게 없는 저주', quote: '그림자 표식이 에단의 발밑에 붙어 이동 경로를 기록했다.' } },
      { category: '아이템', settingName: '무음 쇠뇌', value: '마력 반응 없는 단발 쇠뇌', evidence: { id: 'kael-item-5', episode: 5, episodeTitle: '무게 없는 저주', quote: '마력 파동도 소리도 없이 쇠뇌의 시위가 풀렸다.' } },
      { category: '상태', settingName: '귀환문 오염', value: '오른손부터 진행 중', evidence: { id: 'kael-status-6', episode: 6, episodeTitle: '숨겨진 전직', quote: '닫힌 귀환문의 검은 균열이 카엘의 오른손을 타고 번졌다.' } },
    ],
    timeline: [
      { category: '프로필', settingName: '소속', value: '회색 장막', current: true, evidence: { id: 'kael-affiliation-5', episode: 5, episodeTitle: '무게 없는 저주', quote: '회색 장막의 추적자 카엘이 무너진 회랑 끝에 모습을 드러냈다.' } },
      { category: '스킬', settingName: '그림자 표식', value: '대상 위치를 3시간 추적', current: true, evidence: { id: 'kael-skill-5', episode: 5, episodeTitle: '무게 없는 저주', quote: '그림자 표식이 에단의 발밑에 붙어 이동 경로를 기록했다.' } },
      { category: '상태', settingName: '귀환문 오염', value: '오른손부터 진행 중', current: true, evidence: { id: 'kael-status-6', episode: 6, episodeTitle: '숨겨진 전직', quote: '닫힌 귀환문의 검은 균열이 카엘의 오른손을 타고 번졌다.' } },
    ],
  },
];

export const INTERACTIVE_DEMO_WORLD_ROWS = [
  {
    category: '장소',
    subject: '거꾸로숲',
    settingName: '하늘과 땅의 방향',
    value: '해가 아래에서 뜨고 나무뿌리가 하늘을 향한다.',
    evidence: '3화',
  },
  {
    category: '장소',
    subject: '거꾸로숲',
    settingName: '귀환문의 조건',
    evidence: '6화',
  },
] as const;

const FACT_TYPE_BY_CATEGORY = {
  '프로필': 'PROFILE',
  '스탯': 'STAT',
  '스킬': 'SKILL',
  '아이템': 'ITEM',
  '상태': 'STATUS',
} as const;

const FACT_TYPE_LABELS = {
  PROFILE: '프로필',
  AGE: '나이',
  LEVEL: '레벨',
  STAT: '스탯',
  SKILL: '스킬',
  ITEM: '아이템',
  STATUS: '상태',
} as const;

const FACT_TYPE_ORDER = ['PROFILE', 'AGE', 'LEVEL', 'STAT', 'SKILL', 'ITEM', 'STATUS'] as const;

function numericLabel(value: string): number | null {
  const matched = value.match(/\d+/);
  return matched ? Number(matched[0]) : null;
}

function settingKey(category: DemoCharacterSettingCategory, settingName: string, index: number): string {
  if (category === '프로필' && settingName === '직업') return 'profile.occupation';
  if (category === '프로필' && settingName === '역할') return 'profile.role';
  if (category === '프로필' && settingName.includes('소속')) return 'profile.affiliation';
  if (category === '프로필' && settingName === '직책') return 'profile.position';
  if (category === '프로필' && settingName === '목표') return 'profile.goal';
  if (category === '스킬') return `skill.demo_${index}`;
  if (category === '아이템') return `item.demo_${index}`;
  if (category === '상태') return `status.demo_${index}`;
  return `stats.demo_${index}`;
}

function evidenceReference(evidence?: DemoCharacterEvidence) {
  return evidence ? [{
    characterFactId: evidence.id,
    sourceEpisodeId: `demo-episode-${evidence.episode}`,
    sourceEpisodeNo: evidence.episode,
    hasEvidence: true,
  }] : [];
}

function snapshotSetting(
  setting: DemoCharacterSetting,
  index: number,
): CharacterSettingResponse {
  const sourceFacts = evidenceReference(setting.evidence);
  return {
    characterFactId: sourceFacts[sourceFacts.length - 1]?.characterFactId ?? null,
    key: settingKey(setting.category, setting.settingName, index),
    displayName: setting.settingName,
    attributeNameEditable: false,
    attributeNamePrefix: null,
    displayNameEditable: false,
    value: setting.value,
    valueType: 'STRING',
    properties: [],
    hasEvidence: sourceFacts.length > 0,
    sourceFacts,
  };
}

function characterDetail(character: DemoCharacterFixture): CharacterDetailResponse {
  const currentLevelSetting = character.settings.find(setting => setting.settingName === '현재 레벨');
  const grouped = character.settings
    .filter(setting => setting.settingName !== '현재 레벨')
    .reduce<Record<DemoCharacterSettingCategory, CharacterSettingResponse[]>>((result, setting, index) => {
      result[setting.category].push(snapshotSetting(setting, index));
      return result;
    }, { '프로필': [], '스탯': [], '스킬': [], '아이템': [], '상태': [] });

  return {
    id: character.name,
    name: character.name,
    roleLabel: character.role,
    currentAge: numericLabel(character.age),
    currentLevel: numericLabel(character.level),
    currentLevelSourceFacts: evidenceReference(currentLevelSetting?.evidence),
    firstAppearanceEpisode: {
      id: `demo-episode-${numericLabel(character.firstEpisode) ?? 1}`,
      episodeNo: numericLabel(character.firstEpisode) ?? 1,
    },
    profile: grouped['프로필'],
    stats: grouped['스탯'],
    skills: grouped['스킬'],
    items: grouped['아이템'],
    statuses: grouped['상태'],
  };
}

function timelineFact(
  fact: DemoCharacterTimelineFact,
  index: number,
): CharacterTimelineFactResponse {
  const factType = fact.settingName === '현재 레벨'
    ? 'LEVEL'
    : FACT_TYPE_BY_CATEGORY[fact.category];
  return {
    characterFactId: fact.evidence.id,
    factType,
    factKey: factType === 'LEVEL' ? 'level' : settingKey(fact.category, fact.settingName, index),
    factTypeLabel: FACT_TYPE_LABELS[factType],
    displayName: fact.settingName,
    factValue: fact.value,
    sourceType: 'EPISODE',
    sourceEpisodeId: `demo-episode-${fact.evidence.episode}`,
    sourceEpisodeNo: fact.evidence.episode,
    hasEvidence: true,
  };
}

function timelineSummary(
  character: DemoCharacterFixture,
  facts: CharacterTimelineFactResponse[],
): CharacterTimelineSummaryResponse {
  const factTypeCounts = FACT_TYPE_ORDER.map(factType => ({
    factType,
    factTypeLabel: FACT_TYPE_LABELS[factType],
    count: facts.filter(fact => fact.factType === factType).length,
  }));
  const factFacets = FACT_TYPE_ORDER.flatMap(factType => {
    const matching = facts.filter(fact => fact.factType === factType);
    if (matching.length === 0) return [];
    const keys = new Map<string, { displayName: string; count: number }>();
    matching.forEach(fact => {
      if (!fact.factKey) return;
      const current = keys.get(fact.factKey) ?? {
        displayName: fact.displayName ?? fact.factKey,
        count: 0,
      };
      current.count += 1;
      keys.set(fact.factKey, current);
    });
    return [{
      factType,
      factTypeLabel: FACT_TYPE_LABELS[factType],
      count: matching.length,
      factKeys: [...keys].map(([factKey, value]) => ({ factKey, ...value })),
    }];
  });
  const episodeCounts = new Map<number, number>();
  facts.forEach(fact => {
    if (fact.sourceEpisodeNo == null) return;
    episodeCounts.set(fact.sourceEpisodeNo, (episodeCounts.get(fact.sourceEpisodeNo) ?? 0) + 1);
  });

  return {
    characterId: character.name,
    characterName: character.name,
    firstAppearanceEpisodeNo: numericLabel(character.firstEpisode),
    totalFactCount: facts.length,
    totalEpisodeCount: episodeCounts.size,
    appliedFactType: 'ALL',
    filteredFactCount: facts.length,
    factTypeCounts,
    factFacets,
    episodes: [...episodeCounts]
      .sort(([left], [right]) => right - left)
      .map(([episodeNo, factCount]) => ({
        episodeId: `demo-episode-${episodeNo}`,
        episodeNo,
        factCount,
      })),
    manualFactCount: 0,
  };
}

function evidenceResponse(evidence: DemoCharacterEvidence): CharacterFactEvidenceResponse {
  const lead = `${evidence.episode}화 · ${evidence.episodeTitle}\n\n`;
  const tail = '\n\n이후의 장면은 데모 원고에서 이어집니다.';
  const content = `${lead}${evidence.quote}${tail}`;
  const startOffset = [...lead].length;
  return {
    characterFactId: evidence.id,
    sourceCandidateId: `demo-candidate-${evidence.id}`,
    episode: {
      episodeId: `demo-episode-${evidence.episode}`,
      episodeNo: evidence.episode,
      title: evidence.episodeTitle,
    },
    content,
    evidenceSpans: [{
      quote: evidence.quote,
      startOffset,
      endOffset: startOffset + [...evidence.quote].length,
    }],
  };
}

export type InteractiveDemoCharacterTimeline = {
  facts: CharacterTimelineFactResponse[];
  summary: CharacterTimelineSummaryResponse;
};

export const INTERACTIVE_DEMO_CHARACTER_DETAILS = INTERACTIVE_DEMO_CHARACTERS.map(characterDetail);

export const INTERACTIVE_DEMO_CHARACTER_TIMELINES = Object.fromEntries(
  INTERACTIVE_DEMO_CHARACTERS.map(character => {
    const facts = character.timeline
      .map(timelineFact)
      .sort((left, right) => (right.sourceEpisodeNo ?? 0) - (left.sourceEpisodeNo ?? 0));
    return [character.name, { facts, summary: timelineSummary(character, facts) }];
  }),
) as Record<DemoCharacterName, InteractiveDemoCharacterTimeline>;

export const INTERACTIVE_DEMO_CHARACTER_EVIDENCE = Object.fromEntries(
  INTERACTIVE_DEMO_CHARACTERS.flatMap(character => [
    ...character.settings.flatMap(setting => setting.evidence ? [setting.evidence] : []),
    ...character.timeline.map(fact => fact.evidence),
  ]).map(evidence => [evidence.id, evidenceResponse(evidence)]),
) as Record<string, CharacterFactEvidenceResponse>;

export function createInteractiveDemoWorldSettings(worldValue: string): WorldSettingDetailResponse[] {
  const reviewedAt = new Date().toISOString();
  return [
    {
      id: 'demo-world-reverse-forest',
      workId: 'interactive-demo',
      category: 'LOCATION',
      subjectName: '거꾸로숲',
      propertyCount: 2,
      version: 1,
      updatedAt: reviewedAt,
      properties: [
        {
          scopeName: null,
          settingName: '하늘과 땅의 방향',
          value: '해가 아래에서 뜨고 나무뿌리가 하늘을 향한다.',
        },
        { scopeName: null, settingName: '귀환문의 조건', value: worldValue },
      ],
      propertyEvidence: [{
        scopeName: null,
        settingName: '귀환문의 조건',
        latestEvidence: {
          candidateId: INTERACTIVE_DEMO_CANDIDATES.world.id,
          operation: 'ADD',
          value: worldValue,
          sourceEpisodeId: 'demo-episode-6',
          sourceEpisodeNo: 6,
          evidenceSpans: [{ quote: INTERACTIVE_DEMO_CANDIDATES.world.evidence }],
          reviewedAt,
        },
        history: [],
      }],
    },
    {
      id: 'demo-world-abyss-gate',
      workId: 'interactive-demo',
      category: 'LOCATION',
      subjectName: '무저갱 관문',
      propertyCount: 2,
      version: 1,
      updatedAt: '2026-08-20T09:00:00+09:00',
      properties: [
        { scopeName: null, settingName: '통과 조건', value: '서약자의 인장이 있어야 관문이 열린다.' },
        { scopeName: null, settingName: '위치', value: '제3외곽 성벽 아래 폐쇄 구역' },
      ],
      propertyEvidence: [],
    },
    {
      id: 'demo-world-white-night',
      workId: 'interactive-demo',
      category: 'FACTION',
      subjectName: '백야 원정대',
      propertyCount: 1,
      version: 1,
      updatedAt: '2026-08-18T15:30:00+09:00',
      properties: [
        { scopeName: null, settingName: '임무', value: '재액 발생 지역의 조사와 봉쇄' },
      ],
      propertyEvidence: [],
    },
  ];
}
