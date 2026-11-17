import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { FolderOpenIcon } from "@phosphor-icons/react/dist/csr/FolderOpen";
import { PauseIcon } from "@phosphor-icons/react/dist/csr/Pause";
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play";
import { encodeAudio, formats, readAudio, supportsFormat } from "./audio";
import type { Audio, Format } from "./audio";
import {
  clock,
  exportFileName,
  fadeSettings,
  fadeSeconds,
  frameCount,
  outputPosition,
  parseTime,
  revealFrame,
  sourcePosition,
} from "./edit";
import { useAudioJob } from "./use-audio-job";
import { usePlayback } from "./use-playback";
import type { Fade, Range } from "./edit";
import { FadeControl } from "./fade-control";
import { Waveform } from "./waveform";

const defaultFade: Fade = { enabled: false, preset: "2", custom: "1" };

const baseFormats: Format[] = ["mp3", "m4a", "wav"];

export function App() {
  const [audio, setAudio] = useState<Audio | null>(null);
  const [fileVersion, setFileVersion] = useState(0);
  const [viewport, setViewport] = useState({ left: 0, zoom: 1 });
  const [rangeDragging, setRangeDragging] = useState(false);
  const [range, setRange] = useState<Range>([0, 0]);
  const [fadeIn, setFadeIn] = useState(defaultFade);
  const [fadeOut, setFadeOut] = useState(defaultFade);
  const [format, setFormat] = useState<Format>("mp3");
  const [nameByDate, setNameByDate] = useState(false);
  const originalName = exportFileName(audio?.name ?? "", format);
  const dateName = exportFileName(audio?.name ?? "", format, new Date());
  const [choices, setChoices] = useState(baseFormats);
  const [download, setDownload] = useState<{ url: string; name: string } | null>(null);
  const exportLink = useRef<HTMLAnchorElement>(null);
  const rate = audio?.buffer.sampleRate ?? 1;
  const total = frameCount(range);
  const { fades, invalid } = fadeSettings(fadeSeconds(fadeIn), fadeSeconds(fadeOut), rate, total);
  const playback = usePlayback(audio?.buffer, range, fades, !invalid);
  const { position, playing } = playback;
  const cursor = sourcePosition(range, position);
  const previousView = useRef({ cursor, zoom: viewport.zoom });
  const { zoom, left } = viewport;
  const length = audio?.frames ?? 0;

  useLayoutEffect(() => {
    if (rangeDragging) return;
    const previous = previousView.current;
    previousView.current = { cursor, zoom };
    // Let users browse the waveform with the arrows while paused.
    if (!length || (!playing && cursor === previous.cursor && zoom === previous.zoom)) return;
    const nextLeft = revealFrame(left, Math.ceil(length / zoom), length, cursor, playing);
    if (nextLeft !== left) setViewport({ left: nextLeft, zoom });
  }, [cursor, left, length, playing, rangeDragging, zoom]);

  const { job, progress, error, setProgress, setError, run, cancel } = useAudioJob();

  useEffect(() => {
    if (!audio) return;
    let current = true;
    void Promise.all(
      (["ogg", "flac"] as const).map(async (id) =>
        (await supportsFormat(id, audio.buffer).catch(() => false)) ? [id] : [],
      ),
    ).then((results) => {
      if (current) setChoices([...baseFormats, ...results.flat()]);
    });
    return () => {
      current = false;
    };
  }, [audio]);

  useEffect(() => {
    if (!download) return;
    exportLink.current?.click();
    return () => URL.revokeObjectURL(download.url);
  }, [download]);

  function edit(next: { range?: Range; fadeIn?: Fade; fadeOut?: Fade }) {
    if (!audio) return;
    const nextRange = next.range ?? range;
    const nextIn = next.fadeIn ?? fadeIn;
    const nextOut = next.fadeOut ?? fadeOut;
    if (
      nextRange[0] === range[0] &&
      nextRange[1] === range[1] &&
      nextIn === fadeIn &&
      nextOut === fadeOut
    )
      return;
    const { fades, invalid } = fadeSettings(
      fadeSeconds(nextIn),
      fadeSeconds(nextOut),
      rate,
      frameCount(nextRange),
    );
    playback.applyEdit({ range: nextRange, fades, allowed: !invalid });
    setRange(nextRange);
    setFadeIn(nextIn);
    setFadeOut(nextOut);
    setDownload(null);
    setError("");
  }
  function load(file: File) {
    playback.pause();
    void run("read", async (signal) => {
      const next = await readAudio(file, signal, setProgress);
      signal.throwIfAborted();
      setAudio(next);
      setFileVersion((version) => version + 1);
      setViewport({ left: 0, zoom: 1 });
      setRangeDragging(false);
      setRange([0, next.frames]);
      setFadeIn(defaultFade);
      setFadeOut(defaultFade);
      setFormat("mp3");
      setChoices(baseFormats);
      playback.reset();
      setDownload(null);
    });
  }

  function save() {
    if (!audio || invalid) return;
    const name = nameByDate ? dateName : originalName;
    setDownload(null);
    playback.pause();
    void run("write", async (signal) => {
      const blob = await encodeAudio(
        audio.buffer,
        range,
        fades[0],
        fades[1],
        format,
        signal,
        setProgress,
      );
      signal.throwIfAborted();
      setDownload({
        url: URL.createObjectURL(blob),
        name,
      });
    });
  }

  function setTime(edge: number, text: string) {
    if (!audio) return;
    const frame = parseTime(text, rate);
    if (
      !Number.isFinite(frame) ||
      frame > audio.frames ||
      (edge === 0 ? frame >= range[1] : frame <= range[0])
    ) {
      setError("開始・終了時刻を音声の長さ内で指定してください。例 01:23.500");
      return;
    }
    edit({ range: edge === 0 ? [frame, range[1]] : [range[0], frame] });
  }

  return (
    <main className="shell">
      <header className="page-header">
        <h1>Simple Audio Cutter</h1>
      </header>
      <section className={audio ? "file-bar" : "file-bar empty"} aria-label="音声ファイル">
        {audio ? (
          <div className="file-info">
            <strong>{audio.name}</strong>
            <small>
              元音声 <time>{clock(audio.frames / rate)}</time> ・{" "}
              {audio.buffer.numberOfChannels === 1 ? "モノラル" : "ステレオ"}
            </small>
          </div>
        ) : null}
        <label className={audio ? "file-picker icon-button" : "file-picker"}>
          <FolderOpenIcon aria-hidden="true" />
          {!audio && "音声を開く"}
          <input
            type="file"
            aria-label={audio ? "ファイルを変更" : "音声を開く"}
            title={audio ? "ファイルを変更" : "音声を開く"}
            accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg,.opus,.webm,.flac"
            disabled={!!job}
            onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              event.currentTarget.value = "";
              if (file) load(file);
            }}
          />
        </label>
      </section>
      {job && (
        <div className="feedback" role="status">
          <label>
            <span>
              {job === "read" ? "読み込み中" : "書き出し中"} {Math.round(progress * 100)}%
            </span>
            <progress value={progress || undefined} max={1} />
          </label>
          <button type="button" data-variant="outline" onClick={cancel}>
            キャンセル
          </button>
        </div>
      )}
      {(error || playback.error) && (
        <p role="alert" className="error">
          {error || "音声を再生できませんでした。"}
        </p>
      )}
      {audio && (
        <div className="workspace" inert={!!job}>
          <section className="panel timeline" aria-label="波形・選択範囲・試聴">
            <Waveform
              key={fileVersion}
              audio={audio}
              viewport={viewport}
              onViewportChange={setViewport}
              range={range}
              cursor={cursor}
              onRange={(range) => edit({ range })}
              onRangeDrag={setRangeDragging}
              onSeek={(frame) => playback.seek(outputPosition(range, frame))}
              onSeekStart={playback.beginScrub}
            />
            <fieldset>
              <legend>選択範囲</legend>
              <div className="fields">
                {range.map((frame, edge) => (
                  <label key={edge}>
                    {edge === 0 ? "開始" : "終了"}
                    <input
                      key={frame}
                      type="text"
                      defaultValue={clock(frame / rate)}
                      onBlur={(event) => {
                        if (event.currentTarget.value !== clock(frame / rate)) {
                          setTime(edge, event.currentTarget.value);
                          event.currentTarget.value = clock(frame / rate);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") event.currentTarget.blur();
                      }}
                    />
                  </label>
                ))}
              </div>
            </fieldset>
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
          </section>
          <section className="panel settings" aria-label="フェードと保存">
            <fieldset>
              <legend>フェード</legend>
              <div className="fade-fields">
                <FadeControl
                  label="フェードイン"
                  fade={fadeIn}
                  onChange={(fadeIn) => edit({ fadeIn })}
                />
                <FadeControl
                  label="フェードアウト"
                  fade={fadeOut}
                  onChange={(fadeOut) => edit({ fadeOut })}
                />
              </div>
            </fieldset>
            <div className="export">
              {invalid && (
                <p className="error" role="status">
                  {invalid}
                </p>
              )}
              <fieldset className="save-name-field">
                <legend>ファイル名</legend>
                <div className="save-names">
                  {(
                    [
                      ["original", originalName],
                      ["date", dateName],
                    ] as const
                  ).map(([mode, name]) => (
                    <label key={mode}>
                      <input
                        type="radio"
                        name="save-name"
                        checked={nameByDate === (mode === "date")}
                        onChange={() => {
                          setNameByDate(mode === "date");
                          setDownload(null);
                          setError("");
                        }}
                      />
                      <span>{name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="save-controls">
                <label>
                  <span>保存形式</span>
                  <select
                    value={format}
                    onChange={(event) => {
                      setFormat(event.target.value as Format);
                      setDownload(null);
                      setError("");
                    }}
                  >
                    {choices.map((id) => (
                      <option key={id} value={id}>
                        {formats[id].label}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={save} disabled={!!invalid}>
                  <DownloadSimpleIcon aria-hidden="true" /> 保存
                </button>
              </div>
              {download && (
                <a ref={exportLink} href={download.url} download={download.name}>
                  もう一度ダウンロード
                </a>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
