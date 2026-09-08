import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import { C, type NavId, type WorkId } from './constants';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useAppContext } from '../../context/AppContext';
import { AppSidebar, FALLBACK_WORK_INFO } from './AppSidebar';
import { WorkspaceTopbar } from './ui-v2/WorkspaceTopbar';
import {
  Users, GitBranch, Globe, Upload, FileText, CircleCheckBig,
  X, Search, Loader2, AlertCircle, RefreshCw, Menu,
} from 'lucide-react';
import { EpisodeDeleteModal } from './EpisodeDeleteModal';
import { EpisodeReanalysisModal } from './EpisodeReanalysisModal';
import { CharacterDatabase } from './character/CharacterDatabase';
import { CharacterFactSearch } from './character/CharacterFactSearch';
import { CharacterTimelineModal } from './character/CharacterTimeline';
import {
  clearTimelineSelection,
  createTimelineSelection,
  EMPTY_TIMELINE_SELECTION,
  writeTimelineSelection,
  type TimelineSelection,
} from './character/character-timeline-filter';
import { AnalysisList } from './AnalysisList';
import { loadDemoCharacterState } from './character/demoCharacters';
import { SettingBookWorkspace } from './SettingBookWorkspace';
import { WorldSettingDatabase } from './worldsetting/WorldSettingDatabase';
import { ComingSoonToast } from './ComingSoonToast';
import { useWorks } from '../../hooks/useWorks';
import { isDemoMode } from '../../lib/worksApi';
import { ALLOWED_EXTENSIONS, validateManuscriptFile, formatFileSize } from '../../lib/fileValidation';
import {
  createAnalysisJobMutation,
  deleteEpisodeMutation,
  getAnalysisBatchesOptions,
  getEpisodesOptions,
  getEpisodesQueryKey,
  replaceEpisodeFileMutation,
  updateEpisodeTitleMutation,
} from '../../api/generated/@tanstack/react-query.gen';
import type { EpisodeSummaryResponse } from '../../api/generated/types.gen';
import { toApiError } from '../../lib/api-errors';

function BtnG({ label, onClick, icon, small, disabled = false }: {
  label: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  small?: boolean;
  disabled?: boolean;
}) {
  const [h, setH] = useState(false);
  return (
    <button className="legacy-action legacy-action--secondary" disabled={disabled} onClick={onClick} onMouseEnter={() => { if (!disabled) setH(true); }} onMouseLeave={() => setH(false)}
      style={{
        height: small ? 32 : 38, padding: small ? '0 12px' : '0 16px', borderRadius: 6,
        border: `1px solid ${h ? '#3A3A4A' : C.border}`, background: h ? '#1F1F2A' : 'transparent',
        color: C.t2, fontSize: small ? 12 : 13, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
        whiteSpace: 'nowrap', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
        opacity: disabled ? 0.45 : 1,
      }}>
      {icon}{label}
    </button>
  );
}
function BtnP({ label, onClick, icon }: { label: string; onClick?: () => void; icon?: React.ReactNode }) {
  const [h, setH] = useState(false);
  return (
    <button className="legacy-action legacy-action--primary" onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        height: 38, padding: '0 18px', borderRadius: 6, border: 'none',
        background: h ? '#6B4EE8' : C.primary, color: '#fff', fontSize: 13, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
      {icon}{label}
    </button>
  );
}

