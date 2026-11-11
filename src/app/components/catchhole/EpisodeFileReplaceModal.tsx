import { useRef, useState } from 'react';
import { useMutation, useQueryClient, type Query } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { getEpisodesQueryKey, replaceEpisodeFileMutation } from '../../api/generated/@tanstack/react-query.gen';
import type { EpisodeSummaryResponse } from '../../api/generated/types.gen';
import { toApiError } from '../../lib/api-errors';
import { EPISODE_VALIDATION_INTAKE_ENABLED } from '../../lib/validation-feature';
import { C } from './constants';
import { FileDropArea } from './FileDropArea';
import { useModalFocusTrap } from './review-ui/useModalFocusTrap';

function SourceFileModal({
  title, description, currentFilename, warning, file, fileError, requestError,
  pending, submitLabel, onFileChange, onClose, onSubmit,
}: {
  title: string;
  description: string;
  currentFilename?: string | null;
  warning?: string;
  file: File | null;
  fileError: string | null;
  requestError: string | null;
  pending: boolean;
  submitLabel: string;
  onFileChange: (file: File | null, error: string | null) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  // 열면 창 안으로 초점을 옮기고 Tab을 가두며, Esc로 닫고(처리 중이면 무시) 닫히면 연 버튼으로 초점을 돌려준다.
  useModalFocusTrap(dialogRef, pending, onClose);
  return (
    <motion.div className="theme-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{
      position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.68)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <motion.div
        ref={dialogRef}
        tabIndex={-1}
        className="theme-modal source-file-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-file-modal-title"
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{
        width: 480, maxWidth: '100%', maxHeight: '100%', overflowY: 'auto', boxSizing: 'border-box', borderRadius: 12, border: `1px solid ${C.border}`,
        background: C.surface, padding: 24, boxShadow: '0 20px 60px rgba(0,0,0,0.55)',
      }}>
        <div className="theme-modal__header" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
          <div className="theme-modal__title" id="source-file-modal-title" style={{ color: C.t1, fontSize: 17, fontWeight: 700 }}>{title}</div>
          <button type="button" aria-label="닫기" disabled={pending} onClick={onClose} style={{
            width: 28, height: 28, border: 0, background: 'transparent', color: C.t3,
            cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.4 : 1,
          }}><X size={16} /></button>
        </div>
        <div className="theme-modal__description" style={{ color: C.t2, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>{description}</div>
        {currentFilename && <div className="theme-modal__meta" style={{ color: C.t3, fontSize: 12, marginBottom: 12 }}>현재 원본: {currentFilename}</div>}
        <FileDropArea
          file={file}
          error={fileError}
          onFileChange={onFileChange}
          fileLabel="TXT, DOCX, HWP, HWPX · 최대 10MB"
          disabled={pending}
          keyboardAccessible
        />
        {warning && <div style={{ padding: '9px 11px', marginBottom: 12, borderRadius: 6, background: `${C.warning}12`, color: C.warning, fontSize: 12 }}>{warning}</div>}
        {requestError && <div role="alert" style={{ padding: '9px 11px', marginBottom: 12, borderRadius: 6, background: `${C.danger}12`, color: C.danger, fontSize: 12 }}>{requestError}</div>}
        <div className="theme-modal__footer" style={{ display: 'flex', gap: 8 }}>
          <button type="button" disabled={pending} onClick={onClose} style={{
            flex: 1, height: 40, borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent',
            color: C.t2, fontFamily: 'inherit', cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.5 : 1,
          }}>취소</button>
          <button type="button" disabled={!file || Boolean(fileError) || pending} onClick={onSubmit} style={{
            flex: 2, height: 40, borderRadius: 6, border: 0, background: C.primary, color: '#fff',
            fontFamily: 'inherit', fontWeight: 700, cursor: !file || fileError || pending ? 'not-allowed' : 'pointer',
            opacity: !file || fileError || pending ? 0.45 : 1,
          }}>{pending ? '처리 중...' : submitLabel}</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export type EpisodeFileReplaced = {
  /** 교체한 회차의 현재 오류 리포트. 없으면 일반 회차 교체다. */
  reportId: string | null;
  /** 검수 회차이고 접수 플래그가 켜져 있으면 교체 뒤 바로 재검수한다(소유자 결정). 호출한 쪽이 리포트의 재검수 경로로 잇는다. */
  recheck: boolean;
};

/**
 * 회차 원문 파일 변경 창. 원고 목록(대시보드)과 오류 리포트(#428 원고 고치기)가 같은 창·문구·파일 검증·요청을 쓴다.
 * 대상은 호출한 쪽이 넘긴 episodeId 하나이며 회차 번호·제목으로 고르지 않는다. 서버의 파일 교체는 검수를 시작하지 않으므로
 * 교체 뒤 관련 조회만 무효화하고, 재검수 여부(`recheck`)를 알려 호출한 쪽이 리포트 주소의 `recheck=1` 경로로 잇게 한다.
 */
export function EpisodeFileReplaceModal({ workId, episode, reportId, onClose, onReplaced }: {
  workId: string;
  episode: Pick<EpisodeSummaryResponse, 'id' | 'episodeNo' | 'title' | 'originalFilename'>;
  /** 교체할 회차의 현재 오류 리포트. 있으면 교체 뒤 그 리포트의 검수 조회를 다시 읽는다. */
  reportId: string | null;
  onClose: () => void;
  onReplaced: (result: EpisodeFileReplaced) => void;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  // 교체 요청부터 조회 갱신까지 한 번의 제출이다. 갱신을 기다리는 동안에도 닫기·다시 제출을 막는다.
  const [submitting, setSubmitting] = useState(false);
  const mutation = useMutation(replaceEpisodeFileMutation());
  const pending = submitting || mutation.isPending;
  // 검수 회차(현재 오류 리포트가 있는 회차)의 파일 교체는 교체 뒤 바로 재검수한다. 접수 플래그가 꺼진 빌드는 교체만 한다.
  const recheck = EPISODE_VALIDATION_INTAKE_ENABLED && Boolean(reportId);

  const submit = async () => {
    if (!episode.id || !file || fileError || pending) return;
    setRequestError(null);
    setSubmitting(true);
    try {
      await mutation.mutateAsync({ path: { workId, episodeId: episode.id }, body: { file } });
      // 서버의 파일 교체는 검수를 시작하지 않는다. 열려 있던 리포트가 무효 상태를 바로 읽도록 검수 조회를 다시 읽는다.
      // 리포트의 재검수 자동 접수가 교체 전 캐시(재검수 불가)로 판단하지 않도록 다시 읽기를 마친 뒤 알린다.
      await Promise.all([
        reportId ? queryClient.invalidateQueries({
          predicate: (query: Query) => {
            const params = query.queryKey[0] as { path?: { reportId?: string; workId?: string }; _id?: string } | undefined;
            return params?.path?.reportId === reportId
              || (params?.path?.workId === workId && (params?._id === 'getCurrentEpisodeValidation' || params?._id === 'getEpisodeValidationEligibility'));
          },
        }) : null,
        queryClient.invalidateQueries({ queryKey: getEpisodesQueryKey({ path: { workId } }) }),
      ]);
      onReplaced({ reportId, recheck });
    } catch (error) {
      setRequestError(toApiError(error)?.message ?? '회차 원문 파일을 변경하지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const label = episode.episodeNo != null ? `${episode.episodeNo}화 ${episode.title || '제목 없음'}` : '이 회차';
  return (
    <SourceFileModal
      title="회차 파일 변경"
      description={`${label}의 원문 파일을 변경합니다.`}
      currentFilename={episode.originalFilename}
      warning={recheck
        // 검수 회차는 재분석이 아니라 오류 리포트의 재검수로 이어진다.
        ? '파일을 변경하면 이 회차의 이전 원문과 당시 검사 근거가 삭제되고, 바꾼 원고로 바로 다시 검수해요. 새 검사는 검수 로딩창에서 진행 상황을 볼 수 있고, 이전 결과는 검사 이력에 남아요.'
        : reportId
          ? '파일을 변경하면 이 회차의 이전 원문과 당시 검사 근거가 삭제되고, 지금의 오류 리포트는 다시 검수해야 해요. 파일 변경만으로 검사나 분석을 시작하지 않아요. 변경한 뒤 오류 리포트에서 수정 내용으로 재검수해 주세요.'
          : '파일을 변경하면 해당 회차의 이전 원문과 미확정 분석 후보가 영구 삭제됩니다. 확정 설정과 이미 완료된 뒤 회차의 분석 결과는 유지됩니다. 아직 완료되지 않은 뒤 회차의 순차 분석은 이전 원고에 기반한 진행 내용을 이어서 사용할 수 없게 될 수 있습니다. 변경한 회차는 직접 재분석하고, 미완료 분석은 분석 목록에서 상태를 확인해 주세요.'}
      file={file}
      fileError={fileError}
      requestError={requestError}
      pending={pending}
      submitLabel={recheck ? '파일 변경하고 재검수' : '파일 변경'}
      onFileChange={(nextFile, error) => {
        setFile(nextFile);
        setFileError(error);
        setRequestError(null);
      }}
      onClose={() => { if (!pending) onClose(); }}
      onSubmit={() => void submit()}
    />
  );
}
