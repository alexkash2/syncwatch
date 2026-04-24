import type { ReactNode } from 'react';

interface PreferenceToggleCardProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  icon?: ReactNode;
}

export function PreferenceToggleCard({
  label,
  description,
  checked,
  onChange,
  icon,
}: PreferenceToggleCardProps) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-[1.35rem] border border-outline-variant/14 bg-surface-container-lowest/72 px-4 py-4 transition hover:border-primary-container/24 hover:bg-surface-container-low">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary-container/18 bg-primary-container/10 text-primary">
              {icon}
            </span>
          )}
          <p className="text-sm font-semibold text-on-surface">{label}</p>
        </div>
        <p className="mt-2 text-xs leading-6 text-on-surface-variant">{description}</p>
      </div>

      <span className="relative mt-1 inline-flex h-7 w-12 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer sr-only"
          aria-label={label}
        />
        <span className="h-full w-full rounded-full border border-outline-variant/18 bg-black/24 transition peer-checked:border-primary-container/28 peer-checked:bg-primary-container/20" />
        <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-on-surface-variant transition-transform duration-200 ease-out peer-checked:translate-x-5 peer-checked:bg-primary" />
      </span>
    </label>
  );
}
