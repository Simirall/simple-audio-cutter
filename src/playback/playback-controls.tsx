import { PauseIcon } from "@phosphor-icons/react/dist/csr/Pause";
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { useAtomValue } from "jotai";
import type { CSSProperties } from "react";
import { clock } from "../editor/edit";
import { editResultAtom } from "../editor/editor-state";
import type { usePlayback } from "./use-playback";

export function PlaybackControls({
  playback,
  position,
  rate,
}: {
  playback: Pick<ReturnType<typeof usePlayback>, "playing" | "toggle" | "beginScrub" | "seek">;
  position: number;
  rate: number;
}) {
  const { playing } = playback;
  const { invalid, total } = useAtomValue(editResultAtom);

  return (
    <div className="transport">
      <button
        type="button"
        className="icon-button"
        aria-label={playing ? "一時停止" : "再生"}
        title={playing ? "一時停止" : "再生"}
        onClick={playback.toggle}
        disabled={!playing && !!invalid}
      >
        {playing ? <PauseIcon weight="fill" /> : <PlayIcon weight="fill" />}
      </button>
      <div className="play-position">
        <input
          type="range"
          aria-label="再生位置"
          aria-valuetext={clock(position / rate)}
          min={0}
          max={total}
          value={position}
          style={
            {
              "--played": `${total ? (position / total) * 100 : 0}%`,
            } as CSSProperties
          }
          disabled={!total}
          onPointerDown={(event) => playback.beginScrub(event.pointerId)}
          onChange={(event) => playback.seek(event.currentTarget.valueAsNumber)}
        />
        <div className="play-times">
          <time>{clock(position / rate)}</time>
          <time>{clock(total / rate)}</time>
        </div>
      </div>
    </div>
  );
}
