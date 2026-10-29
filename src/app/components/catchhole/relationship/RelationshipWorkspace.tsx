import { lazy, Suspense, useId } from 'react';
import { useSearchParams } from 'react-router';
import { FamilyRelationshipWorkspace } from './FamilyRelationshipWorkspace';
import '../../../../styles/relationships-v2.css';

const EpisodeRelationshipWorkspace = lazy(() => import('./EpisodeRelationshipWorkspace'));
export function RelationshipWorkspace(props: { workId: string; enabled: boolean; onOpenCharacter: (id: string) => void }) {
  const [params, setParams] = useSearchParams();
  const id = useId();
  const mode = params.get('relationMode') === 'people' ? 'people' : 'family';
  function changeMode(nextMode: 'family' | 'people') {
    setParams(previous => {
      const next = new URLSearchParams(previous);
      if (nextMode === 'people') next.set('relationMode', nextMode); else next.delete('relationMode');
      return next;
    });
  }
  return <section className="relationship-workspace" aria-label="관계도">
    <div className="relationship-mode-tabs" role="tablist" aria-label="관계도 종류">
      {(['family', 'people'] as const).map((item, index) => <button key={item} type="button" role="tab" id={`${id}-${item}`}
        aria-selected={mode === item} aria-controls={`${id}-panel`} tabIndex={mode === item ? 0 : -1}
        onClick={() => changeMode(item)} onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          event.preventDefault();
          const target = event.key === 'Home' ? 'family' : event.key === 'End' ? 'people' : index === 0 ? 'people' : 'family';
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
