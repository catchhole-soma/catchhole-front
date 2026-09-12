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

// ===== AnalysisJob =====
export type AnalysisJobStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

export const PROCESSING_STATUS_LABELS: Record<EpisodeProcessingStatus, string> = {
  UPLOADED: '원문 저장 완료',
  CHUNKING: '원문 나누는 중',
  CHUNKED: '원문 정리 완료',
  PREPROCESSING: '내용 파악 중',
  PREPROCESSED: '내용 파악 완료',
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
