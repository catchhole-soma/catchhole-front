import type { Locator } from '@playwright/test';

type Rgba = [number, number, number, number];

function parseRgba(value: string): Rgba {
  const channels = value.match(/\d+(?:\.\d+)?/g)?.map(Number);
  if (!channels || channels.length < 3) {
    throw new Error(`RGB 색상을 해석할 수 없습니다: ${value}`);
  }
  return [channels[0], channels[1], channels[2], channels[3] ?? 1];
}

function composite(foreground: Rgba, background: Rgba): Rgba {
  const alpha = foreground[3] + background[3] * (1 - foreground[3]);
  if (alpha === 0) return [0, 0, 0, 0];
  return [
    (foreground[0] * foreground[3]
      + background[0] * background[3] * (1 - foreground[3])) / alpha,
    (foreground[1] * foreground[3]
      + background[1] * background[3] * (1 - foreground[3])) / alpha,
    (foreground[2] * foreground[3]
      + background[2] * background[3] * (1 - foreground[3])) / alpha,
    alpha,
  ];
}

function luminance(color: Rgba): number {
  const channels = color.slice(0, 3).map(channel => {
    const normalized = channel / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export async function computedContrastRatio(
  locator: Locator,
  backgroundLocator: Locator = locator,
  backdropLocator?: Locator,
): Promise<number> {
  const [foregroundValue, backgroundValue, backdropValue] = await Promise.all([
    locator.evaluate(element => getComputedStyle(element).color),
    backgroundLocator.evaluate(element => getComputedStyle(element).backgroundColor),
    backdropLocator
      ? backdropLocator.evaluate(element => getComputedStyle(element).backgroundColor)
      : Promise.resolve('rgb(255, 255, 255)'),
  ]);
  const background = composite(parseRgba(backgroundValue), parseRgba(backdropValue));
  const foreground = composite(parseRgba(foregroundValue), background);
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}
