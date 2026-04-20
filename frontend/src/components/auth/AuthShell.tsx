import { Link } from 'react-router';
import type { ReactNode } from 'react';
import { Badge } from '../ui/Badge';
import { BrandMarkIcon } from '../ui/icons';
import { Panel } from '../ui/Panel';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  footerPrompt: string;
  footerLabel: string;
  footerHref: string;
  children: ReactNode;
}

export function AuthShell({
  eyebrow,
  title,
  description,
  footerPrompt,
  footerLabel,
  footerHref,
  children,
}: AuthShellProps) {
  return (
    <div className="min-h-screen overflow-hidden bg-surface text-on-surface">
      <div className="relative isolate min-h-screen px-5 py-8 md:px-8 md:py-10">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,98,255,0.2),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(180,197,255,0.14),transparent_28%),linear-gradient(180deg,#090909_0%,#121212_45%,#171717_100%)]" />
          <div className="absolute left-[8%] top-[8%] h-56 w-56 rounded-full border border-primary-container/12 bg-primary-container/12 blur-3xl" />
          <div className="absolute bottom-[10%] right-[10%] h-72 w-72 rounded-full border border-primary/10 bg-primary/8 blur-3xl" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.022)_1px,transparent_1px)] bg-[size:36px_36px] opacity-30" />
        </div>

        <div className="mx-auto mb-6 flex w-full max-w-6xl justify-center lg:justify-start">
          <Link
            to="/login"
            className="inline-flex items-center gap-3 rounded-full border border-outline-variant/15 bg-black/28 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.28em] text-primary shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl transition hover:border-primary-container/35 hover:text-white"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary-container/25 bg-primary-container/10">
              <BrandMarkIcon size={15} />
            </span>
            SyncWatch
          </Link>
        </div>

        <div className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-6xl flex-col justify-center gap-8 lg:flex-row lg:items-stretch">
          <Panel variant="glass" padding="lg" className="flex w-full flex-col justify-between lg:max-w-[34rem]">
            <div className="space-y-8">
              <div className="space-y-5">
                <Badge tone="primary" className="w-fit">
                  <span className="h-2 w-2 rounded-full bg-primary-container shadow-[0_0_12px_rgba(0,98,255,0.9)]" />
                  {eyebrow}
                </Badge>

                <div>
                  <p className="mb-3 text-sm uppercase tracking-[0.35em] text-on-surface-variant">
                    Private Local Sessions
                  </p>
                  <h1 className="max-w-md text-4xl font-black tracking-tight text-on-surface md:text-5xl">
                    {title}
                  </h1>
                </div>

                <p className="max-w-lg text-sm leading-7 text-on-surface-variant md:text-base">
                  {description}
                </p>
              </div>

              <div className="grid gap-4">
                <InfoBlock
                  title="Local-first media"
                  text="Video files never leave the device. SyncWatch only coordinates the shared timeline."
                />
                <InfoBlock
                  title="Rooms stay readable"
                  text="Chat, readiness and reconnect state stay visible so the group always knows what happens next."
                />
                <InfoBlock
                  title="Host-led control"
                  text="Playback, pauses and seeks stay anchored to one host timeline for a cleaner shared session."
                />
              </div>
            </div>

            <div className="mt-8 text-sm text-on-surface-variant">
              {footerPrompt}{' '}
              <Link to={footerHref} className="font-semibold text-primary hover:text-white transition-colors">
                {footerLabel}
              </Link>
            </div>
          </Panel>

          <Panel variant="glass" padding="lg" className="relative w-full overflow-hidden lg:max-w-[34rem]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,98,255,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0)_45%,rgba(255,255,255,0.04)_100%)]" />
            <div className="relative z-10">{children}</div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function InfoBlock({ title, text }: { title: string; text: string }) {
  return (
    <Panel variant="muted" padding="sm" className="rounded-[1.6rem]">
      <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">{title}</p>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">{text}</p>
    </Panel>
  );
}
