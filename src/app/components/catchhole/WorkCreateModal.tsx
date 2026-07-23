import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { AlertCircle, BookPlus, Loader2, X } from 'lucide-react';
import {
  createWorkMutation,
  getMyWorksQueryKey,
} from '../../api/generated/@tanstack/react-query.gen';
import { NetworkError, toApiError } from '../../lib/api-errors';
import type { WorkGenre } from '../../lib/work-contract';
import {
  createDemoWork,
  DEMO_WORKS_QUERY_KEY,
  isDemoMode,
  toWork,
  type Work,
} from '../../lib/worksApi';
import { C } from './constants';
import { WorkGenreSelector } from './WorkGenreSelector';

interface Props {
  onClose: () => void;
  onCreated: (work: Work) => void;
}

interface FieldErrors {
  title?: string;
  description?: string;
  genre?: string;
}

function validate(title: string, description: string, genre: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!title.trim()) errors.title = '작품 제목을 입력해 주세요.';
  else if (title.trim().length > 100) errors.title = '작품 제목은 100자 이하로 입력해 주세요.';
  if (description.trim().length > 20) errors.description = '작품 설명은 20자 이하로 입력해 주세요.';
  if (!genre) errors.genre = '작품 장르를 선택해 주세요.';
  return errors;
}

