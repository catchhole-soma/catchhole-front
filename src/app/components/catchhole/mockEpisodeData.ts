import {
  AnalysisJob, AnalysisJobType, Episode, SettingCandidate,
  SettingsExtractionCategory,
} from './types';

let idCounter = 1000;
const nextId = (prefix: string) => `${prefix}-${idCounter++}`;

export function mockCreateEpisode(
  workId: string,
  episodeNumber: number,
  title: string,
  analysisJobType: AnalysisJobType,
): Episode {
  return {
    id: `episode-${episodeNumber}`,
    workId,
    episodeNumber,
    title: title || `${episodeNumber}화`,
    rawText: '',
    analysisJobType,
    processingStatus: 'UPLOADED',
  };
}

export function mockCreateMultiFileEpisodes(
  workId: string,
  startEpisodeNumber: number,
  fileCount: number,
  analysisJobType: AnalysisJobType,
): Episode[] {
  return Array.from({ length: fileCount }, (_, i) => {
    const episodeNumber = startEpisodeNumber + i;
    return mockCreateEpisode(workId, episodeNumber, `${episodeNumber}화`, analysisJobType);
  });
}

export const MOCK_SETTINGS_EXTRACTION: SettingsExtractionCategory[] = [
  { type: '캐릭터', count: 5, items: ['수아 (주인공)', '강민준 (남자주인공)', '이레나 (라이벌)'] },
  { type: '아이템', count: 3, items: ['증거 봉투', '법원 영장', '검사 배지'] },
  { type: '스킬', count: 4, items: ['반대심문', '증거 제출', '공판 개시'] },
  { type: '타임라인', count: 8, items: ['1화: 수아 등장', '3화: 강민준 등장', '23화: 갈색 눈 설정'] },
];

export function mockCreateAnalysisJob(
  episodeId: string,
  jobType: AnalysisJobType,
): AnalysisJob {
  return {
    id: nextId('job'),
    episodeId,
    jobType,
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
