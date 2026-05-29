import type { ReactNode } from 'react';
import { RefreshIcon, WarningCircleIcon } from '../ui/icons';

interface HostDisconnectOverlayProps {
  graceCountdown: number;
}

export function HostDisconnectOverlay({ graceCountdown }: HostDisconnectOverlayProps) {
  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,180,171,0.08),transparent_35%),rgba(0,0,0,0.72)] px-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="host-disconnect-title"
      aria-describedby="host-disconnect-desc"
    >
      <div className="max-w-lg rounded-[2rem] border border-error/24 bg-surface-container-low/86 p-6 text-center shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl md:p-8">
        <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-full border border-error/24 bg-error-container/22 text-error shadow-[0_18px_36px_rgba(0,0,0,0.24)]">
          <WarningCircleIcon size={28} />
        </div>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-error">
          Session Hold
        </p>
        <h2
          id="host-disconnect-title"
          className="mt-3 text-2xl font-black tracking-tight text-on-surface md:text-3xl"
        >
          Host connection dropped
        </h2>
        <p
          id="host-disconnect-desc"
          className="mt-4 text-sm leading-7 text-on-surface-variant md:text-base"
        >
          Playback is paused and the room state is being preserved while the host tries to return. If they do not reconnect in time, the room will close automatically.
        </p>
        <div
          className="mt-5 inline-flex items-center gap-3 rounded-full border border-error/22 bg-black/28 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-on-surface-variant"
          aria-live="assertive"
          aria-atomic="true"
        >
          <span>Time left</span>
          <span className="font-mono text-error">{graceCountdown}s</span>
        </div>

        <div className="mt-6 grid gap-3 text-left md:grid-cols-2">
          <InfoTile
            icon={<RefreshIcon size={16} className="animate-spin [animation-duration:2.6s]" />}
            title="What stays safe"
            description="Your matched file, chat history and readiness state remain in place while the room waits."
          />
          <InfoTile
            icon={<WarningCircleIcon size={16} />}
            title="What to do"
            description="Keep this tab open. If the host returns in time, the session recovers automatically."
          />
        </div>
      </div>
    </div>
  );
}

function InfoTile({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[1.35rem] border border-outline-variant/16 bg-black/28 p-4">
      <div className="flex items-center gap-2 text-primary">
        <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary-container/20 bg-primary-container/10">
          {icon}
        </span>
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface">
          {title}
        </p>
      </div>
      <p className="mt-3 text-xs leading-6 text-on-surface-variant">{description}</p>
    </div>
  );
}
