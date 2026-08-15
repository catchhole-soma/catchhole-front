type BrandLogoProps = {
  alt?: string;
  className?: string;
  variant?: 'symbol' | 'wordmark';
};

const BRAND_ASSET = {
  symbol: '/brand/catchhole-symbol.png',
  wordmark: '/brand/catchhole-wordmark.png',
} as const;

export function BrandLogo({ alt, className = '', variant = 'wordmark' }: BrandLogoProps) {
  return (
    <span
      aria-hidden={alt ? undefined : true}
      aria-label={alt}
      className={`brand-logo brand-logo--${variant}${className ? ` ${className}` : ''}`}
      role={alt ? 'img' : undefined}
    >
      <img alt="" src={BRAND_ASSET[variant]} />
    </span>
  );
}
