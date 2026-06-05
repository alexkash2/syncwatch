import { useRef, type ReactNode } from 'react';
import { cn } from './cn';

export interface SegmentedItem<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
  count?: number;
}

interface SegmentedProps<T extends string> {
  items: SegmentedItem<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  /** When set, tabs expose `id`/`aria-controls` linking to `${idBase}-panel`. */
  idBase?: string;
}

/** Segmented tab control (Chat / People, etc.) following the ARIA tabs pattern. */
export function Segmented<T extends string>({
  items,
  value,
  onChange,
  className,
  idBase,
}: SegmentedProps<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    let next = index;
    if (event.key === 'ArrowRight') {
      next = (index + 1) % items.length;
    } else if (event.key === 'ArrowLeft') {
      next = (index - 1 + items.length) % items.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = items.length - 1;
    } else {
      return;
    }
    event.preventDefault();
    onChange(items[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div role="tablist" className={cn('inline-flex gap-[2px] rounded-[10px] bg-surface-3 p-1', className)}>
      {items.map((item, index) => {
        const active = value === item.value;
        return (
          <button
            key={item.value}
            ref={(node) => {
              refs.current[index] = node;
            }}
            role="tab"
            type="button"
            id={idBase ? `${idBase}-tab-${item.value}` : undefined}
            aria-controls={idBase ? `${idBase}-panel` : undefined}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              'inline-flex items-center justify-center gap-[7px] rounded-[7px] px-[14px] py-[7px] text-[13px] font-semibold transition',
              active
                ? 'bg-surface text-ink shadow-[0_1px_2px_rgba(16,23,20,0.05)]'
                : 'text-ink-3 hover:text-ink'
            )}
          >
            {item.icon}
            {item.label}
            {item.count != null && (
              <span className="tabular-nums opacity-60">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
