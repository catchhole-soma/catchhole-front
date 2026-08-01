import { useEffect, useMemo, useRef, useState } from 'react';
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
  validateManuscriptFile,
} from '../../lib/fileValidation';
import { SettingBookDeleteModal } from './SettingBookDeleteModal';
import { C } from './constants';

const SETTING_BOOK_ID_PARAM = 'settingBookFileId';
const UPLOAD_MODAL_VALUE = 'setting-book-upload';
const TEXT_MIME_PREFIX = 'text/plain';

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
  if (filename.endsWith('.docx')) return 'DOCX';
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
  onFileChange,
  onClose,
  onSubmit,
}: {
  file: File | null;
  fileError: string | null;
  requestError: string | null;
  pending: boolean;
  onFileChange: (file: File | null, error: string | null) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, pending]);

  useEffect(() => {
    if (!file && inputRef.current) inputRef.current.value = '';
  }, [file]);

  const chooseFile = (nextFile: File | null | undefined) => {
    if (pending || !nextFile) return;
    const validationError = validateManuscriptFile(nextFile, ALLOWED_EXTENSIONS);
    if (validationError) {
      onFileChange(file, validationError);
      return;
    }
    onFileChange(nextFile, null);
  };

  return (
    <motion.div
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
        <div style={{ padding: 24 }}>
          <div style={{
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
            작품에서 참고할 설정집 원본 파일을 업로드하세요.
          </div>

          <input
            ref={inputRef}
            data-testid="setting-book-file-input"
            type="file"
            accept={ALLOWED_EXTENSIONS.join(',')}
            disabled={pending}
            onChange={event => {
              chooseFile(event.target.files?.[0]);
              event.currentTarget.value = '';
            }}
            style={{ display: 'none' }}
          />

          <div
            role="button"
            tabIndex={pending ? -1 : 0}
            aria-disabled={pending}
            onKeyDown={event => {
              if ((event.key === 'Enter' || event.key === ' ') && !pending) inputRef.current?.click();
            }}
            onClick={() => {
              if (!pending) inputRef.current?.click();
            }}
            onDragOver={event => {
              event.preventDefault();
              if (!pending) setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={event => {
              event.preventDefault();
              setDragging(false);
              chooseFile(event.dataTransfer.files?.[0]);
            }}
            style={{
              minHeight: 138,
              borderRadius: 9,
              border: `1.5px dashed ${fileError ? C.danger : dragging ? C.primary : C.border}`,
              background: fileError ? `${C.danger}08` : dragging ? `${C.primary}0D` : C.bg,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              textAlign: 'center',
              cursor: pending ? 'not-allowed' : 'pointer',
              opacity: pending ? 0.6 : 1,
            }}
          >
            <Upload size={24} color={dragging ? C.primary : C.t3} />
            <div style={{ color: C.t1, fontSize: 13, fontWeight: 600 }}>
              파일을 드래그하거나 클릭하여 선택
            </div>
            <div style={{ color: C.t3, fontSize: 11 }}>
              TXT, DOCX · 파일당 최대 10MB
            </div>
          </div>

          {fileError && (
            <div role="alert" style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: C.danger,
              fontSize: 12,
              marginTop: 8,
            }}>
              <AlertCircle size={13} />
              {fileError}
            </div>
          )}

          {file && (
            <div style={{ marginTop: 14 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '11px 12px',
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                background: C.bg,
              }}>
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: 7,
                  background: `${C.primary}18`,
                  color: C.primary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <FileText size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    color: C.t1,
                    fontSize: 12,
                    fontWeight: 700,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {file.name}
                  </div>
                  <div style={{ color: C.t3, fontSize: 11, marginTop: 3 }}>
                    {file.name.toLowerCase().endsWith('.docx') ? 'DOCX' : 'TXT'} · {formatFileSize(file.size)}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="선택한 파일 제거"
                  disabled={pending}
                  onClick={() => onFileChange(null, null)}
                  style={{
                    width: 28,
                    height: 28,
                    border: 0,
                    borderRadius: 6,
                    background: 'transparent',
                    color: C.t3,
                    cursor: pending ? 'not-allowed' : 'pointer',
                  }}
                >
                  <X size={15} />
                </button>
              </div>
              <button
                type="button"
                disabled={pending}
                onClick={() => inputRef.current?.click()}
                style={{
                  marginTop: 8,
                  padding: 0,
                  border: 0,
                  background: 'transparent',
                  color: C.primary,
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: pending ? 'not-allowed' : 'pointer',
                }}
              >
                다른 파일 다시 선택
              </button>
            </div>
          )}

          <div style={{
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

        <div className="setting-book-header" style={{
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
            disabled={!file || Boolean(fileError) || pending}
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
      <div style={{ padding: '16px 18px 13px', borderBottom: `1px solid ${C.border}` }}>
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

      <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
        {loading ? (
          <div style={{
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
          <div role="alert" style={{
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
          <div style={{
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
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 9,
        color: C.t3,
        textAlign: 'center',
      }}>
        <div style={{
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
        <div style={{ color: C.t2, fontSize: 13, fontWeight: 700 }}>
          설정집을 선택해주세요
        </div>
        <div style={{ fontSize: 11 }}>
          왼쪽 파일 목록에서 설정집을 선택하면 전체 원문이 표시됩니다.
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
  actionError,
  saving,
  deleting,
  onDraftChange,
  onRetry,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDelete,
  onClose,
}: {
  summary: SettingBookSummaryResponse | null;
  detail: SettingBookResponse | undefined;
  loading: boolean;
  failed: boolean;
  editing: boolean;
  draft: string;
  actionError: string | null;
  saving: boolean;
  deleting: boolean;
  onDraftChange: (value: string) => void;
  onRetry: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const metadata = detail ?? summary;
  const metadataType = metadata ? fileType(metadata) : 'FILE';

  return (
    <section
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
      <div style={{
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
              <ActionButton label="취소" disabled={saving} onClick={onCancelEdit} />
              <PrimaryButton
                testId="setting-book-save"
                label={saving ? '저장 중...' : '저장'}
                icon={saving ? <Loader2 size={13} className="spin" /> : undefined}
                disabled={saving}
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

      <div style={{ flex: 1, minHeight: 0, padding: 14 }}>
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
        ) : failed ? (
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

  const listQuery = useQuery({
    ...getSettingBooksOptions({ path: { workId } }),
    enabled,
    retry: false,
  });
  const detailQuery = useQuery({
    ...getSettingBookOptions({
      path: { workId, settingBookId: selectedId ?? '' },
    }),
    enabled: enabled && Boolean(selectedId),
    retry: false,
  });
  const uploadRequest = useMutation(uploadSettingBookMutation());
  const updateRequest = useMutation(updateSettingBookMutation());
  const deleteRequest = useMutation(deleteSettingBookMutation());

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFileError, setUploadFileError] = useState<string | null>(null);
  const [uploadRequestError, setUploadRequestError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [sourceActionError, setSourceActionError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SettingBookSummaryResponse | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const rows = useMemo(() => listQuery.data?.data ?? [], [listQuery.data?.data]);
  const detail = detailQuery.data?.data;
  const selectedSummary = rows.find(item => item.id === selectedId) ?? null;

  const replaceSearchParams = (update: (next: URLSearchParams) => void) => {
    setSearchParams(current => {
      const next = new URLSearchParams(current);
      update(next);
      return next;
    }, { replace: true });
  };

  const clearSelection = () => {
    replaceSearchParams(next => next.delete(SETTING_BOOK_ID_PARAM));
    setEditing(false);
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
    setDraft('');
    setSourceActionError(null);
  }, [listQuery.isError, listQuery.isPending, rows, selectedId, setSearchParams]);

  useEffect(() => {
    setEditing(false);
    setDraft('');
    setSourceActionError(null);
  }, [selectedId]);

  useEffect(() => {
    if (!editing && detail?.content !== undefined) setDraft(detail.content);
  }, [detail?.content, editing]);

  const openUploadModal = () => {
    setUploadRequestError(null);
    replaceSearchParams(next => next.set('modal', UPLOAD_MODAL_VALUE));
  };

  const closeUploadModal = () => {
    if (uploadRequest.isPending) return;
    replaceSearchParams(next => {
      if (next.get('modal') === UPLOAD_MODAL_VALUE) next.delete('modal');
    });
    setUploadFile(null);
    setUploadFileError(null);
    setUploadRequestError(null);
  };

  const refreshList = () => queryClient.invalidateQueries({
    queryKey: getSettingBooksQueryKey({ path: { workId } }),
  });

  const uploadSettingBook = async () => {
    if (!uploadFile || uploadFileError || uploadRequest.isPending) return;
    setUploadRequestError(null);
    try {
      await uploadRequest.mutateAsync({
        path: { workId },
        body: { file: uploadFile },
      });
      await refreshList();
      closeUploadModal();
    } catch (error) {
      setUploadRequestError(toApiError(error)?.message ?? '설정집 원본을 업로드하지 못했습니다.');
    }
  };

  const saveSettingBook = async () => {
    if (!selectedId || updateRequest.isPending) return;
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
        body: { content: draft },
      });
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
      setEditing(false);
    } catch (error) {
      setSourceActionError(toApiError(error)?.message ?? '설정집 원문을 수정하지 못했습니다.');
    }
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
          <div style={{
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
            <div style={{ color: C.t2, fontSize: 14 }}>데모 작품은 설정집 API에 연결되지 않습니다.</div>
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
                summary={selectedSummary}
                detail={detail}
                loading={detailQuery.isPending}
                failed={detailQuery.isError}
                editing={editing}
                draft={draft}
                actionError={sourceActionError}
                saving={updateRequest.isPending}
                deleting={deleteRequest.isPending}
                onDraftChange={setDraft}
                onRetry={() => void detailQuery.refetch()}
                onStartEdit={() => {
                  setDraft(detail?.content ?? '');
                  setSourceActionError(null);
                  setEditing(true);
                }}
                onCancelEdit={() => {
                  setDraft(detail?.content ?? '');
                  setSourceActionError(null);
                  setEditing(false);
                }}
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
