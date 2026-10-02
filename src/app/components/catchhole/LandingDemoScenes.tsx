/* eslint-disable react-refresh/only-export-components -- 정적 데모 장면과 장면 레지스트리를 한 파일에서 관리합니다. */
import type { ReactNode } from 'react';
import {
  BarChart3,
  BookOpen,
  Check,
  Clock3,
  FileText,
  Files,
  ListChecks,
  MessageSquare,
  Network,
  RefreshCcw,
  Trash2,
  Upload,
} from 'lucide-react';
import { BrandLogo } from './ui-v2/BrandLogo';
import { LandingReviewScene } from './LandingReviewScene';

export type LandingDemoStep = {
  label: string;
  shortLabel: string;
  scene: ReactNode;
};

const EPISODES = [
  ['10화', '첫 번째 전리품'],
  ['9화', '영혼력 0'],
  ['8화', '이름 없는 보스'],
  ['7화', '원정대장의 배신'],
  ['6화', '숨겨진 전직'],
  ['5화', '두 개의 저주'],
  ['4화', '죽은 자의 인벤토리'],
  ['3화', '뿌리가 하늘인 숲'],
];

function DemoHeader({ eyebrow, title, back = false }: { eyebrow: string; title: string; back?: boolean }) {
  return (
    <header className="landing-native-header">
      <div className="landing-native-header__title">
        {back && <button type="button" tabIndex={-1}>‹</button>}
        <span><small>{eyebrow}</small><strong>{title}</strong></span>
      </div>
      <div className="landing-native-avatar">K</div>
    </header>
  );
}

function BrandHeader() {
  return (
    <header className="landing-native-brand-header">
      <BrandLogo />
      <div className="landing-native-avatar">K</div>
    </header>
  );
}

function Sidebar({ active }: { active: 'manuscripts' | 'database' | 'analyses' }) {
  const items = [
    ['manuscripts', <FileText size={13} />, '원고 목록'],
    ['database', <BookOpen size={13} />, '작품 설정'],
    ['analyses', <ListChecks size={13} />, '분석 목록'],
  ] as const;
  return (
    <aside className="landing-native-sidebar">
      <small>현재 작품</small>
      <div className="landing-native-work"><strong>마나 0의 짐꾼</strong><span>판타지</span></div>
      <button type="button" tabIndex={-1}>작품 변경</button>
      <i />
      <small>워크스페이스</small>
      {items.map(([id, icon, label]) => (
        <div className={active === id ? 'is-active' : ''} key={id}>{icon}{label}</div>
      ))}
      <div><BarChart3 size={13} />분석 리포트<em>예정</em></div>
      <div><Network size={13} />그래프 뷰<em>예정</em></div>
      <div><MessageSquare size={13} />챗봇<em>예정</em></div>
      <footer><span>남은 사용량</span><b><i /></b><small>45.0%</small></footer>
    </aside>
  );
}

function UploadStepper({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="landing-native-stepper">
      {['업로드 방식', '회차 정보 입력', '분석 진행'].map((label, index) => (
        <div className={index + 1 <= current ? 'is-active' : ''} key={label}>
          <b>{index + 1 < current ? <Check size={12} /> : index + 1}</b>
          <strong>{label}</strong>
          {index < 2 && <i />}
        </div>
      ))}
    </div>
  );
}

