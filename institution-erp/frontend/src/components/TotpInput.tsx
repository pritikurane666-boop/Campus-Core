import React, { useRef, useState, useEffect } from 'react';

interface TotpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
}

/**
 * Six-box OTP/TOTP input with:
 * - Auto-advance on digit entry
 * - Backspace moves to previous box
 * - Paste support (handles full 6-digit paste from any position)
 * - Keyboard accessible
 */
export const TotpInput: React.FC<TotpInputProps> = ({
  length = 6,
  value,
  onChange,
  disabled = false,
  autoFocus = false,
  id = 'totp-input',
}) => {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const [localValues, setLocalValues] = useState<string[]>(
    Array.from({ length }, (_, i) => value[i] ?? '')
  );

  // Sync incoming value to local boxes
  useEffect(() => {
    setLocalValues(Array.from({ length }, (_, i) => value[i] ?? ''));
  }, [value, length]);

  const focus = (i: number) => inputs.current[i]?.focus();

  const buildString = (vals: string[]) => vals.join('');

  const handleChange = (i: number, rawVal: string) => {
    // Filter to digits only
    const digit = rawVal.replace(/\D/g, '').slice(-1);
    const next = [...localValues];
    next[i] = digit;
    setLocalValues(next);
    onChange(buildString(next));
    if (digit && i < length - 1) focus(i + 1);
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (localValues[i]) {
        // Clear current
        const next = [...localValues];
        next[i] = '';
        setLocalValues(next);
        onChange(buildString(next));
      } else if (i > 0) {
        focus(i - 1);
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      focus(i - 1);
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      focus(i + 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, length);
    if (!pasted) return;
    const next = Array.from({ length }, (_, i) => pasted[i] ?? '');
    setLocalValues(next);
    onChange(buildString(next));
    // Focus the box after the last pasted digit, or last box
    const nextFocus = Math.min(pasted.length, length - 1);
    focus(nextFocus);
  };

  return (
    <div className="flex gap-2 justify-center" aria-label="One-time code input">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          id={i === 0 ? id : undefined}
          ref={(el) => { inputs.current[i] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={localValues[i]}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          autoComplete="one-time-code"
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className={[
            'w-11 h-14 text-center text-2xl font-bold rounded-xl border-2 transition-all',
            'bg-slate-50 dark:bg-slate-800',
            'text-slate-900 dark:text-slate-100',
            localValues[i]
              ? 'border-primary-500 ring-2 ring-primary-500/20'
              : 'border-slate-200 dark:border-slate-700',
            'focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        />
      ))}
    </div>
  );
};
