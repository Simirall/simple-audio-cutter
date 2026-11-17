import { FileBar } from "./audio/file-bar";
import { FadeSettings } from "./editor/fade-settings";
import { Timeline } from "./editor/timeline";
import { useEditor } from "./editor/use-editor";
import { ExportControls } from "./export/export-controls";

export function App() {
  const {
    audio,
    fileVersion,
    job,
    progress,
    error,
    setError,
    cancel,
    playback,
    audioExport,
    applyEdit,
    load,
    save,
  } = useEditor();

  return (
    <main className="shell">
      <header className="page-header">
        <h1>Simple Audio Cutter</h1>
      </header>
      <FileBar audio={audio} disabled={!!job} onLoad={load} />
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
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {audio && (
        <div className="workspace" inert={!!job}>
          <Timeline
            key={fileVersion}
            audio={audio}
            playback={playback}
            onRange={(range) => applyEdit({ range })}
            onError={setError}
          />
          <section className="panel settings" aria-label="フェードと保存">
            <FadeSettings onEdit={applyEdit} />
            <ExportControls audioExport={audioExport} onSave={save} />
          </section>
        </div>
      )}
    </main>
  );
}
