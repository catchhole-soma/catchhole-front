import {
  AnalysisJob,
  AnalysisJobType,
  Episode,
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
