import { useAtomValue } from "jotai";
import type { Audio } from "../audio/read-audio";
import { PlaybackControls } from "../playback/playback-controls";
import { playbackPositionAtom } from "../playback/use-playback";
import type { usePlayback } from "../playback/use-playback";
import { useWaveformViewport } from "../waveform/use-waveform-viewport";
import { Waveform } from "../waveform/waveform";
import { outputPosition, sourcePosition } from "./edit";
import type { Range } from "./edit";
import { rangeAtom } from "./editor-state";
import { RangeFields } from "./range-fields";

export function Timeline({
  audio,
  playback,
  onRange,
  onError,
}: {
  audio: Audio;
  playback: Pick<ReturnType<typeof usePlayback>, "playing" | "seek" | "beginScrub" | "toggle">;
  onRange: (range: Range) => void;
  onError: (error: string) => void;
}) {
  const range = useAtomValue(rangeAtom);
  const position = useAtomValue(playbackPositionAtom);
  const cursor = sourcePosition(range, position);
  const { viewport, setViewport, setRangeDragging } = useWaveformViewport(
    audio.frames,
    cursor,
    playback.playing,
  );

  return (
    <section className="panel timeline" aria-label="波形・選択範囲・試聴">
      <Waveform
        audio={audio}
        viewport={viewport}
        onViewportChange={setViewport}
        range={range}
        cursor={cursor}
        onRange={onRange}
        onRangeDrag={setRangeDragging}
        onSeek={(frame) => playback.seek(outputPosition(range, frame))}
        onSeekStart={playback.beginScrub}
      />
      <RangeFields audio={audio} onRange={onRange} onError={onError} />
      <PlaybackControls playback={playback} position={position} rate={audio.buffer.sampleRate} />
    </section>
  );
}
