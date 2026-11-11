import { useState } from 'react';
import type { EpisodeSummaryResponse } from '../../../api/generated/types.gen';
import { CharacterDatabase } from '../character/CharacterDatabase';
import { CharacterSettingLabelProvider } from '../character/CharacterSettingLabelProvider';
import { EMPTY_TIMELINE_SELECTION } from '../character/character-timeline-filter';
import { EpisodeFileReplaceModal, type EpisodeFileReplaced } from '../EpisodeFileReplaceModal';
import { WorldSettingDatabase } from '../worldsetting/WorldSettingDatabase';
import { useInPlaceCorrection } from './useReportSettingLink';
import type { CorrectionContext } from './validation-return';

/** 리포트 위에 연 `고치기` 창. session은 창을 열 때마다 바뀐다. */
export type ReportFix = { session: number } & ({ kind: 'replace' } | { kind: 'setting'; context: CorrectionContext });

const unused = () => undefined;

/**
 * #428 오류 리포트의 `고치기` 창. 다른 화면으로 이동하지 않고 리포트 위에 띄운다.
 * - 원고 고치기: 원고 목록과 같은 EpisodeFileReplaceModal로 리포트 회차(staging.episodeId)의 파일을 바꾼다.
 * - 설정 고치기: 설정 관리와 같은 캐릭터 상세 편집(CharacterDatabase detailOnly) / 세계관 상세(WorldSettingDatabase detailOnly)에
 *   정정 저장(useInPlaceCorrection, 대시보드와 같은 저장 로직)을 붙인다. 정정 문맥은 주소가 아니라 리포트의 화면 상태다.
 *
 * 리포트 위에서는 캐릭터의 변화 이력·이미지 변경·삭제(상세 보기 머리의 버튼)와 세계관의 이미지 변경·대상 정보 수정을 열지 않는다.
 * 캐릭터는 처음부터 편집으로 열고 편집을 끝내면(취소·저장) 창을 닫으므로 그 버튼이 있는 상세 보기를 거치지 않는다.
 * 설정 옆 원문 근거 보기는 이 창 안에서 그대로 연다.
 */
export function ValidationFixDialogs({ workId, reportId, episodeId, episode, genre, fix, onClose, onReplaced, onCorrected }: {
  workId: string;
  reportId: string;
  /** 리포트 회차. 회차 번호·제목으로 대상을 고르지 않는다. */
  episodeId: string;
  /** 회차 목록에서 읽은 같은 회차(번호·제목·현재 파일명 표시용). 아직 없으면 표시 정보 없이 연다. */
  episode?: EpisodeSummaryResponse;
  genre?: string | null;
  fix: ReportFix | null;
  onClose: () => void;
  onReplaced: (result: EpisodeFileReplaced) => void;
  onCorrected: (result: 'linked' | 'unlinked', receiptId?: string) => void;
}) {
  // 원문 근거 보기는 창 안에서만 연다. 주소에 남기지 않는다.
  const [evidenceFactId, setEvidenceFactId] = useState<string | null>(null);
  const context = fix?.kind === 'setting' ? fix.context : null;
  const correction = useInPlaceCorrection({ workId, context, session: fix?.session ?? 0, onFinish: (result, receiptId) => {
    setEvidenceFactId(null);
    onCorrected(result, receiptId);
  } });
  const close = () => {
    setEvidenceFactId(null);
    onClose();
  };

  if (fix?.kind === 'replace') {
    return (
      <EpisodeFileReplaceModal
        key={fix.session}
        workId={workId}
        episode={episode?.id === episodeId ? episode : { id: episodeId }}
        reportId={reportId}
        onClose={close}
        onReplaced={onReplaced}
      />
    );
  }
  if (context?.subjectType === 'CHARACTER') {
    return (
      <CharacterSettingLabelProvider genre={genre}>
        {/* 설정 관리 화면과 같은 밝은 상세 모달 표면을 쓴다. 감싸는 상자는 리포트 배치에 끼어들지 않는다. */}
        <div className="database-v2" style={{ display: 'contents' }}>
          <CharacterDatabase
            key={fix?.session}
            detailOnly
            workId={workId}
            selectedCharacterId={context.targetId}
            selectedEvidenceFactId={evidenceFactId}
            isEditing
            demoMode={false}
            archiveOpen={false}
            demoCharacters={[]}
            demoArchivedCharacters={[]}
            setDemoCharacters={unused}
            setDemoArchivedCharacters={unused}
            onOpen={unused}
            onClose={close}
            onEvidenceOpen={setEvidenceFactId}
            onEvidenceClose={() => setEvidenceFactId(null)}
            timelineOpen={false}
            timelineEvidenceOpen={false}
            appliedTimelineSelection={EMPTY_TIMELINE_SELECTION}
            onTimelineOpen={unused}
            onTimelineClose={unused}
            onTimelineSelectionChange={unused}
            onArchiveOpen={unused}
            onArchiveClose={unused}
            // 편집 취소는 창을 닫는다(상세 보기로 돌아가지 않는다). 일반 저장을 마쳐도 창을 닫는다.
            onEditChange={editing => { if (!editing) close(); }}
            onEditComplete={close}
            onAnalyze={unused}
            correction={correction.character}
          />
        </div>
      </CharacterSettingLabelProvider>
    );
  }
  if (context?.subjectType === 'WORLD_SETTING') {
    return (
      <WorldSettingDatabase
        key={fix?.session}
        workId={workId}
        enabled
        onAnalyze={unused}
        correction={correction.world}
        detailOnly={{ settingId: context.targetId, onClose: close }}
      />
    );
  }
  return null;
}
