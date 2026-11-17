import { describe, expect, it } from "vite-plus/test";
import { exportFileName } from "./export-file-name";

describe("保存ファイル名", () => {
  it("元の名前を使い、拡張子を保存形式に合わせる", () => {
    expect(exportFileName("録音.編集前.m4a", "mp3")).toBe("録音.編集前.mp3");
    expect(exportFileName("録音", "wav")).toBe("録音.wav");
  });

  it("保存時のローカル日付をゼロ埋めする", () => {
    expect(exportFileName("録音.m4a", "wav", new Date(2026, 0, 5))).toBe("20260105.wav");
  });
});
