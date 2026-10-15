import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  FileText,
  Info,
  Loader2,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router';
import {
  deleteSettingBookMutation,
  getSettingBookOptions,
  getSettingBookQueryKey,
  getSettingBooksOptions,
  getSettingBooksQueryKey,
  updateSettingBookMutation,
  uploadSettingBookMutation,
} from '../../api/generated/@tanstack/react-query.gen';
import type {
  SettingBookResponse,
  SettingBookSummaryResponse,
} from '../../api/generated/types.gen';
import { toApiError } from '../../lib/api-errors';
import {
  ALLOWED_EXTENSIONS,
  formatFileSize,
  MAX_FILE_SIZE_BYTES,
  manuscriptFormatLabel,
} from '../../lib/fileValidation';
import { SettingBookDeleteModal } from './SettingBookDeleteModal';
import { SettingBookAnalysisStatus } from './SettingBookAnalysisStatus';
import type { AnalysisJobResponse } from '../../api/generated/types.gen';
import { C } from './constants';
import { FileDropArea } from './FileDropArea';
import { UploadStepper } from './UploadLayout';
import { SettingBookReferenceFields } from './SettingBookReferenceFields';
import { settingBookReferenceLabel, validSettingBookReference, type SettingBookReferenceKind } from '../../lib/setting-book-reference';

const SETTING_BOOK_ID_PARAM = 'settingBookFileId';
const UPLOAD_MODAL_VALUE = 'setting-book-upload';
const TEXT_MIME_PREFIX = 'text/plain';
const SOURCE_REVISION_CONFLICT_MESSAGE = '다른 창에서 설정집이 변경되었습니다. 작성 중인 내용은 그대로 보관되어 있습니다. 취소하여 최신 원문과 기준 시점을 확인한 뒤 다시 수정해 주세요.';

interface Props {
  workId: string;
  enabled: boolean;
}

function formatUploadedAt(value?: string): string {
  if (!value) return '업로드 시각 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '업로드 시각 없음';
  const parts = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(item => item.type === type)?.value ?? '';
  return `${part('year')}.${part('month')}.${part('day')} ${part('hour')}:${part('minute')}`;
}

function fileType(settingBook: Pick<SettingBookSummaryResponse, 'originalFilename' | 'mimeType'>): string {
  const filename = settingBook.originalFilename?.toLowerCase() ?? '';
  if (/\.(docx|hwp|hwpx)$/.test(filename)) return manuscriptFormatLabel(filename);
  if (filename.endsWith('.txt') || settingBook.mimeType?.startsWith(TEXT_MIME_PREFIX)) return 'TXT';
  return 'FILE';
}

