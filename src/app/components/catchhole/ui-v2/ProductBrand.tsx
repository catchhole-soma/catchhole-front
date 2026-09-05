import { BrandLogo } from './BrandLogo';

type ProductBrandProps = {
  compact?: boolean;
  onClick?: () => void;
};

export function ProductBrand({ compact = false, onClick }: ProductBrandProps) {
  const content = (
    <>
      <BrandLogo className="product-brand__symbol" />
      {!compact && <span className="product-brand__badge">BETA</span>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className="product-brand" aria-label="작품 선택으로 이동" onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className="product-brand" aria-label="CatchHole">{content}</div>;
}
