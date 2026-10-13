import { useEffect, useState } from 'react';
import {
  getChatQuestion,
  querySettingTools,
} from '../../../api/generated/sdk.gen';
import type {
  ChatResultV1,
  SettingToolItemV1,
} from '../../../api/generated/types.gen';
import { Link } from 'react-router';
import { X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

export function ChatEvidence({
  workId,
  questionId,
  onClose,
}: {
  workId: string;
  questionId: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<{
    result: ChatResultV1;
    items: Array<SettingToolItemV1 & { domain: 'CHARACTER' | 'WORLD' }>;
  } | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    async function load() {
      try {
        const first = await getChatQuestion({
          path: { workId, questionId },
          signal: abort.signal,
          throwOnError: true,
        });
        const result = first.data.data?.result;
        if (!result) throw new Error('Unavailable');
        const items: Array<
          SettingToolItemV1 & { domain: 'CHARACTER' | 'WORLD' }
        > = [];
        for (const source of result.sources) {
          if (!source.tool || !source.targetId) continue;
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
          items.push(
            ...(found.data.data?.items?.content ?? []).map((item) => ({
              ...item,
              domain:
                source.tool === 'CHARACTER_EVIDENCE'
                  ? ('CHARACTER' as const)
                  : ('WORLD' as const),
            })),
          );
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
          setData({ result: current.data.data.result, items });
      } catch {
        if (!abort.signal.aborted) setFailed(true);
      }
    }
    void load();
    return () => abort.abort();
  }, [workId, questionId]);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="chat-evidence-backdrop" />
        <Dialog.Content className="chat-evidence">
          <header>
            <Dialog.Title>답변의 근거</Dialog.Title>
            <Dialog.Close asChild>
              <button aria-label="근거 닫기">
                <X />
              </button>
            </Dialog.Close>
          </header>
          <Dialog.Description>
            현재 확인할 수 있는 출처와 원문 인용입니다.
          </Dialog.Description>
          {failed ? (
            <p role="alert">
              현재 원문과 대화를 확인하지 못했습니다. 창을 닫고 다시 확인해
              주세요.
            </p>
          ) : !data ? (
            <p role="status">현재 근거를 확인하고 있어요.</p>
          ) : (
            <>
              {data.result.retrievalSources?.map((source) => (
                <article key={source.chunkId}>
                  <h3>{source.sourceEpisodeNo}화 · 원문 검색 인용</h3>
                  <blockquote>{source.quote}</blockquote>
                  <Link
                    to={`/editor?workId=${workId}&episodeId=${source.episodeId}`}
                  >
                    현재 원문 보기
                  </Link>
                </article>
              ))}
              {data.items.map((item, index) => (
                <article key={item.id ?? index}>
                  <h3>
                    {item.subjectName} · {item.displayName ?? '설정 근거'}
                  </h3>
                  {item.subjectId && (
                    <Link
                      to={
                        item.domain === 'CHARACTER'
                          ? `/dashboard?workId=${workId}&nav=settingDB&tab=characters&modal=char-detail&charId=${item.subjectId}`
                          : `/dashboard?workId=${workId}&nav=settingDB&tab=worldsettings&settingId=${item.subjectId}`
                      }
                    >
                      설정 상세 보기
                    </Link>
                  )}
                  <p>
                    {item.origin === 'USER_INPUT'
                      ? '직접 입력한 설정'
                      : item.historyOnly
                        ? '현재값에 반영되지 않은 이력'
                        : '등록 설정에 연결된 근거'}
                  </p>
                  {item.evidence?.status === 'AVAILABLE' ? (
                    <>
                      <p>{item.evidence.sourceEpisodeNo}화 · 직접 원문 인용</p>
                      {item.evidence.quotes?.map((quote, i) => (
                        <blockquote key={i}>{quote.text}</blockquote>
                      ))}
                      {item.evidence.episodeId && (
                        <Link
                          to={`/editor?workId=${workId}&episodeId=${item.evidence.episodeId}`}
                        >
                          현재 원문 보기
                        </Link>
                      )}
                    </>
                  ) : (
                    <p>현재 확인 가능한 원문 인용이 없습니다.</p>
                  )}
                </article>
              ))}
              <p className="chat-retention">
                인용 회차는 내용이 기록된 출처이며, 사건이 일어난 시점과 다를 수
                있어요.
              </p>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
