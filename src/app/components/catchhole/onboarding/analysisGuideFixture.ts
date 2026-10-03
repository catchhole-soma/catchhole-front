import type { CharacterSummaryResponse, SettingCandidateResponse } from '../../../api/generated/types.gen';

// 안내 전용 로컬 예시. 실제 작품·대상 ID와 연결하거나 Query 캐시에 넣지 않는다.
export const guideCharacters: CharacterSummaryResponse[] = [
  { id: 'guide-leon', name: '레온', firstAppearanceEpisodeNo: 1, representativeAttributeLabel: '직업', representativeAttributeValue: '북부 원정대 정찰병' },
  { id: 'guide-yuna', name: '유나', firstAppearanceEpisodeNo: 1, representativeAttributeLabel: '직업', representativeAttributeValue: '약초사' },
];

const base: SettingCandidateResponse = {
  episodeNo: 2, entityType: 'CHARACTER', entityName: '레온', rawEntityMention: '레온',
  matchStatus: 'MATCHED', matchedCharacterId: 'guide-leon', candidateKind: 'SETTING',
  valueType: 'STRING', confidence: 0.9, reviewStatus: 'PENDING_REVIEW',
  attributeNameEditable: false, valueValidation: { status: 'VALID', repairable: false }, automaticApplicationPending: false,
  comparisonStatus: 'COMPLETED', suggestedOperation: 'ADD', comparisonRevision: 'guide',
  comparisonReason: '원문에서 확인한 새로운 설정입니다.',
};
export const guideCandidates: SettingCandidateResponse[] = [
  { ...base, id: 'guide-species', attributeName: 'profile.species', attributeValue: '엘프',
    evidenceSpans: [{ quote: '레온은 엘프였다.' }] },
  { ...base, id: 'guide-occupation', attributeName: 'profile.occupation',
    attributeValue: '북부 원정대 정찰병', suggestedOperation: 'UPDATE',
    proposedFactValue: '북부 원정대 정찰병', comparisonTargetFactKey: 'profile.occupation',
    comparisonReason: '레온이 현재 맡은 직업이 바뀌어 새로운 직업으로 반영합니다.',
    snapshotChanges: [{ action: 'UPSERT', factKey: 'profile.occupation',
      beforeFactValue: '왕국 정찰병', proposedFactValue: '북부 원정대 정찰병' }],
    evidenceSpans: [{ quote: '왕국을 떠난 레온은 이제 북부 원정대의 정찰병으로 일했다.' }] },
  { ...base, id: 'guide-healing', entityName: '인물 미상', matchedCharacterId: null,
    attributeName: 'skills.치유', attributeValue: '상처를 치유한다.', rawEntityMention: '그',
    matchStatus: 'AMBIGUOUS', comparisonStatus: 'WAITING_FOR_CHARACTER_MATCH', suggestedOperation: null,
    automaticReviewHoldReason: 'SUBJECT_RESOLUTION_FAILED', manualReviewAvailable: false,
    comparisonReason: null,
    evidenceSpans: [{ quote: '레온과 유나가 동굴에 들어섰다. 그는 손끝으로 상처를 아물게 했다.' }] },
];
