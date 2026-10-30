import { lazy, Suspense, useId } from 'react';
import { useSearchParams } from 'react-router';
import { FamilyRelationshipWorkspace } from './FamilyRelationshipWorkspace';
import { getRelationshipMode } from '../../../lib/relationship-feature';
import '../../../../styles/relationships-v2.css';

const EpisodeRelationshipWorkspace = lazy(() => import('./EpisodeRelationshipWorkspace'));
const modes = ['people', 'family'] as const;
export function RelationshipWorkspace(props: { workId: string; enabled: boolean; onOpenCharacter: (id: string) => void }) {
  const [params, setParams] = useSearchParams();
  const id = useId();
  const mode = getRelationshipMode(params);
  function changeMode(nextMode: 'family' | 'people') {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      next.set('relationMode', nextMode);
      return next;
    });
  }
  return <section className="relationship-workspace" aria-label="관계도">
    <div className="relationship-mode-tabs" role="tablist" aria-label="관계도 종류">
      {modes.map((item, index) => <button key={item} type="button" role="tab" id={`${id}-${item}`}
        aria-selected={mode === item} aria-controls={`${id}-panel`} tabIndex={mode === item ? 0 : -1}
        onClick={() => changeMode(item)} onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const target = event.key === 'Home' ? modes[0] : event.key === 'End' ? modes[1] : modes[1 - index];
          changeMode(target);
          document.getElementById(`${id}-${target}`)?.focus();
        }}>{item === 'family' ? '가계도' : '인물 관계도'}</button>)}
    </div>
    <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-${mode}`}>
      {mode === 'family' ? <FamilyRelationshipWorkspace {...props} /> :
        <Suspense fallback={<p role="status">인물 관계도를 불러오고 있어요.</p>}><EpisodeRelationshipWorkspace workId={props.workId} enabled={props.enabled} /></Suspense>}
    </div>
  </section>;
}
