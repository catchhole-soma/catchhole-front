import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import {
  BookOpen, ChevronDown, Menu, MessageSquare, Plus, Send, X,
} from 'lucide-react';
import { AppSidebar } from '../AppSidebar';
import { WorkspaceTopbar } from '../ui-v2/WorkspaceTopbar';
import { useAppContext } from '../../../context/AppContext';
import { useWorks } from '../../../hooks/useWorks';
import { usePrivateImageSession as useAuthContentSession } from '../../../lib/private-image-session';
import { toApiError } from '../../../lib/api-errors';
import { notifyAiTokenQuotaExhausted } from '../../../lib/ai-token-quota';
import {
  closeChatSessionMutation,
  createChatSessionMutation,
  getChatSessionOptions,
  listChatMessagesOptions,
  listChatSessionsOptions,
  retryChatQuestionMutation,
  submitChatQuestionMutation,
} from '../../../api/generated/@tanstack/react-query.gen';
import type {
  ChatMessageV1,
  ChatSubmitV1,
} from '../../../api/generated/types.gen';
import { ChatEvidence } from './ChatEvidence';
import { ChatAnswerNotes } from './ChatAnswerNotes';
import { ChatAnswerText } from './ChatAnswerText';
import './chat.css';
import './chat-citations.css';

const uuid = /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const pending = (m: ChatMessageV1) =>
  ['QUEUED', 'RUNNING', 'SETTLEMENT_PENDING'].includes(
    m.execution?.state ?? '',
  );
const failureText: Record<string, string> = {
  PROVIDER_FAILURE: '답변을 만드는 중 문제가 생겼습니다. 다시 시도해 주세요.',
  NETWORK_FAILURE: '연결이 끊겨 답변을 완료하지 못했습니다.',
  QUOTA_EXHAUSTED: 'AI 사용량이 부족합니다.',
  EXECUTION_LIMIT_EXCEEDED:
    '한 번에 확인할 수 있는 범위를 넘었습니다. 질문 범위를 줄여 주세요.',
  HANDLER_UNAVAILABLE: '챗봇을 준비하고 있습니다. 잠시 후 다시 확인해 주세요.',
  INTERRUPTED: '답변 처리가 중단되었습니다.',
};
function errorText(error: unknown) {
  const code = toApiError(error)?.code;
  return (
    (
      {
        CHAT_DISABLED:
          '챗봇을 준비하고 있습니다. 활성화되면 대화를 시작할 수 있어요.',
        CHAT_SESSION_CLOSED:
          '종료되었거나 2시간 동안 사용하지 않아 삭제된 대화입니다.',
        CHAT_SESSION_BUSY: '앞선 질문의 답변을 기다린 뒤 보내 주세요.',
        CHAT_SESSION_LIMIT:
          '대화 한도에 도달했습니다. 다른 대화를 종료하거나 새 대화를 시작해 주세요.',
        CHAT_LIMIT_EXCEEDED:
          '진행 중인 질문이 많습니다. 잠시 후 다시 시도해 주세요.',
        AI_TOKEN_QUOTA_EXHAUSTED: 'AI 사용량이 부족합니다.',
        CHAT_NOT_FOUND: '이 대화를 찾을 수 없습니다.',
      } as Record<string, string>
    )[code ?? ''] ??
    '대화를 확인하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.'
  );
}

export default function SChat() {
  const [params] = useSearchParams();
  const workId = params.get('workId') ?? '';
  const epoch = useAuthContentSession();
  if (!uuid.test(workId)) return <Navigate to="/works" replace />;
  return (
    <ChatWorkspace key={`${epoch}:${workId}`} workId={workId} epoch={epoch} />
  );
}

