import {
  AnalysisJob, AnalysisJobType, DetectedEpisodeBoundary, Episode, SettingCandidate,
  SettingsExtractionCategory, UploadPurpose,
} from './types';

let idCounter = 1000;
const nextId = (prefix: string) => `${prefix}-${idCounter++}`;

export function mockDetectBoundaries(fileCount: number, startEpisodeNumber: number): DetectedEpisodeBoundary[] {
  const count = Math.max(3, Math.min(8, fileCount * 4));
  const previews = [
    '수아는 어두운 골목 끝에서 낯선 그림자를 발견했다.',
    '강민준은 서류 더미 속에서 결정적인 단서를 찾아냈다.',
    '이레나는 차가운 미소를 지으며 거래를 제안했다.',
    '법정에 들어선 수아는 깊게 숨을 들이쉬었다.',
    '오래된 사진 한 장이 모든 것을 뒤바꿔 놓았다.',
    '두 사람은 약속 장소에서 다시 마주쳤다.',
    '비밀스러운 편지가 책상 위에 놓여 있었다.',
    '폭풍이 몰아치는 밤, 사건은 새로운 국면을 맞았다.',
  ];

  return Array.from({ length: count }, (_, i) => {
    const startParagraph = i * 18 + 1;
    const endParagraph = startParagraph + 16 + (i % 3);
    return {
      tempId: nextId('boundary'),
      episodeNumber: startEpisodeNumber + i,
      title: `${startEpisodeNumber + i}화`,
      startParagraph,
      endParagraph,
      preview: previews[i % previews.length],
      charCount: 3500 + (i % 5) * 250,
      confirmed: true,
    };
  });
}

const MANUSCRIPT_FILLER_LINES = [
  '창밖으로 빗줄기가 가늘게 흩날리고 있었다.',
  '복도는 형광등 불빛 아래 길게 늘어져 있었다.',
  '그녀는 손끝으로 책상 위 서류를 천천히 정리했다.',
  '멀리서 사이렌 소리가 희미하게 들려왔다.',
  '아무도 입을 열지 않은 채 시간이 흘렀다.',
  '그는 창밖을 바라보며 깊은 생각에 잠겼다.',
  '낡은 시계가 정각을 알리며 종을 울렸다.',
  '복잡한 생각들이 머릿속을 스쳐 지나갔다.',
];

export function mockManuscriptParagraphs(boundaries: DetectedEpisodeBoundary[]): { number: number; text: string }[] {
  const total = boundaries.length > 0 ? boundaries[boundaries.length - 1].endParagraph : 0;
  const startMap = new Map(boundaries.map((b) => [b.startParagraph, b.preview]));
  return Array.from({ length: total }, (_, i) => {
    const number = i + 1;
    return { number, text: startMap.get(number) ?? MANUSCRIPT_FILLER_LINES[number % MANUSCRIPT_FILLER_LINES.length] };
  });
}

export function mockCreateEpisode(
  workId: string,
  episodeNumber: number,
  title: string,
  uploadPurpose: UploadPurpose,
): Episode {
  return {
    id: `episode-${episodeNumber}`,
    workId,
    episodeNumber,
    title: title || `${episodeNumber}화`,
    rawText: '',
    uploadPurpose,
    processingStatus: 'UPLOADED',
  };
}

export function mockCreateMultiFileEpisodes(
  workId: string,
  startEpisodeNumber: number,
  fileCount: number,
  uploadPurpose: UploadPurpose,
): Episode[] {
  return Array.from({ length: fileCount }, (_, i) => {
    const episodeNumber = startEpisodeNumber + i;
    return mockCreateEpisode(workId, episodeNumber, `${episodeNumber}화`, uploadPurpose);
  });
}

