// ===== Episode =====
export type EpisodeProcessingStatus =
  | 'UPLOADED'
  | 'CHUNKING'
  | 'CHUNKED'
  | 'PREPROCESSING'
  | 'PREPROCESSED'
  | 'ANALYZING'
  | 'ANALYZED'
  | 'FAILED';

export type UploadPurpose = 'SETTING_EXTRACTION' | 'EPISODE_VALIDATION';

export interface Episode {
  id: string;
  workId: string;
  episodeNumber: number;
  title: string;
  rawText: string;
  uploadPurpose: UploadPurpose;
  processingStatus: EpisodeProcessingStatus;
}

// ===== AnalysisJob =====
export type AnalysisJobType = 'SETTING_EXTRACTION' | 'BASELINE_CONSISTENCY_CHECK' | 'EPISODE_VALIDATION';
export type AnalysisJobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

export interface AnalysisJob {
  id: string;
  episodeId: string;
  type: AnalysisJobType;
  status: AnalysisJobStatus;
  retryCount: number;
}

// ===== SettingCandidate =====
export type SettingCandidateType = 'CHARACTER_BASIC' | 'NUMERIC_STATE' | 'POSSESSION' | 'TIME_STATUS' | 'EXTENDED';
// 'CONFIRMED'/'DISMISSED'는 백엔드 CharacterReviewStatus와 이름을 맞춤(docs/character.md).
// 'EDITED'는 FE 전용 상태로, 저장 시 'CONFIRMED'로 매핑된다.
export type SettingCandidateReviewStatus = 'PENDING_REVIEW' | 'CONFIRMED' | 'EDITED' | 'DISMISSED';

export interface EvidenceChunk {
  episodeNumber: number;
  paragraph: number;
  quote: string;
}

export interface SettingCandidate {
  id: string;
  episodeId: string;
  characterName?: string;
  settingType: SettingCandidateType;
  settingKey: string;
  settingValue: string;
  editedValue?: string;
  confidence: number; // 0~1
  evidenceChunk: EvidenceChunk;
  reviewStatus: SettingCandidateReviewStatus;
}

// ===== 화면 전용 보조 타입 =====
export type EpisodeUploadMode = 'single' | 'bulk-single-file' | 'bulk-multi-file';

export interface SingleUploadForm {
  episodeNumber: string;
  title: string;
  file: File | null;
}

export interface DetectedEpisodeBoundary {
  tempId: string;
  episodeNumber: number;
  title: string;
  startParagraph: number;
  endParagraph: number;
  preview: string;
  charCount: number;
  confirmed: boolean;
}

export type EpisodeUploadStep = 'select-mode' | 'boundary-preview' | 'settings-review' | 'processing';

export interface SettingsExtractionCategory {
  type: string;
  count: number;
  items: string[];
}

export interface JobProgressItem {
  episodeId: string;
  episodeLabel: string;
  job: AnalysisJob;
  processingStatus: EpisodeProcessingStatus;
}

export type SettingGroupBy = 'character' | 'type' | 'none';
export type SettingReviewFilter = 'ALL' | SettingCandidateReviewStatus;

export const SETTING_TYPE_LABELS: Record<SettingCandidateType, string> = {
  CHARACTER_BASIC: '캐릭터 기본정보',
  NUMERIC_STATE: '수치형 상태',
  POSSESSION: '보유정보',
  TIME_STATUS: '시간·상태정보',
  EXTENDED: '확장 후보',
};

export const REVIEW_STATUS_LABELS: Record<SettingCandidateReviewStatus, string> = {
  PENDING_REVIEW: '검토 대기',
  CONFIRMED: '확정',
  EDITED: '수정 후 확정',
  DISMISSED: '무시',
};

export const PROCESSING_STATUS_LABELS: Record<EpisodeProcessingStatus, string> = {
  UPLOADED: '원문 저장 완료',
  CHUNKING: '원문 청킹 중',
  CHUNKED: '청크 저장 완료',
  PREPROCESSING: 'LLM 전처리 중',
  PREPROCESSED: 'LLM 전처리 완료',
  ANALYZING: 'AI 설정 추출 중',
  ANALYZED: '설정 후보 생성 완료',
  FAILED: '처리 실패',
};

export const JOB_STATUS_LABELS: Record<AnalysisJobStatus, string> = {
  PENDING: '대기',
  RUNNING: '실행 중',
  SUCCEEDED: '완료',
  FAILED: '실패',
  CANCELED: '취소됨',
};
