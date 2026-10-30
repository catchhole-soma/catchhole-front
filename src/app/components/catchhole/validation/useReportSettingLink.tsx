import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQueryClient, type Query } from '@tanstack/react-query';
import type { SetURLSearchParams } from 'react-router';
import {
  correctValidationBaselineSettingMutation,
  getEpisodeValidationStagingOptions,
} from '../../../api/generated/@tanstack/react-query.gen';
import type {
  CharacterCorrection,
  CharacterDetailResponse,
  CharacterUpdateRequest,
  ValidationCorrectionRequest,
  WorldSettingPropertyUpdateRequest,
} from '../../../api/generated/types.gen';
import { toApiError } from '../../../lib/api-errors';
import { ReportReturnNotice } from './ValidationReturnNotice';
import {
  CORRECTION_PARAM_KEYS,
  CORRECTION_RECEIPT_KEY,
  CORRECTION_RESULT_KEY,
  readCorrectionContext,
  readReportReturn,
  REPORT_VIEW_SUBJECT,
  type CorrectionContext,
  type ReportReturn,
} from './validation-return';

type Slot = Pick<CharacterCorrection, 'factType' | 'factKey'>;
type Tone = 'info' | 'success' | 'warning' | 'danger';
type Feedback = { signature: string; tone: Tone; text: string };

type SaveBinding<TSubmit> = {
  /** `link`: 저장을 정정 요청(설정 편집+receipt 한 트랜잭션)으로 보낸다. `plain`: 정정이 거절된 뒤 기준 연결 없이 일반 저장한다. */
  mode: 'link' | 'plain';
  pending: boolean;
  submit: TSubmit;
  /** `plain` 일반 저장 성공. 결과 안내로 바꾸고 상세 편집을 닫는다. */
  onPlainSaved: () => void;
};

/** 오류 리포트에서 연 캐릭터 상세에 붙이는 안내와 정정 저장. 이 캐릭터에만 적용한다. */
export type CharacterCorrectionBinding = {
  targetId: string;
  notice: ReactNode;
  save?: SaveBinding<(edit: CharacterUpdateRequest, detail: CharacterDetailResponse) => Promise<boolean>>;
};

/** 오류 리포트에서 연 세계관 상세에 붙이는 안내와 정정 저장. path가 있으면 그 저장 설정만 정정한다. */
export type WorldCorrectionBinding = {
  targetId: string;
  notice: ReactNode;
  path: { scopeName: string | null; settingName: string } | null;
  save?: SaveBinding<(edit: Omit<WorldSettingPropertyUpdateRequest, 'version'>) => Promise<boolean>>;
};

const GROUPS = [
  ['profile', 'PROFILE'], ['stats', 'STAT'], ['skills', 'SKILL'], ['items', 'ITEM'], ['statuses', 'STATUS'],
] as const;
const text = (value?: string | null) => value?.trim() || null;
const signatureOf = (value: string | null | undefined, properties: Array<{ key?: string; value?: string | null }> | undefined) => (
  JSON.stringify([text(value), (properties ?? []).map(property => [property.key ?? '', text(property.value)])])
);

/**
 * 작가가 바꾼 캐릭터 slot. 서버는 정정 slot 하나 외의 추가·삭제·값 변경과 이름·역할·첫 등장 변경을 거절하므로
 * 요청 전에 같은 기준으로 확인해 안내한다(Backend CharacterServiceImpl.correctCharacterSetting).
 */
function characterEditSlots(detail: CharacterDetailResponse, edit: CharacterUpdateRequest) {
  const changed: Slot[] = [];
  if ((detail.currentAge ?? null) !== (edit.currentAge ?? null)) changed.push({ factType: 'AGE', factKey: 'age' });
  if ((detail.currentLevel ?? null) !== (edit.currentLevel ?? null)) changed.push({ factType: 'LEVEL', factKey: 'level' });
  for (const [group, factType] of GROUPS) {
    const before = new Map((detail[group] ?? []).flatMap(item => item.key ? [[item.key, signatureOf(item.value, item.properties)] as const] : []));
    const after = new Map(edit[group].map(item => [item.key, signatureOf(item.value, item.properties)] as const));
    for (const key of new Set([...before.keys(), ...after.keys()])) {
      if (before.get(key) !== after.get(key)) changed.push({ factType, factKey: key });
    }
  }
  const basicChanged = text(detail.name) !== text(edit.name) || text(detail.roleLabel) !== text(edit.roleLabel)
    || (detail.firstAppearanceEpisode?.episodeNo ?? null) !== (edit.firstAppearanceEpisodeNo ?? null);
  return { changed, basicChanged };
}

