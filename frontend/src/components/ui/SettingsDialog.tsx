import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';
import { Panel } from './Panel';
import { LayoutPanelIcon, KeyboardIcon, SettingsSlidersIcon, XIcon } from './icons';
import type { AppPreferences } from '../../types/preferences';

interface SettingsDialogProps {
  open: boolean;
  preferences: AppPreferences;
  onTogglePreference: <K extends keyof AppPreferences>(key: K) => void;
  onReset: () => void;
  onClose: () => void;
}

export function SettingsDialog({
  open,
  preferences,
  onTogglePreference,
  onReset,
  onClose,
}: SettingsDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    closeButtonRef.current?.focus();

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => !element.hasAttribute('disabled'));

      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    dialog.addEventListener('keydown', handleKeyDown);
    return () => dialog.removeEventListener('keydown', handleKeyDown);
  }, [onClose, open]);

  if (!open) {
    return null;
  }

  return (
    <div className="ui-overlay-enter fixed inset-0 z-[125] flex items-end justify-center bg-black/76 p-4 backdrop-blur-md sm:items-center sm:p-6">
      <Panel
        ref={dialogRef}
        variant="glass"
        padding="lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-dialog-title"
        aria-describedby="settings-dialog-description"
        tabIndex={-1}
        className="ui-dialog-enter relative w-full max-w-3xl rounded-[2rem]"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full border border-outline-variant/16 bg-black/18 p-2 text-on-surface-variant transition hover:border-primary-container/35 hover:text-on-surface"
          aria-label="Close settings"
        >
          <XIcon size={14} />
        </button>

        <div className="max-w-2xl">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
            Preferences
          </p>
          <h2
            id="settings-dialog-title"
            className="mt-3 text-3xl font-black tracking-tight text-on-surface"
          >
            Tune the room experience
          </h2>
          <p
            id="settings-dialog-description"
            className="mt-4 text-sm leading-7 text-on-surface-variant"
          >
            These settings stay on this device and shape how SyncWatch feels for you
            without changing the shared room state for everyone else.
          </p>
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <PreferenceSection
            title="Viewing Comfort"
            description="Shape motion, guidance and helper cues around playback."
          >
            <PreferenceToggle
              label="Reduce motion"
              description="Tone down transitions and animated flourishes across the app."
              checked={preferences.reduceMotion}
              onChange={() => onTogglePreference('reduceMotion')}
            />
            <PreferenceToggle
              label="Show keyboard hints"
              description="Keep shortcut chips visible around playback controls on desktop."
              checked={preferences.showHotkeys}
              onChange={() => onTogglePreference('showHotkeys')}
            />
            <PreferenceToggle
              label="Show room guidance"
              description="Display the onboarding steps that explain file matching and synced playback."
              checked={preferences.showRoomOnboarding}
              onChange={() => onTogglePreference('showRoomOnboarding')}
            />
          </PreferenceSection>

          <PreferenceSection
            title="Room Behavior"
            description="Adjust how dense the room UI feels and how exits are handled."
          >
            <PreferenceToggle
              label="Compact sidebar"
              description="Use a denser participant/chat panel to give the player more breathing room."
              checked={preferences.compactSidebar}
              onChange={() => onTogglePreference('compactSidebar')}
              icon={<LayoutPanelIcon size={16} />}
            />
            <PreferenceToggle
              label="Confirm viewer exit"
              description="Ask for confirmation before leaving a room even when you are not the host."
              checked={preferences.confirmViewerLeave}
              onChange={() => onTogglePreference('confirmViewerLeave')}
              icon={<KeyboardIcon size={16} />}
            />
          </PreferenceSection>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button variant="ghost" size="md" onClick={onReset}>
            Reset defaults
          </Button>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="ghost" size="md" onClick={onClose}>
              Continue editing
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={onClose}
              leadingIcon={<SettingsSlidersIcon size={16} />}
            >
              Save and close
            </Button>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function PreferenceSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Panel variant="outline" padding="md" className="rounded-[1.7rem]">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">{title}</p>
      <p className="mt-3 text-sm leading-7 text-on-surface-variant">{description}</p>
      <div className="mt-5 space-y-3">{children}</div>
    </Panel>
  );
}

function PreferenceToggle({
  label,
  description,
  checked,
  onChange,
  icon,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: () => void;
  icon?: ReactNode;
}) {
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

      <span className="relative mt-1 inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={onChange}
          className="peer sr-only"
          aria-label={label}
        />
        <span className="flex h-7 w-12 items-center rounded-full border border-outline-variant/18 bg-black/24 px-1 transition peer-checked:border-primary-container/28 peer-checked:bg-primary-container/20">
          <span className="h-5 w-5 rounded-full bg-on-surface-variant transition peer-checked:translate-x-5 peer-checked:bg-primary" />
        </span>
      </span>
    </label>
  );
}