function ChatWorkspace({ workId, epoch }: { workId: string; epoch: number }) {
  const [params, setParams] = useSearchParams();
  const sessionId = params.get('sessionId') ?? '';
  const navigate = useNavigate();
  const client = useQueryClient();
  const { works, loading, error, refetch } = useWorks();
  const work = works.find(
    (w) => w.id === workId && w.lifecycleStatus === 'ACTIVE',
  );
  const { setSelectedWork, setSelectedWorkInfo } = useAppContext();
  const [mobile, setMobile] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const creationKey = useRef(crypto.randomUUID());
  const live = useRef(true);
  const create = useMutation({ ...createChatSessionMutation(), gcTime: 0 });
  const listOptions = listChatSessionsOptions({
    path: { workId },
    query: { page: 0, size: 50 },
  });
  const rooms = useQuery({
    ...listOptions,
    queryKey: [{ ...listOptions.queryKey[0], tags: ['chat', `auth:${epoch}`] }],
    meta: { chat: true, epoch, workId },
    enabled: !!work,
    gcTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const selectedId = work?.id,
    title = work?.title,
    genre = work?.genre,
    episodeCount = work?.episodeCount;
  useEffect(() => {
    if (selectedId && title) {
      setSelectedWork(selectedId);
      setSelectedWorkInfo({
        id: selectedId,
        title,
        genre: genre ?? '',
        episodeCount: episodeCount ?? 0,
      });
    }
  }, [
    selectedId,
    title,
    genre,
    episodeCount,
    setSelectedWork,
    setSelectedWorkInfo,
  ]);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      void client.cancelQueries({
        predicate: (q) =>
          q.meta?.chat === true &&
          q.meta.epoch === epoch &&
          q.meta.workId === workId,
      });
      client.removeQueries({
        predicate: (q) =>
          q.meta?.chat === true &&
          q.meta.epoch === epoch &&
          q.meta.workId === workId,
      });
    };
  }, [client, epoch, workId]);
  async function newSession() {
    setNotice('');
    try {
      const response = await create.mutateAsync({
        path: { workId },
        body: { requestId: creationKey.current },
      });
      if (!live.current) return;
      if (!response.data?.id) throw new Error('Missing session');
      creationKey.current = crypto.randomUUID();
      setParams({ workId, sessionId: response.data.id });
      await rooms.refetch();
    } catch (e) {
      if (live.current) setNotice(errorText(e));
    }
  }
  const sidebar = (
    <AppSidebar
      className="desktop-app-sidebar"
      activeNav="chat"
      onClose={() => setMobile(false)}
      onNavChange={(nav) => navigate(`/dashboard?workId=${workId}&nav=${nav}`)}
      onComingSoon={() => setNotice('이 기능은 준비 중입니다.')}
    />
  );
  return (
    <div className="chat-page theme-v2 workspace-v2">
      <WorkspaceTopbar
        onBrandClick={() => navigate('/works')}
        leading={
          <button
            className="mobile-nav-trigger"
            aria-label="메뉴 열기"
            onClick={() => setMobile(true)}
          >
            <Menu size={20} />
          </button>
        }
      />
      <div className="chat-shell">
        {sidebar}
        <main className="chat-main">
          <header className="chat-heading">
            <div>
              <span className="chat-eyebrow">{work?.title ?? '내 작품'}</span>
              <h1>
                <MessageSquare size={22} /> 작품과 대화하기
              </h1>
            </div>
            <button
              className="chat-primary"
              onClick={() => void newSession()}
              disabled={!work || create.isPending}
            >
              <Plus size={16} /> 새 대화
            </button>
          </header>
          <p className="chat-retention">
            대화 종료 또는 마지막 질문·답변 후 2시간이 지나면 대화 내용이
            삭제됩니다.
          </p>
          {loading && <p role="status">작품을 확인하고 있어요.</p>}
          {error && (
            <p role="alert">
              {error} <button onClick={refetch}>다시 확인</button>
            </p>
          )}
          {!loading && !error && !work && (
            <p role="alert">
              접근할 수 없는 작품입니다. <Link to="/works">작품 선택</Link>
            </p>
          )}
          {notice && (
            <p className="chat-notice" role="alert">
              {notice}
            </p>
          )}
          {rooms.isError && (
            <p role="alert">
              {errorText(rooms.error)}{' '}
              <button onClick={() => void rooms.refetch()}>
                목록 다시 확인
              </button>
            </p>
          )}
          <div className="chat-workspace">
            {!!work && (
              <aside className="chat-rooms" aria-label="대화 목록" data-open={roomsOpen}>
                <h2>대화 목록</h2>
                <button
                  className="chat-rooms-toggle"
                  aria-expanded={roomsOpen}
                  aria-controls="chat-room-list"
                  onClick={() => setRoomsOpen(!roomsOpen)}
                >
                  <MessageSquare size={16} /> 대화 목록
                  <ChevronDown size={16} />
                </button>
                <div className="chat-room-list" id="chat-room-list">
                  {rooms.isPending && <p role="status">대화를 불러오고 있어요.</p>}
                  {!rooms.isError && (rooms.data?.data?.content ?? []).map((room) => (
                    <button
                      key={room.id}
                      className="chat-room"
                      aria-current={room.id === sessionId ? 'true' : undefined}
                      onClick={() => {
                        if (!room.id) return;
                        if (room.id !== sessionId) setParams({ workId, sessionId: room.id });
                        setRoomsOpen(false);
                      }}
                    >
                      <MessageSquare size={17} />
                      <span>
                        <strong>{room.createdAt && !Number.isNaN(Date.parse(room.createdAt))
                          ? `${new Date(room.createdAt).toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })} 대화`
                          : '새 대화'}</strong>
                        <small>{room.questionCount ? `${room.questionCount}개 질문` : '첫 질문을 기다리고 있어요'}</small>
                      </span>
                    </button>
                  ))}
                  {rooms.isSuccess && !rooms.data?.data?.content?.length && (
                    <p>새 대화를 시작해 보세요.</p>
                  )}
                </div>
              </aside>
            )}
            {work && uuid.test(sessionId) ? (
              <Conversation
                key={`${epoch}:${workId}:${sessionId}`}
                workId={workId}
                sessionId={sessionId}
                epoch={epoch}
                onClose={() => {
                  setParams({ workId }, { replace: true });
                  void rooms.refetch();
                }}
              />
            ) : (
              work && (
                <div className="chat-empty">
                  <MessageSquare size={36} />
                  <h2>궁금한 설정부터 물어보세요</h2>
                  <p>현재 능력, 설정의 변화, 원문 속 장면을 확인할 수 있어요.</p>
                  <p>예: “아리아의 현재 능력과 획득 과정을 알려줘.”</p>
                  <button
                    className="chat-primary"
                    onClick={() => void newSession()}
                    disabled={create.isPending}
                  >
                    대화 시작
                  </button>
                </div>
              )
            )}
          </div>
        </main>
      </div>
      {mobile && (
        <div className="chat-mobile-menu">
          <button aria-label="메뉴 닫기" onClick={() => setMobile(false)}>
            <X />
          </button>
          <AppSidebar
            activeNav="chat"
            onClose={() => setMobile(false)}
            onNavChange={(nav) => navigate(`/dashboard?workId=${workId}&nav=${nav}`)}
            onComingSoon={() => setNotice('이 기능은 준비 중입니다.')}
          />
        </div>
      )}
    </div>
  );
}

