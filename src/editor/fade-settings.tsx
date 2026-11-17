import { useAtomValue } from "jotai";
import type { EditSettings } from "./edit";
import { editorAtom } from "./editor-state";
import { FadeControl } from "./fade-control";

export function FadeSettings({
  onEdit,
}: {
  onEdit: (changes: Partial<Pick<EditSettings, "fadeIn" | "fadeOut">>) => void;
}) {
  const {
    edit: { fadeIn, fadeOut },
  } = useAtomValue(editorAtom);
  return (
    <fieldset>
      <legend>フェード</legend>
      <div className="fade-fields">
        <FadeControl label="フェードイン" fade={fadeIn} onChange={(fadeIn) => onEdit({ fadeIn })} />
        <FadeControl
          label="フェードアウト"
          fade={fadeOut}
          onChange={(fadeOut) => onEdit({ fadeOut })}
        />
      </div>
    </fieldset>
  );
}
