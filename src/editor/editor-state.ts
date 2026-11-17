import { atom } from "jotai";
import type { Audio } from "../audio/read-audio";
import { resolveEdit } from "./edit";
import type { EditSettings, Fade } from "./edit";

const defaultFade: Fade = { enabled: false, preset: "2", custom: "1" };

export function initialEdit(frames: number): EditSettings {
  return { range: [0, frames], fadeIn: defaultFade, fadeOut: defaultFade };
}

export const editorAtom = atom<{ audio: Audio | null; edit: EditSettings }>({
  audio: null,
  edit: initialEdit(0),
});
export const rangeAtom = atom((get) => get(editorAtom).edit.range);
export const editResultAtom = atom((get) => {
  const { audio, edit } = get(editorAtom);
  return resolveEdit(edit, audio?.buffer.sampleRate ?? 1);
});