function newIdempotencyKey() {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `validation-correction-${random}`;
}

const STATE_UNKNOWN_COPY = '오류 리포트의 현재 상태를 확인하지 못했어요. 입력한 내용은 그대로예요. 잠시 후 다시 저장해 주세요.';
const CONFLICT_COPY = '검수 기준과 지금 저장된 설정이 달라 정정으로 저장하지 못했어요. 입력한 내용은 그대로예요. 다시 저장하면 검수 기준과 연결하지 않고 저장해요.';
const RETIRED_COPY = '이 오류 리포트는 이미 새 검수로 바뀌어 정정으로 연결할 수 없어요. 입력한 내용은 그대로예요. 다시 저장하면 검수 기준과 연결하지 않고 저장해요.';
const LOST_COPY = '정정 결과를 확인하지 못했어요. 입력한 내용은 그대로예요. 다시 저장하면 같은 요청으로 확인해요.';

type PendingRequest = { target: string; request: Omit<ValidationCorrectionRequest, 'idempotencyKey'>; key: string };
/** 정정 요청 결과. `plain`이면 이 정정 문맥에서는 다음 저장부터 기준 연결 없이 일반 저장한다. */
type Outcome = { receiptId: string } | { tone: Tone; text: string; plain?: boolean; keepRequest?: boolean };

/** 정정 거절 사유를 작가의 다음 행동으로 바꾼다. 4xx는 저장되지 않았고, 응답이 없으면 저장 여부를 모른다. */
function failureOutcome(error: unknown): Outcome {
  const api = toApiError(error);
  if (!api || api.status < 400 || api.status >= 500) return { tone: 'warning', text: LOST_COPY, keepRequest: true };
  if (api.code === 'VALIDATION_CORRECTION_CONFLICT') return { tone: 'warning', text: CONFLICT_COPY, plain: true };
  if (api.code === 'VALIDATION_REPORT_VERSION_CONFLICT') {
    return { tone: 'warning', text: '오류 리포트의 상태가 방금 바뀌었어요. 입력한 내용은 그대로예요. 다시 저장하면 최신 상태로 다시 확인해요.' };
  }
  return { tone: 'danger', text: `${api.message || '정정을 저장하지 못했어요.'} 입력한 내용은 그대로예요.` };
}

/** 캐릭터 정정 slot. basis가 slot을 가리키면 그 slot, 아니면 작가가 바꾼 slot 하나다. 조건이 맞지 않으면 안내 문구를 돌려준다. */
function characterSlotFor(context: CorrectionContext, detail: CharacterDetailResponse, edit: CharacterUpdateRequest): Slot | string {
  const { changed, basicChanged } = characterEditSlots(detail, edit);
  if (basicChanged) return '정정에서는 이름·역할·첫 등장 회차를 바꿀 수 없어요. 고칠 설정 하나만 바꿔 주세요.';
  if (changed.length === 0) return '바뀐 설정이 없어요. 고칠 설정의 값을 바꾼 뒤 저장해 주세요.';
  const slot: Slot = context.factType && context.factKey ? { factType: context.factType, factKey: context.factKey } : changed[0];
  if (changed.length > 1 || changed[0].factType !== slot.factType || changed[0].factKey !== slot.factKey) {
    return context.factType
      ? '정정은 검사한 설정 하나만 바꿀 수 있어요. 다른 설정은 원래대로 두고 저장해 주세요.'
      : '정정은 설정 하나만 바꿀 수 있어요. 다른 설정은 원래대로 두고 저장해 주세요.';
  }
  return slot;
}

