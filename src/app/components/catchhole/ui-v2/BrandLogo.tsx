type BrandLogoProps = {
  alt?: string;
  className?: string;
};

const BRAND_ASSET = '/brand/catchhole-glossy-v1.png';

export function BrandLogo({ alt, className = '' }: BrandLogoProps) {
  return (
    <span
      aria-hidden={alt ? undefined : true}
      aria-label={alt}
      className={`brand-logo${className ? ` ${className}` : ''}`}
      role={alt ? 'img' : undefined}
    >
      <img className="brand-logo__symbol" alt="" src={BRAND_ASSET} width={512} height={512} decoding="async" />
      <span className="brand-logo__wordmark">
        <img alt="" src="/brand/catchhole-wordmark.png" width={512} height={341} decoding="async" />
      </span>
    </span>
  );
}
