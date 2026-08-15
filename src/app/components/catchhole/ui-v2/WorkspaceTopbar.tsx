import type { ReactNode } from 'react';
import { UserMenu } from '../UserMenu';
import { ProductBrand } from './ProductBrand';

type WorkspaceTopbarProps = {
  leading?: ReactNode;
  onBrandClick: () => void;
};

export function WorkspaceTopbar({ leading, onBrandClick }: WorkspaceTopbarProps) {
  return (
    <header className="app-topbar workspace-topbar">
      <div className="workspace-topbar__leading">
        {leading}
        <ProductBrand onClick={onBrandClick} />
      </div>
      <UserMenu />
    </header>
  );
}
