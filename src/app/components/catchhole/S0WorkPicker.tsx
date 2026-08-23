import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSearchParams } from 'react-router';
import {
  AlertCircle,
  BookOpen,
  Hash,
  Pencil,
  Plus,
  RefreshCw,
  Tag,
  Trash2,
} from 'lucide-react';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useAppContext } from '../../context/AppContext';
import { useWorks } from '../../hooks/useWorks';
import type { Work } from '../../lib/worksApi';
import { WorkCreateModal } from './WorkCreateModal';
import { WorkDeleteModal } from './WorkDeleteModal';
import { WorkEditModal } from './WorkEditModal';
import { PageHeading } from './ui-v2/PageHeading';
import { WorkspaceTopbar } from './ui-v2/WorkspaceTopbar';

const COVER_GRADIENTS = [
  'linear-gradient(145deg, #e8f5ff 0%, #cce8ff 52%, #edf9ff 100%)',
  'linear-gradient(145deg, #edf4ff 0%, #d8e4ff 52%, #f0f4ff 100%)',
  'linear-gradient(145deg, #eef9f5 0%, #d4f0e5 52%, #f5fbf8 100%)',
  'linear-gradient(145deg, #f4efff 0%, #e2d8ff 52%, #f8f5ff 100%)',
] as const;

function coverGradient(workId: string): string {
  const seed = Array.from(workId).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return COVER_GRADIENTS[seed % COVER_GRADIENTS.length];
}

function WorkCard({
  work,
  onClick,
  onEdit,
  onDelete,
}: {
  work: Work;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const purging = work.lifecycleStatus === 'PURGING';
  const episodeLabel = work.episodeCount > 0
    ? `마지막 회차 ${work.episodeCount}화`
    : '등록된 회차 없음';

  return (
    <motion.div
      className="work-card"
      whileHover={{ y: -4 }}
      transition={{ duration: 0.18 }}
    >
      <div
        aria-label={`${work.title} 작품 관리`}
        className="work-card__actions"
      >
        <button
          type="button"
          aria-label={`${work.title} 수정`}
          onClick={onEdit}
          disabled={purging}
          className="work-card__action"
        >
          <Pencil size={12} /> 수정
        </button>
        <button
          type="button"
          aria-label={`${work.title} ${purging ? '삭제 상태' : '삭제'}`}
          onClick={onDelete}
          className="work-card__action work-card__action--danger"
        >
          <Trash2 size={12} /> {purging ? '삭제 상태' : '삭제'}
        </button>
      </div>

      <button
        type="button"
        aria-label={`${work.title} 작품 선택`}
        onClick={onClick}
        disabled={purging}
        className="work-card__select"
      >
        <div className="work-card__cover" style={{ background: coverGradient(work.id) }}>
          <BookOpen size={74} />
        </div>
        <div className="work-card__body">
          <div className="work-card__title">
            {work.title}
          </div>
          {purging && (
            <div role="status" style={{ color: '#D4A04A', fontSize: 11, fontWeight: 700, marginTop: 6 }}>
              영구 삭제 진행 중 · 선택과 수정 불가
            </div>
          )}
          <div
            title={work.description ?? undefined}
            className={`work-card__description${work.description ? '' : ' is-empty'}`}
          >
            {work.description || '작품 소개가 없습니다.'}
          </div>
          <div className="work-card__meta">
            <span>
              <Tag size={11} /> {work.genre}
            </span>
            <span>
              <Hash size={11} /> {episodeLabel}
            </span>
          </div>
        </div>
      </button>
    </motion.div>
  );
}

function NewWorkCard({ onClick, compact = false }: { onClick: () => void; compact?: boolean }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      className={`new-work-card${compact ? ' new-work-card--compact' : ''}`}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.18 }}
    >
      <div className="new-work-card__icon">
        <Plus size={20} />
      </div>
      <span>새 작품 등록</span>
    </motion.button>
  );
}

function SkeletonCard() {
  return (
    <div aria-hidden="true" className="work-skeleton-card">
      <div className="work-skeleton work-skeleton-card__cover" />
      <div className="work-skeleton-card__body">
        <div className="work-skeleton work-skeleton-card__line work-skeleton-card__line--title" />
        <div className="work-skeleton work-skeleton-card__line" />
      </div>
    </div>
  );
}

