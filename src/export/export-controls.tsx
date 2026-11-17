import { DownloadSimpleIcon } from "@phosphor-icons/react/dist/csr/DownloadSimple";
import { useAtomValue } from "jotai";
import { editResultAtom } from "../editor/editor-state";
import type { Format } from "./encode-audio";
import { formatLabels } from "./use-audio-export";
import type { useAudioExport } from "./use-audio-export";

export function ExportControls({
  audioExport,
  onSave,
}: {
  audioExport: ReturnType<typeof useAudioExport>;
  onSave: () => void;
}) {
  const {
    choices,
    changeFormat,
    changeNameByDate,
    dateName,
    download,
    exportLink,
    format,
    nameByDate,
    originalName,
  } = audioExport;
  const { invalid } = useAtomValue(editResultAtom);

  return (
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
                onChange={() => changeNameByDate(mode === "date")}
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
            onChange={(event) => changeFormat(event.currentTarget.value as Format)}
          >
            {choices.map((id) => (
              <option key={id} value={id}>
                {formatLabels[id]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={onSave} disabled={!!invalid}>
          <DownloadSimpleIcon aria-hidden="true" /> 保存
        </button>
      </div>
      {download && (
        <a ref={exportLink} href={download.url} download={download.name}>
          もう一度ダウンロード
        </a>
      )}
    </div>
  );
}
