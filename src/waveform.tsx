import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { CornersOutIcon } from "@phosphor-icons/react/dist/csr/CornersOut";
import { MagnifyingGlassMinusIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlassMinus";
import { MagnifyingGlassPlusIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlassPlus";
import { peakSize } from "./audio";
import type { Audio } from "./audio";
import { clock, editRange } from "./edit";
import type { Range } from "./edit";

type Viewport = { left: number; zoom: number };

export function Waveform({
  audio,
  viewport,
  onViewportChange,
  range,
  cursor,
  onRange,
  onRangeDrag,
  onSeek,
  onSeekStart,
}: {
  audio: Audio;
  viewport: Viewport;
  onViewportChange: (viewport: Viewport) => void;
  range: Range;
  cursor: number;
  onRange: (range: Range) => void;
  onRangeDrag: (dragging: boolean) => void;
  onSeek: (frame: number) => void;
  onSeekStart: (id: number) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const { left, zoom } = viewport;
  const [active, setActive] = useState(0);
  const drag = useRef<{
    id: number;
    edge: number;
    initial: Range;
    x: number;
    span: number;
  } | null>(null);
  const seekPointer = useRef<number | null>(null);
  const span = Math.max(1, Math.ceil(audio.frames / zoom));
  const right = left + span;
  const rate = audio.buffer.sampleRate;

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
        for (let i = start; i < end && i < audio.peaks.length; i++)
          peak = Math.max(peak, audio.peaks[i]);
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
  }, [audio, left, span]);

  function update(edge: number, value: number) {
    onRange(editRange(range, edge, value, audio.frames));
  }

  function zoomTo(next: number) {
    const nextSpan = Math.ceil(audio.frames / next);
    const center = zoom === 1 ? (range[0] + range[1]) / 2 : left + span / 2;
    onViewportChange({
      left: Math.max(0, Math.min(audio.frames - nextSpan, Math.round(center - nextSpan / 2))),
      zoom: next,
    });
  }

  function cancel(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.id !== event.pointerId) return;
    onRange(drag.current.initial);
    endDrag();
  }

  function beginDrag(event: PointerEvent<HTMLDivElement>, edge: number) {
    if (!rail.current) return;
    drag.current = {
      id: event.pointerId,
      edge,
      initial: range,
      x: event.clientX,
      span,
    };
    rail.current.setPointerCapture(event.pointerId);
    onRangeDrag(true);
    onSeekStart(event.pointerId);
  }

  function endDrag() {
    drag.current = null;
    onRangeDrag(false);
  }

  function frameAt(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    return Math.round(left + ((event.clientX - box.left) / box.width) * span);
  }

  const percent = (frame: number) => 100 * Math.min(1, Math.max(0, (frame - left) / span));
  const start = percent(range[0]);
  const end = percent(range[1]);
  const maxZoom = Math.max(1, Math.min(128, audio.frames / rate));
  return (
    <div className="waveform">
      <div className="wave-tools" role="group" aria-label="波形の拡大表示">
        <div className="zoom-step">
          <button
            type="button"
            className="icon-button ghost"
            aria-label="縮小"
            title="縮小"
            onClick={() => zoomTo(Math.max(1, zoom / 2))}
            disabled={zoom === 1}
          >
            <MagnifyingGlassMinusIcon />
          </button>
          <button
            type="button"
            className="icon-button ghost"
            aria-label="拡大"
            title="拡大"
            onClick={() => zoomTo(Math.min(maxZoom, zoom * 2))}
            disabled={zoom >= maxZoom}
          >
            <MagnifyingGlassPlusIcon />
          </button>
        </div>
        <button
          type="button"
          className="icon-button outline"
          aria-label="全体表示"
          title="全体表示"
          onClick={() => zoomTo(1)}
          disabled={zoom === 1}
        >
          <CornersOutIcon />
        </button>
      </div>
      <div className="wave-box">
        <div
          className="wave-rail"
          ref={rail}
          onPointerDown={(event) => {
            if (event.button !== 0 || drag.current || seekPointer.current !== null) return;
            const frame = frameAt(event);
            seekPointer.current = event.pointerId;
            event.currentTarget.setPointerCapture(event.pointerId);
            onSeekStart(event.pointerId);
            onSeek(frame);
          }}
          onPointerMove={(event) => {
            if (seekPointer.current === event.pointerId) onSeek(frameAt(event));
            const state = drag.current;
            if (state?.id !== event.pointerId) return;
            const dx = event.clientX - state.x;
            const delta = Math.round(
              (dx / event.currentTarget.getBoundingClientRect().width) * state.span,
            );
            onRange(
              editRange(state.initial, state.edge, state.initial[state.edge] + delta, audio.frames),
            );
          }}
          onPointerUp={(event) => {
            const state = drag.current;
            if (state?.id !== event.pointerId) return;
            endDrag();
          }}
          onPointerCancel={cancel}
          onLostPointerCapture={(event) => {
            if (seekPointer.current === event.pointerId) seekPointer.current = null;
            cancel(event);
          }}
        >
          <canvas aria-hidden="true" ref={canvas} />
          <div
            aria-hidden="true"
            className="selected"
            style={{ left: `${start}%`, width: `${end - start}%` }}
          />
          {(
            [
              [0, start],
              [end, 100],
            ] as const
          ).map(([from, to], i) => (
            <div
              aria-hidden="true"
              className="outside-range"
              key={i}
              style={{ left: `${from}%`, width: `${to - from}%` }}
            />
          ))}
          {cursor >= left && cursor <= right && (
            <div className="cursor" aria-hidden="true" style={{ left: `${percent(cursor)}%` }}>
              <span>
                <CaretDownIcon size={16} weight="fill" />
              </span>
            </div>
          )}
          {range.map(
            (frame, edge) =>
              frame >= left &&
              frame <= right && (
                <div
                  key={edge}
                  className="handle"
                  data-edge={edge}
                  style={{ left: `${percent(frame)}%`, zIndex: active === edge ? 4 : 3 }}
                  role="slider"
                  tabIndex={0}
                  aria-label={edge === 0 ? "選択範囲の開始" : "選択範囲の終了"}
                  aria-valuemin={(edge === 0 ? 0 : range[0] + 1) / rate}
                  aria-valuemax={(edge === 0 ? range[1] - 1 : audio.frames) / rate}
                  aria-valuenow={frame / rate}
                  aria-valuetext={clock(frame / rate)}
                  onFocus={() => setActive(edge)}
                  onKeyDown={(event) => {
                    const step = Math.max(1, Math.round(rate * (event.shiftKey ? 1 : 0.01)));
                    const keys: Record<string, number> = {
                      ArrowLeft: frame - step,
                      ArrowDown: frame - step,
                      ArrowRight: frame + step,
                      ArrowUp: frame + step,
                      Home: 0,
                      End: audio.frames,
                    };
                    if (!(event.key in keys)) return;
                    event.preventDefault();
                    update(edge, keys[event.key]);
                  }}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    if (drag.current || seekPointer.current !== null || event.button !== 0) return;
                    setActive(edge);
                    beginDrag(event, edge);
                  }}
                >
                  <span aria-hidden="true" />
                </div>
              ),
          )}
        </div>
      </div>
      <div className="wave-scale">
        <div>
          <button
            type="button"
            className="icon-button ghost"
            aria-label="波形を左へ移動"
            title="波形を左へ移動"
            onClick={() =>
              onViewportChange({ left: Math.max(0, left - Math.ceil(span / 2)), zoom })
            }
            disabled={left === 0}
          >
            <ArrowLeftIcon />
          </button>
          <time>{clock(left / rate)}</time>
        </div>
        <div>
          <time>{clock(right / rate)}</time>
          <button
            type="button"
            className="icon-button ghost"
            aria-label="波形を右へ移動"
            title="波形を右へ移動"
            onClick={() =>
              onViewportChange({
                left: Math.min(audio.frames - span, left + Math.ceil(span / 2)),
                zoom,
              })
            }
            disabled={right >= audio.frames}
          >
            <ArrowRightIcon />
          </button>
        </div>
      </div>
    </div>
  );
}
