type Point = [number, number];

type Rect = { x: number; y: number; width: number; height: number };

export const clamp = (value: number): number => Math.max(0, Math.min(1, value));
const lerp = (from: number, to: number, progress: number): number =>
  from + (to - from) * progress;
export const smooth = (value: number): number => {
  const progress = clamp(value);
  return progress * progress * (3 - 2 * progress);
};
export const ease = (value: number): number => 1 - (1 - clamp(value)) ** 3;
export const toInternal = (progress: number): number => clamp((progress - 0.018) / 0.982);
export const toGlobal = (progress: number): number => 0.018 + 0.982 * clamp(progress);

const rectPoints = ({ x, y, width, height }: Rect): Point[] => [
  [x, y], [x + width, y], [x + width, y + height], [x, y + height],
];

/** Map the editor's 1600 × 1000 plane to clockwise corners starting at top left. */
function matrixFor(points: Point[]): string {
  if (points.length !== 4) return 'none';
  const source = rectPoints({ x: 0, y: 0, width: 1600, height: 1000 });
  const rows: number[][] = [];
  for (let index = 0; index < 4; index++) {
    const [x, y] = source[index];
    const [u, v] = points[index];
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let column = 0; column < 8; column++) {
    let pivot = column;
    for (let row = column + 1; row < 8; row++) {
      if (Math.abs(rows[row][column]) > Math.abs(rows[pivot][column])) pivot = row;
    }
    [rows[column], rows[pivot]] = [rows[pivot], rows[column]];
    const divisor = rows[column][column];
    if (Math.abs(divisor) < 1e-10) return 'none';
    for (let cell = column; cell < 9; cell++) rows[column][cell] /= divisor;
    for (let row = 0; row < 8; row++) {
      if (row === column) continue;
      const factor = rows[row][column];
      for (let cell = column; cell < 9; cell++) {
        rows[row][cell] -= factor * rows[column][cell];
      }
    }
  }
  const [a, b, c, d, e, f, g, h] = rows.map(row => row[8]);
  return `matrix3d(${a},${d},0,${g},${b},${e},0,${h},0,0,1,0,${c},${f},0,1)`;
}

type HeroGeometry = {
  p: number;
  ex: number;
  morph: number;
  opening: number;
  viewport: Rect;
  frameScale: number;
  sceneHeight: number;
  film: Rect;
  editorTransform: string;
  editorRect: Rect;
};

export function geometryFor({ progress, width, height, headerHeight, reducedMotion }: {
  progress: number;
  width: number;
  height: number;
  headerHeight: number;
  reducedMotion: boolean;
}): HeroGeometry {
  const p = toInternal(progress);
  const ex = clamp((p - 0.6) / 0.4) * 100;
  const opening = reducedMotion ? 0 : smooth(progress / 0.075);
  const morph = reducedMotion ? (p >= 0.6 ? 1 : 0) : smooth((p - 0.48) / 0.12);
  const compact = width < 1050;
  const finalSceneHeight = compact ? 1500 : 1000;
  const availableHeight = Math.max(1, height - headerHeight - 104);
  const webScale = Math.min(
    Math.max(1, width - 80) / 1600,
    Math.min(Math.max(1, height - 190), availableHeight) / finalSceneHeight,
  );
  const web: Rect = {
    x: (width - 1600 * webScale) / 2,
    y: headerHeight + 80 + (availableHeight - finalSceneHeight * webScale) / 2,
    width: 1600 * webScale,
    height: finalSceneHeight * webScale,
  };
  // The sticky container starts below the header; its external offset is handled by the hook.
  const video: Rect = {
    x: 16 * (1 - opening),
    y: 0,
    width: width - 32 * (1 - opening),
    height: height - (headerHeight + 24) * (1 - opening),
  };
  const viewport: Rect = {
    x: lerp(video.x, web.x, morph),
    y: lerp(video.y, web.y, morph),
    width: lerp(video.width, web.width, morph),
    height: lerp(video.height, web.height, morph),
  };
  const frameScale = viewport.width / 1600;
  const sceneHeight = viewport.height / frameScale;
  const filmScale = Math.max(1600 / 1468, sceneHeight / 630);
  const film: Rect = {
    x: (1600 - 1468 * filmScale) * lerp(0.58, 0.5, smooth(p / 0.45)),
    y: (sceneHeight - 630 * filmScale) / 2,
    width: 1468 * filmScale,
    height: 630 * filmScale,
  };
  const spread = reducedMotion ? (ex > 8 ? 1 : 0) : ease((ex - 8) / 20);
  const finalEditorWidth = compact ? Math.max(180, Math.min(840,
    1600 - 2 * Math.max(330, 194 / webScale) - 96,
  )) : 840;
  const editorWidth = lerp(1536, finalEditorWidth, spread);
  const editorHeight = editorWidth / 1.6;
  const editorRect: Rect = {
    x: (1600 - editorWidth) / 2,
    y: (finalSceneHeight - editorHeight) / 2,
    width: editorWidth,
    height: editorHeight,
  };
  const target = rectPoints(editorRect);
  const corners: Point[] = [[331, 187], [920, 126], [997, 461], [394, 589]];
  const points = p < 0.6 ? corners.map(([x, y], index): Point => [
    lerp(film.x + x * filmScale, target[index][0], morph),
    lerp(film.y + y * filmScale, target[index][1], morph),
  ]) : target;
  return { p, ex, morph, opening, viewport, frameScale, sceneHeight, film,
    editorTransform: matrixFor(points), editorRect };
}