function Conversation({
  workId,
  sessionId,
  epoch,
  onClose,
}: {
  workId: string;
  sessionId: string;
  epoch: number;
  onClose: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const page = Math.max(
    0,
    Math.min(999, Number.parseInt(params.get('messagePage') ?? '1') - 1 || 0),
  );
  const [draft, setDraft] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');
  const [unconfirmed, setUnconfirmed] = useState<{
    key: string;
    body: ChatSubmitV1;
  } | null>(null);
  const [evidence, setEvidence] = useState<{
    questionId: string;
    sourceNumber?: number;
  } | null>(null);
  const evidenceTrigger = useRef<HTMLButtonElement | null>(null);
  const live = useRef(true);
  const scrollTarget = useRef<{ page: number; questionId?: string } | null>({
    page,
  });
  const viewedPage = useRef(page);
  const scroller = useRef<HTMLDivElement>(null);
  const composition = useRef(false);
  const submitLock = useRef(false);
  const quotaShown = useRef(new Set<string>());
  const client = useQueryClient();
  const sessionOptions = getChatSessionOptions({ path: { workId, sessionId } });
  const session = useQuery({
    ...sessionOptions,
    queryKey: [
      { ...sessionOptions.queryKey[0], tags: ['chat', `auth:${epoch}`] },
    ],
    meta: { chat: true, epoch, workId, sessionId },
    gcTime: 0,
    retry: false,
    refetchInterval: 2000,
    refetchOnWindowFocus: true,
  });
  const messageOptions = listChatMessagesOptions({
    path: { workId, sessionId },
    query: { page, size: 20 },
  });
  const messages = useQuery({
    ...messageOptions,
    queryKey: [
      { ...messageOptions.queryKey[0], tags: ['chat', `auth:${epoch}`] },
    ],
    meta: { chat: true, epoch, workId, sessionId },
    enabled: session.isSuccess && !session.isError,
    gcTime: 0,
    retry: false,
    refetchInterval: 2000,
    refetchOnWindowFocus: true,
  });
  const send = useMutation({ ...submitChatQuestionMutation(), gcTime: 0 });
  const retry = useMutation({ ...retryChatQuestionMutation(), gcTime: 0 });
  const close = useMutation({ ...closeChatSessionMutation(), gcTime: 0 });
  const inaccessible = session.isError || messages.isError;
  const rows = inaccessible ? [] : (messages.data?.data?.content ?? []);
  const busy = rows.some(pending);
  const working = send.isPending || retry.isPending || close.isPending;
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      void client.cancelQueries({
        predicate: (q) =>
          q.meta?.chat === true &&
          q.meta.epoch === epoch &&
          q.meta.workId === workId &&
          q.meta.sessionId === sessionId,
      });
      client.removeQueries({
        predicate: (q) =>
          q.meta?.chat === true &&
          q.meta.epoch === epoch &&
          q.meta.workId === workId &&
          q.meta.sessionId === sessionId,
      });
    };
  }, [client, epoch, workId, sessionId]);
  useEffect(() => {
    if (viewedPage.current !== page) {
      viewedPage.current = page;
      if (scrollTarget.current?.page !== page) scrollTarget.current = { page };
    }
    if (inaccessible || !messages.isSuccess || !scroller.current) return;
    const request = scrollTarget.current;
    if (!request || request.page !== page) return;
    const element = scroller.current;
    const target = request.questionId
      ? Array.from(element.children).find(
          (child) => child instanceof HTMLElement &&
            child.dataset.questionId === request.questionId,
        )
      : element.lastElementChild;
    if (target) {
      // Navigation and a submitted question move once. Polling and answer updates
      // must never take the reader back to the beginning of the latest turn.
      scrollTarget.current = null;
      element.scrollTop +=
        target.getBoundingClientRect().top -
        element.getBoundingClientRect().top -
        12;
    } else if (!request.questionId) {
      scrollTarget.current = null;
    }
  }, [page, inaccessible, messages.isSuccess, messages.dataUpdatedAt]);
  useEffect(() => {
    if (inaccessible) return;
    for (const row of messages.data?.data?.content ?? []) {
      const attempt = row.execution?.attemptId;
      if (
        attempt &&
        row.execution?.failure === 'QUOTA_EXHAUSTED' &&
        !quotaShown.current.has(attempt)
      ) {
        quotaShown.current.add(attempt);
        notifyAiTokenQuotaExhausted();
      }
    }
  }, [inaccessible, messages.data]);
  function setPage(value: number, questionId?: string) {
    scrollTarget.current = { page: value, questionId };
    setParams({ workId, sessionId, messagePage: String(value + 1) });
  }
  function openEvidence(
    questionId: string | undefined,
    trigger: HTMLButtonElement,
    sourceNumber?: number,
  ) {
    if (!questionId) return;
    evidenceTrigger.current = trigger;
    setEvidence({ questionId, sourceNumber });
  }
  async function submit() {
    if (submitLock.current || working || inaccessible || busy || !draft.trim())
      return;
    if (
      (from && (!Number.isInteger(Number(from)) || Number(from) < 1)) ||
      (to && (!Number.isInteger(Number(to)) || Number(to) < 1)) ||
      (from && to && Number(from) > Number(to))
    ) {
      setError('출처 회차 범위를 확인해 주세요.');
      return;
    }
    submitLock.current = true;
    setError('');
    const request = unconfirmed ?? {
      key: crypto.randomUUID(),
      body: {
        question: draft,
        sessionId,
        ...(from ? { episodeFrom: Number(from) } : {}),
        ...(to ? { episodeTo: Number(to) } : {}),
      },
    };
    try {
      const submitted = await send.mutateAsync({
        path: { workId },
        headers: { 'Idempotency-Key': request.key },
        body: request.body,
      });
      if (!live.current) return;
      setDraft('');
      setFrom('');
      setTo('');
      setUnconfirmed(null);
      const fresh = await session.refetch();
      if (!live.current) return;
      setPage(
        Math.floor(
          Math.max(0, (fresh.data?.data?.questionCount ?? 1) - 1) / 20,
        ),
        submitted.data?.questionId,
      );
      await messages.refetch();
    } catch (e) {
      if (!live.current) return;
      const api = toApiError(e);
      if (!api || api.status >= 500) setUnconfirmed(request);
      else setUnconfirmed(null);
      setError(errorText(e));
      await session.refetch();
      await messages.refetch();
    } finally {
      submitLock.current = false;
    }
  }
  async function retryQuestion(row: ChatMessageV1) {
    if (!row.questionId || !row.execution?.attemptId || working || busy) return;
    setError('');
    try {
      await retry.mutateAsync({
        path: { workId, questionId: row.questionId },
        body: { previousAttemptId: row.execution.attemptId },
      });
      if (live.current) await messages.refetch();
    } catch (e) {
      if (live.current) {
        setError(errorText(e));
        await messages.refetch();
      }
    }
  }
  async function end() {
    setError('');
    try {
      await close.mutateAsync({ path: { workId, sessionId } });
      if (live.current) {
        client.removeQueries({
          predicate: (q) =>
            q.meta?.chat === true &&
            q.meta.epoch === epoch &&
            q.meta.workId === workId &&
            q.meta.sessionId === sessionId,
        });
        onClose();
      }
    } catch (e) {
      if (live.current) setError(errorText(e));
    }
  }
  return (
    <section className="chat-conversation" aria-label="대화">
      <div className="chat-conversation-toolbar">
        <span>답변은 생성 당시의 설정과 근거를 기준으로 합니다.</span>
        <button onClick={() => void end()} disabled={close.isPending}>
          대화 종료
        </button>
      </div>
      {inaccessible ? (
        <div className="chat-empty" role="alert">
          <p>{errorText(session.error ?? messages.error)}</p>
          <button
            onClick={() => {
              void session.refetch();
              void messages.refetch();
            }}
          >
            다시 확인
          </button>
        </div>
      ) : (
        <>
          <div
            className="chat-messages"
            ref={scroller}
          >
            {(session.isPending || messages.isPending) && (
              <p role="status">대화를 불러오고 있어요.</p>
            )}
            {!messages.isPending && rows.length === 0 && (
              <p className="chat-empty">
                첫 질문을 보내 보세요. 후속 질문도 이어서 할 수 있어요.
              </p>
            )}
            {rows.map((row) => (
              <article key={row.questionId} className="chat-turn" data-question-id={row.questionId}>
                <div className="chat-question">
                  <span>나</span>
                  <p>{row.question ?? '내용을 더 이상 이용할 수 없습니다.'}</p>
                </div>
                <div className="chat-answer">
                  <span>캐치홀</span>
                  {row.execution?.result ? (
                    <>
                      <ChatAnswerText
                        text={row.execution.result.text}
                        sourceCount={
                          row.execution.result.sources.length +
                          (row.execution.result.retrievalSources?.length ?? 0)
                        }
                        onSourceClick={(number, trigger) =>
                          openEvidence(row.questionId, trigger, number)
                        }
                      />
                      <ChatAnswerNotes
                        notes={row.execution.result.limitations}
                      />
                      {(row.execution.result.sources.length > 0 ||
                        (row.execution.result.retrievalSources?.length ?? 0) >
                          0) && (
                        <button
                          type="button"
                          className="chat-evidence-summary"
                          aria-label={`답변 근거 ${row.execution.result.sources.length + (row.execution.result.retrievalSources?.length ?? 0)}개 모두 보기`}
                          aria-haspopup="dialog"
                          onClick={(event) =>
                            openEvidence(row.questionId, event.currentTarget)
                          }
                        >
                          <BookOpen size={14} aria-hidden="true" />
                          근거{' '}
                          {row.execution.result.sources.length +
                            (row.execution.result.retrievalSources?.length ?? 0)}
                          개
                        </button>
                      )}
                    </>
                  ) : pending(row) ? (
                    <p role="status">설정과 근거를 확인하고 있어요…</p>
                  ) : (
                    <p role="status">
                      {row.execution?.state === 'INVALIDATED'
                        ? '원문이 변경되어 답변을 이용할 수 없습니다.'
                        : row.execution?.state === 'TIMED_OUT'
                          ? '답변 시간이 초과되었습니다.'
                          : (failureText[row.execution?.failure ?? ''] ??
                            '답변 상태를 확인하고 있어요.')}
                    </p>
                  )}
                  {['FAILED', 'TIMED_OUT'].includes(
                    row.execution?.state ?? '',
                  ) && (
                    <button
                      disabled={working || busy}
                      onClick={() => void retryQuestion(row)}
                    >
                      다시 시도
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          {(page > 0 || messages.data?.data?.hasNext) && (
            <nav className="chat-pagination" aria-label="메시지 페이지">
              <button disabled={page === 0} onClick={() => setPage(page - 1)}>
                이전
              </button>
              <span>{page + 1}페이지</span>
              <button
                disabled={!messages.data?.data?.hasNext}
                onClick={() => setPage(page + 1)}
              >
                다음
              </button>
            </nav>
          )}
        </>
      )}
      {error && (
        <p className="chat-notice" role="alert">
          {error}
          {unconfirmed &&
            ' 전송 여부를 확인하려면 같은 질문의 접수 확인을 눌러 주세요.'}
        </p>
      )}
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <details>
          <summary>근거를 찾을 출처 회차 범위</summary>
          <div className="chat-range">
            <label>
              시작 회차
              <input
                type="number"
                min="1"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                disabled={!!unconfirmed || working}
              />
            </label>
            <span>~</span>
            <label>
              마지막 회차
              <input
                type="number"
                min="1"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                disabled={!!unconfirmed || working}
              />
            </label>
          </div>
          <p>
            비워 두면 허용된 전체 회차에서 찾습니다. 해당 회차 당시의 전체
            상태를 복원하는 기능은 아닙니다.
          </p>
        </details>
        <div className="chat-input-row">
          <textarea
            aria-label="질문"
            placeholder="작품의 설정이나 장면을 물어보세요"
            maxLength={4000}
            value={draft}
            readOnly={!!unconfirmed || working}
            disabled={inaccessible}
            onChange={(e) => setDraft(e.target.value)}
            onCompositionStart={() => {
              composition.current = true;
            }}
            onCompositionEnd={() => {
              composition.current = false;
            }}
            onKeyDown={(e) => {
              if (
                e.key === 'Enter' &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing &&
                !composition.current &&
                e.keyCode !== 229
              ) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <button
            type="submit"
            className="chat-primary"
            disabled={
              !draft.trim() ||
              working ||
              busy ||
              inaccessible ||
              messages.isPending
            }
          >
            <Send size={16} />
            {unconfirmed ? '접수 확인' : '보내기'}
          </button>
        </div>
        {busy && <small>앞선 답변이 끝나면 다음 질문을 보낼 수 있어요.</small>}
      </form>
      {evidence && !inaccessible && (
        <ChatEvidence
          workId={workId}
          questionId={evidence.questionId}
          initialSourceNumber={evidence.sourceNumber}
          onClose={() => setEvidence(null)}
          onReturnFocus={() => {
            if (evidenceTrigger.current?.isConnected)
              evidenceTrigger.current.focus({ preventScroll: true });
          }}
        />
      )}
    </section>
  );
}
