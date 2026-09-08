import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation, useNavigate as useRouterNavigate, useSearchParams } from 'react-router';
import { C } from './constants';
import { useAppNavigate } from '../../hooks/useAppNavigate';
import { useAppContext } from '../../context/AppContext';
import { ChevronLeft, Eye, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { UserMenu } from './UserMenu';
import { getEpisodeOptions, getSettingBookOptions } from '../../api/generated/@tanstack/react-query.gen';

function formatOriginalDate(value?: string | null) {
  if (!value) return '변경일 없음';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '변경일 없음';
  return `${date.toLocaleDateString('ko-KR')} ${date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`;
}

function OriginalLines({ content }: { content: string }) {
  return (
    <div className="original-lines" style={{ fontSize: 15, lineHeight: 1.9, letterSpacing: '-0.1px' }}>
      {content.split('\n').map((line, index) => (
        <div className="original-line" key={index} style={{ display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr)' }}>
          <span className="original-line__number" aria-hidden="true" style={{ color: C.t3, fontSize: 12, textAlign: 'right', paddingRight: 14, userSelect: 'none' }}>
            {index + 1}
          </span>
          <span className="original-line__body" style={{ color: C.t1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', minHeight: '1.9em' }}>{line || ' '}</span>
        </div>
      ))}
    </div>
  );
}

function useOriginalBack(workId: string) {
  const routerNavigate = useRouterNavigate();
  const navigate = useAppNavigate();
  const location = useLocation();
  const routeState = location.state as {
    source?: string;
    sourceWorkId?: string;
  } | null;
  return () => {
    if (routeState?.source === 'manuscripts' && routeState.sourceWorkId === workId) {
      routerNavigate(-1);
    }
    else navigate(
      `/dashboard?workId=${encodeURIComponent(workId)}&nav=manuscripts`,
      'pop',
      undefined,
      { replace: true },
    );
  };
}

function EpisodeOriginalReader({ workId, episodeId }: { workId: string; episodeId: string }) {
  const goBack = useOriginalBack(workId);
  const { selectedWorkInfo } = useAppContext();
  const workTitle = selectedWorkInfo?.id === workId ? selectedWorkInfo.title : '내 작품';
  const episodeQuery = useQuery({
    ...getEpisodeOptions({ path: { workId, episodeId } }),
    retry: false,
  });
  const episode = episodeQuery.data?.data;

  return (
    <div className="original-reader-page original-reader-v2 theme-v2" style={{
      background: C.bg, width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      color: C.t1, fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      <header className="original-reader-header app-topbar" style={{
        height: 56, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 20px', flexShrink: 0,
      }}>
        <button className="original-reader-back" type="button" onClick={goBack} style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          color: C.t2, cursor: 'pointer', fontSize: 13, padding: '4px 8px', fontFamily: 'inherit',
        }}>
          <ChevronLeft size={16} /> 원고 목록
        </button>
        <span className="original-reader-title" style={{ color: C.t2, fontSize: 14 }}>
          {workTitle} · {episode?.originalFilename || (episode?.episodeNo ? `${episode.episodeNo}화 원문` : '회차 원문')}
        </span>
        <UserMenu />
      </header>

      <div className="original-reader-notice" style={{
        height: 36, background: `${C.warning}18`, borderBottom: `1px solid ${C.warning}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 0,
      }}>
        <Eye size={13} color={C.warning} />
        <span style={{ color: C.warning, fontSize: 12, fontWeight: 600 }}>업로드한 원문 · 읽기 전용</span>
      </div>

      {episodeQuery.isPending ? (
        <div className="original-reader-state is-loading" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.t3 }}>
          <Loader2 size={18} className="spin" /> 원문을 불러오는 중...
        </div>
      ) : episodeQuery.isError || !episode ? (
        <div className="original-reader-state is-error" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <AlertCircle size={38} color={C.danger} />
          <span style={{ color: C.t2, fontSize: 14 }}>원문을 불러오지 못했습니다.</span>
          <button className="original-reader-retry" type="button" onClick={() => void episodeQuery.refetch()} style={{
            height: 36, padding: '0 14px', borderRadius: 6, border: `1px solid ${C.border}`,
            background: 'transparent', color: C.t2, cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <RefreshCw size={13} /> 다시 불러오기
          </button>
        </div>
      ) : (
        <main className="original-reader-main" style={{ flex: 1, overflowY: 'auto', padding: '36px 24px 64px' }}>
          <article className="original-reader-article" style={{ maxWidth: 820, margin: '0 auto' }}>
            <div className="original-reader-article__header" style={{ marginBottom: 26, paddingBottom: 20, borderBottom: `1px solid ${C.border}` }}>
              <div className="original-reader-article__eyebrow" style={{ color: C.t3, fontSize: 12, marginBottom: 8 }}>{episode.episodeNo ?? '—'}화</div>
              <h1 className="original-reader-article__title" style={{ margin: 0, color: C.t1, fontSize: 24, lineHeight: 1.35, letterSpacing: '-0.5px' }}>
                {episode.title || '제목 없음'}
              </h1>
              <div className="original-reader-article__meta" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12, color: C.t3, fontSize: 12 }}>
                <span>{(episode.charCount ?? episode.content?.length ?? 0).toLocaleString()}자</span>
                <span>·</span>
                <span>{formatOriginalDate(episode.contentUpdatedAt)}</span>
              </div>
            </div>
            <OriginalLines content={episode.content || '원문 내용이 없습니다.'} />
          </article>
        </main>
      )}
    </div>
  );
}

function SettingBookOriginalReader({ workId, settingBookId }: { workId: string; settingBookId: string }) {
  const goBack = useOriginalBack(workId);
  const { selectedWorkInfo } = useAppContext();
  const workTitle = selectedWorkInfo?.id === workId ? selectedWorkInfo.title : '내 작품';
  const settingBookQuery = useQuery({
    ...getSettingBookOptions({ path: { workId, settingBookId } }),
    retry: false,
  });
  const settingBook = settingBookQuery.data?.data;

  return (
    <div className="original-reader-page original-reader-v2 theme-v2" style={{
      background: C.bg, width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      color: C.t1, fontFamily: "'Pretendard Variable', 'Pretendard', 'Apple SD Gothic Neo', -apple-system, sans-serif",
    }}>
      <header className="original-reader-header app-topbar" style={{
        height: 56, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 20px', flexShrink: 0,
      }}>
        <button className="original-reader-back" type="button" onClick={goBack} style={{
          display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
          color: C.t2, cursor: 'pointer', fontSize: 13, padding: '4px 8px', fontFamily: 'inherit',
        }}><ChevronLeft size={16} /> 원고 목록</button>
        <span className="original-reader-title" style={{ color: C.t2, fontSize: 14 }}>{workTitle} · {settingBook?.originalFilename || '설정집 원문'}</span>
        <UserMenu />
      </header>
      <div className="original-reader-notice" style={{
        height: 36, background: `${C.warning}18`, borderBottom: `1px solid ${C.warning}44`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexShrink: 0,
      }}>
        <Eye size={13} color={C.warning} />
        <span style={{ color: C.warning, fontSize: 12, fontWeight: 600 }}>설정집 원본 · 읽기 전용</span>
      </div>
      {settingBookQuery.isPending ? (
        <div className="original-reader-state is-loading" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.t3 }}>
          <Loader2 size={18} className="spin" /> 원문을 불러오는 중...
        </div>
      ) : settingBookQuery.isError || !settingBook ? (
        <div className="original-reader-state is-error" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <AlertCircle size={38} color={C.danger} />
          <span style={{ color: C.t2, fontSize: 14 }}>설정집 원문을 불러오지 못했습니다.</span>
          <button className="original-reader-retry" type="button" onClick={() => void settingBookQuery.refetch()} style={{
            height: 36, padding: '0 14px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent',
            color: C.t2, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
          }}><RefreshCw size={13} /> 다시 불러오기</button>
          <button type="button" onClick={goBack} style={{ border: 0, background: 'transparent', color: C.primary, cursor: 'pointer' }}>원고 목록으로 돌아가기</button>
        </div>
      ) : (
        <main className="original-reader-main" style={{ flex: 1, overflowY: 'auto', padding: '36px 24px 64px' }}>
          <article className="original-reader-article" style={{ maxWidth: 820, margin: '0 auto' }}>
            <div className="original-reader-article__header" style={{ marginBottom: 26, paddingBottom: 20, borderBottom: `1px solid ${C.border}` }}>
              <div className="original-reader-article__eyebrow" style={{ color: C.t3, fontSize: 12, marginBottom: 8 }}>설정집</div>
              <h1 className="original-reader-article__title" style={{ margin: 0, color: C.t1, fontSize: 24, lineHeight: 1.35, letterSpacing: '-0.5px' }}>{settingBook.originalFilename}</h1>
              <div className="original-reader-article__meta" style={{ marginTop: 12, color: C.t3, fontSize: 12 }}>{formatOriginalDate(settingBook.uploadedAt)}</div>
            </div>
            <OriginalLines content={settingBook.content || '원문 내용이 없습니다.'} />
          </article>
        </main>
      )}
    </div>
  );
}

export default function S2Editor() {
  const [searchParams] = useSearchParams();
  const workId = searchParams.get('workId');
  const episodeId = searchParams.get('episodeId');
  const settingBookId = searchParams.get('settingBookId');

  if (workId && episodeId) {
    return <EpisodeOriginalReader workId={workId} episodeId={episodeId} />;
  }
  if (workId && settingBookId) {
    return <SettingBookOriginalReader workId={workId} settingBookId={settingBookId} />;
  }

  return <Navigate to="/works" replace />;
}
