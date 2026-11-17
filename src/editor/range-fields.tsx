import { useAtomValue } from "jotai";
import type { Audio } from "../audio/read-audio";
import { clock, rangeFromTime } from "./edit";
import type { Range } from "./edit";
import { rangeAtom } from "./editor-state";

export function RangeFields({
  audio,
  onRange,
  onError,
}: {
  audio: Audio;
  onRange: (range: Range) => void;
  onError: (error: string) => void;
}) {
  const range = useAtomValue(rangeAtom);
  const rate = audio.buffer.sampleRate;

  function setTime(edge: number, text: string) {
    const next = rangeFromTime(range, edge, text, rate, audio.frames);
    if (next) onRange(next);
    else onError("開始・終了時刻を音声の長さ内で指定してください。例 01:23.500");
  }

  return (
    <fieldset>
      <legend>選択範囲</legend>
      <div className="fields">
        {range.map((frame, edge) => {
          const value = clock(frame / rate);
          return (
            <label key={edge}>
              {edge === 0 ? "開始" : "終了"}
              <input
                key={frame}
                type="text"
                defaultValue={value}
                onBlur={(event) => {
                  if (event.currentTarget.value !== value) {
                    setTime(edge, event.currentTarget.value);
                    event.currentTarget.value = value;
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
