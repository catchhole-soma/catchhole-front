import type { RefObject } from 'react';
import { ArrowDown, ArrowRight, Check, CheckCircle2, Pause, Play, RotateCcw } from 'lucide-react';
import { ActionButton } from '../ui-v2/ActionButton';
import { useLandingVideo } from './useLandingVideo';

type LandingVideoHeroProps = {
  scrollContainerRef: RefObject<HTMLDivElement>;
  headerRef: RefObject<HTMLElement>;
  onDemo: () => void;
  onSignup: () => void;
};

const assetRoot = '/landing/video-hero';
function PlaybackControl({ extracting, completed, playing, ended, onToggle }: {
  extracting: boolean; completed: boolean; playing: boolean; ended: boolean; onToggle: () => void;
}) {
  const replay = completed || (!extracting && ended);
  const label = replay ? completed ? '처음부터 다시 보기' : '영상 다시 재생' :
    `${extracting ? '설정 추출' : '영상'} ${playing ? '일시정지' : '재생'}`;
  const Icon = replay ? RotateCcw : playing ? Pause : Play;
  return <button className="lvh-play-toggle" type="button" aria-label={label} aria-pressed={playing} onClick={onToggle}>
    <Icon size={15} aria-hidden="true" /><span>{label}</span>
  </button>;
}

const settingGroups = [
  {
    key: 'world', title: '세계관 설정',
    facts: [
      { name: '북쪽 성문', value: '첫 햇빛이 닿는 순간에만 열림' },
      { name: '소년이 운반하는 봉인함', value: '살아 있는 사람이 만지고 있을 때만 봉인 유지' },
      { name: '성벽 위의 구리 종', value: '성문 근처에서 마력이 모일 때마다 울림' },
    ],
  },
  { key: 'character', title: '캐릭터 설정', facts: [{ name: '리엔', value: '마법사' }] },
  {
    key: 'magic', title: '마법 설정',
    facts: [
      { name: '리엔의 불 마법', value: '마법으로 불을 피울 때마다 소중한 기억 하나를 잃음' },
      { name: '성 안의 금지 마법', value: '불 마법 사용 금지' },
    ],
  },
] as const;

