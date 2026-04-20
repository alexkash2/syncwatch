interface HostDisconnectOverlayProps {
  graceCountdown: number;
}

export function HostDisconnectOverlay({ graceCountdown }: HostDisconnectOverlayProps) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,180,171,0.08),transparent_35%),rgba(0,0,0,0.72)] px-4">
      <div className="max-w-lg rounded-[2rem] border border-error/24 bg-surface-container-low/86 p-6 text-center shadow-[0_28px_80px_rgba(0,0,0,0.42)] backdrop-blur-2xl md:p-8">
        <div className="mx-auto flex h-18 w-18 items-center justify-center rounded-full border border-error/24 bg-error-container/22">
          <div className="h-11 w-11 rounded-full border-4 border-error/28 border-t-error animate-spin" />
        </div>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.22em] text-error">
          Session Hold
        </p>
        <h2 className="mt-3 text-2xl font-black tracking-tight text-on-surface md:text-3xl">
          Host connection dropped
        </h2>
        <p className="mt-4 text-sm leading-7 text-on-surface-variant md:text-base">
          Playback is paused and the room state is being preserved while the host tries to return. If they do not reconnect in time, the room will close automatically.
        </p>
        <div className="mt-5 inline-flex items-center gap-3 rounded-full border border-error/22 bg-black/28 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-on-surface-variant">
          <span>Time left</span>
          <span className="font-mono text-error">{graceCountdown}s</span>
        </div>
      </div>
    </div>
  );
}
