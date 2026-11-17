import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { useAtomValue } from "jotai";
import { useLayoutEffect, useRef } from "react";
import { revealFrame, sourcePosition } from "../editor/edit";
import type { Range } from "../editor/edit";
import { playbackPositionAtom } from "../playback/use-playback";

export type Viewport = { left: number; zoom: number };

export function Playhead({
  length,
  range,
  viewport: { left, zoom },
  span,
  playing,
  rangeDragging,
  onViewportChange,
}: {
  length: number;
  range: Range;
  viewport: Viewport;
  span: number;
  playing: boolean;
  rangeDragging: boolean;
  onViewportChange: (viewport: Viewport) => void;
}) {
  const cursor = sourcePosition(range, useAtomValue(playbackPositionAtom));
  const previousView = useRef({ cursor, zoom });

  useLayoutEffect(() => {
    if (rangeDragging) return;
    const previous = previousView.current;
    previousView.current = { cursor, zoom };
    // Let users browse the waveform with the arrows while paused.
    if (!playing && cursor === previous.cursor && zoom === previous.zoom) return;
    const nextLeft = revealFrame(left, span, length, cursor, playing);
    if (nextLeft !== left) onViewportChange({ left: nextLeft, zoom });
  }, [cursor, left, length, onViewportChange, playing, rangeDragging, span, zoom]);

  if (cursor < left || cursor > left + span) return null;
  return (
    <div
      className="cursor"
      aria-hidden="true"
      style={{ left: `${((cursor - left) / span) * 100}%` }}
    >
      <span>
        <CaretDownIcon size={16} weight="fill" />
      </span>
    </div>
  );
}
