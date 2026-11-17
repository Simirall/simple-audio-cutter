export type Range = readonly [start: number, end: number];
export type Fade = { enabled: boolean; preset: "2" | "5" | "custom"; custom: string };
export type EditSettings = { range: Range; fadeIn: Fade; fadeOut: Fade };

export function fadeSeconds({ enabled, preset, custom }: Fade) {
  return enabled ? (preset === "custom" ? custom : preset) : "0";
}

export function frameCount([start, end]: Range) {
  return end - start;
}
export function fadeSettings(fadeIn: string, fadeOut: string, rate: number, length: number) {
  const seconds = [Number(fadeIn), Number(fadeOut)];
  const fades: Range = [Math.round(seconds[0] * rate), Math.round(seconds[1] * rate)];
  let invalid = "";
  if (!length) invalid = "仕上がりが空です。選択範囲を調整してください。";
  else if (!fadeIn || !fadeOut || seconds.some((value) => !Number.isFinite(value) || value < 0))
    invalid = "フェードには0以上の秒数を入力してください。";
  else if (seconds[0] + seconds[1] > length / rate + Number.EPSILON || fades[0] + fades[1] > length)
    invalid = "フェードの合計を仕上がりの長さ以下にしてください。";
  return { fades, invalid };
}

export function resolveEdit({ range, fadeIn, fadeOut }: EditSettings, rate: number) {
  const total = frameCount(range);
  return { total, ...fadeSettings(fadeSeconds(fadeIn), fadeSeconds(fadeOut), rate, total) };
}

export function clampPosition(position: number, length: number) {
  return Math.max(0, Math.min(length, position));
}

export function revealFrame(
  left: number,
  span: number,
  length: number,
  frame: number,
  playing = false,
) {
  const right = left + span;
  if (frame >= left && (frame < right || (frame === right && !playing))) return left;
  const half = Math.max(1, Math.floor(span / 2));
  const next = playing && frame >= right && frame < right + half ? left + half : frame - half;
  return clampPosition(next, length - span);
}

export function sourcePosition(range: Range, position: number) {
  return range[0] + clampPosition(position, frameCount(range));
}

export function outputPosition(range: Range, source: number) {
  return clampPosition(source - range[0], frameCount(range));
}

export function remapPosition(before: Range, after: Range, position: number) {
  return outputPosition(after, sourcePosition(before, position));
}
export function clock(seconds: number) {
  const tenths = Math.round(seconds * 10);
  const minutes = String(Math.floor(tenths / 600)).padStart(2, "0");
  return `${minutes}:${((tenths % 600) / 10).toFixed(1).padStart(4, "0")}`;
}

export function parseTime(text: string, sampleRate: number) {
  const parts = text.trim().split(":");
  if (parts.length > 3 || parts.some((part) => !/^\d+(?:\.\d+)?$/.test(part))) return NaN;
  return Math.round(parts.reduce((sum, part) => sum * 60 + Number(part), 0) * sampleRate);
}

export function rangeFromTime(
  range: Range,
  edge: number,
  text: string,
  sampleRate: number,
  length: number,
): Range | null {
  const frame = parseTime(text, sampleRate);
  if (
    !Number.isFinite(frame) ||
    frame > length ||
    (edge === 0 ? frame >= range[1] : frame <= range[0])
  ) {
    return null;
  }
  return edge === 0 ? [frame, range[1]] : [range[0], frame];
}

export function editRange([start, end]: Range, edge: number, frame: number, length: number): Range {
  return edge === 0
    ? [clampPosition(frame, end - 1), end]
    : [start, Math.min(length, Math.max(start + 1, frame))];
}

export function gainAt(frame: number, length: number, fadeIn: number, fadeOut: number) {
  return Math.min(
    1,
    fadeIn ? frame / fadeIn : 1,
    fadeOut ? Math.max(0, length - 1 - frame) / fadeOut : 1,
  );
}