export function FileDropArea({
  file,
  onFileChange,
  error,
  fileLabel,
  allowedExtensions = ALLOWED_EXTENSIONS,
  disabled = false,
}: {
  file: File | null;
  onFileChange: (file: File | null, error: string | null) => void;
  error?: string | null;
  fileLabel: string;
  allowedExtensions?: readonly string[];
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!file && inputRef.current) inputRef.current.value = '';
  }, [file]);

  useEffect(() => {
    if (disabled) setDragging(false);
  }, [disabled]);

  const handleFile = (f: File | null | undefined) => {
    if (disabled) return;
    if (!f) { onFileChange(null, null); return; }
    const validationError = validateManuscriptFile(f, allowedExtensions);
    if (validationError) { onFileChange(null, validationError); return; }
    onFileChange(f, null);
  };

  return (
    <div className={`file-drop-area${file ? ' has-file' : ''}${error ? ' has-error' : ''}`} style={{ marginBottom: error ? 4 : 12 }}>
      <div
        className="file-drop-area__target"
        aria-disabled={disabled}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handleFile(e.dataTransfer.files?.[0]);
        }}
        onClick={() => {
          if (!disabled) inputRef.current?.click();
        }}
        style={{
          border: `2px dashed ${error ? C.danger : dragging ? C.primary : file ? C.success : C.border}`,
          borderRadius: 8, padding: '24px', textAlign: 'center',
          background: error ? C.danger + '08' : dragging ? C.primary + '08' : file ? C.success + '08' : 'transparent',
          cursor: disabled ? 'not-allowed' : 'pointer', transition: 'all 0.15s',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        <input
          ref={inputRef} type="file" accept={allowedExtensions.join(',')} disabled={disabled} style={{ display: 'none' }}
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        {file ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <CircleCheckBig size={18} color={C.success} />
            <span style={{ color: C.success, fontSize: 14, fontWeight: 600 }}>
              {file.name} · {formatFileSize(file.size)}
            </span>
          </div>
        ) : (
          <>
            <Upload size={24} color={C.t3} style={{ margin: '0 auto 10px' }} />
            <div style={{ color: C.t2, fontSize: 14, marginBottom: 4 }}>파일을 드래그하거나 클릭하여 업로드</div>
            <div style={{ color: C.t3, fontSize: 12 }}>{allowedExtensions.join(', ')} 지원 (최대 10MB) · {fileLabel}</div>
          </>
        )}
      </div>
      {error && (
        <div style={{ color: C.danger, fontSize: 12, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}
    </div>
  );
}

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
  return (
    <motion.div className="theme-modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{
      position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.68)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <motion.div
        className="theme-modal source-file-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="source-file-modal-title"
        initial={{ y: 18, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        style={{
        width: 480, maxWidth: '100%', borderRadius: 12, border: `1px solid ${C.border}`,
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
          fileLabel="TXT 또는 DOCX · 최대 10MB"
          disabled={pending}
        />
        {warning && <div style={{ padding: '9px 11px', marginBottom: 12, borderRadius: 6, background: `${C.warning}12`, color: C.warning, fontSize: 12 }}>{warning}</div>}
        {requestError && <div style={{ padding: '9px 11px', marginBottom: 12, borderRadius: 6, background: `${C.danger}12`, color: C.danger, fontSize: 12 }}>{requestError}</div>}
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
type SettingTabId = 'characters' | 'relations' | 'worldsettings' | 'worldrules' | 'search';

type QueryStateSettingTab = Extract<SettingTabId, 'worldsettings' | 'search'>;

const SETTING_TAB_QUERY_PARAMS: Record<QueryStateSettingTab, { q: string; page: string }> = {
  worldsettings: { q: 'worldSettingQ', page: 'worldSettingPage' },
  search: { q: 'factSearchQ', page: 'factSearchPage' },
};

function copyOptionalSearchParam(params: URLSearchParams, source: string, target: string) {
  const value = params.get(source);
  if (value == null) params.delete(target);
  else params.set(target, value);
}

function switchSettingTabQueryState(
  params: URLSearchParams,
  current: SettingTabId,
  target: SettingTabId,
): URLSearchParams {
  const next = new URLSearchParams(params);
  if (current === target) return next;

  if (current === 'worldsettings' || current === 'search') {
    const saved = SETTING_TAB_QUERY_PARAMS[current];
    copyOptionalSearchParam(next, 'q', saved.q);
    copyOptionalSearchParam(next, 'page', saved.page);
  }

  if (target === 'worldsettings' || target === 'search') {
    const saved = SETTING_TAB_QUERY_PARAMS[target];
    copyOptionalSearchParam(next, saved.q, 'q');
    copyOptionalSearchParam(next, saved.page, 'page');
  } else {
    next.delete('q');
    next.delete('page');
  }

  return next;
}

const WORK_INFO: Record<WorkId, { title: string; genre: string; episodeCount: number }> = {
  detective: { title: '빛나는 검사 로맨스', genre: '로맨스', episodeCount: 12 },
  murim: { title: '무협지존', genre: '무협', episodeCount: 8 },
};

const NAV_IDS: NavId[] = ['settingDB', 'analyses', 'manuscripts'];
const SETTING_TAB_IDS: SettingTabId[] = ['characters', 'worldsettings', 'worldrules', 'search'];

function formatEpisodeDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(date).replace(/\. /g, '.').replace(/\.$/, '');
}

function episodeAnalysisLabel(episode: EpisodeSummaryResponse): { label: string; color: string } {
  switch (episode.analysisStatus) {
    case 'COMPLETED': return { label: '분석 완료', color: C.success };
    case 'IN_PROGRESS': return { label: '분석 중', color: C.primary };
    case 'FAILED': return { label: '분석 실패', color: C.danger };
    default: return { label: '재분석 필요', color: C.warning };
  }
}

export default function S1Dashboard() {
  const navigate = useAppNavigate();
  const {
    selectedWork,
    setSelectedWork,
    selectedWorkInfo,
    setSelectedWorkInfo,
    setEditorMode,
  } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const workIdParam = searchParams.get('workId');
  const queryClient = useQueryClient();
  const [comingSoonFeature, setComingSoonFeature] = useState<string | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const closeComingSoon = useCallback(() => setComingSoonFeature(null), []);

  const navParam = searchParams.get('nav');
  const activeNav: NavId = (NAV_IDS as string[]).includes(navParam ?? '') ? (navParam as NavId) : 'settingDB';
  const setActiveNav = (id: NavId) => setSearchParams(prev => {
    const currentTabParam = prev.get('tab');
    const currentTab = (SETTING_TAB_IDS as string[]).includes(currentTabParam ?? '')
      ? currentTabParam as SettingTabId
      : 'characters';
    const next = id === 'settingDB'
      ? switchSettingTabQueryState(prev, currentTab, 'characters')
      : new URLSearchParams(prev);

    next.set('nav', id);
    // 별도 타임라인 탭 없이 캐릭터 상세에서 이력을 확인하므로 캐릭터 DB로 진입한다.
    if (id === 'settingDB') next.set('tab', 'characters');
    if (id !== 'settingDB') {
      next.delete('settingBookFileId');
      if (next.get('modal') === 'setting-book-upload') next.delete('modal');
      next.delete('settingId');
      if (next.get('modal') === 'world-setting-create' || next.get('modal') === 'world-setting-edit') {
        next.delete('modal');
      }
    }
    return next;
  });

  const tabParam = searchParams.get('tab');
  const settingTab: SettingTabId = (SETTING_TAB_IDS as string[]).includes(tabParam ?? '') ? (tabParam as SettingTabId) : 'characters';
  const setSettingTab = (id: SettingTabId) => {
    const openCategoryOverview = id === 'worldsettings';
    setSearchParams(prev => {
      const next = switchSettingTabQueryState(prev, settingTab, id);
      next.set('tab', id);
      if (openCategoryOverview) {
        next.delete('category');
        next.delete('q');
        next.delete('page');
        next.delete('sort');
        next.delete('settingId');
        next.delete('worldSettingQ');
        next.delete('worldSettingPage');
      }
      if (id !== 'characters' && (
        next.get('modal') === 'char-detail'
        || next.get('modal') === 'character-timeline'
        || next.get('modal') === 'character-archive'
      )) {
        next.delete('modal');
        next.delete('charId');
        next.delete('mode');
        next.delete('timelineView');
        next.delete('timelineFactType');
        next.delete('timelineFactTypes');
        next.delete('timelineFactKeys');
        next.delete('timelineEpisodeNo');
        next.delete('factId');
        next.delete('timelineFactId');
      }
      if (id !== 'worldrules') {
        next.delete('settingBookFileId');
        if (next.get('modal') === 'setting-book-upload') next.delete('modal');
      }
      if (id !== 'worldsettings') {
        next.delete('settingId');
        if (next.get('modal') === 'world-setting-create' || next.get('modal') === 'world-setting-edit') {
          next.delete('modal');
        }
      }
      return next;
    });
  };

  useEffect(() => {
    if (tabParam !== 'timeline') return;
    // 이전 독립 타임라인 URL도 캐릭터 DB 안의 동일 이력 화면으로 자연스럽게 연결한다.
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'characters');
      next.delete('timelinePage');
      return next;
    }, { replace: true });
  }, [setSearchParams, tabParam]);

  const selectedCharDetail = searchParams.get('modal') === 'char-detail' ? searchParams.get('charId') : null;
  const legacyCharacterTimelineId = searchParams.get('modal') === 'character-timeline'
    ? searchParams.get('charId')
    : null;
  const selectedCharEditing = selectedCharDetail !== null && searchParams.get('mode') === 'edit';
  const characterTimelineOpen = selectedCharDetail !== null && searchParams.get('mode') === 'timeline';
  const timelineFactTypesParam = searchParams.getAll('timelineFactTypes').join('\u0000');
  const timelineFactKeysParam = searchParams.getAll('timelineFactKeys').join('\u0000');
  const appliedTimelineSelection = React.useMemo(() => createTimelineSelection(
    timelineFactTypesParam ? timelineFactTypesParam.split('\u0000') : [],
    timelineFactKeysParam ? timelineFactKeysParam.split('\u0000') : [],
  ), [timelineFactKeysParam, timelineFactTypesParam]);
  const visibleTimelineSelection = characterTimelineOpen && searchParams.get('timelineView') === 'all'
    ? EMPTY_TIMELINE_SELECTION
    : appliedTimelineSelection;
  const selectedCharacterFactId = selectedCharDetail !== null && !characterTimelineOpen
    ? searchParams.get('factId')
    : null;
  const selectedTimelineFactId = characterTimelineOpen ? searchParams.get('timelineFactId') : null;
  const characterArchiveOpen = searchParams.get('modal') === 'character-archive';

  useEffect(() => {
    if (!legacyCharacterTimelineId) return;
    // 이전 전체 타임라인 URL도 캐릭터 상세 오른쪽 패널 구조로 복원한다.
    setSearchParams(prev => {
      prev.set('modal', 'char-detail');
      prev.set('charId', legacyCharacterTimelineId);
      prev.set('mode', 'timeline');
      // 이전 독립 타임라인은 선택 대기 화면이 없었으므로 같은 전체 이력 상태로 복원한다.
      prev.set('timelineView', 'all');
      const legacyFactId = prev.get('factId');
      if (legacyFactId) prev.set('timelineFactId', legacyFactId);
      prev.delete('factId');
      return prev;
    }, { replace: true });
  }, [legacyCharacterTimelineId, setSearchParams]);

  const setSelectedCharDetail = (id: string | null) => setSearchParams(prev => {
    if (id) { prev.set('modal', 'char-detail'); prev.set('charId', id); }
    else {
      prev.delete('modal');
      prev.delete('charId');
      prev.delete('mode');
      prev.delete('factId');
      prev.delete('timelineFactId');
      prev.delete('timelineView');
      prev.delete('timelineFactType');
      prev.delete('timelineEpisodeNo');
      clearTimelineSelection(prev);
    }
    return prev;
  });
  const openCharDetail = (id: string, edit: boolean) => setSearchParams(prev => {
    prev.set('modal', 'char-detail');
    prev.set('charId', id);
    if (edit) prev.set('mode', 'edit');
    else prev.delete('mode');
    prev.delete('factId');
    prev.delete('timelineFactId');
    prev.delete('timelineView');
    prev.delete('timelineFactType');
    prev.delete('timelineEpisodeNo');
    clearTimelineSelection(prev);
    return prev;
  });
  const openCharacterTimeline = () => setSearchParams(prev => {
    prev.set('mode', 'timeline');
    prev.delete('factId');
    prev.delete('timelineFactId');
    prev.delete('timelineView');
    prev.delete('timelineFactType');
    prev.delete('timelineEpisodeNo');
    clearTimelineSelection(prev);
    return prev;
  });
  const closeCharacterTimeline = () => setSearchParams(prev => {
    prev.delete('mode');
    prev.delete('timelineFactId');
    prev.delete('timelineView');
    prev.delete('timelineFactType');
    prev.delete('timelineEpisodeNo');
    clearTimelineSelection(prev);
    return prev;
  });
  const changeCharacterTimelineSelection = (
    selection: TimelineSelection,
  ) => setSearchParams(prev => {
    prev.delete('timelineView');
    prev.delete('timelineFactType');
    prev.delete('timelineEpisodeNo');
    prev.delete('timelineFactId');
    writeTimelineSelection(prev, selection);
    return prev;
  });
  const setSelectedCharEditing = (editing: boolean) => setSearchParams(prev => {
    if (editing) prev.set('mode', 'edit');
    else prev.delete('mode');
    return prev;
  });
  const completeCharacterEditing = () => setSearchParams(prev => {
    prev.delete('mode');
    prev.delete('factId');
    return prev;
  }, { replace: true });
  const openCharacterEvidence = (characterFactId: string) => setSearchParams(prev => {
    prev.set('factId', characterFactId);
    return prev;
  }, { replace: selectedCharacterFactId !== null });
  const closeCharacterEvidence = () => setSearchParams(prev => {
    prev.delete('factId');
    return prev;
  }, { replace: true });
  const setCharacterArchiveOpen = (open: boolean) => setSearchParams(prev => {
    if (open) prev.set('modal', 'character-archive');
    else prev.delete('modal');
    prev.delete('charId');
    prev.delete('mode');
    prev.delete('factId');
    prev.delete('timelineFactId');
    return prev;
  });
  const { works } = useWorks();
  const demoMode = isDemoMode();
  const restoredWorkId = selectedWorkInfo?.id === selectedWork ? selectedWork : '';
  const requestedWorkId = workIdParam ?? (demoMode ? selectedWork : restoredWorkId);
  const demoOnlyWorkId = ['detective', 'murim'].includes(requestedWorkId)
    || requestedWorkId.startsWith('demo-');
  const effectiveWorkId = demoMode || (Boolean(requestedWorkId) && !demoOnlyWorkId)
    ? requestedWorkId
    : '';
  const apiWork = works.find(work => work.id === effectiveWorkId);
  const selectedWorkDisplay = selectedWorkInfo?.id === effectiveWorkId
    ? selectedWorkInfo
    : apiWork
      ? {
          id: apiWork.id,
          title: apiWork.title,
          genre: apiWork.genre ?? '',
          episodeCount: apiWork.episodeCount,
        }
      : WORK_INFO[effectiveWorkId] ?? {
          id: effectiveWorkId,
          ...FALLBACK_WORK_INFO,
          episodeCount: 0,
        };
  const episodeApiEnabled = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(effectiveWorkId);
  const dashboardMountedRef = useRef(false);
  const dashboardContextRef = useRef({ workId: effectiveWorkId, activeNav });
  useLayoutEffect(() => {
    dashboardContextRef.current = { workId: effectiveWorkId, activeNav };
  }, [effectiveWorkId, activeNav]);
  const episodesQuery = useQuery({
    ...getEpisodesOptions({ path: { workId: effectiveWorkId } }),
    enabled: episodeApiEnabled,
    retry: false,
    refetchInterval: query => {
      const episodes = query.state.data?.data ?? [];
      return episodes.some(episode => episode.analysisStatus === 'IN_PROGRESS') ? 10_000 : false;
    },
  });
  const analysisOverviewQuery = useQuery({
    ...getAnalysisBatchesOptions({
      path: { workId: effectiveWorkId },
      query: { page: 0, size: 10 },
    }),
    enabled: episodeApiEnabled && activeNav === 'manuscripts',
    retry: false,
    refetchInterval: query => (
      query.state.data?.data?.content?.some(batch => batch.status === 'IN_PROGRESS')
        ? 10_000
        : false
    ),
  });
  const deleteEpisodeRequest = useMutation(deleteEpisodeMutation());
  const updateEpisodeTitleRequest = useMutation(updateEpisodeTitleMutation());
  const replaceEpisodeFileRequest = useMutation(replaceEpisodeFileMutation());
  const createEpisodeAnalysisRequest = useMutation(createAnalysisJobMutation());

  useEffect(() => {
    dashboardMountedRef.current = true;
    return () => {
      dashboardMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [mobileNavOpen]);

  useEffect(() => {
    if (workIdParam && workIdParam !== selectedWork) setSelectedWork(workIdParam);
  }, [selectedWork, setSelectedWork, workIdParam]);

  useEffect(() => {
    if (!demoMode && !effectiveWorkId) {
      navigate('/works', 'dissolve', undefined, { replace: true });
    }
  }, [demoMode, effectiveWorkId, navigate]);

  useEffect(() => {
    if (apiWork?.lifecycleStatus !== 'PURGING') return;
    navigate(
      `/works?modal=work-delete&targetWorkId=${encodeURIComponent(apiWork.id)}`,
      'dissolve',
      undefined,
      { replace: true },
    );
  }, [apiWork?.id, apiWork?.lifecycleStatus, navigate]);

  useEffect(() => {
    if (!apiWork) return;
    if (
      selectedWorkInfo?.id !== apiWork.id
      || selectedWorkInfo.title !== apiWork.title
      || selectedWorkInfo.genre !== (apiWork.genre ?? '')
      || selectedWorkInfo.episodeCount !== apiWork.episodeCount
    ) {
      setSelectedWorkInfo({
        id: apiWork.id,
        title: apiWork.title,
        genre: apiWork.genre ?? '',
        episodeCount: apiWork.episodeCount,
      });
    }
  }, [apiWork, selectedWorkInfo, setSelectedWorkInfo]);
  const initialManuscriptPage = Math.max(0, Number.parseInt(searchParams.get('page') ?? '1', 10) - 1 || 0);
  const [msPage, setMsPage] = useState(initialManuscriptPage);
  const MS_PAGE_SIZE = 20;
  const [demoCharacters, setDemoCharacters] = useState(
    () => loadDemoCharacterState(effectiveWorkId).characters,
  );
  const [demoArchivedCharacters, setDemoArchivedCharacters] = useState<
    ReturnType<typeof loadDemoCharacterState>['archivedCharacters']
  >(() => loadDemoCharacterState(effectiveWorkId).archivedCharacters);
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);
  const [editingEpisodeTitle, setEditingEpisodeTitle] = useState('');
  const [episodeActionError, setEpisodeActionError] = useState<string | null>(null);
  const [replaceEpisodeTarget, setReplaceEpisodeTarget] = useState<EpisodeSummaryResponse | null>(null);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [replacementFileError, setReplacementFileError] = useState<string | null>(null);
  const [episodeDeleteTarget, setEpisodeDeleteTarget] = useState<EpisodeSummaryResponse | null>(null);
  const [episodeDeleteSubmitting, setEpisodeDeleteSubmitting] = useState(false);
  const [episodeDeleteFailed, setEpisodeDeleteFailed] = useState(false);
  const [episodeReanalysisTarget, setEpisodeReanalysisTarget] = useState<EpisodeSummaryResponse | null>(null);

  useEffect(() => {
    if (!demoMode || !effectiveWorkId) return;
    const saved = loadDemoCharacterState(effectiveWorkId);
    setDemoCharacters(saved.characters);
    setDemoArchivedCharacters(saved.archivedCharacters);
  }, [demoMode, effectiveWorkId]);

  const refreshEpisodeList = () => queryClient.invalidateQueries({
    queryKey: getEpisodesQueryKey({ path: { workId: effectiveWorkId } }),
  });

  const changeManuscriptPage = (nextPage: number) => {
    setMsPage(nextPage);
    setSearchParams(params => {
      if (nextPage === 0) params.delete('page');
      else params.set('page', String(nextPage + 1));
      return params;
    }, { replace: true });
  };

  const saveEpisodeTitle = async (episode: EpisodeSummaryResponse) => {
    if (!episode.id || editingEpisodeTitle.trim().length > 100) return;
    setEpisodeActionError(null);
    try {
      await updateEpisodeTitleRequest.mutateAsync({
        path: { workId: effectiveWorkId, episodeId: episode.id },
        body: { title: editingEpisodeTitle.trim() || null },
      });
      setEditingEpisodeId(null);
      await refreshEpisodeList();
    } catch (error) {
      setEpisodeActionError(toApiError(error)?.message ?? '회차 제목을 수정하지 못했습니다.');
    }
  };

  const removeEpisode = async () => {
    if (!episodeDeleteTarget?.id || episodeDeleteSubmitting) return;
    setEpisodeDeleteSubmitting(true);
    setEpisodeDeleteFailed(false);
    setEpisodeActionError(null);
    try {
      await deleteEpisodeRequest.mutateAsync({
        path: { workId: effectiveWorkId, episodeId: episodeDeleteTarget.id },
      });
      await refreshEpisodeList();
      setEpisodeDeleteTarget(null);
    } catch {
      setEpisodeDeleteFailed(true);
    } finally {
      setEpisodeDeleteSubmitting(false);
    }
  };

  const replaceEpisodeFile = async () => {
    if (!replaceEpisodeTarget?.id || !replacementFile || replacementFileError) return;
    setEpisodeActionError(null);
    try {
      await replaceEpisodeFileRequest.mutateAsync({
        path: { workId: effectiveWorkId, episodeId: replaceEpisodeTarget.id },
        body: { file: replacementFile },
      });
      await refreshEpisodeList();
      setReplaceEpisodeTarget(null);
      setReplacementFile(null);
      setReplacementFileError(null);
    } catch (error) {
      setEpisodeActionError(toApiError(error)?.message ?? '회차 원문 파일을 변경하지 못했습니다.');
    }
  };

  const startEpisodeReanalysis = async (episode: EpisodeSummaryResponse) => {
    if (createEpisodeAnalysisRequest.isPending) return;
    setEpisodeActionError(null);
    if (!episode.batchId || !episode.id) {
      setEpisodeActionError('이 회차의 업로드 묶음 정보를 찾지 못했습니다.');
      return;
    }
    const jobType = 'SETTING_EXTRACTION' as const;
    const requestWorkId = effectiveWorkId;
    const isCurrentRequestContext = () => (
      dashboardMountedRef.current
      && window.location.pathname === '/dashboard'
      && dashboardContextRef.current.workId === requestWorkId
      && dashboardContextRef.current.activeNav === 'manuscripts'
    );
    try {
      const response = await createEpisodeAnalysisRequest.mutateAsync({
        path: { workId: requestWorkId },
        body: { jobType, batchId: episode.batchId, episodeId: episode.id },
      });
      const analysisJobIds = [...new Set(
        (response.data ?? []).flatMap(job => job.id ? [job.id] : []),
      )];
      if (!isCurrentRequestContext()) return;
      if (analysisJobIds.length === 0) throw new Error('분석 작업 ID가 응답에 없습니다.');
      const analysisJobIdParam = analysisJobIds.join(',');
      setEpisodeReanalysisTarget(null);
      navigate(
        `/episode-upload?workId=${encodeURIComponent(requestWorkId)}&batchId=${episode.batchId}&analysisJobIds=${analysisJobIdParam}&currentAnalysisJobIds=${analysisJobIdParam}&jobType=${jobType}`,
        'push-right',
      );
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError?.code === 'AI_TOKEN_QUOTA_EXHAUSTED') {
        setEpisodeReanalysisTarget(currentTarget => (
          currentTarget?.id === episode.id ? null : currentTarget
        ));
        return;
      }
      if (isCurrentRequestContext()) {
        setEpisodeActionError(apiError?.message ?? '분석 작업을 시작하지 못했습니다.');
      }
    }
  };

  const episodeRows = episodesQuery.data?.data ?? [];
  const totalEpisodePages = Math.max(1, Math.ceil(episodeRows.length / MS_PAGE_SIZE));
  const currentEpisodePage = Math.min(msPage, totalEpisodePages - 1);
  const pagedEpisodeRows = episodeRows.slice(
    currentEpisodePage * MS_PAGE_SIZE,
    (currentEpisodePage + 1) * MS_PAGE_SIZE,
  );
  const overviewBatches = analysisOverviewQuery.data?.data?.content ?? [];
  // 서버가 최근 분석 요청순으로 정렬하므로 원고 배너는 가장 최신 배치만 반영한다.
  const latestAnalysisBatch = overviewBatches[0];
  const analysisNotice = latestAnalysisBatch?.status === 'FAILED'
    || latestAnalysisBatch?.status === 'PARTIALLY_FAILED'
    ? {
        label: '일부 분석에 실패했습니다.',
        description: '분석 목록에서 실패한 회차를 확인하고 다시 시도할 수 있습니다.',
        color: C.danger,
      }
    : latestAnalysisBatch?.status === 'IN_PROGRESS'
      ? {
          label: '진행 중인 분석이 있습니다.',
          description: '분석 목록에서 함께 올린 회차의 진행 상황을 확인할 수 있습니다.',
          color: C.primary,
        }
      : latestAnalysisBatch?.status === 'REVIEW_REQUIRED'
        ? {
            label: '검토할 설정 후보가 있습니다.',
            description: '분석 목록에서 업로드 묶음을 선택해 후보 검토를 이어가세요.',
            color: C.warning,
          }
        : null;
  return (
    <div className={`dashboard-page${activeNav === 'manuscripts' || activeNav === 'analyses' || activeNav === 'settingDB' ? ' theme-v2 workspace-v2' : ''}${activeNav === 'settingDB' ? ' database-v2' : ''}`} style={{
      background: C.bg, width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      <WorkspaceTopbar
        onBrandClick={() => navigate('/works', 'dissolve')}
        leading={(
          <button
            type="button"
            className="mobile-nav-trigger"
            aria-label="메뉴 열기"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu size={19} />
          </button>
        )}
      />

      <div className="dashboard-shell" style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <AppSidebar
          className="desktop-app-sidebar"
          activeNav={activeNav}
          onNavChange={setActiveNav}
          onComingSoon={setComingSoonFeature}
        />

        <div className="dashboard-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* 메뉴 전환 시 이전 화면을 남겨 두지 않아 연속 클릭과 뒤로가기를 즉시 처리한다. */}
          <>
            {activeNav === 'settingDB' && (
              <motion.div key="settingDB" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                <div className="dashboard-section-header setting-db-header" style={{
                  padding: '20px 40px', borderBottom: `1px solid ${C.border}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
                }}>
                  <div>
                    <div className="setting-db-header__eyebrow" style={{ color: C.t3, fontSize: 12, marginBottom: 4 }}>설정 대시보드</div>
                    <div className="setting-db-header__title" style={{ color: C.t1, fontSize: 18, fontWeight: 700, letterSpacing: '-0.4px' }}>
                      {selectedWorkDisplay.title}
                      <span className="setting-db-header__genre" style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 4, background: C.primary + '18', color: C.primary, fontSize: 12, fontWeight: 500, border: `1px solid ${C.primary}33`, verticalAlign: 'middle' }}>{selectedWorkDisplay.genre}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <BtnP label="회차 올리기" onClick={() => navigate(`/episode-upload?workId=${encodeURIComponent(effectiveWorkId)}`, 'push-right')} icon={<Upload size={12} />} />
                  </div>
                </div>

                <label className="setting-db-mobile-navigation">
                  작품 설정
                  <select
                    className="mobile-choice-select"
                    value={settingTab}
                    onChange={event => {
                      if (event.target.value === 'relations') setComingSoonFeature('관계도');
                      else setSettingTab(event.target.value as SettingTabId);
                    }}
                  >
                    <option value="characters">캐릭터 설정</option>
                    <option value="worldsettings">세계관 설정</option>
                    <option value="worldrules">설정집 목록</option>
                    <option value="search">설정 검색</option>
                    <option value="relations">관계도 · 업데이트 예정</option>
                  </select>
                </label>
                <div className="dashboard-tabs setting-db-tabs" style={{ display: 'flex', gap: 0, padding: '0 40px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                  {([
                    { id: 'characters', label: '캐릭터 설정', icon: <Users size={13} /> },
                    { id: 'worldsettings', label: '세계관 설정', icon: <Globe size={13} /> },
                    { id: 'worldrules', label: '설정집 목록', icon: <Globe size={13} /> },
                    { id: 'search', label: '설정 검색', icon: <Search size={13} /> },
                    { id: 'relations', label: '관계도', icon: <GitBranch size={13} />, upcoming: true },
                  ] as { id: SettingTabId; label: string; icon: React.ReactNode; upcoming?: boolean }[]).map((tab) => (
                    <button key={tab.id} onClick={() => {
                      if (tab.upcoming) setComingSoonFeature(tab.label);
                      else setSettingTab(tab.id);
                    }} className={`setting-db-tab${settingTab === tab.id ? ' is-active' : ''}${tab.upcoming ? ' is-upcoming' : ''}`} style={{
                      height: 44, padding: '0 16px', background: 'none', border: 'none',
                      borderBottom: `2px solid ${settingTab === tab.id ? C.primary : 'transparent'}`,
                      color: settingTab === tab.id ? C.primary : tab.upcoming ? C.t3 : C.t2,
                      fontSize: 13, fontWeight: settingTab === tab.id ? 600 : 400,
                      cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 6, marginBottom: -1,
                    }}>
                      {tab.icon}{tab.label}
                      {tab.upcoming && (
                        <span style={{
                          padding: '1px 5px', borderRadius: 7, border: `1px solid ${C.primary}33`,
                          color: C.t3, fontSize: 9, fontWeight: 600, whiteSpace: 'nowrap',
                        }}>업데이트 예정</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="dashboard-section-content setting-db-content" style={{ flex: 1, overflowY: 'auto', padding: '24px 40px' }}>
                  <>
                    {settingTab === 'characters' && (
                      <motion.div key="chars" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ position: 'relative' }}>
                        <CharacterDatabase
                          workId={effectiveWorkId}
                          selectedCharacterId={selectedCharDetail}
                          selectedEvidenceFactId={selectedCharacterFactId}
                          isEditing={selectedCharEditing}
                          demoMode={demoMode}
                          archiveOpen={characterArchiveOpen}
                          demoCharacters={demoCharacters}
                          demoArchivedCharacters={demoArchivedCharacters}
                          setDemoCharacters={setDemoCharacters}
                          setDemoArchivedCharacters={setDemoArchivedCharacters}
                          onOpen={openCharDetail}
                          onClose={() => setSelectedCharDetail(null)}
                          onEvidenceOpen={openCharacterEvidence}
                          onEvidenceClose={closeCharacterEvidence}
                          timelineOpen={characterTimelineOpen}
                          timelineEvidenceOpen={Boolean(selectedTimelineFactId)}
                          appliedTimelineSelection={visibleTimelineSelection}
                          onTimelineOpen={openCharacterTimeline}
                          onTimelineClose={closeCharacterTimeline}
                          onTimelineSelectionChange={changeCharacterTimelineSelection}
                          onArchiveOpen={() => setCharacterArchiveOpen(true)}
                          onArchiveClose={() => setCharacterArchiveOpen(false)}
                          onEditChange={setSelectedCharEditing}
                          onEditComplete={completeCharacterEditing}
                          onAnalyze={() => navigate(
                            `/episode-upload?workId=${encodeURIComponent(effectiveWorkId)}`,
                            'push-right',
                          )}
                        />
                        {selectedCharDetail && characterTimelineOpen && (
                          <CharacterTimelineModal
                            workId={effectiveWorkId}
                            characterId={selectedCharDetail}
                            demoMode={demoMode}
                            onClose={closeCharacterTimeline}
                          />
                        )}
                      </motion.div>
                    )}



                    {settingTab === 'worldrules' && (
                      <SettingBookWorkspace
                        workId={effectiveWorkId}
                        enabled={episodeApiEnabled}
                      />
                    )}

                    {settingTab === 'worldsettings' && (
                      <motion.div key="worldsettings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <WorldSettingDatabase
                          workId={effectiveWorkId}
                          enabled={episodeApiEnabled}
                          onAnalyze={() => navigate(
                            `/episode-upload?workId=${encodeURIComponent(effectiveWorkId)}`,
                            'push-right',
                          )}
                        />
                      </motion.div>
                    )}

                    {settingTab === 'search' && (
                      <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ maxWidth: 900 }}>
                        <div style={{ color: C.t3, fontSize: 13, marginBottom: 16 }}>확정된 모든 작품 설정에서 키워드로 빠르게 검색합니다. 설정 오류를 방지하거나 떡밥을 확인할 때 유용합니다.</div>
                        <CharacterFactSearch
                          workId={effectiveWorkId}
                          enabled={episodeApiEnabled}
                        />
                      </motion.div>
                    )}
                  </>
                </div>
              </motion.div>
            )}





            {activeNav === 'analyses' && (
              <motion.div key="analyses" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
                <AnalysisList workId={effectiveWorkId} />
              </motion.div>
            )}

            {activeNav === 'manuscripts' && (
              <motion.div key="manuscripts" initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                className="dashboard-manuscripts"
                style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}>
                <div className="dashboard-manuscript-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 24 }}>
                  <div>
                    <div data-page-eyebrow style={{ color: C.t3, fontSize: 12, marginBottom: 4 }}>MANUSCRIPTS · 업로드된 원고</div>
                    <span data-page-title style={{ color: C.t1, fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px' }}>
                      {selectedWorkDisplay.title}
                    </span>
                  </div>
                  <BtnP label="회차 올리기" icon={<Upload size={13} />}
                    onClick={() => navigate(`/episode-upload?workId=${encodeURIComponent(effectiveWorkId)}`, 'push-right')} />
                </div>

                {!episodeApiEnabled ? (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    height: 280, color: C.t3, gap: 12,
                  }}>
                    <AlertCircle size={40} strokeWidth={1.2} />
                    <div style={{ fontSize: 14 }}>데모 작품은 원고 API에 연결되지 않습니다.</div>
                    <div style={{ fontSize: 12 }}>실제 계정으로 로그인해 작품을 선택하거나 등록하세요.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 1240 }}>
                    {analysisNotice && (
                      <div role="status" className="dashboard-analysis-notice" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 16,
                        padding: '12px 14px',
                        color: C.t2,
                        background: `${analysisNotice.color}0D`,
                        border: `1px solid ${analysisNotice.color}44`,
                        borderRadius: 8,
                      }}>
                        <div>
                          <div style={{ color: analysisNotice.color, fontSize: 13, fontWeight: 700, marginBottom: 3 }}>
                            {analysisNotice.label}
                          </div>
                          <div style={{ color: C.t3, fontSize: 11 }}>{analysisNotice.description}</div>
                        </div>
                        <BtnG small label="분석 목록으로" onClick={() => setActiveNav('analyses')} />
                      </div>
                    )}
                    {episodeActionError && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 7, padding: '10px 12px',
                        color: C.danger, background: `${C.danger}10`, border: `1px solid ${C.danger}44`,
                        borderRadius: 6, fontSize: 12,
                      }}>
                        <AlertCircle size={13} /> {episodeActionError}
                      </div>
                    )}

                    <div>
                      <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                        총 {episodeRows.length}개 회차
                      </div>
                      {episodesQuery.isPending ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 240, color: C.t3, gap: 8 }}>
                          <Loader2 size={18} className="spin" /> 회차 목록을 불러오는 중...
                        </div>
                      ) : episodesQuery.isError ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 240, color: C.t3, gap: 12 }}>
                          <AlertCircle size={36} color={C.danger} />
                          <div style={{ color: C.t2, fontSize: 14 }}>원고 목록을 불러오지 못했습니다.</div>
                          <BtnG label="다시 불러오기" icon={<RefreshCw size={12} />} onClick={() => void episodesQuery.refetch()} />
                        </div>
                      ) : episodeRows.length === 0 ? (
                        <div style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          height: 240, color: C.t3, gap: 10,
                        }}>
                          <FileText size={36} strokeWidth={1.2} />
                          <div style={{ fontSize: 14 }}>아직 업로드된 원고가 없습니다.</div>
                          <div style={{ fontSize: 12 }}>회차 올리기로 첫 원고를 추가하세요.</div>
                        </div>
                      ) : (
                        <>
                          <div className="manuscript-table" style={{ overflowX: 'auto' }}>
                          <div className="manuscript-table-head" style={{
                            minWidth: 1060, display: 'grid', gridTemplateColumns: '68px minmax(180px, 1fr) 150px 96px 80px 90px 270px',
                            padding: '8px 14px', color: C.t3, fontSize: 11, fontWeight: 600,
                          }}>
                            <span>회차</span><span>제목</span><span>원본 파일</span><span>변경일</span><span>글자수</span><span>분석 상태</span><span />
                          </div>
                          <div className="manuscript-list" style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            {pagedEpisodeRows.map(episode => {
                              const status = episodeAnalysisLabel(episode);
                              const isAnalyzing = episode.analysisStatus === 'IN_PROGRESS';
                              const editing = editingEpisodeId === episode.id;
                              return (
                                <div key={episode.id} className="manuscript-row" style={{
                                  minWidth: 1060, display: 'grid', gridTemplateColumns: '68px minmax(180px, 1fr) 150px 96px 80px 90px 270px',
                                  alignItems: 'center', padding: '11px 14px', background: C.surface,
                                  borderRadius: 8, border: `1px solid ${C.border}`,
                                }}>
                                  <span className="manuscript-episode-no" style={{ color: C.t2, fontSize: 13, fontWeight: 700 }}>{episode.episodeNo}화</span>
                                  {editing ? (
                                    <div className="manuscript-title-edit" style={{ display: 'flex', gap: 5, paddingRight: 8 }}>
                                      <input
                                        autoFocus
                                        aria-label={`${episode.episodeNo}화 제목`}
                                        value={editingEpisodeTitle}
                                        maxLength={100}
                                        onChange={event => setEditingEpisodeTitle(event.target.value)}
                                        onKeyDown={event => {
                                          if (event.key === 'Enter') void saveEpisodeTitle(episode);
                                          if (event.key === 'Escape') setEditingEpisodeId(null);
                                        }}
                                        style={{
                                          minWidth: 0, flex: 1, height: 30, padding: '0 8px', borderRadius: 5,
                                          border: `1px solid ${C.primary}`, background: C.bg, color: C.t1,
                                          fontFamily: 'inherit', fontSize: 12,
                                        }}
                                      />
                                      <BtnG small label="취소" onClick={() => setEditingEpisodeId(null)} />
                                      <BtnG small label="저장" onClick={() => void saveEpisodeTitle(episode)} />
                                    </div>
                                  ) : (
                                    <button className="manuscript-title" type="button" onClick={() => {
                                      setEditingEpisodeId(episode.id ?? null);
                                      setEditingEpisodeTitle(episode.title ?? '');
                                    }} style={{
                                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left',
                                      border: 0, padding: '4px 8px 4px 0', background: 'transparent',
                                      color: episode.title ? C.t1 : C.warning, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
                                    }} title="제목 수정">
                                      {episode.title || '제목을 찾지 못했어요 · 제목 입력'}
                                    </button>
                                  )}
                                  <span className="manuscript-original-filename" style={{ color: C.t3, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 8 }} title={episode.originalFilename ?? ''}>
                                    {episode.originalFilename ?? '—'}
                                  </span>
                                  <span className="manuscript-date" style={{ color: C.t3, fontSize: 11 }}>{formatEpisodeDate(episode.contentUpdatedAt)}</span>
                                  <span className="manuscript-char-count" style={{ color: C.t3, fontSize: 11 }}>{(episode.charCount ?? 0).toLocaleString()}자</span>
                                  <span className="manuscript-status" style={{ color: status.color, fontSize: 11, fontWeight: 700 }}>{status.label}</span>
                                  <div className="manuscript-mobile-meta">
                                    <span title={episode.originalFilename ?? ''}>{episode.originalFilename ?? '파일명 없음'}</span>
                                    <span>{formatEpisodeDate(episode.contentUpdatedAt)}</span>
                                    <span>{(episode.charCount ?? 0).toLocaleString()}자</span>
                                  </div>
                                  <div className="manuscript-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 5 }}>
                                    {episode.analysisStatus === 'REANALYSIS_REQUIRED' && (
                                      <BtnG
                                        small
                                        disabled={createEpisodeAnalysisRequest.isPending}
                                        label="재분석"
                                        onClick={() => {
                                          setEpisodeActionError(null);
                                          setEpisodeReanalysisTarget(episode);
                                        }}
                                      />
                                    )}
                                    <BtnG small label="원문" onClick={() => {
                                      setEditorMode('view');
                                      navigate(
                                        `/editor?workId=${encodeURIComponent(effectiveWorkId)}&episodeId=${episode.id}`,
                                        'push-right',
                                        { source: 'manuscripts', sourceWorkId: effectiveWorkId },
                                      );
                                    }} />
                                    <BtnG small label="파일 변경" disabled={isAnalyzing} onClick={() => {
                                      setReplacementFile(null);
                                      setReplacementFileError(null);
                                      setEpisodeActionError(null);
                                      setReplaceEpisodeTarget(episode);
                                    }} />
                                    <BtnG small label="삭제" disabled={isAnalyzing || !episode.id} onClick={() => {
                                      if (!episode.id) return;
                                      setEpisodeActionError(null);
                                      setEpisodeDeleteFailed(false);
                                      setEpisodeDeleteTarget(episode);
                                    }} />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 16 }}>
                            <button onClick={() => changeManuscriptPage(Math.max(0, currentEpisodePage - 1))} disabled={currentEpisodePage === 0} style={{ height: 32, padding: '0 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: currentEpisodePage === 0 ? C.t3 : C.t2, fontSize: 13, cursor: currentEpisodePage === 0 ? 'default' : 'pointer', fontFamily: 'inherit', opacity: currentEpisodePage === 0 ? 0.4 : 1 }}>← 이전</button>
                            <span style={{ color: C.t2, fontSize: 13 }}>{currentEpisodePage + 1} / {totalEpisodePages}</span>
                            <button onClick={() => changeManuscriptPage(Math.min(totalEpisodePages - 1, currentEpisodePage + 1))} disabled={currentEpisodePage >= totalEpisodePages - 1} style={{ height: 32, padding: '0 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: currentEpisodePage >= totalEpisodePages - 1 ? C.t3 : C.t2, fontSize: 13, cursor: currentEpisodePage >= totalEpisodePages - 1 ? 'default' : 'pointer', fontFamily: 'inherit', opacity: currentEpisodePage >= totalEpisodePages - 1 ? 0.4 : 1 }}>다음 →</button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </>
        </div>
      </div>
      {mobileNavOpen && (
        <div className="mobile-sidebar-layer" role="dialog" aria-modal="true" aria-label="워크스페이스 메뉴">
          <button
            type="button"
            className="mobile-sidebar-backdrop"
            aria-label="메뉴 닫기"
            onClick={() => setMobileNavOpen(false)}
          />
          <AppSidebar
            className="mobile-app-sidebar"
            activeNav={activeNav}
            onNavChange={setActiveNav}
            onComingSoon={setComingSoonFeature}
            onClose={() => setMobileNavOpen(false)}
          />
        </div>
      )}
      <ComingSoonToast feature={comingSoonFeature} onClose={closeComingSoon} />

      <AnimatePresence>
      {replaceEpisodeTarget && (
        <SourceFileModal
          title="회차 파일 변경"
          description={`${replaceEpisodeTarget.episodeNo}화 ${replaceEpisodeTarget.title || '제목 없음'}의 원문 파일을 변경합니다.`}
          currentFilename={replaceEpisodeTarget.originalFilename}
          warning="파일을 변경하면 이전 원문·청크·미확정 후보가 영구 삭제됩니다. 확정 설정은 유지되며 새 원문은 재분석이 필요합니다."
          file={replacementFile}
          fileError={replacementFileError}
          requestError={episodeActionError}
          pending={replaceEpisodeFileRequest.isPending}
          submitLabel="파일 변경"
          onFileChange={(file, error) => {
            setReplacementFile(file);
            setReplacementFileError(error);
            setEpisodeActionError(null);
          }}
          onClose={() => {
            if (replaceEpisodeFileRequest.isPending) return;
            setReplaceEpisodeTarget(null);
            setReplacementFile(null);
            setReplacementFileError(null);
            setEpisodeActionError(null);
          }}
          onSubmit={() => void replaceEpisodeFile()}
        />
      )}
      {episodeDeleteTarget && (
        <EpisodeDeleteModal
          episode={episodeDeleteTarget}
          submitting={episodeDeleteSubmitting}
          failed={episodeDeleteFailed}
          onClose={() => {
            if (episodeDeleteSubmitting) return;
            setEpisodeDeleteTarget(null);
            setEpisodeDeleteFailed(false);
          }}
          onDelete={() => void removeEpisode()}
        />
      )}
      {episodeReanalysisTarget && (
        <EpisodeReanalysisModal
          episode={episodeReanalysisTarget}
          laterAnalyzedEpisodeCount={episodeRows.filter(candidate => (
            (candidate.episodeNo ?? 0) > (episodeReanalysisTarget.episodeNo ?? 0)
            && candidate.analysisStatus === 'COMPLETED'
          )).length}
          submitting={createEpisodeAnalysisRequest.isPending}
          error={episodeActionError}
          onClose={() => {
            if (createEpisodeAnalysisRequest.isPending) return;
            setEpisodeReanalysisTarget(null);
            setEpisodeActionError(null);
          }}
          onConfirm={() => void startEpisodeReanalysis(episodeReanalysisTarget)}
        />
      )}
      </AnimatePresence>
    </div>
  );
}
