import { useEffect, useRef, useState } from "react";

type Job = "read" | "write";

export function useAudioJob() {
  const [job, setJob] = useState<Job | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const operation = useRef<AbortController | null>(null);

  useEffect(() => () => operation.current?.abort(), []);

  async function run(kind: Job, task: (signal: AbortSignal) => Promise<void>) {
    if (operation.current) return;
    const controller = new AbortController();
    operation.current = controller;
    setError("");
    setProgress(0);
    setJob(kind);
    try {
      await task(controller.signal);
    } catch (reason) {
      if (!controller.signal.aborted) {
        const detail =
          reason instanceof Error && /[ぁ-龯]/.test(reason.message) ? reason.message : "";
        setError(
          detail ||
            (kind === "read"
              ? "音声を読み込めませんでした。対応形式とファイルの状態を確認してください。"
              : "音声を書き出せませんでした。再試行するか、別の形式を選んでください。"),
        );
      }
    } finally {
      operation.current = null;
      setJob(null);
    }
  }

  return {
    job,
    progress,
    error,
    setProgress,
    setError,
    run,
    cancel: () => operation.current?.abort(),
  };
}