export const MOCK_SETTINGS_EXTRACTION: SettingsExtractionCategory[] = [
  { type: '캐릭터', count: 5, items: ['수아 (주인공)', '강민준 (남자주인공)', '이레나 (라이벌)'] },
  { type: '아이템', count: 3, items: ['증거 봉투', '법원 영장', '검사 배지'] },
  { type: '스킬', count: 4, items: ['반대심문', '증거 제출', '공판 개시'] },
  { type: '타임라인', count: 8, items: ['1화: 수아 등장', '3화: 강민준 등장', '23화: 갈색 눈 설정'] },
];

export function mockCreateAnalysisJob(episodeId: string, type: AnalysisJobType): AnalysisJob {
  return {
    id: nextId('job'),
    episodeId,
    type,
    status: 'PENDING',
    retryCount: 0,
  };
}

export const MOCK_SETTING_CANDIDATES: SettingCandidate[] = [
  {
    id: 'sc-13',
    episodeId: 'episode-160',
    characterName: '강민준',
    settingType: 'POSSESSION',
    settingKey: '보유 아이템',
    settingValue: '권총(분실), 수갑, 증거 사진',
    confidence: 0.39,
    evidenceChunk: { episodeNumber: 160, paragraph: 22, quote: '권총을 잃어버린 채로 수갑과 증거 사진만 챙겨 나왔다.' },
    reviewStatus: 'PENDING_REVIEW',
  },
  {
    id: 'sc-14',
    episodeId: 'episode-161',
    characterName: '수아',
    settingType: 'TIME_STATUS',
    settingKey: '시간 경과',
    settingValue: '3년 후 (나이 재계산 필요)',
    confidence: 0.45,
    evidenceChunk: { episodeNumber: 161, paragraph: 1, quote: '그로부터 3년이 지났다.' },
    reviewStatus: 'PENDING_REVIEW',
  },
  {
    id: 'sc-15',
    episodeId: 'episode-161',
    characterName: '강민준',
    settingType: 'NUMERIC_STATE',
    settingKey: '계급/직급',
    settingValue: '강력계 반장 (이전: 강력계 형사)',
    confidence: 0.52,
    evidenceChunk: { episodeNumber: 161, paragraph: 6, quote: '반장으로 진급한 민준의 책상에는 새 명패가 놓여 있었다.' },
    reviewStatus: 'PENDING_REVIEW',
  },
  {
    id: 'sc-1',
    episodeId: 'episode-159',
    characterName: '수아',
    settingType: 'CHARACTER_BASIC',
    settingKey: '눈동자 색',
    settingValue: '파란색',
    confidence: 0.92,
    evidenceChunk: { episodeNumber: 159, paragraph: 12, quote: '수아는 파란 눈을 깜빡이며 그를 올려다보았다.' },
    reviewStatus: 'PENDING_REVIEW',
  },
  {
    id: 'sc-2',
    episodeId: 'episode-159',
    characterName: '수아',
    settingType: 'NUMERIC_STATE',
    settingKey: '나이',
    settingValue: '27세',
    confidence: 0.81,
    evidenceChunk: { episodeNumber: 159, paragraph: 4, quote: '스물일곱 살이 된 수아는 검사 생활 3년 차였다.' },
    reviewStatus: 'PENDING_REVIEW',
  },
  {
    id: 'sc-3',
    episodeId: 'episode-159',
    characterName: '수아',
    settingType: 'POSSESSION',
    settingKey: '보유 아이템',
    settingValue: '검사 배지, 증거 봉투',
    confidence: 0.74,
    evidenceChunk: { episodeNumber: 159, paragraph: 20, quote: '그녀는 검사 배지와 증거 봉투를 챙겨 법원으로 향했다.' },
    reviewStatus: 'PENDING_REVIEW',
  },
  {
    id: 'sc-4',
    episodeId: 'episode-159',
    characterName: '강민준',
    settingType: 'CHARACTER_BASIC',
    settingKey: '소속',
    settingValue: '강력계 형사팀',
    confidence: 0.88,
    evidenceChunk: { episodeNumber: 159, paragraph: 7, quote: '강력계로 복귀한 민준은 새 사건 파일을 펼쳤다.' },
    reviewStatus: 'PENDING_REVIEW',
  },
  {
    id: 'sc-5',
    episodeId: 'episode-159',
    characterName: '강민준',
    settingType: 'TIME_STATUS',
    settingKey: '생사 여부',
    settingValue: '생존',
    confidence: 0.97,
    evidenceChunk: { episodeNumber: 159, paragraph: 33, quote: '민준은 가까스로 숨을 고르며 몸을 일으켰다.' },
    reviewStatus: 'CONFIRMED',
  },
  {
    id: 'sc-6',
    episodeId: 'episode-159',
    characterName: '이레나',
    settingType: 'NUMERIC_STATE',
    settingKey: '직급',
    settingValue: '수석 변호사',
    confidence: 0.69,
    evidenceChunk: { episodeNumber: 159, paragraph: 15, quote: '수석 변호사가 된 이레나는 여유로운 표정을 지었다.' },
    reviewStatus: 'PENDING_REVIEW',
  },
  {
    id: 'sc-7',
    episodeId: 'episode-159',
    characterName: '이레나',
    settingType: 'TIME_STATUS',
    settingKey: '관계 상태',
    settingValue: '수아와 대립',
    confidence: 0.65,
    evidenceChunk: { episodeNumber: 159, paragraph: 28, quote: '이레나는 수아를 정면으로 노려보며 말했다.' },
    reviewStatus: 'EDITED',
    editedValue: '수아와 일시적 대립',
  },
  {
    id: 'sc-8',
    episodeId: 'episode-159',
    characterName: '수아',
    settingType: 'EXTENDED',
    settingKey: '거주지',
    settingValue: '서울 종로구',
    confidence: 0.42,
    evidenceChunk: { episodeNumber: 159, paragraph: 2, quote: '집으로 돌아가는 길, 익숙한 골목이 눈에 들어왔다.' },
    reviewStatus: 'DISMISSED',
  },
  {
    id: 'sc-9',
    episodeId: 'episode-160',
    characterName: '수아',
    settingType: 'NUMERIC_STATE',
    settingKey: '체력',
    settingValue: '경상 (왼팔 부상)',
    confidence: 0.78,
    evidenceChunk: { episodeNumber: 160, paragraph: 9, quote: '수아는 욱신거리는 왼팔을 감싸 쥐었다.' },
    reviewStatus: 'PENDING_REVIEW',
  },
  {
    id: 'sc-10',
    episodeId: 'episode-160',
    characterName: '강민준',
    settingType: 'POSSESSION',
    settingKey: '보유 아이템',
    settingValue: '범행 도구 사진',
    confidence: 0.83,
    evidenceChunk: { episodeNumber: 160, paragraph: 18, quote: '민준은 범행 도구로 추정되는 사진을 품에 넣었다.' },
    reviewStatus: 'PENDING_REVIEW',
  },
  {
    id: 'sc-11',
    episodeId: 'episode-160',
    characterName: '이레나',
    settingType: 'CHARACTER_BASIC',
    settingKey: '별칭',
    settingValue: '얼음 변호사',
    confidence: 0.58,
    evidenceChunk: { episodeNumber: 160, paragraph: 3, quote: '사람들은 그녀를 \'얼음 변호사\'라 불렀다.' },
    reviewStatus: 'PENDING_REVIEW',
  },
  {
    id: 'sc-12',
    episodeId: 'episode-160',
    characterName: '수아',
    settingType: 'TIME_STATUS',
    settingKey: '시간 경과',
    settingValue: '사건 발생 후 5일',
    confidence: 0.71,
    evidenceChunk: { episodeNumber: 160, paragraph: 1, quote: '사건이 일어난 지 닷새가 지났다.' },
    reviewStatus: 'PENDING_REVIEW',
  },
];
