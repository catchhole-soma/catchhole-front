import { useCallback, useEffect, useRef, useState } from 'react';
import { REVIEW_RECHECK_DELAYS_MS, REVIEW_RECHECK_LIMIT, type ReviewSaveState } from '../../../lib/review-save-state';

export type SaveCheckResult = 'matched' | 'different' | 'unknown';

type TrackerEntry<TIntent> =
  | { kind: 'saving'; intent: TIntent }
  | { kind: 'unverified'; intent: TIntent; attempt: number; final: boolean };

/**
 * 후보(또는 그룹 확정) 단위로 저장 요청의 결과를 추적한다.
 *
 * 응답을 받지 못한 요청은 저장 완료로 표시하지 않는다. 곧바로 서버 값을 다시 읽고, 작가의 의도와 다르거나
 * 읽지 못하면 1→3→8초 뒤 최대 3회 다시 확인한다. 서버 쓰기는 같은 요청을 다시 보내도 같은 최종 상태가 되는
 * 계약이지만, 버전 검증 때문에 재전송 전에 반드시 다시 읽어 이미 저장된 경우를 먼저 걸러 낸다.
 */
export function useCandidateSaveTracker<TIntent>({ check, onConfirmed, resend, covers }: {
  /** 서버 값을 다시 읽어 의도대로 저장됐는지 판단한다. 읽지 못하면 'unknown'. */
  check: (key: string, intent: TIntent) => Promise<SaveCheckResult>;
  /** 응답 없이 저장이 확인됐을 때 정상 응답과 같은 후속 처리를 한다. */
  onConfirmed: (key: string, intent: TIntent) => void;
  /** 작가가 다시 시도를 누르면 최신 상태를 기준으로 같은 요청을 보낸다. */
  resend: (key: string, intent: TIntent) => void;
  /** 여러 후보를 한 요청으로 바꾸는 의도(선택·묶음 연결)가 함께 잠그는 후보 키. */
  covers?: (intent: TIntent) => string[];
}) {
  const [entries, setEntries] = useState<Record<string, TrackerEntry<TIntent>>>({});
  const entriesRef = useRef(entries);
  const handlersRef = useRef({ check, onConfirmed, resend });
  const generationsRef = useRef(new Map<string, number>());
  const timersRef = useRef(new Map<string, number>());
  const mountedRef = useRef(false);

  useEffect(() => {
    entriesRef.current = entries;
    handlersRef.current = { check, onConfirmed, resend };
  });

  useEffect(() => {
    mountedRef.current = true;
    const timers = timersRef.current;
    return () => {
      mountedRef.current = false;
      timers.forEach(timer => window.clearTimeout(timer));
      timers.clear();
    };
  }, []);

  const write = useCallback((key: string, entry: TrackerEntry<TIntent> | null) => {
    setEntries(previous => {
      if (!entry && !(key in previous)) return previous;
      const next = { ...previous };
      if (entry) next[key] = entry; else delete next[key];
      entriesRef.current = next;
      return next;
    });
  }, []);

  /** 같은 대상의 이전 확인 흐름을 끊고 새 세대를 시작한다. */
  const restart = useCallback((key: string) => {
    const generation = (generationsRef.current.get(key) ?? 0) + 1;
    generationsRef.current.set(key, generation);
    const timer = timersRef.current.get(key);
    if (timer != null) window.clearTimeout(timer);
    timersRef.current.delete(key);
    return generation;
  }, []);

  const runCheck = useCallback(async (key: string, intent: TIntent, attempt: number, generation: number) => {
    const current = () => mountedRef.current && generationsRef.current.get(key) === generation;
    write(key, { kind: 'unverified', intent, attempt, final: false });
    let result: SaveCheckResult;
    try {
      result = await handlersRef.current.check(key, intent);
    } catch {
      result = 'unknown';
    }
    if (!current()) return;
    if (result === 'matched') {
      restart(key);
      write(key, null);
      handlersRef.current.onConfirmed(key, intent);
      return;
    }
    if (attempt >= REVIEW_RECHECK_LIMIT) {
      write(key, { kind: 'unverified', intent, attempt, final: true });
      return;
    }
    const timer = window.setTimeout(() => {
      timersRef.current.delete(key);
      if (current()) void runCheck(key, intent, attempt + 1, generation);
    }, REVIEW_RECHECK_DELAYS_MS[attempt]);
    timersRef.current.set(key, timer);
  }, [restart, write]);

  const begin = useCallback((key: string, intent: TIntent) => {
    restart(key);
    write(key, { kind: 'saving', intent });
  }, [restart, write]);

  /** 정상 응답 또는 상태 코드가 있는 오류 응답을 받으면 추적을 끝낸다. 오류 문구는 기존 화면 경로가 표시한다. */
  const settle = useCallback((key: string) => {
    restart(key);
    write(key, null);
  }, [restart, write]);

  const lose = useCallback((key: string, intent: TIntent) => {
    void runCheck(key, intent, 0, restart(key));
  }, [restart, runCheck]);

  const recheck = useCallback((key: string) => {
    const entry = entriesRef.current[key];
    if (!entry) return;
    // 작가가 직접 누른 확인은 한 번만 읽고, 결과가 다르면 다시 버튼을 보여 준다.
    void runCheck(key, entry.intent, REVIEW_RECHECK_LIMIT, restart(key));
  }, [restart, runCheck]);

  const retry = useCallback((key: string) => {
    const entry = entriesRef.current[key];
    if (!entry) return;
    restart(key);
    write(key, { kind: 'saving', intent: entry.intent });
    handlersRef.current.resend(key, entry.intent);
  }, [restart, write]);

  const stateFor = (key?: string | null): ReviewSaveState => {
    const entry = key ? entries[key] : undefined;
    if (!entry || !key) return { kind: 'idle' };
    if (entry.kind === 'saving') return { kind: 'saving' };
    return { kind: 'unverified', attempt: entry.attempt, final: entry.final,
      retry: () => retry(key), check: () => recheck(key) };
  };
  /** 이 키를 직접 쓰거나, 여러 후보를 바꾸는 요청이 이 키를 함께 덮고 있는 항목. */
  const entriesFor = (key: string) => Object.entries(entries).flatMap(([entryKey, entry]) => (
    entryKey === key || covers?.(entry.intent).includes(key) ? [entry] : []
  ));
  /** 저장 결과가 확정되지 않은 대상. 그룹 확정은 확인이 끝날 때까지 막는다. */
  const unresolved = (key?: string | null) => Boolean(key && entriesFor(key).length);
  /** 요청 중이거나 자동 확인 중인 대상. 같은 대상의 다른 쓰기를 막는다. */
  const busy = (key?: string | null) => Boolean(key && entriesFor(key).some(entry => entry.kind === 'saving' || !entry.final));

  return { begin, settle, lose, stateFor, unresolved, busy };
}
