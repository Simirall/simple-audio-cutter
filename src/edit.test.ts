import { describe, expect, it } from "vite-plus/test";
import {
  clampPosition,
  clock,
  editRange,
  exportFileName,
  fadeSeconds,
  fadeSettings,
  frameCount,
  gainAt,
  outputPosition,
  parseTime,
  remapPosition,
  revealFrame,
  sourcePosition,
} from "./edit";

describe("保存ファイル名", () => {
  it("元の名前を使い、拡張子を保存形式に合わせる", () => {
    expect(exportFileName("録音.編集前.m4a", "mp3")).toBe("録音.編集前.mp3");
    expect(exportFileName("録音", "wav")).toBe("録音.wav");
  });

  it("保存時のローカル日付をゼロ埋めする", () => {
    expect(exportFileName("録音.m4a", "wav", new Date(2026, 0, 5))).toBe("20260105.wav");
  });
});

describe("カット", () => {
  it("選択した開始・終了サンプルから仕上がりの長さを求める", () => {
    expect(frameCount([3, 7])).toBe(4);
    expect(frameCount([0, 0])).toBe(0);
  });
});
describe("再生位置", () => {
  it("表示範囲外にシークしたときだけ、表示幅を保って位置を合わせる", () => {
    expect(revealFrame(40, 20, 100, 50)).toBe(40);
    expect(revealFrame(40, 20, 100, 80)).toBe(70);
    expect(revealFrame(40, 20, 100, 5)).toBe(0);
    expect(revealFrame(40, 20, 100, 100)).toBe(80);
    expect(revealFrame(0, 100, 100, 100)).toBe(0);
  });

  it("再生中は右端に達したときに半画面進み、その後のフレームでは視点を固定する", () => {
    expect(revealFrame(40, 20, 100, 59, true)).toBe(40);
    const next = revealFrame(40, 20, 100, 60, true);
    expect(next).toBe(50);
    expect(revealFrame(40, 20, 100, 61, true)).toBe(next);
    expect(revealFrame(next, 20, 100, 61, true)).toBe(next);
    expect(revealFrame(80, 20, 100, 100, true)).toBe(80);
  });

  it("範囲の変更後も元音声上の位置を保ち、範囲外では端に合わせる", () => {
    expect(remapPosition([20, 80], [30, 85], 25)).toBe(15);
    expect(remapPosition([20, 80], [50, 85], 25)).toBe(0);
    expect(remapPosition([20, 80], [10, 40], 25)).toBe(30);
  });

  it("時刻表示を小数1桁に揃え、分の境界を繰り上げる", () => {
    expect(clock(1.24)).toBe("00:01.2");
    expect(clock(59.97)).toBe("01:00.0");
  });
  it("選択範囲の外を最寄りの端に制限する", () => {
    const range = [20, 60] as const;
    expect(outputPosition(range, 10)).toBe(0);
    expect(outputPosition(range, 80)).toBe(40);
    expect(sourcePosition(range, clampPosition(80, 40))).toBe(60);
  });

  it("範囲の両端が逆転せず、時刻入力をサンプル単位に変換する", () => {
    expect(editRange([20, 60], 0, 99, 100)).toEqual([59, 60]);
    expect(editRange([20, 60], 1, 0, 100)).toEqual([20, 21]);
    expect(parseTime("01:23.500", 48_000)).toBe(4_008_000);
    expect(parseTime("00:", 48_000)).toBeNaN();
  });
});

describe("フェード", () => {
  it("オフでは0秒、有効時は選んだプリセットまたは入力値を使う", () => {
    expect(fadeSeconds({ enabled: false, preset: "custom", custom: "2.5" })).toBe("0");
    expect(fadeSeconds({ enabled: true, preset: "5", custom: "2.5" })).toBe("5");
    expect(fadeSeconds({ enabled: true, preset: "custom", custom: "2.5" })).toBe("2.5");
  });

  it("試聴と書き出しに使うフレーム数を返し、仕上がりが短くなったら無効にする", () => {
    expect(fadeSettings("0.2", "0.5", 100, 80)).toEqual({ fades: [20, 50], invalid: "" });
    expect(fadeSettings("0.2", "0.5", 100, 60).invalid).not.toBe("");
    expect(fadeSettings("0", "0", 100, 0).invalid).not.toBe("");
  });

  const gains = (length: number, fadeIn: number, fadeOut: number) =>
    Array.from({ length }, (_, index) => gainAt(index, length, fadeIn, fadeOut));

  it("完成音声の両端を個別の長さで調整する", () => {
    expect(gains(7, 2, 1)).toEqual([0, 0.5, 1, 1, 1, 1, 0]);
    expect(gains(4, 0, 2)).toEqual([1, 1, 0.5, 0]);
    expect(gains(4, 2, 0)).toEqual([0, 0.5, 1, 1]);
  });

  it("フェードが無効なら音量を維持する", () => {
    expect(gains(1, 0, 0)).toEqual([1]);
    expect(gains(1, 1, 0)).toEqual([0]);
  });
});
