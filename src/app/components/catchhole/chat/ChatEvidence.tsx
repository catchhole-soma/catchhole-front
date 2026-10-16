import { useEffect, useRef, useState } from 'react';
import {
  getChatQuestion,
  querySettingTools,
} from '../../../api/generated/sdk.gen';
import type {
  ChatResultV1,
  SettingToolItemV1,
} from '../../../api/generated/types.gen';
import { Link } from 'react-router';
import { ArrowUpRight, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

type EvidenceItem = SettingToolItemV1 & { domain: 'CHARACTER' | 'WORLD' };
type DirectSource = { sourceNumber: number; items: EvidenceItem[] };

function DirectEvidence({ item, workId }: { item: EvidenceItem; workId: string }) {
  const evidence = item.evidence;
  const available = evidence?.status === 'AVAILABLE';
  return (
    <div className="chat-evidence-detail">
      <p className="chat-evidence-subject">
        {[item.subjectName, item.displayName].filter(Boolean).join(' · ') || '설정 근거'}
      </p>
      {item.origin === 'USER_INPUT' || item.historyOnly ? (
        <p className="chat-evidence-context">
          {item.origin === 'USER_INPUT'
            ? '직접 입력한 설정'
            : '현재값에 반영되지 않은 이력'}
        </p>
      ) : null}
      {item.value != null && (
        <dl className="chat-evidence-value">
          <dt>조회한 설정값</dt>
          <dd>{item.value}</dd>
        </dl>
      )}
      {item.valueTruncated && (
        <p className="chat-evidence-context">
          설정값이 길어 일부 내용이 생략됐어요. 전체 내용은 설정에서 확인해 주세요.
        </p>
      )}
      {available ? (
        evidence.quotes?.map((quote, index) => (
          <blockquote key={index}>{quote.text}</blockquote>
        ))
      ) : (
        <p className="chat-evidence-unavailable">
          현재 확인 가능한 원문 인용이 없습니다.
        </p>
      )}
      <div className="chat-evidence-actions">
        {available && evidence.episodeId && (
          <Link
            className="chat-evidence-original"
            to={`/editor?workId=${workId}&episodeId=${evidence.episodeId}`}
          >
            {evidence.sourceEpisodeNo != null ? `${evidence.sourceEpisodeNo}화 원문 보기` : '원문 보기'}
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        )}
        {item.subjectId && (
          <Link
            className="chat-evidence-setting"
            to={
              item.domain === 'CHARACTER'
                ? `/dashboard?workId=${workId}&nav=settingDB&tab=characters&modal=char-detail&charId=${item.subjectId}`
                : `/dashboard?workId=${workId}&nav=settingDB&tab=worldsettings&settingId=${item.subjectId}`
            }
          >
            설정 보기
          </Link>
        )}
      </div>
    </div>
  );
}

export function ChatEvidence({
  workId,
  questionId,
  initialSourceNumber,
  onClose,
  onReturnFocus,
}: {
  workId: string;
  questionId: string;
  initialSourceNumber?: number;
  onClose: () => void;
  onReturnFocus?: () => void;
}) {
  const [data, setData] = useState<{
    result: ChatResultV1;
    directSources: DirectSource[];
  } | null>(null);
  const [failed, setFailed] = useState(false);
  const [selectedSource, setSelectedSource] = useState(initialSourceNumber);
  const sourceElements = useRef(new Map<number, HTMLElement>());

  function focusSource(sourceNumber: number) {
    const element = sourceElements.current.get(sourceNumber);
    if (!element) return;
    element.scrollIntoView({ block: 'start', behavior: 'instant' });
    element.focus({ preventScroll: true });
  }

  useEffect(() => {
    const abort = new AbortController();
    setData(null);
    setFailed(false);
    async function load() {
      try {
        const first = await getChatQuestion({
          path: { workId, questionId },
          signal: abort.signal,
          throwOnError: true,
        });
        const result = first.data.data?.result;
        if (!result) throw new Error('Unavailable');
        const directSources: DirectSource[] = [];
        for (const [sourceIndex, source] of result.sources.entries()) {
          const slot: DirectSource = { sourceNumber: sourceIndex + 1, items: [] };
          directSources.push(slot);
          if (!source.tool || !source.targetId) continue;
          try {
            const found = await querySettingTools({
              path: { workId },
              body: {
                tool: source.tool,
                targetId: source.targetId,
                page: 0,
                size: 20,
              },
              signal: abort.signal,
              throwOnError: true,
            });
            slot.items = (found.data.data?.items?.content ?? []).map((item) => ({
              ...item,
              domain:
                source.tool === 'CHARACTER_EVIDENCE'
                  ? ('CHARACTER' as const)
                  : ('WORLD' as const),
            }));
          } catch (error) {
            if (abort.signal.aborted) throw error;
          }
        }
        const current = await getChatQuestion({
          path: { workId, questionId },
          signal: abort.signal,
          throwOnError: true,
        });
        if (
          !current.data.data?.result ||
          current.data.data.attemptId !== first.data.data?.attemptId
        )
          throw new Error('Changed');
        if (!abort.signal.aborted)
          setData({
            result: current.data.data.result,
            directSources,
          });
      } catch {
        if (!abort.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => abort.abort();
  }, [workId, questionId]);

  useEffect(() => {
    setSelectedSource(initialSourceNumber);
    if (data && initialSourceNumber != null) focusSource(initialSourceNumber);
  }, [data, initialSourceNumber]);

  const sourceCount = data
    ? data.result.sources.length + (data.result.retrievalSources?.length ?? 0)
    : 0;
  const unavailableSourceCount = data?.directSources.filter((source) => source.items.length === 0).length ?? 0;

  function sourceProps(sourceNumber: number) {
    return {
      'aria-label': `근거 ${sourceNumber}`,
      'data-source-number': sourceNumber,
      'data-selected': selectedSource === sourceNumber,
      tabIndex: -1,
      ref: (element: HTMLElement | null) => {
        if (element) sourceElements.current.set(sourceNumber, element);
        else sourceElements.current.delete(sourceNumber);
      },
    };
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="chat-evidence-backdrop" />
        <Dialog.Content
          className="chat-evidence theme-v2"
          onCloseAutoFocus={(event) => {
            if (!onReturnFocus) return;
            event.preventDefault();
            onReturnFocus();
          }}
        >
          <header className="chat-evidence-header">
            <div>
              <Dialog.Title>답변의 근거</Dialog.Title>
              <Dialog.Description>
                답변에 연결된 인용을 읽고, 해당 회차의 원문을 확인해 보세요.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button className="chat-evidence-close" aria-label="근거 닫기">
                <X size={20} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </header>
          {sourceCount > 1 && (
            <nav className="chat-evidence-nav" aria-label="근거 목록">
              <span>근거 바로가기</span>
              <div>
                {Array.from({ length: sourceCount }, (_, index) => index + 1).map((sourceNumber) => (
                  <button
                    key={sourceNumber}
                    aria-label={`근거 ${sourceNumber}으로 이동`}
                    aria-current={selectedSource === sourceNumber ? 'true' : undefined}
                    onClick={() => {
                      setSelectedSource(sourceNumber);
                      focusSource(sourceNumber);
                    }}
                  >
                    {sourceNumber}
                  </button>
                ))}
              </div>
            </nav>
          )}
          <div className="chat-evidence-body">
            {failed ? (
              <p className="chat-evidence-status" role="alert">
                현재 원문과 대화를 확인하지 못했습니다. 창을 닫고 다시 확인해 주세요.
              </p>
            ) : !data ? (
              <p className="chat-evidence-status" role="status">현재 근거를 확인하고 있어요.</p>
            ) : (
              <>
                {unavailableSourceCount > 0 && (
                  <p className="chat-evidence-status" role="alert">
                    직접 근거 {unavailableSourceCount}건을 확인하지 못했어요. 해당 번호에서 안내를 확인할 수 있어요.
                  </p>
                )}
                {data.directSources.map((source) => {
                  const episodeNumbers = [...new Set(source.items.map((item) => item.evidence?.sourceEpisodeNo).filter((value) => value != null))];
                  return (
                    <article key={source.sourceNumber} {...sourceProps(source.sourceNumber)}>
                      <h3>
                        근거 {source.sourceNumber}
                        {episodeNumbers.length === 1 && <span> · {episodeNumbers[0]}화</span>}
                      </h3>
                      {source.items.length > 0 ? source.items.map((item, index) => (
                        <DirectEvidence key={item.id ?? index} item={item} workId={workId} />
                      )) : (
                        <p className="chat-evidence-unavailable">
                          이 근거를 현재 확인할 수 없어요. 창을 닫고 다시 확인해 주세요.
                        </p>
                      )}
                    </article>
                  );
                })}
                {data.result.retrievalSources?.map((source, index) => {
                  const sourceNumber = data.result.sources.length + index + 1;
                  return (
                    <article key={`${sourceNumber}:${source.chunkId}`} {...sourceProps(sourceNumber)}>
                      <h3>
                        근거 {sourceNumber}
                        {source.sourceEpisodeNo != null && <span> · {source.sourceEpisodeNo}화</span>}
                      </h3>
                      <p className="chat-evidence-subject">원문에서 찾은 근거</p>
                      <blockquote>{source.quote}</blockquote>
                      <div className="chat-evidence-actions">
                        <Link
                          className="chat-evidence-original"
                          to={`/editor?workId=${workId}&episodeId=${source.episodeId}`}
                        >
                          {source.sourceEpisodeNo != null ? `${source.sourceEpisodeNo}화 원문 보기` : '원문 보기'}
                          <ArrowUpRight size={16} aria-hidden="true" />
                        </Link>
                      </div>
                    </article>
                  );
                })}
                <p className="chat-evidence-footnote">
                  인용 회차는 내용이 기록된 출처이며, 사건이 일어난 시점과 다를 수 있어요.
                </p>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
