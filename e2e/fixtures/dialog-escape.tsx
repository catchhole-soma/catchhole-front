import { createRoot } from 'react-dom/client';
import { WorldSettingDialog } from '../../src/app/components/catchhole/worldsetting/WorldSettingDialog';

export function mountDialogEscape(veto: boolean) {
  document.getElementById('root')?.remove();
  const target = document.createElement('div');
  document.body.append(target);
  const root = createRoot(target);
  let closes = 0;
  const render = () => root.render(<main>
    <output data-testid="dialog-close-count">{closes}</output>
    {closes === 0 && <WorldSettingDialog title="첫 포커스 키보드 계약" onClose={() => {
      closes += 1;
      render();
    }}>
      <textarea aria-label="보존할 수정안" defaultValue="보존할 수정안" onKeyDown={event => {
        if (veto && event.key === 'Escape') event.preventDefault();
      }} />
    </WorldSettingDialog>}
  </main>);
  render();
}
