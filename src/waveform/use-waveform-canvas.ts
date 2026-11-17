import { useEffect, useRef } from "react";
import { peakSize } from "../audio/read-audio";

export function useWaveformCanvas(peaks: Float32Array, left: number, span: number) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const element = canvas.current;
    if (!element) return;
    const draw = () => {
      const { width, height } = element.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      element.width = Math.round(width * ratio);
      element.height = Math.round(height * ratio);
      const ctx = element.getContext("2d");
      if (!ctx || width < 1) return;
      ctx.scale(ratio, ratio);
      ctx.fillStyle = getComputedStyle(element).color;
      for (let x = 0; x < width; x += 3) {
        const start = Math.floor((left + (x / width) * span) / peakSize);
        const end = Math.ceil((left + ((x + 3) / width) * span) / peakSize);
        let peak = 0;
        for (let i = start; i < end && i < peaks.length; i++) peak = Math.max(peak, peaks[i]);
        const bar = Math.max(1, Math.min(1, peak) * (height - 16));
        ctx.fillRect(x, (height - bar) / 2, 2, bar);
      }
    };
    const observer = new ResizeObserver(draw);
    observer.observe(element);
    const scheme = matchMedia("(prefers-color-scheme: dark)");
    scheme.addEventListener("change", draw);
    draw();
    return () => {
      observer.disconnect();
      scheme.removeEventListener("change", draw);
    };
  }, [peaks, left, span]);

  return canvas;
}