function ActionButton({
  label,
  icon,
  danger = false,
  disabled = false,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      style={{
        height: 34,
        padding: '0 12px',
        borderRadius: 6,
        border: `1px solid ${danger ? `${C.danger}66` : C.border}`,
        background: danger ? `${C.danger}0D` : 'transparent',
        color: danger ? C.danger : C.t2,
        fontFamily: 'inherit',
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function PrimaryButton({
  label,
  icon,
  disabled = false,
  onClick,
  testId,
}: {
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      style={{
        height: 38,
        padding: '0 16px',
        borderRadius: 6,
        border: 0,
        background: C.primary,
        color: '#fff',
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function SettingBookUploadModal({
  file,
  fileError,
  requestError,
  pending,
  referenceKind,
  referenceEpisodeNo,
  onReferenceKindChange,
  onReferenceEpisodeNoChange,
  onFileChange,
  onClose,
  onSubmit,
}: {
  file: File | null;
  fileError: string | null;
  requestError: string | null;
  pending: boolean;
  referenceKind: SettingBookReferenceKind;
  referenceEpisodeNo: string;
  onReferenceKindChange: (kind: SettingBookReferenceKind) => void;
  onReferenceEpisodeNoChange: (value: string) => void;
  onFileChange: (file: File | null, error: string | null) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, pending]);

  return (
    <motion.div
      className="setting-book-modal-backdrop theme-modal-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={event => {
        if (event.target === event.currentTarget && !pending) onClose();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 320,
        background: 'rgba(4, 4, 8, 0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <motion.div
        className="setting-book-upload-modal theme-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="setting-book-upload-title"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        style={{
          width: 'min(540px, 100%)',
          borderRadius: 12,
          border: `1px solid ${C.border}`,
          background: C.surface,
          boxShadow: '0 24px 80px rgba(0,0,0,0.62)',
          overflow: 'hidden',
        }}
      >
        <div className="setting-book-upload-modal__body theme-modal__body" style={{ padding: 24 }}>
          <div className="setting-book-upload-modal__header" style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            marginBottom: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 9,
                background: `${C.primary}18`,
                color: C.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Upload size={17} />
              </div>
              <div id="setting-book-upload-title" style={{ color: C.t1, fontSize: 18, fontWeight: 700 }}>
                설정집 업로드
              </div>
            </div>
            <button
              type="button"
              aria-label="설정집 업로드 닫기"
              disabled={pending}
              onClick={onClose}
              style={{
                width: 30,
                height: 30,
                border: 0,
                borderRadius: 6,
                background: 'transparent',
                color: C.t3,
                cursor: pending ? 'not-allowed' : 'pointer',
                opacity: pending ? 0.45 : 1,
              }}
            >
              <X size={17} />
            </button>
          </div>

          <div style={{ color: C.t2, fontSize: 13, lineHeight: 1.6, marginBottom: 16 }}>
            설정집을 올리면 인물·세계관 설정을 추출하고 비교합니다.
          </div>

          <UploadStepper labels={['설정집 선택', '설정 분석', '설정 확인']} current={1} />
          <FileDropArea file={file} error={fileError} onFileChange={onFileChange}
            fileLabel="인물·세계관 설정을 담은 설정집" inputTestId="setting-book-file-input"
            allowedExtensions={ALLOWED_EXTENSIONS} keyboardAccessible preserveFileOnError disabled={pending} />
          {file && <p className="setting-book-file-meta">{manuscriptFormatLabel(file.name)} · {formatFileSize(file.size)}</p>}
          {file && <button type="button" className="analysis-card-action" aria-label="선택한 파일 제거"
            disabled={pending} onClick={() => onFileChange(null, null)}>선택한 파일 제거</button>}

          <SettingBookReferenceFields idPrefix="setting-book-upload" kind={referenceKind} episodeNo={referenceEpisodeNo}
            disabled={pending} onKindChange={onReferenceKindChange} onEpisodeNoChange={onReferenceEpisodeNoChange} />

          <div className="setting-book-upload-note" style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            padding: '10px 11px',
            marginTop: 16,
            borderRadius: 7,
            background: `${C.primary}0D`,
            color: C.t2,
            fontSize: 11,
            lineHeight: 1.55,
          }}>
            <Info size={14} color={C.primary} style={{ flexShrink: 0, marginTop: 1 }} />
            원본 파일명이 목록의 표시명으로 사용되며, 업로드할 때마다 새 파일로 추가됩니다.
          </div>

          {requestError && (
            <div role="alert" style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              padding: '9px 11px',
              marginTop: 12,
              borderRadius: 7,
              background: `${C.danger}12`,
              color: C.danger,
              fontSize: 12,
            }}>
              <AlertCircle size={14} />
              {requestError}
            </div>
          )}
        </div>

        <div className="setting-book-header setting-book-upload-modal__footer theme-modal__footer" style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: 8,
          padding: '16px 24px',
          borderTop: `1px solid ${C.border}`,
        }}>
          <ActionButton label="취소" disabled={pending} onClick={onClose} />
          <PrimaryButton
            testId="setting-book-upload-submit"
            label={pending ? '업로드 중...' : '설정집 업로드'}
            icon={pending ? <Loader2 size={14} className="spin" /> : <Upload size={14} />}
            disabled={!file || Boolean(fileError) || !validSettingBookReference(referenceKind, referenceEpisodeNo) || pending}
            onClick={onSubmit}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}

