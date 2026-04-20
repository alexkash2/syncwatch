import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Badge } from '../components/ui/Badge';
import { buttonStyles } from '../components/ui/buttonStyles';
import { ArrowUpRightIcon, BrandMarkIcon } from '../components/ui/icons';
import { Panel } from '../components/ui/Panel';

export function NotFoundPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-surface text-on-surface">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,98,255,0.18),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(180,197,255,0.14),transparent_26%),linear-gradient(180deg,#090909_0%,#121212_42%,#171717_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.022)_1px,transparent_1px)] bg-[size:36px_36px] opacity-30" />
        <div className="absolute left-[8%] top-[12%] h-60 w-60 rounded-full border border-primary-container/12 bg-primary-container/12 blur-3xl" />
        <div className="absolute bottom-[8%] right-[10%] h-72 w-72 rounded-full border border-primary/10 bg-primary/8 blur-3xl" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10">
        <Panel variant="glass" padding="lg" className="w-full max-w-5xl rounded-[2.4rem]">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <Badge tone="primary" className="mb-3">
                <BrandMarkIcon size={14} />
                Lost Route
              </Badge>
              <h1 className="text-[4.75rem] font-black leading-none tracking-[-0.08em] text-on-surface sm:text-[6rem] md:text-[9rem] xl:text-[11rem]">
                404
              </h1>
              <h2 className="mt-3 text-3xl font-black tracking-tight text-on-surface md:text-4xl">
                This page drifted out of sync.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-on-surface-variant md:text-base">
                The address you opened does not point to an active screen. Jump back to the dashboard to reopen one of your rooms and continue the session.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/"
                  className={buttonStyles({
                    variant: 'primary',
                    size: 'lg',
                  })}
                >
                  Go Home
                </Link>
                <Link
                  to="/login"
                  className={buttonStyles({
                    variant: 'ghost',
                    size: 'lg',
                  })}
                >
                  Open Login
                </Link>
              </div>
            </div>

            <div className="grid gap-4">
              <RouteHint
                title="Return to dashboard"
                text="Your room list, create flow and join form are all available from the home screen."
              />
              <RouteHint
                title="Reopen a room"
                text="If the room still exists, you can enter it again from your recent activity cards."
              />
              <RouteHint
                title="Pick up the session"
                text="Once you are back on the main screen, open a room card and jump straight into the synced session."
                icon={<ArrowUpRightIcon size={15} />}
              />
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function RouteHint({
  title,
  text,
  icon,
}: {
  title: string;
  text: string;
  icon?: ReactNode;
}) {
  return (
    <Panel variant="muted" padding="md" className="rounded-[1.75rem]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">{title}</p>
        {icon && <span className="text-primary">{icon}</span>}
      </div>
      <p className="mt-3 text-sm leading-7 text-on-surface-variant">{text}</p>
    </Panel>
  );
}
