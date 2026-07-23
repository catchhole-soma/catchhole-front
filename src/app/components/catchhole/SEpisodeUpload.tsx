import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueries, useQuery } from '@tanstack/react-query';
import { useNavigate as useRouterNavigate, useSearchParams } from 'react-router';
import { motion } from 'motion/react';
import {
  AlertCircle,
  BookMarked,
  Check,
  ChevronLeft,
  CircleCheckBig,
  FileText,
  Files,
  RefreshCw,
  Upload,
} from 'lucide-react';
import {
  createAnalysisJobMutation as createAnalysisJobMutationOptions,
  detectEpisodesMutation as detectEpisodesMutationOptions,
  getAnalysisJobOptions,
  getEpisodesOptions,
  getWorkOptions,
  retryAnalysisJobMutation as retryAnalysisJobMutationOptions,
  uploadEpisodesMutation as uploadEpisodesMutationOptions,
  uploadSettingBookMutation as uploadSettingBookMutationOptions,
} from '../../api/generated/@tanstack/react-query.gen';
import type {
  AnalysisJobCreateRequest,
  DetectedEpisodeResponse,
  EpisodeDetectionRequest,
  EpisodeSummaryResponse,
  EpisodeUploadRequest,
  GetAnalysisJobResponse,
} from '../../api/generated/types.gen';
import { useAppContext } from '../../context/AppContext';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { toApiError } from '../../lib/api-errors';
import { validateManuscriptFile } from '../../lib/fileValidation';
import { C } from './constants';
import { FileDropArea } from './S1Dashboard';
import { UserMenu } from './UserMenu';
import type { EpisodeProcessingStatus } from './types';
import { JOB_STATUS_LABELS, PROCESSING_STATUS_LABELS } from './types';
import { ModeCard } from './ReviewLayout';

type UploadStep = 'select-mode' | 'boundary-preview' | 'processing';
type AnalysisJobType = AnalysisJobCreateRequest['jobType'];
type EpisodeUploadType = EpisodeDetectionRequest['uploadType'];

type EpisodeConfirmationDraft = {
  detectionOrder: number;
  sourceFileIndex: number;
  episodeNo: number;
  title: string;
  content: string;
  charCount: number;
};

type EpisodeMultipartBody = {
  metadata: EpisodeDetectionRequest | EpisodeUploadRequest;
  episodeFiles: Array<Blob | File>;
};

const PROCESSING_SEQUENCE: EpisodeProcessingStatus[] = [
  'UPLOADED',
  'CHUNKING',
  'CHUNKED',
  'PREPROCESSING',
  'PREPROCESSED',
  'ANALYZING',
  'ANALYZED',
];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function episodeMultipartSerializer(body: unknown): FormData {
  const multipartBody = body as EpisodeMultipartBody;
  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(multipartBody.metadata)], { type: 'application/json' }));
  multipartBody.episodeFiles.forEach(file => formData.append('episodeFiles', file));
  return formData;
}

function toEpisodeConfirmationDrafts(
  detectedEpisodes: DetectedEpisodeResponse[] | undefined,
): EpisodeConfirmationDraft[] {
  return (detectedEpisodes ?? []).map(detectedEpisode => ({
    detectionOrder: detectedEpisode.detectionOrder,
    sourceFileIndex: detectedEpisode.sourceFileIndex,
    episodeNo: detectedEpisode.episodeNo,
    title: detectedEpisode.title ?? '',
    content: detectedEpisode.content,
    charCount: detectedEpisode.charCount,
  }));
}

function errorMessage(error: unknown, fallback: string): string {
  const apiError = toApiError(error);
  switch (apiError?.code) {
    case 'EPISODE_UPLOAD_DUPLICATED':
      return apiError.message || '이미 등록된 회차 번호가 포함되어 있습니다.';
    case 'UPLOAD_EPISODE_NO_CONFLICT':
      return '파일명과 원문의 회차 번호가 다릅니다. 회차 번호를 직접 입력해주세요.';
    case 'UPLOAD_EPISODE_NO_DETECTION_FAILED':
      return '회차 번호를 찾지 못했습니다. 파일의 회차 표기를 확인해주세요.';
    case 'UPLOAD_EPISODE_COUNT_INVALID':
      return '다회차 업로드에는 정상 감지된 회차가 2개 이상 필요합니다.';
    case 'UPLOAD_EPISODE_CONFIRMATION_INVALID':
    case 'UPLOAD_EPISODE_ORDER_INVALID':
      return '회차 번호는 원문 순서대로 중복 없이 오름차순이어야 합니다.';
    case 'UPLOAD_SETTING_BOOK_DUPLICATED':
      return '같은 이름의 설정집이 이미 업로드되어 있습니다.';
    case 'UPLOAD_FILE_TYPE_NOT_SUPPORTED':
    case 'UPLOAD_FILE_TOO_LARGE':
    case 'UPLOAD_FILE_EMPTY':
      return apiError.message;
    default:
      return apiError?.message || fallback;
  }
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div style={{
      height: 56, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 20px', borderBottom: `1px solid ${C.border}`,
    }}>
      <button type="button" aria-label="원고 목록으로 돌아가기" onClick={onBack} style={{
        width: 32, height: 32, borderRadius: 6, border: `1px solid ${C.border}`,
        background: 'transparent', color: C.t2, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ChevronLeft size={16} />
      </button>
      <div style={{ color: C.t1, fontSize: 15, fontWeight: 700 }}>회차 업로드</div>
      <div style={{ flex: 1 }} />
      <UserMenu />
    </div>
  );
}

function Stepper({ labels, current }: { labels: string[]; current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', maxWidth: 860, margin: '0 auto', padding: '24px 20px 0' }}>
      {labels.map((label, index) => (
        <React.Fragment key={label}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: index + 1 <= current ? C.primary : C.border,
              color: index + 1 <= current ? '#fff' : C.t3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
            }}>
              {index + 1 < current ? <Check size={12} /> : index + 1}
            </div>
            <span style={{ color: index + 1 === current ? C.t1 : C.t3, fontSize: 12, whiteSpace: 'nowrap' }}>
              {label}
            </span>
          </div>
          {index < labels.length - 1 && (
            <div style={{ flex: 1, height: 1, background: index + 1 < current ? C.primary : C.border, margin: '0 12px' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, marginBottom: 6, letterSpacing: '0.05em' }}>
      {children}
    </div>
  );
}

function TextInput({ value, onChange, type = 'text', placeholder, disabled }: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={event => onChange(event.target.value)}
      type={type}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        width: '100%', height: 40, boxSizing: 'border-box', padding: '0 12px',
        borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg,
        color: C.t1, fontFamily: 'inherit', fontSize: 14, outline: 'none',
        opacity: disabled ? 0.55 : 1,
      }}
    />
  );
}

function PrimaryButton({ children, onClick, disabled = false }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      width: '100%', height: 40, border: 'none', borderRadius: 6,
      background: C.primary, color: '#fff', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
    }}>
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick, disabled = false }: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{
      height: 40, padding: '0 16px', borderRadius: 6, border: `1px solid ${C.border}`,
      background: 'transparent', color: C.t2, fontFamily: 'inherit', fontSize: 13,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
    }}>
      {children}
    </button>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '11px 12px', marginBottom: 16,
      borderRadius: 6, border: `1px solid ${C.danger}55`, background: `${C.danger}12`,
      color: C.danger, fontSize: 12,
    }}>
      <AlertCircle size={14} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>{message}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} style={{
          border: 0, background: 'transparent', color: C.danger, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
        }}>
          <RefreshCw size={12} /> 다시 시도
        </button>
      )}
    </div>
  );
}