export function LandingVideoHero({ scrollContainerRef, headerRef, onDemo, onSignup }: LandingVideoHeroProps) {
  const { sectionRef, videoRef, state, showSettings, showVideo, confirm, togglePlayback, retryVideo } =
    useLandingVideo(scrollContainerRef, headerRef);
  const extracting = state.mode === 'mobile' && state.scene !== 'video';
  const completed = state.confirmedMask === 7;

  return (
    <section ref={sectionRef} className="landing-hero landing-video-hero" id="features"
      aria-labelledby="landing-video-title" data-mode={state.mode} data-scene={state.scene} data-video-ended={state.ended}>
      <div className="lvh-story">
      <div className="lvh-sticky">
        <div className="lvh-scene-heading">
          <div><p>쓰던 원고에서 바로</p><h2>설정이 한눈에 펼쳐져요.</h2></div>
          <button type="button" className="lvh-back" onClick={showVideo}><RotateCcw size={14} aria-hidden="true" />처음 장면으로</button>
        </div>
        <div className="lvh-viewport">
          <button className="lvh-keyboard-skip" type="button" onClick={showSettings}>영상 건너뛰고 설정 보기</button>
          <div className="lvh-canvas">
            <div className="lvh-film">
              <video ref={videoRef} muted playsInline preload="auto" poster={`${assetRoot}/poster.jpg`}
                aria-label="집필하는 작가에서 노트북 원고로 이어지는 영상">
                <source src={`${assetRoot}/writer-to-laptop.mp4`} type="video/mp4" />
              </video>
              <img className="lvh-freeze" src={`${assetRoot}/last-frame.jpg`} alt="" aria-hidden="true" draggable={false} />
            </div>
            <svg className="lvh-wires" aria-hidden="true">
              {settingGroups.map(group => <path key={group.key} data-setting-wire={group.key} pathLength="1" />)}
            </svg>
            <div className="lvh-editor" aria-hidden="true">
              <p className="lvh-manuscript-label">잊힌 불씨<span>25화. 북쪽 성문</span></p>
              <img src={`${assetRoot}/manuscript-25.png`} width="1600" height="1000" draggable={false}
                alt="잊힌 불씨 25화 북쪽 성문. 리엔과 소년이 성문을 향하는 19문단의 확정 원고 편집 화면" />
            </div>
            {settingGroups.map((group, index) => {
              const confirmed = (state.confirmedMask & (1 << index)) !== 0;
              const shown = (state.visibleMask & (1 << index)) !== 0;
              const interactive = (state.interactiveMask & (1 << index)) !== 0;
              return (
                <section key={group.key} className={`lvh-setting lvh-setting--${group.key}`}
                  data-setting-group={group.key} aria-label={group.title} aria-hidden={!shown}>
                  <header className="lvh-setting__header">
                    <h3>{group.title}</h3>
                    <span className="lvh-setting__status" data-confirmed={confirmed}>
                      {confirmed && <Check size={17} aria-hidden="true" />}{confirmed ? '확정' : '추출됨'}
                    </span>
                  </header>
                  {group.facts.map(fact => (
                    <div key={fact.name} className="lvh-fact">
                      <h4>{fact.name}</h4>
                      <p>{group.key === 'character' && <span className="lvh-fact__label">직업</span>}{fact.value}</p>
                    </div>
                  ))}
                  <button type="button" className="lvh-confirm" aria-label={`${group.title} ${confirmed ? '확정됨' : '확정'}`}
                    disabled={confirmed} tabIndex={interactive && !confirmed ? 0 : -1} onClick={() => confirm(index)}>
                    {confirmed ? '확정됨' : '확정'}
                  </button>
                </section>
              );
            })}
            <p className="lvh-finish" role="status" aria-live="polite" hidden={state.confirmedMask !== 7}>
              원고 속 설정 6개, 정리 완료
            </p>
            <div className="lvh-foreground" aria-hidden="true"><img src={`${assetRoot}/last-frame.jpg`} alt="" draggable={false} /></div>
          </div>
          <div className="lvh-shade" aria-hidden="true" />
          <div className="lvh-cue" aria-hidden="true"><ArrowDown size={17} />아래로 스크롤해 보세요</div>
          <div className="lvh-copy">
            <h1 id="landing-video-title" className="landing-hero-title"><span>설정 추출부터 검수까지</span><span>캐치홀 하나로</span></h1>
            <button className="lvh-reduced-settings" type="button" onClick={showSettings}>설정 추출 보기<ArrowRight size={15} aria-hidden="true" /></button>
          </div>
          <PlaybackControl extracting={extracting} completed={completed} playing={state.playing} ended={state.ended} onToggle={togglePlayback} />
          {state.mediaError && <div className="lvh-media-error" role="status">
            <span>영상을 불러오지 못했습니다.</span><button type="button" onClick={retryVideo}>다시 불러오기</button>
          </div>}
        </div>
      </div>
      </div>
      <div className="lvh-end-actions" hidden={!completed}>
        <div className="landing-actions">
          <ActionButton className="landing-primary-action" icon={<ArrowRight size={16} aria-hidden="true" />} onClick={onDemo}>
            로그인 없이 체험하기
          </ActionButton>
          <ActionButton variant="secondary" onClick={onSignup}>지금 무료로 시작하기</ActionButton>
        </div>
        <div className="landing-trust">
          <span className="landing-trust__item"><CheckCircle2 size={14} aria-hidden="true" />원문 근거까지 한눈에</span>
          <span className="landing-trust__item"><CheckCircle2 size={14} aria-hidden="true" />작가가 직접 최종 확정</span>
        </div>
        <button className="lvh-end-replay" type="button" onClick={showVideo}><RotateCcw size={14} aria-hidden="true" />처음부터 다시 보기</button>
      </div>
    </section>
  );
}
