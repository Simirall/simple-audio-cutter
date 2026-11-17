import { useId } from "react";
import type { Fade } from "./edit";

const presets = [
  ["2", "2秒"],
  ["5", "5秒"],
  ["custom", "任意"],
] as const;

export function FadeControl({
  label,
  fade,
  onChange,
}: {
  label: string;
  fade: Fade;
  onChange: (fade: Fade) => void;
}) {
  const presetName = useId();
  return (
    <div className="fade-control">
      <label className="fade-toggle">
        <input
          type="checkbox"
          checked={fade.enabled}
          onChange={(event) => onChange({ ...fade, enabled: event.target.checked })}
        />
        {label}
      </label>
      {fade.enabled && (
        <div className="fade-presets" role="radiogroup" aria-label={`${label}の長さ`}>
          {presets.map(([value, text]) => (
            <label key={value}>
              <input
                type="radio"
                name={presetName}
                checked={fade.preset === value}
                onChange={() => onChange({ ...fade, preset: value })}
              />
              <span>{text}</span>
            </label>
          ))}
        </div>
      )}
      {fade.enabled && fade.preset === "custom" && (
        <label className="fade-custom">
          <input
            aria-label={`${label}の任意の秒数`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={fade.custom}
            onChange={(event) => onChange({ ...fade, custom: event.target.value })}
          />
          <span aria-hidden="true">秒</span>
        </label>
      )}
    </div>
  );
}
