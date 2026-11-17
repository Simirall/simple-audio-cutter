import { FolderOpenIcon } from "@phosphor-icons/react/dist/csr/FolderOpen";
import { clock } from "../editor/edit";
import type { Audio } from "./read-audio";

export function FileBar({
  audio,
  disabled,
  onLoad,
}: {
  audio: Audio | null;
  disabled: boolean;
  onLoad: (file: File) => void;
}) {
  return (
    <section className={audio ? "file-bar" : "file-bar empty"} aria-label="音声ファイル">
      {audio ? (
        <div className="file-info">
          <strong>{audio.name}</strong>
          <small>
            元音声 <time>{clock(audio.frames / audio.buffer.sampleRate)}</time> ・{" "}
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
          disabled={disabled}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (file) onLoad(file);
          }}
        />
      </label>
    </section>
  );
}
