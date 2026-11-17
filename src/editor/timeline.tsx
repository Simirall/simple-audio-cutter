import { useAtomValue } from "jotai";
import type { Audio } from "../audio/audio";
import { PlaybackControls } from "../playback/playback-controls";
import type { usePlayback } from "../playback/use-playback";
import { Waveform } from "../waveform/waveform";
import { outputPosition } from "./edit";
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

  return (
    <section className="panel timeline" aria-label="波形・選択範囲・試聴">
      <Waveform
        audio={audio}
        range={range}
        playing={playback.playing}
        onRange={onRange}
        onSeek={(frame) => playback.seek(outputPosition(range, frame))}
        onSeekStart={playback.beginScrub}
      />
      <RangeFields audio={audio} onRange={onRange} onError={onError} />
      <PlaybackControls playback={playback} rate={audio.buffer.sampleRate} />
    </section>
  );
}