export function WorkCreateModal({ onClose, onCreated }: Props) {
  const queryClient = useQueryClient();
  const createRequest = useMutation(createWorkMutation());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [demoSubmitting, setDemoSubmitting] = useState(false);
  const submitting = createRequest.isPending || demoSubmitting;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, submitting]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const nextErrors = validate(title, description, genre);
    setFieldErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;

    try {
      let work: Work | null;
      if (isDemoMode()) {
        setDemoSubmitting(true);
        work = await createDemoWork({
          title: title.trim(),
          genre,
          description: description.trim() || null,
        });
        await queryClient.invalidateQueries({ queryKey: DEMO_WORKS_QUERY_KEY });
      } else {
        const response = await createRequest.mutateAsync({
          body: {
            title: title.trim(),
            genre: genre as WorkGenre,
            description: description.trim() || null,
          },
        });
        work = response.data ? toWork(response.data) : null;
        await queryClient.invalidateQueries({ queryKey: getMyWorksQueryKey() });
      }

      if (!work) throw new Error('작품 생성 응답에 필수 정보가 없습니다.');
      onCreated(work);
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError?.code === 'REQUEST_VALIDATION_FAILED') {
        const serverErrors: FieldErrors = {};
        apiError.details.forEach(detail => {
          if (detail.field === 'title' || detail.field === 'description' || detail.field === 'genre') {
            serverErrors[detail.field] = detail.message;
          }
        });
        if (Object.keys(serverErrors).length > 0) setFieldErrors(serverErrors);
        else setSubmitError('입력한 작품 정보를 다시 확인해 주세요.');
      } else if (error instanceof NetworkError) {
        setSubmitError('서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.');
      } else {
        setSubmitError('작품을 등록하지 못했습니다. 잠시 후 다시 시도해주세요.');
      }
    } finally {
      setDemoSubmitting(false);
    }
  };

  return (
    <motion.div
      className="work-create-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={event => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
      style={{
        position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(4, 4, 8, 0.76)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}
    >
      <motion.form
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-create-title"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        onSubmit={handleSubmit}
        noValidate
        style={{
          width: 'min(700px, 100%)', borderRadius: 14, background: C.surface,
          border: `1px solid ${C.border}`, boxShadow: '0 24px 80px rgba(0,0,0,0.58)',
          padding: 32, boxSizing: 'border-box',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 28 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9, background: C.primary + '20',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <BookPlus size={19} color={C.primary} />
          </div>
          <div style={{ flex: 1 }}>
            <div id="work-create-title" style={{ color: C.t1, fontSize: 20, fontWeight: 700, marginBottom: 5 }}>
              새 작품 등록
            </div>
            <div style={{ color: C.t2, fontSize: 13 }}>작품의 기본 정보를 입력해 주세요.</div>
          </div>
          <button
            type="button"
            aria-label="작품 등록 닫기"
            onClick={onClose}
            disabled={submitting}
            style={{
              border: 'none', background: 'transparent', color: C.t3, padding: 4,
              cursor: submitting ? 'default' : 'pointer', display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <label htmlFor="work-title" style={{ display: 'block', color: C.t2, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
          작품 제목 <span style={{ color: C.danger }}>*</span>
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="work-title"
            autoFocus
            value={title}
            onChange={event => {
              setTitle(event.target.value);
              if (fieldErrors.title) setFieldErrors(current => ({ ...current, title: undefined }));
            }}
            placeholder="작품 제목을 입력해 주세요"
            aria-invalid={Boolean(fieldErrors.title)}
            aria-describedby={fieldErrors.title ? 'work-title-error' : undefined}
            style={{
              width: '100%', height: 46, borderRadius: 8, boxSizing: 'border-box',
              border: `1px solid ${fieldErrors.title ? C.danger + '99' : C.border}`,
              background: C.bg, color: C.t1, padding: '0 72px 0 13px', outline: 'none',
              fontSize: 14, fontFamily: 'inherit',
            }}
          />
          <span style={{
            position: 'absolute', right: 12, top: 15, color: title.trim().length > 100 ? C.danger : C.t3,
            fontSize: 11,
          }}>
            {title.trim().length}/100
          </span>
        </div>
        <div id="work-title-error" style={{ minHeight: 24, paddingTop: 6, color: C.danger, fontSize: 12 }}>
          {fieldErrors.title}
        </div>

        <label htmlFor="work-description" style={{ display: 'block', color: C.t2, fontSize: 12, fontWeight: 600, margin: '8px 0' }}>
          작품 설명 <span style={{ color: C.t3, fontWeight: 400 }}>(선택)</span>
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="work-description"
            value={description}
            onChange={event => {
              setDescription(event.target.value);
              if (fieldErrors.description) {
                setFieldErrors(current => ({ ...current, description: undefined }));
              }
            }}
            placeholder="목록에 표시할 짧은 소개"
            aria-invalid={Boolean(fieldErrors.description)}
            aria-describedby={fieldErrors.description ? 'work-description-error' : undefined}
            style={{
              width: '100%', height: 46, borderRadius: 8, boxSizing: 'border-box',
              border: `1px solid ${fieldErrors.description ? C.danger + '99' : C.border}`,
              background: C.bg, color: C.t1, padding: '0 64px 0 13px', outline: 'none',
              fontSize: 14, fontFamily: 'inherit',
            }}
          />
          <span style={{
            position: 'absolute', right: 12, top: 15,
            color: description.trim().length > 20 ? C.danger : C.t3, fontSize: 11,
          }}>
            {description.trim().length}/20
          </span>
        </div>
        <div id="work-description-error" style={{ minHeight: 24, paddingTop: 6, color: C.danger, fontSize: 12 }}>
          {fieldErrors.description}
        </div>

        <div id="work-genre-label" style={{ color: C.t2, fontSize: 12, fontWeight: 600, margin: '8px 0' }}>
          작품 장르 <span style={{ color: C.danger }}>*</span>
        </div>
        <WorkGenreSelector
          value={genre}
          labelId="work-genre-label"
          describedBy={fieldErrors.genre ? 'work-genre-error' : undefined}
          invalid={Boolean(fieldErrors.genre)}
          onChange={value => {
            setGenre(value);
            if (fieldErrors.genre) {
              setFieldErrors(current => ({ ...current, genre: undefined }));
            }
          }}
        />
        <p style={{ margin: '8px 0 0', color: C.t3, fontSize: 11, lineHeight: 1.5 }}>
          * 현재 서비스는 판타지 장르에 최적화되어 있으며, 다른 장르도 순차적으로 최적화할 예정입니다.
        </p>
        <div id="work-genre-error" style={{ minHeight: 24, paddingTop: 6, color: C.danger, fontSize: 12 }}>
          {fieldErrors.genre}
        </div>

        {submitError && (
          <div role="alert" style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, padding: '11px 13px',
            borderRadius: 7, background: C.danger + '14', border: `1px solid ${C.danger}44`,
            color: C.danger, fontSize: 12,
          }}>
            <AlertCircle size={15} /> {submitError}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 28 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              height: 42, padding: '0 22px', borderRadius: 7, border: `1px solid ${C.border}`,
              background: 'transparent', color: C.t2, fontSize: 13, fontFamily: 'inherit',
              cursor: submitting ? 'default' : 'pointer',
            }}
          >
            취소
          </button>
          <button
            type="submit"
            disabled={submitting}
            style={{
              minWidth: 118, height: 42, padding: '0 22px', borderRadius: 7, border: 'none',
              background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            {submitting && <Loader2 size={14} className="spin" />}
            {submitting ? '만드는 중...' : '작품 만들기'}
          </button>
        </div>
      </motion.form>
    </motion.div>
  );
}