function Spinner({ size = 16 }: { size?: number }) {
  return (
    <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}>
      <RefreshCw size={size} color={C.primary} />
    </motion.div>
  );
}

function AnalysisJobTypeSelector({ value, onChange, disabled }: {
  value: AnalysisJobType;
  onChange: (value: AnalysisJobType) => void;
  disabled: boolean;
}) {
  return (
    <>
      <FieldLabel>분석 유형</FieldLabel>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {(['EPISODE_VALIDATION', 'SETTING_EXTRACTION'] as AnalysisJobType[]).map(jobType => (
          <button key={jobType} type="button" disabled={disabled} onClick={() => onChange(jobType)} style={{
            flex: 1, padding: '10px 12px', textAlign: 'left', borderRadius: 6,
            background: value === jobType ? `${C.primary}14` : C.surface,
            border: `1px solid ${value === jobType ? C.primary : C.border}`,
            color: value === jobType ? C.t1 : C.t2, cursor: disabled ? 'default' : 'pointer',
            fontFamily: 'inherit', opacity: disabled ? 0.55 : 1,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
              {jobType === 'EPISODE_VALIDATION' ? '신규 회차 검수' : '기존 설정 구축'}
            </div>
            <div style={{ fontSize: 11, color: C.t3 }}>
              {jobType === 'EPISODE_VALIDATION' ? '확정된 설정과의 충돌을 검사합니다' : '원고에서 설정 후보를 추출합니다'}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function MultiFileDropArea({ files, error, onFilesChange, disabled }: {
  files: File[];
  error: string | null;
  onFilesChange: (files: File[], error: string | null) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFiles = (fileList: FileList | null) => {
    if (!fileList) return;
    const nextFiles = Array.from(fileList);
    const invalid = nextFiles.find(file => validateManuscriptFile(file) || !file.name.toLowerCase().endsWith('.txt'));
    if (invalid) {
      onFilesChange([], validateManuscriptFile(invalid) ?? '여러 파일 업로드는 TXT 파일만 지원합니다.');
      return;
    }
    if (nextFiles.length < 2) {
      onFilesChange(nextFiles, '두 개 이상의 TXT 파일을 선택해주세요.');
      return;
    }
    onFilesChange(nextFiles, null);
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <button type="button" disabled={disabled} onClick={() => inputRef.current?.click()} style={{
        width: '100%', minHeight: 110, borderRadius: 8,
        border: `2px dashed ${error ? C.danger : files.length >= 2 ? C.success : C.border}`,
        background: files.length >= 2 ? `${C.success}08` : 'transparent',
        color: files.length >= 2 ? C.success : C.t2, cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'inherit', opacity: disabled ? 0.55 : 1,
      }}>
        <input
          ref={inputRef}
          type="file"
          accept=".txt"
          multiple
          hidden
          onChange={event => handleFiles(event.target.files)}
        />
        <Upload size={22} style={{ margin: '0 auto 8px' }} />
        {files.length > 0 ? `${files.length}개 파일 선택됨` : '회차별 TXT 파일을 두 개 이상 선택하세요'}
      </button>
      {error && <div style={{ color: C.danger, fontSize: 12, marginTop: 6 }}>{error}</div>}
    </div>
  );
}

function SettingsFileInput({ include, setInclude, file, error, setFile, disabled, txtOnly = false }: {
  include: boolean;
  setInclude: (include: boolean) => void;
  file: File | null;
  error: string | null;
  setFile: (file: File | null, error: string | null) => void;
  disabled: boolean;
  txtOnly?: boolean;
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: C.t2, fontSize: 13, marginBottom: include ? 10 : 0 }}>
        <input
          type="checkbox"
          checked={include}
          disabled={disabled}
          onChange={event => setInclude(event.target.checked)}
          style={{ accentColor: C.primary }}
        />
        설정집도 함께 업로드 <span style={{ color: C.t3 }}>(원본만 저장)</span>
      </label>
      {include && (
        <FileDropArea
          file={file}
          error={error}
          onFileChange={setFile}
          fileLabel={txtOnly ? '설정집.txt' : '설정집.txt 또는 설정집.docx'}
          allowedExtensions={txtOnly ? ['.txt'] : undefined}
        />
      )}
    </div>
  );
}

function EpisodeConfirmationRows({ episodeConfirmations, onChange, disabled }: {
  episodeConfirmations: EpisodeConfirmationDraft[];
  onChange: (episodeConfirmations: EpisodeConfirmationDraft[]) => void;
  disabled: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
      {episodeConfirmations.map(confirmation => (
        <div key={confirmation.detectionOrder} style={{
          display: 'grid', gridTemplateColumns: '90px 1fr 90px', gap: 10, alignItems: 'center',
          padding: 12, borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface,
        }}>
          <TextInput
            type="number"
            value={String(confirmation.episodeNo)}
            disabled={disabled}
            onChange={value => onChange(episodeConfirmations.map(item =>
              item.detectionOrder === confirmation.detectionOrder
                ? { ...item, episodeNo: Number.parseInt(value, 10) || 0 }
                : item))}
          />
          <TextInput
            value={confirmation.title}
            placeholder="제목을 찾지 못했어요"
            disabled={disabled}
            onChange={value => onChange(episodeConfirmations.map(item =>
              item.detectionOrder === confirmation.detectionOrder
                ? { ...item, title: value }
                : item))}
          />
          <span style={{ color: C.t3, fontSize: 12, textAlign: 'right' }}>
            {confirmation.charCount.toLocaleString()}자
          </span>
        </div>
      ))}
    </div>
  );
}

function areEpisodeConfirmationsValid(
  episodeConfirmations: EpisodeConfirmationDraft[],
  existingEpisodeNos: Set<number>,
): boolean {
  if (episodeConfirmations.length === 0) return false;
  let previousEpisodeNo = 0;
  for (const confirmation of episodeConfirmations) {
    if (confirmation.episodeNo < 1
      || confirmation.episodeNo <= previousEpisodeNo
      || confirmation.title.trim().length > 100) return false;
    if (existingEpisodeNos.has(confirmation.episodeNo)) return false;
    previousEpisodeNo = confirmation.episodeNo;
  }
  return true;
}

function toProcessingStatus(status: EpisodeSummaryResponse['status']): EpisodeProcessingStatus {
  return status === 'ARCHIVED' || !status ? 'UPLOADED' : status;
}

export default function SEpisodeUpload() {
  const navigate = useAppNavigate();
  const routerNavigate = useRouterNavigate();
  const { selectedWork, selectedWorkMeta, selectWork } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();
  const routeWorkId = searchParams.get('workId');
  const workId = routeWorkId ?? selectedWork;
  const initialTrackedAnalysisJobIds = (searchParams.get('analysisJobIds') ?? '').split(',').filter(Boolean);
  const initialCurrentAnalysisJobIds = (searchParams.get('currentAnalysisJobIds') ?? '').split(',').filter(Boolean);

  const [step, setStep] = useState<UploadStep>(
    initialTrackedAnalysisJobIds.length > 0 ? 'processing' : 'select-mode',
  );
  const [uploadType, setUploadType] = useState<EpisodeUploadType | null>(null);
  const [episodeNo, setEpisodeNo] = useState('');
  const [episodeNoTouched, setEpisodeNoTouched] = useState(false);
  const [episodeTitle, setEpisodeTitle] = useState('');
  const [episodeTitleTouched, setEpisodeTitleTouched] = useState(false);
  const [singleFile, setSingleFile] = useState<File | null>(null);
  const [singleFileError, setSingleFileError] = useState<string | null>(null);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkFileError, setBulkFileError] = useState<string | null>(null);
  const [multiFiles, setMultiFiles] = useState<File[]>([]);
  const [multiFilesError, setMultiFilesError] = useState<string | null>(null);
  const [episodeConfirmationDrafts, setEpisodeConfirmationDrafts] = useState<EpisodeConfirmationDraft[]>([]);
  const [selectedDetectionOrder, setSelectedDetectionOrder] = useState<number | null>(null);
  const initialAnalysisJobType: AnalysisJobType = searchParams.get('jobType') === 'SETTING_EXTRACTION'
    ? 'SETTING_EXTRACTION'
    : 'EPISODE_VALIDATION';
  const [analysisJobType, setAnalysisJobType] = useState<AnalysisJobType>(initialAnalysisJobType);
  const [includeSettings, setIncludeSettings] = useState(false);
  const [settingsFile, setSettingsFile] = useState<File | null>(null);
  const [settingsFileError, setSettingsFileError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [episodeUploadBatchId, setEpisodeUploadBatchId] = useState<string | null>(searchParams.get('batchId'));
  const [uploadedEpisodes, setUploadedEpisodes] = useState<EpisodeSummaryResponse[]>([]);
  const [trackedAnalysisJobIds, setTrackedAnalysisJobIds] = useState<string[]>(initialTrackedAnalysisJobIds);
  const [currentAnalysisJobIds, setCurrentAnalysisJobIds] = useState<string[]>(
    initialCurrentAnalysisJobIds.length > 0
      ? initialCurrentAnalysisJobIds
      : initialTrackedAnalysisJobIds,
  );
  const [analysisStartError, setAnalysisStartError] = useState<string | null>(null);
  const [settingSaveStatus, setSettingSaveStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [settingUploadError, setSettingUploadError] = useState<string | null>(null);

  const goBackToEntry = () => {
    const historyIndex = (window.history.state as { idx?: number } | null)?.idx;
    if (typeof historyIndex === 'number' && historyIndex > 0) routerNavigate(-1);
    else navigate('/dashboard?nav=manuscripts', 'pop', undefined, { replace: true });
  };

  const workQuery = useQuery({
    ...getWorkOptions({ path: { workId } }),
    enabled: UUID_PATTERN.test(workId),
    retry: false,
  });
  const routeWork = workQuery.data?.data;

  useEffect(() => {
    if (!routeWorkId || !routeWork?.id || !routeWork.title) return;
    const nextGenre = routeWork.genre ?? '';
    if (selectedWorkMeta.id === routeWork.id
      && selectedWorkMeta.title === routeWork.title
      && selectedWorkMeta.genre === nextGenre) return;
    selectWork({ id: routeWork.id, title: routeWork.title, genre: nextGenre });
  }, [routeWorkId, routeWork?.genre, routeWork?.id, routeWork?.title, selectWork, selectedWorkMeta]);

  const episodesQuery = useQuery({
    ...getEpisodesOptions({ path: { workId } }),
    enabled: UUID_PATTERN.test(workId),
    retry: false,
  });
  const existingEpisodes = useMemo(
    () => episodesQuery.data?.data ?? [],
    [episodesQuery.data?.data],
  );
  const existingEpisodeNos = useMemo(
    () => new Set(existingEpisodes.flatMap(episode => episode.episodeNo === undefined ? [] : [episode.episodeNo])),
    [existingEpisodes],
  );

  useEffect(() => {
    if (episodeNoTouched || episodesQuery.isPending || episodesQuery.isError) return;
    const latest = existingEpisodes.reduce((max, episode) => Math.max(max, episode.episodeNo ?? 0), 0);
    setEpisodeNo(String(latest + 1));
  }, [episodeNoTouched, episodesQuery.isError, episodesQuery.isPending, existingEpisodes]);

  const detectEpisodesMutation = useMutation(detectEpisodesMutationOptions());
  const uploadEpisodesMutation = useMutation(uploadEpisodesMutationOptions());
  const uploadSettingBookMutation = useMutation(uploadSettingBookMutationOptions());
  const createAnalysisJobMutation = useMutation(createAnalysisJobMutationOptions());
  const retryAnalysisJobMutation = useMutation(retryAnalysisJobMutationOptions());
  const submitting = uploadEpisodesMutation.isPending
    || uploadSettingBookMutation.isPending
    || createAnalysisJobMutation.isPending;

  const jobQueries = useQueries({
    queries: trackedAnalysisJobIds.map(analysisJobId => ({
      ...getAnalysisJobOptions({ path: { workId, analysisJobId } }),
      enabled: step === 'processing' && UUID_PATTERN.test(workId),
      retry: false,
      refetchInterval: (query: { state: { data?: GetAnalysisJobResponse } }) => {
        const status = query.state.data?.data?.status;
        return status === 'SUCCEEDED' || status === 'FAILED' ? false : 3_000;
      },
    })),
  });

  const jobs = jobQueries.flatMap(query => query.data?.data ? [query.data.data] : []);
  const jobsById = new Map(jobs.flatMap(job => job.id ? [[job.id, job] as const] : []));
  const currentAnalysisJobs = currentAnalysisJobIds.flatMap(
    analysisJobId => jobsById.get(analysisJobId) ? [jobsById.get(analysisJobId)!] : [],
  );
  const workTitle = jobs.find(job => job.workTitle)?.workTitle ?? routeWork?.title ?? selectedWorkMeta.title;
  const resolvedAnalysisJobType = jobs.find(job => job.jobType)?.jobType ?? analysisJobType;

  const progressEpisodes = useMemo(() => {
    const byId = new Map<string, EpisodeSummaryResponse>();
    uploadedEpisodes.forEach(episode => { if (episode.id) byId.set(episode.id, episode); });
    jobs.forEach(job => job.episodes?.forEach(episode => {
      if (!episode.id) return;
      byId.set(episode.id, {
        ...byId.get(episode.id),
        id: episode.id,
        episodeNo: episode.episodeNo,
        title: episode.title,
        status: episode.status,
        updatedAt: episode.updatedAt,
      });
    }));
    return [...byId.values()].sort((a, b) => (a.episodeNo ?? 0) - (b.episodeNo ?? 0));
  }, [jobs, uploadedEpisodes]);

  const currentAnalysisJobsLoaded = currentAnalysisJobIds.length > 0
    && currentAnalysisJobs.length === currentAnalysisJobIds.length;
  const analysisFailed = currentAnalysisJobsLoaded
    && currentAnalysisJobs.some(job => job.status === 'FAILED');
  const analysisSucceeded = currentAnalysisJobsLoaded
    && currentAnalysisJobs.every(job => job.status === 'SUCCEEDED')
    && progressEpisodes.length > 0
    && progressEpisodes.every(episode => episode.status === 'ANALYZED');
  const analysisRunning = currentAnalysisJobs.some(
    job => job.status === 'PENDING' || job.status === 'RUNNING',
  );
  const failedJobMessages = [...new Set(currentAnalysisJobs.flatMap(job =>
    job.status === 'FAILED' && job.errorMessage ? [job.errorMessage] : []))];
  const statusQueryFailed = jobQueries.some(query => query.isError);

  const labels = uploadType === 'MULTI_EPISODE_SINGLE_FILE'
    ? ['업로드 방식', '원고 파일 입력', '회차 분리 확인', '분석 진행']
    : ['업로드 방식', '회차 정보 입력', '분석 진행'];
  const currentStep = step === 'processing'
    ? labels.length
    : step === 'boundary-preview'
      ? 3
      : uploadType
        ? 2
        : 1;

  const persistAnalysisRoute = (
    batchId: string,
    nextTrackedAnalysisJobIds: string[],
    nextCurrentAnalysisJobIds: string[],
  ) => {
    setSearchParams(params => {
      params.set('workId', workId);
      params.set('batchId', batchId);
      params.set('analysisJobIds', nextTrackedAnalysisJobIds.join(','));
      params.set('currentAnalysisJobIds', nextCurrentAnalysisJobIds.join(','));
      params.set('jobType', analysisJobType);
      return params;
    }, { replace: true });
  };

  const detectEpisodesFromFiles = async (
    nextUploadType: EpisodeUploadType,
    sourceEpisodeFiles: File[],
    singleEpisodeMetadata: Pick<
      EpisodeDetectionRequest,
      'singleEpisodeNo' | 'singleEpisodeTitle'
    > = {},
  ) => {
    setRequestError(null);
    try {
      const response = await detectEpisodesMutation.mutateAsync({
        path: { workId },
        body: {
          metadata: { uploadType: nextUploadType, ...singleEpisodeMetadata },
          episodeFiles: sourceEpisodeFiles,
        },
        bodySerializer: episodeMultipartSerializer,
      });
      const nextEpisodeConfirmationDrafts = toEpisodeConfirmationDrafts(
        response.data?.detectedEpisodes,
      );
      setEpisodeConfirmationDrafts(nextEpisodeConfirmationDrafts);
      setSelectedDetectionOrder(nextEpisodeConfirmationDrafts[0]?.detectionOrder ?? null);
      return nextEpisodeConfirmationDrafts;
    } catch (error) {
      setEpisodeConfirmationDrafts([]);
      setRequestError(errorMessage(error, '회차 표기를 확인하지 못했습니다. 다시 시도해주세요.'));
      return [];
    }
  };

  const handleSingleFile = async (file: File | null, error: string | null) => {
    setSingleFile(file);
    setSingleFileError(error);
    setRequestError(null);
    if (!file || error) return;
    const detectedEpisodes = await detectEpisodesFromFiles('SINGLE_EPISODE', [file], {
      singleEpisodeNo: episodeNo.trim() ? Number.parseInt(episodeNo, 10) : null,
      singleEpisodeTitle: episodeTitle.trim() || null,
    });
    const firstDetectedEpisode = detectedEpisodes[0];
    if (!firstDetectedEpisode) return;
    if (!episodeNo.trim()) setEpisodeNo(String(firstDetectedEpisode.episodeNo));
    if (!episodeTitleTouched && firstDetectedEpisode.title) setEpisodeTitle(firstDetectedEpisode.title);
  };

  const handleBulkFile = async (file: File | null, error: string | null) => {
    setBulkFile(file);
    setBulkFileError(error);
    setEpisodeConfirmationDrafts([]);
    setRequestError(null);
    if (!file || error) return;
    await detectEpisodesFromFiles('MULTI_EPISODE_SINGLE_FILE', [file]);
  };

  const handleMultiFiles = async (files: File[], error: string | null) => {
    setMultiFiles(files);
    setMultiFilesError(error);
    setEpisodeConfirmationDrafts([]);
    setRequestError(null);
    if (files.length < 2 || error) return;
    await detectEpisodesFromFiles('MULTI_EPISODE_MULTI_FILE', files);
  };

  const createBatchAnalysisJob = async (batchId: string) => {
    setAnalysisStartError(null);
    try {
      const response = await createAnalysisJobMutation.mutateAsync({
        path: { workId },
        body: { jobType: analysisJobType, batchId },
      });
      const analysisJobId = response.data?.id;
      if (!analysisJobId) throw new Error('분석 작업 ID가 응답에 없습니다.');
      setTrackedAnalysisJobIds([analysisJobId]);
      setCurrentAnalysisJobIds([analysisJobId]);
      persistAnalysisRoute(batchId, [analysisJobId], [analysisJobId]);
    } catch (error) {
      setAnalysisStartError(errorMessage(error, '회차는 저장했지만 분석을 시작하지 못했습니다.'));
    }
  };

  const uploadSelectedSettingBook = async () => {
    if (!includeSettings || !settingsFile || settingSaveStatus === 'success') return;
    setSettingUploadError(null);
    try {
      await uploadSettingBookMutation.mutateAsync({
        path: { workId },
        body: { file: settingsFile },
      });
      setSettingSaveStatus('success');
    } catch (error) {
      setSettingSaveStatus('failed');
      setSettingUploadError(errorMessage(error, '설정집 원본 저장에 실패했습니다. 설정집만 다시 시도할 수 있습니다.'));
      throw error;
    }
  };

  const submitEpisodeUpload = async () => {
    if (!uploadType) return;
    setRequestError(null);
    const sourceEpisodeFiles = uploadType === 'SINGLE_EPISODE'
      ? (singleFile ? [singleFile] : [])
      : uploadType === 'MULTI_EPISODE_SINGLE_FILE'
        ? (bulkFile ? [bulkFile] : [])
        : multiFiles;
    const metadata: EpisodeUploadRequest = uploadType === 'SINGLE_EPISODE'
      ? {
          uploadType,
          singleEpisodeNo: Number.parseInt(episodeNo, 10),
          singleEpisodeTitle: episodeTitle.trim() || null,
        }
      : {
          uploadType,
          episodeConfirmations: episodeConfirmationDrafts.map(confirmation => ({
            detectionOrder: confirmation.detectionOrder,
            episodeNo: confirmation.episodeNo,
            title: confirmation.title.trim() || null,
          })),
        };

    const episodeUploadPromise = uploadEpisodesMutation.mutateAsync({
      path: { workId },
      body: {
        metadata,
        episodeFiles: sourceEpisodeFiles,
      },
      bodySerializer: episodeMultipartSerializer,
    });
    const settingUploadPromise = includeSettings && settingsFile && settingSaveStatus !== 'success'
      ? uploadSelectedSettingBook()
      : Promise.resolve();
    const [episodeResult, settingResult] = await Promise.allSettled([episodeUploadPromise, settingUploadPromise]);

    if (episodeResult.status === 'rejected') {
      setRequestError(errorMessage(
        episodeResult.reason,
        includeSettings && settingResult.status === 'fulfilled'
          ? '설정집은 저장했지만 회차 저장에 실패했습니다. 회차만 다시 시도해주세요.'
          : '회차 저장에 실패했습니다. 입력값과 파일을 유지했으니 다시 시도해주세요.',
      ));
      return;
    }

    try {
      const episodeUpload = episodeResult.value.data;
      if (!episodeUpload?.batchId) throw new Error('업로드 배치 ID가 응답에 없습니다.');
      setEpisodeUploadBatchId(episodeUpload.batchId);
      setUploadedEpisodes(episodeUpload.createdEpisodes ?? []);
      setStep('processing');
      await createBatchAnalysisJob(episodeUpload.batchId);
    } catch (error) {
      setRequestError(errorMessage(error, '회차 저장에 실패했습니다. 입력값과 파일을 유지했으니 다시 시도해주세요.'));
    }
  };

  const retryFailedAnalysisJobs = async () => {
    const failedAnalysisJobIds = currentAnalysisJobs.flatMap(
      job => job.status === 'FAILED' && job.id ? [job.id] : [],
    );
    if (failedAnalysisJobIds.length === 0 || !episodeUploadBatchId) return;
    setAnalysisStartError(null);
    try {
      const responses = await Promise.all(
        failedAnalysisJobIds.map(analysisJobId => retryAnalysisJobMutation.mutateAsync({
          path: { workId, analysisJobId },
        })),
      );
      const retryAnalysisJobIds = responses
        .flatMap(response => response.data ?? [])
        .flatMap(job => job.id ? [job.id] : []);
      if (retryAnalysisJobIds.length === 0) throw new Error('재시도 작업 ID가 응답에 없습니다.');
      const nextTrackedAnalysisJobIds = [...trackedAnalysisJobIds, ...retryAnalysisJobIds];
      setTrackedAnalysisJobIds(nextTrackedAnalysisJobIds);
      setCurrentAnalysisJobIds(retryAnalysisJobIds);
      persistAnalysisRoute(
        episodeUploadBatchId,
        nextTrackedAnalysisJobIds,
        retryAnalysisJobIds,
      );
    } catch (error) {
      setAnalysisStartError(errorMessage(error, '실패 회차 분석을 다시 요청하지 못했습니다.'));
    }
  };

  const singleNo = Number.parseInt(episodeNo, 10);
  const singleValid = Boolean(singleFile)
    && Number.isInteger(singleNo)
    && singleNo >= 1
    && !existingEpisodeNos.has(singleNo)
    && episodeTitle.trim().length <= 100;
  const episodeConfirmationsValid = areEpisodeConfirmationsValid(
    episodeConfirmationDrafts,
    existingEpisodeNos,
  );
  const settingsModeError = uploadType === 'MULTI_EPISODE_MULTI_FILE'
    && settingsFile
    && !settingsFile.name.toLowerCase().endsWith('.txt')
    ? '다회차 여러 파일 업로드에서는 설정집도 TXT 파일만 지원합니다.'
    : settingsFileError;
  const settingsValid = !includeSettings || Boolean(settingsFile && !settingsModeError);
  const canSubmit = UUID_PATTERN.test(workId)
    && settingsValid
    && !detectEpisodesMutation.isPending
    && !submitting
    && (uploadType === 'SINGLE_EPISODE' ? singleValid
      : uploadType === 'MULTI_EPISODE_SINGLE_FILE'
        ? Boolean(bulkFile) && episodeConfirmationDrafts.length >= 2 && episodeConfirmationsValid
        : multiFiles.length >= 2 && episodeConfirmationsValid);

  if (!UUID_PATTERN.test(workId)) {
    return (
      <div style={{ width: '100%', height: '100%', background: C.bg, color: C.t2 }}>
        <Header onBack={() => navigate('/works', 'pop')} />
        <div style={{ maxWidth: 560, margin: '80px auto', textAlign: 'center' }}>
          <AlertCircle size={36} color={C.warning} style={{ marginBottom: 14 }} />
          <div style={{ color: C.t1, fontSize: 17, fontWeight: 700, marginBottom: 8 }}>실제 API에 연결할 작품이 필요합니다</div>
          <div style={{ fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
            작품 선택 화면에서 <b>Episode API 테스트 작품</b>을 선택하면 실제 소유 UUID가 준비됩니다.
          </div>
          <PrimaryButton onClick={() => navigate('/works', 'pop')}>작품 선택으로 이동</PrimaryButton>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: C.bg, color: C.t1,
      fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', sans-serif",
    }}>
      <Header onBack={goBackToEntry} />
      <Stepper labels={labels} current={currentStep} />
      <div style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: step === 'boundary-preview' ? 900 : 720, margin: '0 auto', padding: '28px 20px 64px' }}>
          {step === 'select-mode' && (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 5 }}>{workTitle} · 회차 업로드</div>
              <div style={{ color: C.t2, fontSize: 13, marginBottom: 24 }}>업로드 방식과 분석 목적을 선택하세요.</div>

              {episodesQuery.isError && (
                <ErrorBanner message="기존 회차 번호를 불러오지 못했습니다. 번호를 직접 확인해주세요." onRetry={() => void episodesQuery.refetch()} />
              )}
              {requestError && <ErrorBanner message={requestError} />}

              <div style={{ display: 'flex', gap: 12, marginBottom: uploadType ? 28 : 0 }}>
                <ModeCard
                  icon={<FileText size={22} />}
                  title="단일 회차 업로드"
                  desc="새 회차 파일 한 개를 등록합니다"
                  color={C.primary}
                  selected={uploadType === 'SINGLE_EPISODE'}
                  onSelect={() => {
                    if (!submitting) {
                      setUploadType('SINGLE_EPISODE');
                      setEpisodeConfirmationDrafts([]);
                      setRequestError(null);
                    }
                  }}
                />
                <ModeCard
                  icon={<BookMarked size={22} />}
                  title="다회차 - 단일 파일"
                  desc="명시적인 회차 제목 행을 기준으로 분리합니다"
                  color={C.success}
                  selected={uploadType === 'MULTI_EPISODE_SINGLE_FILE'}
                  onSelect={() => {
                    if (!submitting) {
                      setUploadType('MULTI_EPISODE_SINGLE_FILE');
                      setEpisodeConfirmationDrafts([]);
                      setRequestError(null);
                    }
                  }}
                />
                <ModeCard
                  icon={<Files size={22} />}
                  title="다회차 - 여러 파일"
                  desc="TXT 파일마다 한 회차로 등록합니다"
                  color={C.warning}
                  selected={uploadType === 'MULTI_EPISODE_MULTI_FILE'}
                  onSelect={() => {
                    if (!submitting) {
                      setUploadType('MULTI_EPISODE_MULTI_FILE');
                      setEpisodeConfirmationDrafts([]);
                      setRequestError(null);
                    }
                  }}
                />
              </div>

              {uploadType === 'SINGLE_EPISODE' && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
                  <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 160 }}>
                      <FieldLabel>회차 번호</FieldLabel>
                      <TextInput
                        value={episodeNo}
                        type="number"
                        disabled={submitting}
                        placeholder="비우면 파일에서 감지"
                        onChange={value => { setEpisodeNoTouched(true); setEpisodeNo(value); }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <FieldLabel>회차 제목 (선택)</FieldLabel>
                      <TextInput
                        value={episodeTitle}
                        disabled={submitting}
                        placeholder="비우면 원문 제목 행에서 감지"
                        onChange={value => { setEpisodeTitleTouched(true); setEpisodeTitle(value); }}
                      />
                    </div>
                  </div>
                  {existingEpisodeNos.has(singleNo) && (
                    <div style={{ color: C.danger, fontSize: 12, margin: '-8px 0 12px' }}>이미 등록된 회차 번호입니다.</div>
                  )}
                  <FieldLabel>회차 파일</FieldLabel>
                  <FileDropArea
                    file={singleFile}
                    error={singleFileError}
                    onFileChange={(file, error) => void handleSingleFile(file, error)}
                    fileLabel="회차파일.txt 또는 회차파일.docx"
                  />
                  {detectEpisodesMutation.isPending && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: C.t2, fontSize: 12, marginBottom: 14 }}>
                      <Spinner size={13} /> 회차 번호와 제목을 확인하고 있습니다.
                    </div>
                  )}
                </div>
              )}

              {uploadType === 'MULTI_EPISODE_SINGLE_FILE' && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
                  <FieldLabel>다회차 원고 파일</FieldLabel>
                  <FileDropArea
                    file={bulkFile}
                    error={bulkFileError}
                    onFileChange={(file, error) => void handleBulkFile(file, error)}
                    fileLabel="제 N화, EP N, Episode N, Chapter N 제목 행이 있는 TXT 또는 DOCX"
                  />
                  {detectEpisodesMutation.isPending && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: C.t2, fontSize: 12, marginBottom: 14 }}>
                      <Spinner size={13} /> 회차 표기를 확인하고 있습니다.
                    </div>
                  )}
                  {episodeConfirmationDrafts.length > 0 && (
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', padding: '10px 12px', marginBottom: 16,
                      borderRadius: 6, background: `${C.success}10`, border: `1px solid ${C.success}44`,
                      color: C.success, fontSize: 12,
                    }}>
                      <span>{episodeConfirmationDrafts.length}개 회차 감지됨</span>
                      <span>
                        {episodeConfirmationDrafts
                          .reduce((sum, confirmation) => sum + confirmation.charCount, 0)
                          .toLocaleString()}자
                      </span>
                    </div>
                  )}
                </div>
              )}

              {uploadType === 'MULTI_EPISODE_MULTI_FILE' && (
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 24 }}>
                  <FieldLabel>회차별 TXT 파일</FieldLabel>
                  <MultiFileDropArea
                    files={multiFiles}
                    error={multiFilesError}
                    onFilesChange={(files, error) => void handleMultiFiles(files, error)}
                    disabled={submitting}
                  />
                  {detectEpisodesMutation.isPending && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: C.t2, fontSize: 12, marginBottom: 14 }}>
                      <Spinner size={13} /> 파일별 회차 번호와 제목을 확인하고 있습니다.
                    </div>
                  )}
                  {episodeConfirmationDrafts.length > 0 && (
                    <>
                      <FieldLabel>파일별 회차 정보 확인</FieldLabel>
                      <EpisodeConfirmationRows
                        episodeConfirmations={episodeConfirmationDrafts}
                        onChange={setEpisodeConfirmationDrafts}
                        disabled={submitting}
                      />
                    </>
                  )}
                </div>
              )}

              {uploadType && (
                <>
                  <AnalysisJobTypeSelector
                    value={analysisJobType}
                    onChange={setAnalysisJobType}
                    disabled={submitting}
                  />
                  <SettingsFileInput
                    include={includeSettings}
                    setInclude={include => {
                      setIncludeSettings(include);
                      if (!include) {
                        setSettingSaveStatus('idle');
                        setSettingUploadError(null);
                      }
                    }}
                    file={settingsFile}
                    error={settingsModeError}
                    setFile={(file, error) => {
                      setSettingsFile(file);
                      setSettingsFileError(error);
                      setSettingSaveStatus('idle');
                      setSettingUploadError(null);
                    }}
                    disabled={submitting}
                    txtOnly={uploadType === 'MULTI_EPISODE_MULTI_FILE'}
                  />
                  {settingSaveStatus === 'success' && (
                    <div style={{ color: C.success, fontSize: 12, margin: '-4px 0 14px' }}>
                      설정집 원본은 저장되었습니다. 회차를 다시 시도해도 중복 저장하지 않습니다.
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <SecondaryButton onClick={() => setUploadType(null)} disabled={submitting}>← 뒤로</SecondaryButton>
                    <div style={{ flex: 1 }}>
                      {uploadType === 'MULTI_EPISODE_SINGLE_FILE' ? (
                        <PrimaryButton
                          disabled={!canSubmit}
                          onClick={() => {
                            setSelectedDetectionOrder(
                              episodeConfirmationDrafts[0]?.detectionOrder ?? null,
                            );
                            setStep('boundary-preview');
                          }}
                        >
                          다음 — 회차 분리 확인
                        </PrimaryButton>
                      ) : (
                        <PrimaryButton disabled={!canSubmit} onClick={() => void submitEpisodeUpload()}>
                          {submitting ? '저장 중...' : '다음 — 분석 시작'}
                        </PrimaryButton>
                      )}
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {step === 'boundary-preview' && (
            <>
              <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 5 }}>회차 분리 확인</div>
              <div style={{ color: C.t2, fontSize: 13, marginBottom: 20 }}>
                감지 경계는 고정됩니다. 번호와 제목만 확인·수정할 수 있습니다.
              </div>
              {requestError && <ErrorBanner message={requestError} />}
              <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {episodeConfirmationDrafts.map(confirmation => (
                    <button
                      key={confirmation.detectionOrder}
                      type="button"
                      onClick={() => setSelectedDetectionOrder(confirmation.detectionOrder)}
                      style={{
                        padding: '11px 12px', textAlign: 'left', borderRadius: 7,
                        border: `1px solid ${selectedDetectionOrder === confirmation.detectionOrder ? C.primary : C.border}`,
                        background: selectedDetectionOrder === confirmation.detectionOrder ? `${C.primary}12` : C.surface,
                        color: C.t1, cursor: 'pointer', fontFamily: 'inherit',
                      }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 3 }}>
                        {confirmation.episodeNo}화 {confirmation.title || '제목을 찾지 못했어요'}
                      </div>
                      <div style={{ color: C.t3, fontSize: 11 }}>
                        {confirmation.charCount.toLocaleString()}자
                      </div>
                    </button>
                  ))}
                </div>
                {(() => {
                  const selectedConfirmation = episodeConfirmationDrafts.find(
                    confirmation => confirmation.detectionOrder === selectedDetectionOrder,
                  ) ?? episodeConfirmationDrafts[0];
                  if (!selectedConfirmation) return null;
                  return (
                    <div style={{ border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, padding: 16 }}>
                      <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                        <div style={{ width: 110 }}>
                          <FieldLabel>회차 번호</FieldLabel>
                          <TextInput
                            type="number"
                            value={String(selectedConfirmation.episodeNo)}
                            onChange={value => setEpisodeConfirmationDrafts(items => items.map(item =>
                              item.detectionOrder === selectedConfirmation.detectionOrder
                              ? { ...item, episodeNo: Number.parseInt(value, 10) || 0 }
                              : item))}
                          />
                        </div>
                        <div style={{ flex: 1 }}>
                          <FieldLabel>회차 제목 (선택)</FieldLabel>
                          <TextInput
                            value={selectedConfirmation.title}
                            placeholder="제목을 찾지 못했어요"
                            onChange={value => setEpisodeConfirmationDrafts(items => items.map(item =>
                              item.detectionOrder === selectedConfirmation.detectionOrder
                              ? { ...item, title: value }
                              : item))}
                          />
                        </div>
                      </div>
                      <FieldLabel>고정 경계 원문 미리보기</FieldLabel>
                      <div style={{
                        maxHeight: 390, overflowY: 'auto', whiteSpace: 'pre-wrap', padding: 14,
                        borderRadius: 6, border: `1px solid ${C.border}`, background: C.bg,
                        color: C.t2, fontSize: 12, lineHeight: 1.8,
                      }}>
                        {selectedConfirmation.content}
                      </div>
                    </div>
                  );
                })()}
              </div>
              {!episodeConfirmationsValid && (
                <div style={{ color: C.danger, fontSize: 12, marginTop: 12 }}>
                  번호는 1 이상의 정수이며 원문 순서대로 중복 없이 오름차순이어야 하고, 기존 회차와 중복될 수 없습니다.
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <SecondaryButton onClick={() => setStep('select-mode')} disabled={submitting}>← 이전</SecondaryButton>
                <div style={{ flex: 1 }}>
                  <PrimaryButton disabled={!canSubmit} onClick={() => void submitEpisodeUpload()}>
                    {submitting
                      ? '회차 묶음 저장 중...'
                      : `회차 분리 확정 (${episodeConfirmationDrafts.length}개) →`}
                  </PrimaryButton>
                </div>
              </div>
            </>
          )}

          {step === 'processing' && (
            <div>
              <div style={{ textAlign: 'center', marginBottom: 26 }}>
                {analysisSucceeded
                  ? <CircleCheckBig size={52} color={C.success} style={{ marginBottom: 12 }} />
                  : analysisFailed
                    ? <AlertCircle size={52} color={C.danger} style={{ marginBottom: 12 }} />
                    : <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Spinner size={46} /></div>}
                <div style={{ fontSize: 17, fontWeight: 700, marginBottom: 5 }}>
                  {analysisSucceeded ? '분석이 완료되었습니다'
                    : analysisFailed ? '일부 회차 분석에 실패했습니다'
                      : analysisRunning ? '회차를 분석하고 있습니다' : '분석을 준비하고 있습니다'}
                </div>
                <div style={{ color: C.t2, fontSize: 13 }}>
                  {workTitle} · {resolvedAnalysisJobType === 'EPISODE_VALIDATION' ? '신규 회차 검수' : '기존 설정 구축'}
                </div>
              </div>

              {settingUploadError && (
                <ErrorBanner message={settingUploadError} onRetry={() => void uploadSelectedSettingBook()} />
              )}
              {settingSaveStatus === 'success' && includeSettings && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 7, padding: '10px 12px', marginBottom: 16,
                  borderRadius: 6, border: `1px solid ${C.success}44`, background: `${C.success}10`,
                  color: C.success, fontSize: 12,
                }}>
                  <CircleCheckBig size={14} /> 설정집 원본도 독립적으로 저장되었습니다.
                </div>
              )}
              {analysisStartError && (
                <ErrorBanner
                  message={analysisStartError}
                  onRetry={episodeUploadBatchId && currentAnalysisJobIds.length === 0
                    ? () => void createBatchAnalysisJob(episodeUploadBatchId)
                    : undefined}
                />
              )}
              {analysisFailed && failedJobMessages.length > 0 && (
                <ErrorBanner message={`마지막 실패 사유: ${failedJobMessages.join(' / ')}`} />
              )}
              {statusQueryFailed && (
                <ErrorBanner
                  message="상태를 갱신하지 못했습니다. 마지막으로 확인한 상태를 유지합니다."
                  onRetry={() => jobQueries.forEach(query => void query.refetch())}
                />
              )}

              {progressEpisodes.length === 0 && currentAnalysisJobIds.length > 0 && !statusQueryFailed && (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><Spinner /></div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {progressEpisodes.map(episode => {
                  const status = toProcessingStatus(episode.status);
                  const sequenceIndex = status === 'FAILED' ? -1 : PROCESSING_SEQUENCE.indexOf(status);
                  return (
                    <div key={episode.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 14, background: C.surface }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontSize: 14, fontWeight: 700 }}>
                          {episode.episodeNo}화 {episode.title || '제목을 찾지 못했어요'}
                        </div>
                        <span style={{
                          color: status === 'FAILED' ? C.danger : status === 'ANALYZED' ? C.success : C.t2,
                          fontSize: 12, fontWeight: 700,
                        }}>
                          {status === 'FAILED' ? '분석 실패' : PROCESSING_STATUS_LABELS[status]}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {PROCESSING_SEQUENCE.map((item, index) => (
                          <span key={item} style={{
                            padding: '3px 8px', borderRadius: 12, fontSize: 10.5,
                            background: index <= sequenceIndex ? `${C.primary}18` : C.bg,
                            border: `1px solid ${index <= sequenceIndex ? `${C.primary}55` : C.border}`,
                            color: index <= sequenceIndex ? C.primary : C.t3,
                          }}>
                            {PROCESSING_STATUS_LABELS[item]}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
                <SecondaryButton onClick={() => navigate('/dashboard?nav=manuscripts', 'pop')}>원고 목록으로</SecondaryButton>
                <div style={{ flex: 1 }}>
                  {analysisSucceeded ? (
                    <PrimaryButton onClick={() => {
                      const episodeIds = progressEpisodes.flatMap(episode => episode.id ? [episode.id] : []);
                      if (resolvedAnalysisJobType === 'EPISODE_VALIDATION') {
                        navigate('/episode-validation-report', 'dissolve', {
                          workId,
                          batchId: episodeUploadBatchId,
                          analysisJobIds: currentAnalysisJobIds,
                          episodeIds,
                        });
                      } else {
                        navigate('/dashboard?nav=settingDB', 'dissolve');
                      }
                    }}>
                      {resolvedAnalysisJobType === 'EPISODE_VALIDATION' ? '오류 리포트 확인' : '설정 DB 보기'}
                    </PrimaryButton>
                  ) : analysisFailed ? (
                    <PrimaryButton
                      disabled={retryAnalysisJobMutation.isPending}
                      onClick={() => void retryFailedAnalysisJobs()}
                    >
                      {retryAnalysisJobMutation.isPending ? '재시도 요청 중...' : '실패 회차 다시 시도'}
                    </PrimaryButton>
                  ) : (
                    <PrimaryButton disabled onClick={() => undefined}>
                      {currentAnalysisJobs[0]?.status
                        ? JOB_STATUS_LABELS[currentAnalysisJobs[0].status]
                        : '분석 진행 중...'}
                    </PrimaryButton>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