export default function S0WorkPicker() {
  const navigate = useAppNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    selectedWork,
    setSelectedWork,
    selectedWorkInfo,
    setSelectedWorkInfo,
  } = useAppContext();
  const { works, loading, error, refetch } = useWorks();
  const modal = searchParams.get('modal');
  const targetWorkId = searchParams.get('targetWorkId');
  const targetWork = targetWorkId
    ? works.find(work => work.id === targetWorkId) ?? null
    : null;

  const openCreateModal = () => setSearchParams(params => {
    params.set('modal', 'work-create');
    params.delete('targetWorkId');
    return params;
  });
  const openWorkModal = (kind: 'work-edit' | 'work-delete', work: Work) => setSearchParams(params => {
    params.set('modal', kind);
    params.set('targetWorkId', work.id);
    return params;
  });
  const closeModal = () => setSearchParams(params => {
    params.delete('modal');
    params.delete('targetWorkId');
    return params;
  }, { replace: true });
  const selectWork = (work: Work) => {
    if (work.lifecycleStatus === 'PURGING') return;
    setSelectedWork(work.id);
    setSelectedWorkInfo({
      id: work.id,
      title: work.title,
      genre: work.genre ?? '',
      episodeCount: work.episodeCount,
    });
    navigate(
      `/dashboard?workId=${encodeURIComponent(work.id)}&nav=manuscripts`,
      'push-right',
    );
  };

  return (
    <div className="work-picker-page theme-v2 workspace-v2">
      <WorkspaceTopbar onBrandClick={() => navigate('/works', 'dissolve')} />

      <main className="work-picker-main">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <PageHeading eyebrow="MY WORKS" title="작품 선택" description="분석할 작품을 선택하거나 새 작품을 등록하세요." />

          {error && (
            <div role="alert" className="work-picker-alert">
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
              <button type="button" onClick={refetch}>
                <RefreshCw size={12} /> 다시 시도
              </button>
            </div>
          )}

          {loading ? (
            <div aria-label="작품 목록 불러오는 중" className="work-picker-skeletons">
              {[0, 1, 2].map(index => <SkeletonCard key={index} />)}
            </div>
          ) : !error && works.length === 0 ? (
            <div className="work-picker-empty">
              <div className="work-picker-empty__icon">
                <BookOpen size={26} />
              </div>
              <div>
                <h2>등록된 작품이 없습니다</h2>
                <p>첫 작품을 등록하고 AI 설정 분석을 시작해보세요.</p>
              </div>
              <NewWorkCard compact onClick={openCreateModal} />
            </div>
          ) : !error ? (
            <div className="work-picker-grid">
              {works.map(work => (
                <WorkCard
                  key={work.id}
                  work={work}
                  onClick={() => selectWork(work)}
                  onEdit={() => openWorkModal('work-edit', work)}
                  onDelete={() => openWorkModal('work-delete', work)}
                />
              ))}
              <NewWorkCard onClick={openCreateModal} />
            </div>
          ) : null}
        </motion.div>
      </main>

      <AnimatePresence>
        {modal === 'work-create' && (
          <WorkCreateModal
            onClose={closeModal}
            onCreated={work => {
              closeModal();
              window.setTimeout(() => selectWork(work), 0);
            }}
          />
        )}
        {modal === 'work-edit' && targetWork && (
          <WorkEditModal
            key={targetWork.id}
            work={targetWork}
            onClose={closeModal}
            onUpdated={updatedWork => {
              if (selectedWork === updatedWork.id || selectedWorkInfo?.id === updatedWork.id) {
                setSelectedWorkInfo({
                  id: updatedWork.id,
                  title: updatedWork.title,
                  genre: updatedWork.genre ?? '',
                  episodeCount: updatedWork.episodeCount,
                });
              }
              closeModal();
            }}
          />
        )}
        {modal === 'work-delete' && targetWork && (
          <WorkDeleteModal
            key={targetWork.id}
            work={targetWork}
            onClose={closeModal}
            onPurgeStarted={purgingWorkId => {
              if (selectedWork === purgingWorkId || selectedWorkInfo?.id === purgingWorkId) {
                setSelectedWork('');
                setSelectedWorkInfo(null);
              }
            }}
            onCompleted={completedWorkId => {
              if (selectedWork === completedWorkId || selectedWorkInfo?.id === completedWorkId) {
                setSelectedWork('');
                setSelectedWorkInfo(null);
              }
              closeModal();
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