/** 화면 위와 상세 모달 안에 같은 순서로 보여 주는 안내. 정정 중 → 정정 결과 → 대상 보기 → 기존 설정 관리 이동 순으로 고른다. */
function renderNotice({ reportReturn, context, feedback, searchParams, testId }: {
  reportReturn: ReportReturn;
  context: CorrectionContext | null;
  feedback: Feedback | null;
  searchParams: URLSearchParams;
  testId?: string;
}) {
  const notice = (tone: Tone, title: string, body?: ReactNode) => (
    <ReportReturnNotice reportReturn={reportReturn} tone={tone} title={title} testId={testId}>{body}</ReportReturnNotice>
  );
  const result = searchParams.get(CORRECTION_RESULT_KEY);
  if (context && feedback) {
    // 첫 문장은 결과, 나머지는 입력 보존·다음 행동 안내로 나눠 읽기 쉽게 한다.
    const [, title = feedback.text, rest] = /^(.+?[.!?])\s+(.+)$/su.exec(feedback.text) ?? [];
    return notice(feedback.tone, title, rest ? <p>{rest}</p> : undefined);
  }
  if (context) {
    return notice('info', '오류 리포트에서 설정 정보를 정정하러 왔어요.', <>
      <p>{correctionHint(context)}</p>
      <p>리포트에서 비교한 값과 지금 저장된 값은 다를 수 있어요. 저장하면 정정으로 연결되고, 리포트로 돌아가 재검수해 주세요.</p>
    </>);
  }
  if (result === 'linked' && searchParams.get(CORRECTION_RECEIPT_KEY)) {
    return notice('success', '저장됐어요. 리포트로 돌아가 재검수해 주세요.',
      <p>정정한 설정은 이 검수의 기준과 연결됐어요. 재검수를 시작해야 새 기준으로 다시 검사해요.</p>);
  }
  if (result === 'unlinked') {
    return notice('warning', '저장됐지만 검수 기준 연결을 확인하지 못했어요.', <p>리포트로 돌아가 재검수하면 지금 저장된 설정으로 새로 검사해요.</p>);
  }
  if (searchParams.get('reportView') === REPORT_VIEW_SUBJECT) {
    return notice('info', '오류 리포트에서 대상 설정을 보러 왔어요.', <p>리포트에서 비교한 값과 지금 저장된 값은 다를 수 있어요.</p>);
  }
  return notice('info', '오류 리포트에서 설정 정보를 정정하러 왔어요.', <>
    <p>고칠 캐릭터나 세계관 설정을 찾아 수정해 주세요. 리포트에서 비교한 값과 지금 저장된 값은 다를 수 있어요.</p>
    <p>저장만으로는 정정이 연결되지 않아요. 저장한 뒤 오류 리포트로 돌아가 수정 내용으로 재검수해 주세요.</p>
  </>);
}

/** 상세 모달 안 안내는 정정 중이거나 정정 결과가 나온 대상에만 붙인다. */
function modalTarget(context: CorrectionContext | null, searchParams: URLSearchParams) {
  if (context) return { type: context.subjectType, id: context.targetId };
  if (!searchParams.get(CORRECTION_RESULT_KEY)) return null;
  const id = searchParams.get('correctionTargetId');
  return id ? { type: searchParams.get('correctionSubjectType'), id } : null;
}

/**
 * GH314 A5·A10의 설정 관리 쪽 연결. 리포트 복귀 문맥(`returnTo=validation-report`)과 정정 문맥(`correction*`)을 읽어
 * 화면 위·상세 모달 안의 안내와 캐릭터·세계관 저장 방식을 정한다.
 *
 * 정정은 `POST /{reportId}/corrections` 하나로 실제 설정 편집과 receipt를 함께 저장한다. 일반 저장 뒤 정정을 따로 보내면
 * 설정 version과 report가 이미 바뀌어 서버가 항상 거절하므로, 정정 문맥에서는 상세의 저장 버튼이 정정 요청을 보낸다.
 * 409 `VALIDATION_CORRECTION_CONFLICT`면 아무것도 저장되지 않았으므로 입력을 유지하고, 작가가 다시 저장할 때만 기준 연결 없이
 * 일반 저장한 뒤 `저장됐지만 검수 기준 연결을 확인하지 못했어요`를 보여 준다.
 */
