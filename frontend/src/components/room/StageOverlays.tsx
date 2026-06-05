import { useI18n } from '../../hooks/useI18n';
import { Spinner } from '../ui/Spinner';

type OverlayKind = 'reconnecting' | 'hostaway';

interface StageOverlayProps {
  kind: OverlayKind;
  /** Seconds remaining in the host grace window (kind === 'hostaway'). */
  count?: number;
}

/** Full-stage overlay for live connection / lifecycle states (covers the
 *  video only on desktop, so chat stays usable). */
export function StageOverlay({ kind, count = 0 }: StageOverlayProps) {
  const { t, ti } = useI18n();

  let visual;
  let title;
  let sub;

  if (kind === 'reconnecting') {
    visual = <Spinner size={46} />;
    title = t.st_reconnect_title;
    sub = t.st_reconnect_sub;
  } else {
    const closing = count <= 0;
    visual = closing ? (
      <Spinner size={46} />
    ) : (
      <span className="mx-auto flex h-[74px] w-[74px] items-center justify-center rounded-full border-[3px] border-white/18 border-t-accent text-2xl font-bold tabular-nums text-white">
        {count}
      </span>
    );
    title = t.st_hostaway_title;
    sub = closing ? t.st_hostaway_closing : ti('st_hostaway_sub', { n: count });
  }

  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[rgba(8,11,10,0.88)] backdrop-blur-[7px]"
      role="alertdialog"
      aria-labelledby="stage-overlay-title"
      aria-describedby="stage-overlay-desc"
    >
      <div className="max-w-[400px] px-7 text-center">
        <div className="mb-5">{visual}</div>
        <h2
          id="stage-overlay-title"
          className="m-0 text-[21px] font-semibold -tracking-[0.02em] text-white"
        >
          {title}
        </h2>
        <p
          id="stage-overlay-desc"
          className="mx-auto mt-[10px] max-w-[360px] text-[14.5px] leading-[1.6] text-on-stage-2"
        >
          {sub}
        </p>
      </div>
    </div>
  );
}

/** Slim, non-blocking "waiting for everyone" pill at the top of the stage. */
export function WaitingBanner({ ready, total }: { ready: number; total: number }) {
  const { ti } = useI18n();
  return (
    <div className="pointer-events-none absolute left-1/2 top-4 z-20 flex -translate-x-1/2 items-center gap-[9px] whitespace-nowrap rounded-full border border-white/12 bg-black/50 px-[14px] py-2 text-[13px] font-medium text-white backdrop-blur-md">
      <span className="sw-pulse h-2 w-2 rounded-full bg-accent" />
      {ti('st_waiting_chip', { ready, total })}
    </div>
  );
}
