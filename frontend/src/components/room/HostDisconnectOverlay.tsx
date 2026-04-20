interface HostDisconnectOverlayProps {
  graceCountdown: number;
}

export function HostDisconnectOverlay({ graceCountdown }: HostDisconnectOverlayProps) {
  return (
    <div className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="w-16 h-16 mx-auto border-4 border-error/30 border-t-error rounded-full animate-spin" />
        <h2 className="text-xl font-bold text-on-surface">Host lost connection</h2>
        <p className="text-on-surface-variant">
          Waiting for reconnect: <span className="text-error font-mono">{graceCountdown}s</span>
        </p>
      </div>
    </div>
  );
}
