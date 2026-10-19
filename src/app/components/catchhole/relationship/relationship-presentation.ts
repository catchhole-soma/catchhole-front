import type { RelationshipCandidateResponse, RelationshipResponse } from '../../../api/generated/types.gen';
import { toApiError } from '../../../lib/api-errors';

export type RelationshipKind = NonNullable<RelationshipCandidateResponse['kind']>;
export type RelationshipSubtype = NonNullable<RelationshipCandidateResponse['subtype']>;
export type RelationshipAssertion = NonNullable<RelationshipCandidateResponse['assertion']>;
export type RelationshipTime = NonNullable<RelationshipCandidateResponse['temporalScope']>;

export const KIND_LABELS: Record<RelationshipKind, string> = {
  PARENT_OF: '부모 → 자녀', CHILD_OF: '자녀 → 부모', SPOUSE: '배우자', SIBLING: '형제·자매',
};
export const SUBTYPE_LABELS: Record<RelationshipSubtype, string> = {
  UNSPECIFIED: '세부 관계 미상', BIOLOGICAL: '혈연', ADOPTIVE: '입양', STEP: '재혼으로 맺어진 가족',
  FULL: '양쪽 친생 부모가 같은 형제', HALF: '한쪽 친생 부모가 같은 형제',
};
export const ASSERTION_LABELS: Record<RelationshipAssertion, string> = {
  ASSERTED: '명시된 사실', UNCERTAIN: '확실하지 않음', NEGATED: '관계가 아니라고 명시됨',
  FIGURATIVE: '비유적 표현', CONFLICTING: '다른 내용과 충돌함',
};
export const TIME_LABELS: Record<RelationshipTime, string> = {
  CURRENT: '현재 관계', HISTORICAL: '과거 관계', UNKNOWN: '시점 확인 필요',
};
const REVIEW_LABELS: Record<string, string> = {
  UNRESOLVED_TARGET: '연결할 인물을 선택해 주세요.', AMBIGUOUS_TARGET: '같은 이름의 인물 중 대상을 확인해 주세요.',
  ARCHIVED_ENDPOINT: '보관된 인물이 있어 관계를 반영할 수 없어요.', SOURCE_CHANGED: '바탕이 된 설정이 바뀌었어요. 현재 설정을 다시 확인해 주세요.',
  UNCERTAIN: '가족 관계인지 확실한지 확인해 주세요.', NEGATED: '관계가 아니라는 내용이 포함되어 있어요.',
  FIGURATIVE: '가족에 빗댄 표현인지 확인해 주세요.', CONFLICTING: '서로 다른 가족 관계 내용이 있어요.',
  UNKNOWN_TEMPORAL_SCOPE: '현재 관계인지 과거 관계인지 확인해 주세요.',
  SELF_REFERENCE: '같은 인물끼리 연결되어 있어요. 상대 인물을 확인해 주세요.',
  PREVIOUSLY_WITHDRAWN: '이전에 철회한 관계예요. 다시 반영할 관계인지 확인해 주세요.',
  ANCESTRY_CYCLE: '기존 부모·자녀 연결과 순환할 수 있어요. 기존 관계를 확인한 뒤 검토 내용을 저장해 주세요.',
  CURRENT_VALUE_CONFLICT: '현재 설정의 표시 내용과 세부 내용이 서로 달라요.',
  UNSUPPORTED_STRUCTURED_CONTEXT: '복합 설정 안의 가족 관계를 직접 확인해 주세요.',
  UNSUPPORTED_FAMILY_SYNTAX: '가족 관계 표현을 직접 확인해 주세요.',
  INPUT_LIMIT_EXCEEDED: '가족 관계 내용이 길거나 많아 직접 확인이 필요해요.',
  CYCLE: '부모·자녀 관계가 서로 되돌아가는 연결인지 확인해 주세요.',
};
export const VALIDITY_LABELS: Record<NonNullable<RelationshipResponse['validity']>, string> = {
  VALID: '반영됨', REVIEW_REQUIRED: '현재 설정 확인 필요', ARCHIVED_ENDPOINT: '보관된 인물 포함', WITHDRAWN: '철회된 관계',
};

export function allowedSubtypes(kind: RelationshipKind): RelationshipSubtype[] {
  if (kind === 'SPOUSE') return ['UNSPECIFIED'];
  if (kind === 'SIBLING') return ['UNSPECIFIED', 'BIOLOGICAL', 'FULL', 'HALF', 'ADOPTIVE', 'STEP'];
  return ['UNSPECIFIED', 'BIOLOGICAL', 'ADOPTIVE', 'STEP'];
}

export function reviewMessage(reason: string): string {
  return REVIEW_LABELS[reason] ?? '관계 내용과 근거를 확인해 주세요.';
}

export function relationshipError(error: unknown, fallback: string): string {
  return toApiError(error)?.message ?? fallback;
}

export function currentSettingText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && !Array.isArray(value) && 'factValue' in value && typeof value.factValue === 'string') {
    return value.factValue;
  }
  return JSON.stringify(value);
}

export function positivePage(value: string | null): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed - 1 : 0;
}
