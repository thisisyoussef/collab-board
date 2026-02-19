import { useState, useEffect, useCallback } from 'react';
import { COLOR_SWATCHES } from '../lib/style-applicability';
import { isValidHex } from '../lib/color-utils';

export interface ColorPickerProps {
  value: string;
  label: string;
  disabled?: boolean;
  isMixed?: boolean;
  onChange: (color: string) => void;
}

export function ColorPicker({ value, label, disabled, isMixed, onChange }: ColorPickerProps) {
  const stripped = value.replace(/^#/, '');
  const [draft, setDraft] = useState(stripped);
  const [lastCommitted, setLastCommitted] = useState(stripped);

  // Keep draft in sync with external value changes
  useEffect(() => {
    setLastCommitted(stripped);
    setDraft(stripped);
  }, [stripped]);

  const commitHex = useCallback(() => {
    const candidate = `#${draft}`;
    if (isValidHex(candidate)) {
      setLastCommitted(draft);
      onChange(candidate);
    } else {
      // Revert to last valid value
      setDraft(lastCommitted);
    }
  }, [draft, lastCommitted, onChange]);

  return (
    <div className="style-panel-section">
      <span className="color-picker-label">{label}</span>
      <div className="color-swatches">
        {COLOR_SWATCHES.map((swatch) => (
          <button
            key={swatch}
            type="button"
            className={`color-swatch${value === swatch ? ' selected' : ''}`}
            style={{ backgroundColor: swatch }}
            disabled={disabled}
            aria-label={swatch}
            onClick={() => {
              const hex = swatch.replace(/^#/, '');
              setLastCommitted(hex);
              setDraft(hex);
              onChange(swatch);
            }}
          />
        ))}
      </div>
      <div className="hex-input-row">
        <span className="hex-prefix">#</span>
        <input
          type="text"
          className="hex-input"
          value={isMixed ? '' : draft}
          placeholder={isMixed ? 'Mixed' : ''}
          maxLength={6}
          disabled={disabled}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitHex();
            }
          }}
          onBlur={() => commitHex()}
        />
      </div>
    </div>
  );
}