export function useReportSettingLink({ workId, searchParams, setSearchParams }: {
  workId: string;
  searchParams: URLSearchParams;
  setSearchParams: SetURLSearchParams;
}) {
  const queryClient = useQueryClient();
  const reportReturn = readReportReturn(searchParams, workId);
  const context = reportReturn ? readCorrectionContext(searchParams, reportReturn.reportId) : null;
  const signature = context ? [context.reportId, context.entryRef, context.targetId, context.currentVersion].join(':') : null;
  const mutation = useMutation(correctValidationBaselineSettingMutation());
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [plainFor, setPlainFor] = useState<string | null>(null);
  // 응답 유실 뒤 같은 편집을 다시 저장하면 같은 키·같은 요청으로 보내 서버가 원래 receipt를 돌려주게 한다.
  const pendingRequest = useRef<PendingRequest | null>(null);
  const [pending, setPending] = useState(false);
  // 응답 전에 리포트로 돌아가거나 다른 화면·정정 문맥으로 바뀌면 늦은 응답으로 주소와 안내를 바꾸지 않는다.
  // 서버의 정정은 취소하지 않으며 리포트 캐시 무효화는 request() 안에서 그대로 한다.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const liveSignature = useRef(signature);
  useEffect(() => { liveSignature.current = signature; });
  const stillHere = (captured: string | null) => mounted.current && captured !== null && liveSignature.current === captured;

  if (!reportReturn) return { notice: null, character: undefined, world: undefined };

  const mode: 'link' | 'plain' = signature !== null && plainFor === signature ? 'plain' : 'link';
  const activeFeedback = feedback && feedback.signature === signature ? feedback : null;
  const say = (tone: Tone, text: string) => { if (signature) setFeedback({ signature, tone, text }); };

  const invalidateReport = (reportId: string) => queryClient.invalidateQueries({
    predicate: (query: Query) => {
      const params = query.queryKey[0] as { _id?: string; path?: { reportId?: string; workId?: string } } | undefined;
      return params?.path?.reportId === reportId
        || (params?.path?.workId === workId && (params?._id === 'getCurrentEpisodeValidation' || params?._id === 'getEpisodeValidationEligibility'));
    },
  });

  /** 정정 결과를 주소에 남긴다. 대상 종류·ID는 상세 모달 안 결과 안내 위치로만 남기고 나머지 정정 요청 키는 지운다. */
  const finish = (result: 'linked' | 'unlinked', receiptId?: string) => setSearchParams(previous => {
    const next = new URLSearchParams(previous);
    for (const key of CORRECTION_PARAM_KEYS) {
      if (key !== 'correctionSubjectType' && key !== 'correctionTargetId') next.delete(key);
    }
    next.set(CORRECTION_RESULT_KEY, result);
    if (receiptId) next.set(CORRECTION_RECEIPT_KEY, receiptId);
    // 캐릭터 상세의 편집을 닫는다. 같은 렌더에서 다른 주소 변경과 겹치지 않도록 여기서 함께 처리한다.
    if (next.get('modal') === 'char-detail') { next.delete('mode'); next.delete('factId'); }
    return next;
  }, { replace: true });

  /** reportVersion은 판단 저장마다 오르므로 요청 직전의 report 단건 조회 값으로 요청을 만든다. */
  const prepare = async (current: CorrectionContext, target: Pick<ValidationCorrectionRequest, 'character' | 'worldSetting'>): Promise<PendingRequest | Outcome> => {
    let staging;
    try {
      staging = (await queryClient.fetchQuery({
        ...getEpisodeValidationStagingOptions({ path: { workId, reportId: current.reportId } }), staleTime: 0, retry: false,
      })).data;
    } catch {
      return { tone: 'warning', text: STATE_UNKNOWN_COPY };
    }
    if (!staging || staging.current === false) return { tone: 'warning', text: RETIRED_COPY, plain: true };
    if (staging.reportVersion == null) return { tone: 'warning', text: STATE_UNKNOWN_COPY };
    return {
      target: JSON.stringify(target),
      key: newIdempotencyKey(),
      request: {
        expectedReportVersion: staging.reportVersion,
        baselineId: current.baselineId,
        expectedBaselineRevision: current.baselineRevision,
        expectedBaselineHash: current.baselineHash,
        entryRef: current.entryRef,
        expectedEntryHash: current.entryHash,
        ...target,
      },
    };
  };

  const request = async (current: CorrectionContext, target: Pick<ValidationCorrectionRequest, 'character' | 'worldSetting'>): Promise<Outcome> => {
    const retry = pendingRequest.current?.target === JSON.stringify(target) ? pendingRequest.current : null;
    const prepared = retry ?? await prepare(current, target);
    if (!('request' in prepared)) return prepared;
    pendingRequest.current = prepared;
    try {
      const response = await mutation.mutateAsync({ path: { workId, reportId: current.reportId }, body: { idempotencyKey: prepared.key, ...prepared.request } });
      pendingRequest.current = null;
      void invalidateReport(current.reportId);
      const receiptId = response.data?.correctionId;
      return receiptId ? { receiptId } : { tone: 'warning', text: '정정 결과를 확인하지 못했어요. 리포트로 돌아가 상태를 확인해 주세요.' };
    } catch (error) {
      const outcome = failureOutcome(error);
      if (!('receiptId' in outcome) && !outcome.keepRequest) pendingRequest.current = null;
      return outcome;
    }
  };

  const send = async (current: CorrectionContext, target: Pick<ValidationCorrectionRequest, 'character' | 'worldSetting'>) => {
    if (pending) return false;
    const captured = signature;
    setFeedback(null);
    setPending(true);
    try {
      const outcome = await request(current, target);
      if ('receiptId' in outcome) {
        // 저장은 끝났으므로 true를 돌려주되, 결과 주소는 요청을 시작한 정정 화면에 그대로 있을 때만 남긴다.
        if (stillHere(captured)) finish('linked', outcome.receiptId);
        return true;
      }
      if (!stillHere(captured)) return false;
      if (outcome.plain) setPlainFor(captured);
      say(outcome.tone, outcome.text);
      return false;
    } finally {
      if (mounted.current) setPending(false);
    }
  };

  /**
   * 응답을 잃은 정정이 같은 캐릭터·같은 편집이면 그 대상을 돌려준다. 서버가 이미 저장했다면 다시 읽은 상세가 초안과 같아
   * 바뀐 설정을 따질 수 없으므로, slot 확인 전에 이 대상으로 보내 request()가 같은 키·같은 요청으로 다시 보내게 한다.
   */
  const lostCharacterTarget = (current: CorrectionContext, edit: CharacterUpdateRequest) => {
    const lost = pendingRequest.current;
    if (!lost) return null;
    const target = JSON.parse(lost.target) as Pick<ValidationCorrectionRequest, 'character' | 'worldSetting'>;
    const character = target.character;
    return character && character.targetId === current.targetId && character.expectedSnapshotVersion === current.currentVersion
      && JSON.stringify(character.edit) === JSON.stringify(edit) ? target : null;
  };

  const target = modalTarget(context, searchParams);
  const modalNotice = renderNotice({ reportReturn, context, feedback: activeFeedback, searchParams, testId: 'validation-correction-notice' });
  // 일반 저장 성공은 설정 관리의 mutation 콜백에서 오므로 화면을 떠난 뒤에도 불릴 수 있다. 저장을 시작한 정정 화면에서만 결과를 남긴다.
  const onPlainSaved = () => { if (stillHere(signature)) finish('unlinked'); };
  const saveBase = { mode, pending, onPlainSaved };

  const character: CharacterCorrectionBinding | undefined = target?.type === 'CHARACTER' ? {
    targetId: target.id,
    notice: modalNotice,
    save: context?.subjectType === 'CHARACTER' ? {
      ...saveBase,
      submit: async (edit, detail) => {
        const lost = lostCharacterTarget(context, edit);
        if (lost) return send(context, lost);
        const slot = characterSlotFor(context, detail, edit);
        if (typeof slot === 'string') {
          say('warning', slot);
          return false;
        }
        return send(context, {
          character: { targetId: context.targetId, expectedSnapshotVersion: context.currentVersion, factType: slot.factType, factKey: slot.factKey, edit },
        });
      },
    } : undefined,
  } : undefined;

  const world: WorldCorrectionBinding | undefined = target?.type === 'WORLD_SETTING' ? {
    targetId: target.id,
    notice: modalNotice,
    path: context?.settingName ? { scopeName: context.scopeName, settingName: context.settingName } : null,
    save: context?.subjectType === 'WORLD_SETTING' ? {
      ...saveBase,
      submit: edit => send(context, {
        // 세계관은 기준 당시 version을 정정 요청과 편집 요청 모두에 그대로 보낸다.
        worldSetting: { targetId: context.targetId, expectedVersion: context.currentVersion, edit: { ...edit, version: context.currentVersion } },
      }),
    } : undefined,
  } : undefined;

  return { notice: renderNotice({ reportReturn, context, feedback: activeFeedback, searchParams }), character, world };
}

function correctionHint(context: CorrectionContext) {
  if (context.subjectType === 'WORLD_SETTING') {
    return context.settingName
      ? `${[context.scopeName, context.settingName].filter(Boolean).join(' / ')} 설정의 값을 고쳐 저장하면 이 검사 기준과 연결해요.`
      : '이 대상의 설정 하나를 고쳐 저장하면 이 검사 기준과 연결해요.';
  }
  return '검사한 설정 하나만 바꿔 저장하면 이 검사 기준과 연결해요. 이름·역할·첫 등장 회차와 다른 설정은 그대로 두어 주세요.';
}
