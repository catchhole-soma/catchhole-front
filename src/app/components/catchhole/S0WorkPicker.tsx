import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useSearchParams } from 'react-router';
import {
  AlertCircle,
  BookOpen,
  Hash,
  Pencil,
  Plus,
  RefreshCw,
  Shield,
  Tag,
  Trash2,
} from 'lucide-react';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useAppContext } from '../../context/AppContext';
import { useWorks } from '../../hooks/useWorks';
import type { Work } from '../../lib/worksApi';
import { C } from './constants';
import { UserMenu } from './UserMenu';
import { WorkCreateModal } from './WorkCreateModal';
import { WorkDeleteModal } from './WorkDeleteModal';
import { WorkEditModal } from './WorkEditModal';

const COVER_GRADIENTS = [
  'linear-gradient(135deg, #1a1030 0%, #2d1b4e 50%, #1a0820 100%)',
  'linear-gradient(135deg, #0d1a2e 0%, #1a3040 50%, #0d2010 100%)',
  'linear-gradient(135deg, #26121b 0%, #3a2433 50%, #17151f 100%)',
  'linear-gradient(135deg, #101d24 0%, #20313b 50%, #171725 100%)',
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
  const [hovered, setHovered] = useState(false);
  const [actionsFocused, setActionsFocused] = useState(false);
  const showActions = hovered || actionsFocused;
  const episodeLabel = work.episodeCount > 0
    ? `마지막 회차 ${work.episodeCount}화`
    : '등록된 회차 없음';

  return (
    <motion.div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setActionsFocused(true)}
      onBlurCapture={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setActionsFocused(false);
        }
      }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.18 }}
      style={{
        position: 'relative', borderRadius: 12, overflow: 'hidden',
        border: `1px solid ${hovered ? C.primary + '66' : C.border}`,
        background: C.surface, transitionProperty: 'border-color, box-shadow', transitionDuration: '0.18s',
        boxShadow: hovered ? `0 8px 32px ${C.primary}18` : 'none',
      }}
    >
      <div
        aria-label={`${work.title} 작품 관리`}
        style={{
          position: 'absolute', top: 10, right: 10, zIndex: 2,
          display: 'flex', alignItems: 'center', gap: 6,
          opacity: showActions ? 1 : 0,
          transform: showActions ? 'translateY(0)' : 'translateY(-4px)',
          pointerEvents: showActions ? 'auto' : 'none',
          transition: 'opacity 0.15s, transform 0.15s',
        }}
      >
        <button
          type="button"
          aria-label={`${work.title} 수정`}
          onClick={onEdit}
          style={{
            height: 32, padding: '0 10px', borderRadius: 7,
            border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(15,15,19,0.9)',
            color: C.t1, display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Pencil size={12} /> 수정
        </button>
        <button
          type="button"
          aria-label={`${work.title} 삭제`}
          onClick={onDelete}
          style={{
            height: 32, padding: '0 10px', borderRadius: 7,
            border: `1px solid ${C.danger}55`, background: 'rgba(15,15,19,0.9)',
            color: C.danger, display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: 'inherit', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Trash2 size={12} /> 삭제
        </button>
      </div>

      <button
        type="button"
        aria-label={`${work.title} 작품 선택`}
        onClick={onClick}
        style={{
          width: '100%', padding: 0, border: 'none', background: 'transparent',
          textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', display: 'block',
        }}
      >
        <div style={{
          height: 200, background: coverGradient(work.id), position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <BookOpen size={80} color="#fff" style={{ opacity: 0.13 }} />
        </div>
        <div style={{ padding: '15px 16px 16px' }}>
          <div style={{
            color: C.t1, fontSize: 16, fontWeight: 700, marginBottom: 5, letterSpacing: '-0.3px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {work.title}
          </div>
          <div
            title={work.description ?? undefined}
            style={{
              color: work.description ? C.t2 : C.t3,
              fontSize: 12,
              lineHeight: 1.5,
              marginBottom: 9,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {work.description || '작품 소개가 없습니다.'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px 14px', color: C.t3, fontSize: 12 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tag size={11} /> {work.genre}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Hash size={11} /> {episodeLabel}
            </span>
          </div>
        </div>
      </button>
    </motion.div>
  );
}

function NewWorkCard({ onClick }: { onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.18 }}
      style={{
        borderRadius: 12, cursor: 'pointer', border: `1.5px dashed ${hovered ? C.primary + '77' : C.border}`,
        background: hovered ? C.primary + '08' : 'transparent', minHeight: 288, padding: 16,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10,
        transitionProperty: 'border-color, background', transitionDuration: '0.18s', fontFamily: 'inherit',
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 10, background: hovered ? C.primary + '22' : C.border + '66',
        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.18s',
      }}>
        <Plus size={20} color={hovered ? C.primary : C.t3} />
      </div>
      <span style={{ color: hovered ? C.primary : C.t3, fontSize: 13, fontWeight: 500 }}>
        새 작품 등록
      </span>
    </motion.button>
  );
}

function SkeletonCard() {
  return (
    <div aria-hidden="true" style={{ borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.border}` }}>
      <div className="work-skeleton" style={{ height: 200, background: C.surface }} />
      <div style={{ background: C.surface, padding: '15px 16px 16px', borderTop: `1px solid ${C.border}` }}>
        <div className="work-skeleton" style={{ height: 16, width: '62%', borderRadius: 4, background: C.border, marginBottom: 11 }} />
        <div className="work-skeleton" style={{ height: 12, width: '48%', borderRadius: 4, background: C.border }} />
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
    setSelectedWork(work.id);
    setSelectedWorkInfo({ id: work.id, title: work.title, genre: work.genre ?? '' });
    navigate(`/dashboard?workId=${encodeURIComponent(work.id)}&nav=manuscripts`, 'push-right');
  };

  return (
    <div style={{
      background: C.bg, width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      <header style={{
        height: 56, background: C.bg, borderBottom: `1px solid ${C.border}`, display: 'flex',
        alignItems: 'center', justifyContent: 'space-between', padding: '0 32px', flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={() => navigate('/works', 'dissolve')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', border: 'none', background: 'none', padding: 0 }}
        >
          <div style={{
            width: 26, height: 26, borderRadius: 6, background: `linear-gradient(135deg, ${C.primary}, #B48BFF)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Shield size={14} color="#fff" />
          </div>
          <span style={{ color: C.t1, fontSize: 15, fontWeight: 700, letterSpacing: '-0.3px' }}>CatchHole</span>
          <span style={{
            padding: '2px 7px', borderRadius: 3, background: C.primary + '18', color: C.primary,
            fontSize: 10, fontWeight: 600, border: `1px solid ${C.primary}33`, marginLeft: 2,
          }}>BETA</span>
        </button>
        <UserMenu />
      </header>

      <main style={{ flex: 1, overflowY: 'auto', padding: '48px 64px' }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          <h1 style={{ color: C.t1, fontSize: 28, fontWeight: 700, letterSpacing: '-0.6px', margin: '0 0 6px' }}>
            작품 선택
          </h1>
          <p style={{ color: C.t3, fontSize: 14, margin: '0 0 36px' }}>
            분석할 작품을 선택하거나 새 작품을 등록하세요.
          </p>

          {error && (
            <div role="alert" style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px', borderRadius: 8,
              background: C.danger + '14', border: `1px solid ${C.danger}44`, color: C.danger,
              fontSize: 13, marginBottom: 20, maxWidth: 960,
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{error}</span>
              <button type="button" onClick={refetch} style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6,
                background: 'transparent', border: `1px solid ${C.danger}66`, color: C.danger,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
              }}>
                <RefreshCw size={12} /> 다시 시도
              </button>
            </div>
          )}

          {loading ? (
            <div aria-label="작품 목록 불러오는 중" style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, maxWidth: 960,
            }}>
              {[0, 1, 2].map(index => <SkeletonCard key={index} />)}
            </div>
          ) : !error && works.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              maxWidth: 480, margin: '40px auto', textAlign: 'center', gap: 16,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: 14, background: C.primary + '14',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <BookOpen size={26} color={C.primary} />
              </div>
              <div>
                <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, marginBottom: 6 }}>등록된 작품이 없습니다</div>
                <div style={{ color: C.t3, fontSize: 13 }}>첫 작품을 등록하고 AI 설정 분석을 시작해보세요.</div>
              </div>
              <div style={{ width: '100%', maxWidth: 280 }}>
                <NewWorkCard onClick={openCreateModal} />
              </div>
            </div>
          ) : !error ? (
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16, maxWidth: 960,
            }}>
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
            onCreated={selectWork}
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
            onDeleted={deletedWorkId => {
              if (selectedWork === deletedWorkId || selectedWorkInfo?.id === deletedWorkId) {
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
