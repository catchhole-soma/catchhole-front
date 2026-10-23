import type { AnalysisJobResponse } from '../api/generated/types.gen';

export const SETTING_BOOK_PHASES: Record<string, string> = { CHUNKING: '원문 분할', SETTING_EXTRACTION: '인물 설정 추출',
  CHARACTER_FACT_COMPARISON: '인물 설정 비교', WORLD_SETTING_EXTRACTION: '세계관 설정 추출',
  WORLD_SETTING_COMPARISON: '세계관 설정 비교', SETTING_REVIEW: '설정 반영' };
export const SETTING_BOOK_FAILURE_REASONS: Record<NonNullable<AnalysisJobResponse['failureCode']>, string> = {
  AI_TOKEN_QUOTA_EXHAUSTED: '사용량 부족으로 중단됐습니다.',
  LLM_OUTPUT_TRUNCATED: '분석 응답이 끝까지 도착하지 않아 중단됐습니다.',
  LLM_NETWORK_ERROR: '분석 서비스와 연결하지 못해 중단됐습니다.',
  LLM_PROVIDER_ERROR: '분석 서비스에 문제가 생겨 중단됐습니다.',
  LLM_RESPONSE_PARSE_ERROR: '분석 응답을 읽지 못해 중단됐습니다.',
  COMPARISON_VALIDATION_FAILED: '비교 결과를 확인하지 못해 중단됐습니다.',
  WORKER_LEASE_EXPIRED: '분석을 처리하던 작업이 종료됐습니다.',
  UNEXPECTED_ERROR: '분석 중 문제가 발생했습니다.',
};