function FileListPanel({
  rows,
  selectedId,
  loading,
  failed,
  onRetry,
  onSelect,
  onUpload,
}: {
  rows: SettingBookSummaryResponse[];
  selectedId: string | null;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  onSelect: (id: string) => void;
  onUpload: () => void;
}) {
  return (
    <section
      className="setting-book-panel setting-book-file-list"
      aria-label="설정집 파일 목록"
      style={{
        minWidth: 0,
        height: '100%',
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        background: C.surface,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div className="setting-book-panel__header" style={{ padding: '16px 18px 13px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: C.t1, fontSize: 14, fontWeight: 700 }}>설정집 파일</span>
            <span style={{
              padding: '2px 7px',
              borderRadius: 9,
              background: `${C.primary}18`,
              color: C.primary,
              fontSize: 10,
              fontWeight: 700,
            }}>
              {rows.length}개
            </span>
          </div>
          <span style={{ color: C.t3, fontSize: 11 }}>최근 업로드순</span>
        </div>
        <div style={{ color: C.t3, fontSize: 11, marginTop: 7 }}>
          파일을 선택하면 오른쪽에 전체 원문이 열립니다.
        </div>
      </div>

      <div className="setting-book-panel__body" style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {loading ? (
          <div className="setting-book-state is-loading" style={{
            height: '100%',
            minHeight: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: C.t3,
            fontSize: 12,
          }}>
            <Loader2 size={16} className="spin" />
            설정집 파일을 불러오는 중...
          </div>
        ) : failed ? (
          <div className="setting-book-state is-error" role="alert" style={{
            height: '100%',
            minHeight: 180,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: C.t2,
            textAlign: 'center',
          }}>
            <AlertCircle size={28} color={C.danger} />
            <div style={{ fontSize: 13 }}>설정집 목록을 불러오지 못했습니다.</div>
            <ActionButton
              label="다시 시도"
              icon={<RefreshCw size={12} />}
              onClick={onRetry}
            />
          </div>
        ) : rows.length === 0 ? (
          <div className="setting-book-state is-empty" style={{
            height: '100%',
            minHeight: 210,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            textAlign: 'center',
          }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 11,
              background: `${C.primary}12`,
              color: C.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <FileText size={20} />
            </div>
            <div style={{ color: C.t1, fontSize: 13, fontWeight: 700 }}>업로드된 설정집이 없습니다</div>
            <div style={{ color: C.t3, fontSize: 11 }}>
              설정집을 업로드하면 이곳에서 원문을 확인할 수 있습니다.
            </div>
            <PrimaryButton
              testId="open-empty-setting-book-upload"
              label="설정집 업로드하기"
              icon={<Upload size={13} />}
              onClick={onUpload}
            />
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            {rows.map(settingBook => {
              if (!settingBook.id) return null;
              const selected = selectedId === settingBook.id;
              return (
                <button
                  className={`setting-book-row${selected ? ' is-selected' : ''}`}
                  key={settingBook.id}
                  type="button"
                  data-testid={`setting-book-row-${settingBook.id}`}
                  aria-pressed={selected}
                  onClick={() => onSelect(settingBook.id!)}
                  style={{
                    width: '100%',
                    padding: '12px 13px',
                    borderRadius: 8,
                    border: `1px solid ${selected ? C.primary : C.border}`,
                    background: selected ? `${C.primary}14` : C.bg,
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 16,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{
                      color: selected ? '#D8CFFF' : C.t1,
                      fontSize: 13,
                      fontWeight: 700,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {settingBook.originalFilename || '원본 파일명 없음'}
                    </div>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      marginTop: 6,
                      color: C.t3,
                      fontSize: 10,
                      flexWrap: 'wrap',
                    }}>
                      <span>{fileType(settingBook)}</span>
                      <span>·</span>
                      <span>{formatFileSize(settingBook.fileSize ?? 0)}</span>
                      <span>·</span>
                      <span>{formatUploadedAt(settingBook.uploadedAt)}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function EmptySourcePanel() {
  return (
    <section
      className="setting-book-panel setting-book-empty-source"
      aria-label="설정집 원문 안내"
      data-testid="setting-book-empty-source"
      style={{
        minWidth: 0,
        height: '100%',
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        background: C.surface,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="setting-book-state is-empty" style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 9,
        color: C.t3,
        textAlign: 'center',
      }}>
        <div className="setting-book-empty-source__content" data-testid="setting-book-empty-source-content">
          <div className="setting-book-empty-source__icon" style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            background: `${C.primary}12`,
            color: C.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <FileText size={21} />
          </div>
          <div className="setting-book-empty-source__title" style={{ color: C.t2, fontSize: 13, fontWeight: 700 }}>
            설정집을 선택해주세요
          </div>
          <div className="setting-book-empty-source__description" style={{ fontSize: 11 }}>
            왼쪽 파일 목록에서 설정집을 선택하면 전체 원문이 표시됩니다.
          </div>
        </div>
      </div>
    </section>
  );
}

function SourcePanel({
  summary,
  detail,
  loading,
  failed,
  editing,
  draft,
  referenceKind,
  referenceEpisodeNo,
  unsaved,
  onReferenceKindChange,
  onReferenceEpisodeNoChange,
  actionError,
  sourceConflict,
  reloading,
  saving,
  deleting,
  onDraftChange,
  onRetry,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onClose,
  workId,
  onAnalysisCreated,
}: {
  summary: SettingBookSummaryResponse | null;
  detail: SettingBookResponse | undefined;
  loading: boolean;
  failed: boolean;
  editing: boolean;
  draft: string;
  referenceKind: SettingBookReferenceKind;
  referenceEpisodeNo: string;
  unsaved: boolean;
  onReferenceKindChange: (kind: SettingBookReferenceKind) => void;
  onReferenceEpisodeNoChange: (value: string) => void;
  actionError: string | null;
  sourceConflict: boolean;
  reloading: boolean;
  saving: boolean;
  deleting: boolean;
  onDraftChange: (value: string) => void;
  onRetry: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
  workId: string;
  onAnalysisCreated: (job: AnalysisJobResponse) => void;
}) {
  const metadata = detail ?? summary;
  const metadataType = metadata ? fileType(metadata) : 'FILE';

  return (
    <section
      className="setting-book-panel setting-book-source-panel"
      aria-label="선택한 설정집 전체 원문"
      style={{
        minWidth: 0,
        height: '100%',
        borderRadius: 10,
        border: `1px solid ${C.border}`,
        background: C.surface,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div className="setting-book-panel__header" style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 16,
        padding: '15px 16px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            color: C.t1,
            fontSize: 14,
            fontWeight: 700,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {metadata?.originalFilename || '설정집 원문'}
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            color: C.t3,
            fontSize: 10,
            marginTop: 6,
            flexWrap: 'wrap',
          }}>
            <span>{formatUploadedAt(metadata?.uploadedAt)}</span>
            <span>·</span>
            <span>{metadataType}</span>
            <span>·</span>
            <span>{formatFileSize(metadata?.fileSize ?? 0)}</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {editing ? (
            <>
              <ActionButton label="취소" disabled={saving || reloading} onClick={onCancelEdit} />
              <PrimaryButton
                testId="setting-book-save"
                label={saving ? '저장 중...' : '저장'}
                icon={saving ? <Loader2 size={13} className="spin" /> : undefined}
                disabled={saving || reloading || sourceConflict || !validSettingBookReference(referenceKind, referenceEpisodeNo)}
                onClick={onSave}
              />
            </>
          ) : (
            <>
              <ActionButton
                label="수정"
                icon={<Pencil size={12} />}
                disabled={loading || failed || deleting}
                onClick={onStartEdit}
              />
              <ActionButton
                label="삭제"
                icon={<Trash2 size={12} />}
                danger
                disabled={deleting}
                onClick={onDelete}
              />
            </>
          )}
          <button
            type="button"
            aria-label="설정집 원문 닫기"
            disabled={saving || deleting}
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 6,
              border: 0,
              background: 'transparent',
              color: C.t3,
              cursor: saving || deleting ? 'not-allowed' : 'pointer',
              opacity: saving || deleting ? 0.45 : 1,
            }}
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {detail && <SettingBookAnalysisStatus key={detail.id} workId={workId} book={detail}
        unsaved={unsaved} busy={saving || deleting || reloading} onCreated={onAnalysisCreated} />}

      {editing ? <SettingBookReferenceFields idPrefix="setting-book-edit" kind={referenceKind} episodeNo={referenceEpisodeNo}
        disabled={saving} onKindChange={onReferenceKindChange} onEpisodeNoChange={onReferenceEpisodeNoChange} />
        : <p className="setting-book-reference-label">{settingBookReferenceLabel(referenceKind, referenceKind === 'EPISODE' ? Number(referenceEpisodeNo) : null)}</p>}

      {actionError && (
        <div role="alert" style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          padding: '9px 11px',
          margin: '12px 14px 0',
          borderRadius: 7,
          background: `${C.danger}12`,
          color: C.danger,
          fontSize: 12,
        }}>
          <AlertCircle size={14} />
          {actionError}
        </div>
      )}

      <div className="setting-book-panel__body setting-book-source-panel__body" style={{ flex: 1, minHeight: 0, padding: 14 }}>
        {loading ? (
          <div style={{
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: C.t3,
            fontSize: 12,
          }}>
            <Loader2 size={16} className="spin" />
            전체 원문을 불러오는 중...
          </div>
        ) : failed && !editing ? (
          <div role="alert" style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: C.t2,
          }}>
            <AlertCircle size={28} color={C.danger} />
            <div style={{ fontSize: 13 }}>전체 원문을 불러오지 못했습니다.</div>
            <ActionButton
              label="다시 시도"
              icon={<RefreshCw size={12} />}
              onClick={onRetry}
            />
          </div>
        ) : editing ? (
          <textarea
            className="setting-book-editor"
            data-testid="setting-book-editor"
            aria-label="설정집 전체 원문 편집"
            autoFocus
            value={draft}
            disabled={saving}
            onChange={event => onDraftChange(event.target.value)}
            style={{
              width: '100%',
              height: '100%',
              resize: 'none',
              boxSizing: 'border-box',
              borderRadius: 7,
              border: `1px solid ${C.primary}`,
              background: C.bg,
              color: C.t1,
              padding: 14,
              outline: 'none',
              fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', sans-serif",
              fontSize: 13,
              lineHeight: 1.75,
              opacity: saving ? 0.65 : 1,
            }}
          />
        ) : (
          <pre
            className="setting-book-source"
            data-testid="setting-book-source"
            style={{
              width: '100%',
              height: '100%',
              margin: 0,
              overflow: 'auto',
              boxSizing: 'border-box',
              borderRadius: 7,
              border: `1px solid ${C.border}`,
              background: C.bg,
              color: C.t2,
              padding: 16,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', sans-serif",
              fontSize: 13,
              lineHeight: 1.75,
            }}
          >
            {detail?.content ?? ''}
          </pre>
        )}
      </div>
    </section>
  );
}

export function SettingBookWorkspace({ workId, enabled }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const selectedId = searchParams.get(SETTING_BOOK_ID_PARAM);
  const uploadModalOpen = searchParams.get('modal') === UPLOAD_MODAL_VALUE;
  const [editing, setEditing] = useState(false);
  const editSession = useRef(0);

  const listQuery = useQuery({
    ...getSettingBooksOptions({ path: { workId } }),
    enabled,
    retry: false,
    refetchInterval: query => query.state.data?.data?.some(book => book.analysisStatus === 'PENDING' || book.analysisStatus === 'RUNNING') ? 3000 : false,
  });
  const detailQuery = useQuery({
    ...getSettingBookOptions({
      path: { workId, settingBookId: selectedId ?? '' },
    }),
    enabled: enabled && Boolean(selectedId),
    retry: false,
    refetchInterval: query => editing || query.state.data?.data?.analysisStatus === 'PENDING' || query.state.data?.data?.analysisStatus === 'RUNNING' ? 3000 : false,
  });
  const uploadRequest = useMutation(uploadSettingBookMutation());
  const updateRequest = useMutation(updateSettingBookMutation());
  const deleteRequest = useMutation(deleteSettingBookMutation());

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileError, setUploadFileError] = useState<string | null>(null);
  const [uploadRequestError, setUploadRequestError] = useState<string | null>(null);
  const [uploadReferenceKind, setUploadReferenceKind] = useState<SettingBookReferenceKind>('UNSPECIFIED');
  const [uploadReferenceEpisodeNo, setUploadReferenceEpisodeNo] = useState('');
  const [editingRevisionNo, setEditingRevisionNo] = useState<number | null>(null);
  const [sourceConflict, setSourceConflict] = useState(false);
  const [reloadingSource, setReloadingSource] = useState(false);
  const [draft, setDraft] = useState('');
  const [referenceKind, setReferenceKind] = useState<SettingBookReferenceKind>('UNSPECIFIED');
  const [referenceEpisodeNo, setReferenceEpisodeNo] = useState('');
  const [sourceActionError, setSourceActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SettingBookSummaryResponse | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const rows = useMemo(() => listQuery.data?.data ?? [], [listQuery.data?.data]);
  const detail = detailQuery.data?.data;
  const selectedSummary = rows.find(item => item.id === selectedId) ?? null;
  const revisionChangedWhileEditing = editing && editingRevisionNo !== null && detail !== undefined
    && (detail.revisionNo ?? 0) !== editingRevisionNo;
  const staleEdit = editing && (sourceConflict || revisionChangedWhileEditing);

  useEffect(() => {
    if (revisionChangedWhileEditing && !updateRequest.isPending) setSourceConflict(true);
  }, [revisionChangedWhileEditing, updateRequest.isPending]);

  const replaceSearchParams = (update: (next: URLSearchParams) => void) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      update(next);
      return next;
    }, { replace: true });
  };

  const clearSelection = () => {
    editSession.current += 1;
    replaceSearchParams(next => next.delete(SETTING_BOOK_ID_PARAM));
    setEditing(false);
    setEditingRevisionNo(null);
    setSourceConflict(false);
    setDraft('');
    setSourceActionError(null);
  };

  useEffect(() => {
    if (!selectedId || listQuery.isPending || listQuery.isError) return;
    if (rows.some(item => item.id === selectedId)) return;
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      next.delete(SETTING_BOOK_ID_PARAM);
      return next;
    }, { replace: true });
    setEditing(false);
    setEditingRevisionNo(null);
    setSourceConflict(false);
    setDraft('');
    setSourceActionError(null);
  }, [listQuery.isError, listQuery.isPending, rows, selectedId, setSearchParams]);

  useLayoutEffect(() => {
    editSession.current += 1;
    setReloadingSource(false);
    setEditing(false);
    setEditingRevisionNo(null);
    setSourceConflict(false);
    setDraft('');
    setSourceActionError(null);
    return () => { editSession.current += 1; };
  }, [selectedId, workId]);

  useEffect(() => {
    if (editing || detail?.content === undefined) return;
    setDraft(detail.content);
    setReferenceKind(detail.referenceTimeKind ?? 'UNSPECIFIED');
    setReferenceEpisodeNo(detail.referenceEpisodeNo == null ? '' : String(detail.referenceEpisodeNo));
  }, [detail?.content, detail?.referenceTimeKind, detail?.referenceEpisodeNo, editing]);

  const openUploadModal = () => {
    setUploadRequestError(null);
    replaceSearchParams(next => next.set('modal', UPLOAD_MODAL_VALUE));
  };

  const closeUploadModal = (selectId?: string) => {
    if (uploadRequest.isPending) return;
    replaceSearchParams(next => {
      if (next.get('modal') === UPLOAD_MODAL_VALUE) next.delete('modal');
      if (selectId) next.set(SETTING_BOOK_ID_PARAM, selectId);
    });
    setUploadFile(null);
    setUploadFileError(null);
    setUploadRequestError(null);
    setUploadReferenceKind('UNSPECIFIED');
    setUploadReferenceEpisodeNo('');
  };

  const refreshList = () => queryClient.invalidateQueries({
    queryKey: getSettingBooksQueryKey({ path: { workId } }),
  });

  const uploadSettingBook = async () => {
    if (!uploadFile || uploadFileError || uploadRequest.isPending
      || !validSettingBookReference(uploadReferenceKind, uploadReferenceEpisodeNo)) return;
    setUploadRequestError(null);
    try {
      const response = await uploadRequest.mutateAsync({
        path: { workId },
        body: { file: uploadFile },
        query: { referenceTimeKind: uploadReferenceKind,
          referenceEpisodeNo: uploadReferenceKind === 'EPISODE' ? Number(uploadReferenceEpisodeNo) : undefined },
      });
      await refreshList();
      closeUploadModal(response.data?.latestAnalysisJob?.id ? response.data.id : undefined);
    } catch (error) {
      setUploadRequestError(toApiError(error)?.message ?? '설정집 원본을 업로드하지 못했습니다.');
    }
  };

  const saveSettingBook = async () => {
    if (!selectedId || !editing || editingRevisionNo === null || staleEdit || reloadingSource || updateRequest.isPending) return;
    if (!validSettingBookReference(referenceKind, referenceEpisodeNo)) {
      setSourceActionError('기준 회차는 1 이상의 정수로 입력해 주세요.');
      return;
    }
    if (!draft.trim()) {
      setSourceActionError('설정집 원문을 비워둘 수 없습니다.');
      return;
    }
    if (new TextEncoder().encode(draft).length > MAX_FILE_SIZE_BYTES) {
      setSourceActionError('설정집 원문은 UTF-8 기준 10MB 이하여야 합니다.');
      return;
    }
    setSourceActionError(null);
    try {
      const updated = await updateRequest.mutateAsync({
        path: { workId, settingBookId: selectedId },
        body: { content: draft, expectedRevisionNo: editingRevisionNo, referenceTimeKind: referenceKind,
          referenceEpisodeNo: referenceKind === 'EPISODE' ? Number(referenceEpisodeNo) : undefined },
      });
      setEditing(false);
      setEditingRevisionNo(updated.data?.revisionNo ?? 0);
      setSourceConflict(false);
      queryClient.setQueryData(
        getSettingBookQueryKey({ path: { workId, settingBookId: selectedId } }),
        updated,
      );
      await Promise.all([
        refreshList(),
        queryClient.invalidateQueries({
          queryKey: getSettingBookQueryKey({ path: { workId, settingBookId: selectedId } }),
        }),
      ]);
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError?.status === 409 || apiError?.code === 'UPLOAD_SETTING_BOOK_REVISION_CONFLICT') {
        setSourceConflict(true);
      } else {
        setSourceActionError(apiError?.message ?? '설정집 원문을 수정하지 못했습니다.');
      }
    }
  };

  const cancelEdit = async () => {
    if (updateRequest.isPending || reloadingSource) return;
    const session = editSession.current;
    setReloadingSource(true);
    const latest = await detailQuery.refetch();
    // A previous selection (including A → B → A) cannot finish a new edit session.
    if (session !== editSession.current) return;
    setReloadingSource(false);
    if (latest.isError || !latest.data?.data) {
      setSourceActionError('최신 원문을 불러오지 못했습니다. 작성 중인 내용은 그대로 보관되어 있습니다. 취소를 다시 눌러 최신 원문을 확인해 주세요.');
      return;
    }
    setDraft(latest.data.data.content ?? '');
    setReferenceKind(latest.data.data.referenceTimeKind ?? 'UNSPECIFIED');
    setReferenceEpisodeNo(latest.data.data.referenceEpisodeNo == null ? '' : String(latest.data.data.referenceEpisodeNo));
    setSourceActionError(null);
    setSourceConflict(false);
    setEditingRevisionNo(null);
    setEditing(false);
  };

  const openDeleteModal = () => {
    const target = selectedSummary ?? detail;
    if (!selectedId || !target) return;
    setDeleteFailed(false);
    setDeleteTarget(target);
  };

  const deleteSettingBook = async () => {
    if (!deleteTarget?.id || deleteRequest.isPending) return;
    setDeleteFailed(false);
    try {
      await deleteRequest.mutateAsync({
        path: { workId, settingBookId: deleteTarget.id },
      });
      if (selectedId === deleteTarget.id) clearSelection();
      await refreshList();
      queryClient.removeQueries({
        queryKey: getSettingBookQueryKey({
          path: { workId, settingBookId: deleteTarget.id },
        }),
      });
      setDeleteTarget(null);
    } catch {
      setDeleteFailed(true);
    }
  };

  return (
    <>
      <motion.div
        className="setting-book-workspace"
        key="setting-books"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        data-testid="setting-book-workspace"
        style={{ minWidth: 0 }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 20,
          marginBottom: 18,
        }}>
          <div className="setting-book-heading">
            <h2 style={{
              margin: 0,
              color: C.t1,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: '-0.4px',
            }}>
              설정집
            </h2>
            <p style={{ margin: '7px 0 0', color: C.t3, fontSize: 13 }}>
              작품에 업로드한 설정집 파일과 전체 원문을 확인합니다.
            </p>
          </div>
          <div className="setting-book-upload-action">
            <PrimaryButton
              testId="open-setting-book-upload"
              label="설정집 업로드"
              icon={<Upload size={14} />}
              disabled={!enabled}
              onClick={openUploadModal}
            />
          </div>
        </div>

        {!enabled ? (
          <div className="setting-book-disabled database-state" style={{
            height: 300,
            borderRadius: 10,
            border: `1px solid ${C.border}`,
            background: C.surface,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            color: C.t3,
            textAlign: 'center',
          }}>
            <AlertCircle size={34} strokeWidth={1.3} />
            <div style={{ color: C.t2, fontSize: 14 }}>체험 작품에서는 실제 설정집을 관리할 수 없습니다.</div>
            <div style={{ fontSize: 12 }}>실제 계정의 작품을 선택하거나 새 작품을 등록하세요.</div>
          </div>
        ) : (
          <div className="setting-book-layout" style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(280px, 340px) minmax(420px, 1fr)',
            gap: 14,
            height: 'max(420px, calc(100vh - 300px))',
            maxHeight: 650,
            minWidth: 0,
          }}>
            <FileListPanel
              rows={rows}
              selectedId={selectedId}
              loading={listQuery.isPending}
              failed={listQuery.isError}
              onRetry={() => void listQuery.refetch()}
              onSelect={id => {
                replaceSearchParams(next => next.set(SETTING_BOOK_ID_PARAM, id));
              }}
              onUpload={openUploadModal}
            />
            {selectedId ? (
              <SourcePanel
                workId={workId}
                onAnalysisCreated={job => queryClient.setQueryData(getSettingBookQueryKey({ path: { workId, settingBookId: selectedId } }), {
                  ...detailQuery.data, data: detail ? { ...detail, latestAnalysisJob: job, analysisStatus: job.status, contentChangedSinceAnalysis: false } : detail,
                })}
                summary={selectedSummary}
                detail={detail}
                loading={detailQuery.isPending}
                failed={detailQuery.isError}
                editing={editing}
                draft={draft}
                referenceKind={referenceKind}
                referenceEpisodeNo={referenceEpisodeNo}
                onReferenceKindChange={setReferenceKind}
                onReferenceEpisodeNoChange={setReferenceEpisodeNo}
                unsaved={staleEdit || editing && (draft !== detail?.content || referenceKind !== (detail?.referenceTimeKind ?? 'UNSPECIFIED')
                  || referenceKind === 'EPISODE' && Number(referenceEpisodeNo) !== detail?.referenceEpisodeNo)}
                actionError={sourceActionError ?? (staleEdit ? SOURCE_REVISION_CONFLICT_MESSAGE : null)}
                sourceConflict={staleEdit}
                reloading={reloadingSource}
                saving={updateRequest.isPending}
                deleting={deleteRequest.isPending}
                onDraftChange={setDraft}
                onRetry={() => void detailQuery.refetch()}
                onStartEdit={() => {
                  if (!detail) return;
                  editSession.current += 1;
                  setReloadingSource(false);
                  setDraft(detail?.content ?? '');
                  setReferenceKind(detail?.referenceTimeKind ?? 'UNSPECIFIED');
                  setReferenceEpisodeNo(detail?.referenceEpisodeNo == null ? '' : String(detail.referenceEpisodeNo));
                  setSourceActionError(null);
                  setEditingRevisionNo(detail.revisionNo ?? 0);
                  setSourceConflict(false);
                  setEditing(true);
                }}
                onCancelEdit={() => void cancelEdit()}
                onSave={() => void saveSettingBook()}
                onDelete={openDeleteModal}
                onClose={clearSelection}
              />
            ) : (
              <EmptySourcePanel />
            )}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {uploadModalOpen && (
          <SettingBookUploadModal
            file={uploadFile}
            fileError={uploadFileError}
            requestError={uploadRequestError}
            pending={uploadRequest.isPending}
            referenceKind={uploadReferenceKind}
            referenceEpisodeNo={uploadReferenceEpisodeNo}
            onReferenceKindChange={setUploadReferenceKind}
            onReferenceEpisodeNoChange={setUploadReferenceEpisodeNo}
            onFileChange={(file, error) => {
              setUploadFile(file);
              setUploadFileError(error);
              setUploadRequestError(null);
            }}
            onClose={closeUploadModal}
            onSubmit={() => void uploadSettingBook()}
          />
        )}
        {deleteTarget && (
          <SettingBookDeleteModal
            settingBook={deleteTarget}
            submitting={deleteRequest.isPending}
            failed={deleteFailed}
            onClose={() => {
              if (deleteRequest.isPending) return;
              setDeleteTarget(null);
              setDeleteFailed(false);
            }}
            onDelete={() => void deleteSettingBook()}
          />
        )}
      </AnimatePresence>
    </>
  );
}