function ManuscriptScene() {
  return (
    <div className="landing-native-screen">
      <BrandHeader />
      <div className="landing-native-workspace">
        <Sidebar active="manuscripts" />
        <main className="landing-native-main landing-native-manuscripts">
          <div className="landing-native-page-title"><small>MANUSCRIPTS · 업로드된 원고</small><strong>마나 0의 짐꾼</strong><button type="button" tabIndex={-1}><Upload size={13} /> 회차 올리기</button></div>
          <div className="landing-native-alert"><span><strong>검토할 설정 후보가 있습니다.</strong><small>분석 목록에서 업로드 묶음을 선택해 후보 검토를 이어가세요.</small></span><button type="button" tabIndex={-1}>분석 목록으로</button></div>
          <p>총 10개 회차</p>
          <div className="landing-native-table">
            <header><span>회차</span><span>제목</span><span>원본 파일</span><span>변경일</span><span>분석 상태</span><span /></header>
            {EPISODES.map(([episode, title]) => (
              <div key={episode}><b>{episode}</b><strong>{title}</strong><span>{episode.replace('화', '')}화.txt</span><span>2026.08.14</span><em>분석 완료</em><small>원문 · 파일 변경 · 삭제</small></div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

function UploadScene() {
  return (
    <div className="landing-native-screen">
      <DemoHeader eyebrow="MANUSCRIPT" title="회차 업로드" back />
      <div className="landing-native-upload-page">
        <UploadStepper current={2} />
        <section className="landing-native-upload-card">
          <h2>마나 0의 짐꾼 · 회차 업로드</h2><p>업로드 방식과 분석 목적을 선택하세요.</p>
          <div className="landing-native-upload-modes">
            <div><FileText /><strong>단일 회차 업로드</strong><span>새 회차 파일 한 개를 등록합니다</span></div>
            <div><BookOpen /><strong>다회차 · 단일 파일</strong><span>회차 제목 행을 기준으로 분리합니다</span></div>
            <div className="is-selected"><Files /><strong>다회차 · 여러 파일</strong><span>TXT 파일마다 한 회차로 등록합니다</span><Check /></div>
          </div>
          <hr />
          <label>회차별 TXT 파일</label>
          <div className="landing-native-drop"><Upload /><strong>TXT 파일 10개 선택됨</strong><span>01화 마나 0의 짐꾼 ~ 10화 첫 번째 전리품</span></div>
          <label>분석 유형</label>
          <div className="landing-native-analysis-type"><strong>기존 설정 구축</strong><span>원고에서 설정 후보를 추출합니다</span></div>
        </section>
      </div>
    </div>
  );
}

function AnalysisScene() {
  const states = ['원문 저장 완료', '원문 정리 완료', '내용 파악 완료', 'AI 설정 추출 중', '설정 후보 생성 대기'];
  return (
    <div className="landing-native-screen">
      <DemoHeader eyebrow="MANUSCRIPT" title="회차 업로드" back />
      <div className="landing-native-upload-page">
        <UploadStepper current={3} />
        <section className="landing-native-processing">
          <RefreshCcw className="landing-native-processing__spinner" />
          <h2>회차를 분석하고 있습니다</h2><p>마나 0의 짐꾼 · 기존 설정 구축</p>
          <div><header><strong>6화 숨겨진 전직</strong><em>AI 설정 추출 중</em></header><section>{states.map((state, index) => <span className={index < 3 ? 'is-done' : index === 3 ? 'is-current' : ''} key={state}>{state}</span>)}</section></div>
          <footer><button type="button" tabIndex={-1}>분석 목록으로</button><button type="button" tabIndex={-1} disabled>분석 진행 중</button></footer>
        </section>
      </div>
    </div>
  );
}

function CandidateScene() {
  return <LandingReviewScene kind="world" />;
}

function ConfirmScene() {
  return <LandingReviewScene kind="character" />;
}

function CharacterDetail() {
  return (
    <section className="landing-native-character-modal">
      <header><span>에</span><div><strong>에단 렌</strong><small>주인공</small></div><button><Clock3 /> 변화 이력 보기</button><button>수정</button><button className="is-danger"><Trash2 /> 삭제</button><b>×</b></header>
      <div className="landing-native-character-body">
        <h3>기본 정보</h3>
        <div className="landing-native-basic"><span><small>이름</small><strong>에단 렌</strong></span><span><small>역할</small><strong>주인공</strong></span><span><small>현재 나이</small><strong>—</strong></span><span><small>현재 레벨</small><strong>8</strong></span><span><small>첫 등장 회차</small><strong>1화</strong></span></div>
        <div className="landing-native-character-columns">
          <div className="landing-native-character-section landing-native-character-section--profile"><h3>프로필</h3><section><div><span>직업</span><strong>재액 운반자</strong></div><div><span>길드 등급</span><strong>동패</strong></div><div><span>역할</span><strong>저주 운반</strong></div></section></div>
          <div className="landing-native-character-settings"><div className="landing-native-character-section"><h3>스탯</h3><section className="is-two-columns"><div><span>마나</span><strong>0</strong></div><div><span>인지력</span><strong>15</strong></div><div><span>영혼력</span><strong>10</strong></div><div><span>하중 한계</span><strong>120</strong></div></section></div><div className="landing-native-character-pair"><div className="landing-native-character-section"><h3>스킬</h3><section><div><span>재액 적재</span><strong>Lv.2</strong></div><div><span>하중 분산</span><strong>Lv.3</strong></div><div><span>저주 반전</span><strong>Lv.1</strong></div></section></div><div className="landing-native-character-section"><h3>상태</h3><section><div><span>이름 소실</span><strong>해제</strong></div><div><span>직업 변경</span><strong>6화</strong></div></section></div></div></div>
        </div>
        <footer><FileText /> 문서 아이콘이 있는 설정은 선택하여 원문 근거를 확인할 수 있습니다.</footer>
      </div>
    </section>
  );
}

function DatabaseCanvas({ showDetail }: { showDetail: boolean }) {
  return (
    <div className="landing-native-screen">
      <BrandHeader /><div className="landing-native-workspace"><Sidebar active="database" /><main className="landing-native-main landing-native-db"><div className="landing-native-page-title"><small>작품 설정</small><strong>캐릭터 설정</strong></div><nav><span className="is-active">캐릭터 설정</span><span>세계관 설정</span><span>설정집 목록</span><span>설정 검색</span></nav><div className="landing-native-character-list"><div className="is-active"><b>에</b><strong>에단 렌</strong><small>재액 운반자 · Lv.8</small></div><div><b>세</b><strong>세라 바인</strong><small>봉인검사 · Lv.12</small></div><div><b>미</b><strong>미라</strong><small>화염술사</small></div><div><b>도</b><strong>도룬</strong><small>방패전사 · Lv.14</small></div><div><b>발</b><strong>발터</strong><small>원정대장 · Lv.15</small></div></div>{showDetail && <><div className="landing-native-modal-shade" /><CharacterDetail /></>}</main></div>
    </div>
  );
}

function DatabaseListScene() {
  return <DatabaseCanvas showDetail={false} />;
}

function CharacterDetailScene() {
  return <DatabaseCanvas showDetail />;
}

function TimelineScene() {
  return (
    <div className="landing-native-screen landing-native-timeline-screen">
      <section className="landing-native-timeline-modal">
        <header><span><Clock3 /></span><div><strong>에단 렌</strong><small>첫 등장 1화 · 18개 설정 · 10개 회차</small></div><b>×</b></header>
        <nav><button>종류별 보기</button><button className="is-active">전체 보기</button></nav>
        <div className="landing-native-timeline-filters"><button className="is-active">전체 <span>18</span></button><button>프로필 <span>2</span></button><button>나이 <span>1</span></button><button>레벨 <span>4</span></button><button>스탯 <span>3</span></button><button>스킬 <span>4</span></button><button>아이템 <span>2</span></button><button>상태 <span>2</span></button></div>
        <div className="landing-native-timeline-layout"><aside><strong>회차 바로가기</strong><select aria-label="회차 선택" defaultValue=""><option value="">첫 회차부터</option></select><div className="landing-native-timeline-range"><button>‹</button><b>1–10화</b><button>›</button></div>{['1화', '2화', '5화', '6화', '7화', '9화', '10화'].map((episode, index) => <span className={index === 6 ? 'is-active' : ''} key={episode}>{episode}<small>{index === 6 ? '4개' : '2개'}</small></span>)}</aside><main><section><header><strong>10화</strong><span>4개</span></header><article><i /><span><small>레벨</small><strong>현재 레벨</strong><p>8</p></span><FileText /></article><article><i /><span><small>스탯</small><strong>영혼력</strong><p>10</p></span><FileText /></article></section><section><header><strong>9화</strong><span>2개</span></header><article><i /><span><small>스킬</small><strong>저주 반전</strong><p>Lv.1 · 영혼력 페널티를 보너스로 반전</p></span><FileText /></article></section><section><header><strong>6화</strong><span>3개</span></header><article className="is-selected"><i /><span><small>프로필</small><strong>직업</strong><p>짐꾼 → 재액 운반자</p></span><FileText /></article></section></main></div>
      </section>
    </div>
  );
}

export const LANDING_DEMO_STEPS: LandingDemoStep[] = [
  { label: '작품 선택과 원고 목록', shortLabel: '작품', scene: <ManuscriptScene /> },
  { label: '원고 업로드', shortLabel: '업로드', scene: <UploadScene /> },
  { label: '원고 분석', shortLabel: '분석', scene: <AnalysisScene /> },
  { label: '설정 후보 추출', shortLabel: '후보', scene: <CandidateScene /> },
  { label: '후보 비교와 확정', shortLabel: '확정', scene: <ConfirmScene /> },
  { label: '작품 설정 전체 목록', shortLabel: '설정', scene: <DatabaseListScene /> },
  { label: '캐릭터 상세 모달', shortLabel: '상세', scene: <CharacterDetailScene /> },
  { label: '변화 이력 전체 보기', shortLabel: '이력', scene: <TimelineScene /> },
];
