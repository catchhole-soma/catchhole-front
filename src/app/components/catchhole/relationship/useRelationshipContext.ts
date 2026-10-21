import { useEffect, useRef, useState } from 'react';
import { getRelationshipCandidate, getRelationshipSources } from '../../../api/generated/sdk.gen';
import type { RelationshipCandidateResponse, RelationshipSourceResponse } from '../../../api/generated/types.gen';
import { privateImageSessionEpoch as authSessionEpoch } from '../../../lib/private-image-session';

type ContextState = {
  key: string;
  pending: boolean;
  latest: RelationshipCandidateResponse | null;
  sources: RelationshipSourceResponse[] | null;
  error: string | null;
};

function candidateSignature(candidate: RelationshipCandidateResponse) {
  return JSON.stringify({ id: candidate.id, version: candidate.version, status: candidate.status,
    reasons: candidate.reviewReasons, evidence: candidate.evidence });
}

/** Read-only refreshes never adopt a candidate version or a selected evidence token. */
export function useRelationshipContext(workId: string, candidate: RelationshipCandidateResponse, selectedIds: string[]) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ContextState | null>(null);
  const acceptedContext = useRef<ContextState | null>(null);
  const idsKey = JSON.stringify([...new Set(selectedIds)].sort());
  const candidateKey = candidateSignature(candidate);
  const key = `${workId}:${candidateKey}:${idsKey}:${attempt}`;

  useEffect(() => {
    // A successful write already returned authoritative data. A failed follow-up read
    // must not prevent retrying the confirmation with that saved version.
    const accepted = acceptedContext.current;
    acceptedContext.current = null;
    if (accepted?.key === key) { setState(accepted); return; }
    const session = authSessionEpoch();
    const controller = new AbortController();
    const active = () => !controller.signal.aborted && session === authSessionEpoch();
    setState({ key, pending: true, latest: null, sources: null, error: null });
    void (async () => {
      try {
        const result = await getRelationshipCandidate({ path: { workId, candidateId: JSON.parse(candidateKey).id }, signal: controller.signal });
        if (!active()) return;
        const latest = result.data.data;
        if (!latest) throw new Error('Missing candidate');
        if ((latest.version ?? 0) < (JSON.parse(candidateKey).version ?? 0)) throw new Error('Older candidate');
        // Dismissal needs a current candidate version, but not the source read that follows.
        setState({ key, pending: true, latest, sources: null, error: null });
        const ids = [...new Set<string>([...JSON.parse(idsKey), latest.subjectCharacterId, latest.objectCharacterId,
          ...(latest.evidence ?? []).map(source => source.characterId)].filter((id): id is string => !!id))];
        const results = await Promise.allSettled(ids.map(characterId => getRelationshipSources({
          path: { workId }, query: { characterId }, signal: controller.signal,
        })));
        if (!active()) return;
        const failed = results.some(item => item.status === 'rejected');
        setState({ key, pending: false, latest,
          sources: results.flatMap(item => item.status === 'fulfilled' ? item.value.data.data ?? [] : []),
          error: failed ? '현재 근거를 불러오지 못했어요. 입력과 근거 선택은 유지했어요.' : null });
      } catch {
        if (active()) setState({ key, pending: false, latest: null, sources: null,
          error: '최신 관계 내용을 불러오지 못했어요. 입력은 유지했어요.' });
      }
    })();
    return () => controller.abort();
  }, [key, workId, candidateKey, idsKey]);

  const current = state?.key === key ? state : null;
  return { latest: current?.latest ?? null, sources: current?.sources ?? null,
    pending: current?.pending ?? true, error: current?.error ?? null,
    acceptWrite: (latest: RelationshipCandidateResponse) => {
      const replaced = new Set((latest.evidence ?? []).map(item => item.sourceFactId));
      const sources = [...(current?.sources ?? []).filter(source => !replaced.has(source.factId)),
        ...(latest.evidence ?? []).filter(item => item.current && item.sourceFactId && item.sourceToken).map(item => ({
          factId: item.sourceFactId, contextToken: item.sourceToken, characterId: item.characterId,
          currentValue: item.currentValue, hasEvidence: item.hasEvidence, manuallyEdited: item.manuallyEdited,
        }))];
      acceptedContext.current = { key: `${workId}:${candidateSignature(latest)}:${idsKey}:${attempt}`,
        latest, sources, pending: false, error: null };
    },
    acknowledgeRead: (latest: RelationshipCandidateResponse, nextIds: string[]) => {
      if (!current || current.pending) return;
      // Acknowledging an already displayed version is not another network request.
      const nextIdsKey = JSON.stringify([...new Set(nextIds)].sort());
      acceptedContext.current = { ...current, latest,
        key: `${workId}:${candidateSignature(latest)}:${nextIdsKey}:${attempt}` };
    },
    retry: () => setAttempt(previous => previous + 1) };
}
