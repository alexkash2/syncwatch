import { Link } from 'react-router';
import type { ReactNode } from 'react';
import { BrandIllustration, type BrandIllustrationVariant } from '../brand/BrandIllustration';
import { Badge } from '../ui/Badge';
import { BrandMarkIcon, ChatBubbleIcon, UsersIcon, VideoIcon } from '../ui/icons';
import { Panel } from '../ui/Panel';

interface AuthShellProps {
  eyebrow: string;
  title: string;
  description: string;
  footerPrompt: string;
  footerLabel: string;
  footerHref: string;
  illustrationVariant?: BrandIllustrationVariant;
  children: ReactNode;
}

export function AuthShell({
  eyebrow,
  title,
  description,
  footerPrompt,
  footerLabel,
  footerHref,
  illustrationVariant = 'sync',
  children,
}: AuthShellProps) {
  const accessMeta = getAccessMeta(illustrationVariant);
  const facts = [
    {
      title: 'Local video only',
      text: 'Media stays on the device while the app syncs the shared timeline.',
      icon: <VideoIcon size={16} />,
    },
    {
      title: 'Readable room state',
      text: 'Readiness, reconnects and playback state stay visible for the whole group.',
      icon: <UsersIcon size={16} />,
    },
    {
      title: 'Live room chat',
      text: 'Messages stay attached to the session so coordination feels immediate.',
      icon: <ChatBubbleIcon size={16} />,
    },
  ];

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
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant/15 bg-black/28 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-primary shadow-[0_16px_40px_rgba(0,0,0,0.28)] backdrop-blur-xl transition hover:border-primary-container/35 hover:text-white min-[390px]:gap-3 min-[390px]:px-4 min-[390px]:text-[11px] min-[390px]:tracking-[0.28em]"
            aria-label="Open login page"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-primary-container/25 bg-primary-container/10">
              <BrandMarkIcon size={15} />
            </span>
            <span className="hidden min-[390px]:inline">SyncWatch</span>
          </Link>
        </div>

        <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-6xl flex-col-reverse justify-center gap-5 lg:flex-row lg:items-stretch lg:gap-8">
          <Panel
            variant="glass"
            padding="lg"
            className="flex w-full flex-col justify-between lg:max-w-[34rem]"
          >
            <div className="space-y-8">
              <div className="space-y-5">
                <Badge tone="primary" className="w-fit">
                  <span className="h-2 w-2 rounded-full bg-primary-container shadow-[0_0_12px_rgba(0,98,255,0.9)]" />
                  {eyebrow}
                </Badge>

                <div>
                  <p className="mb-3 text-[11px] uppercase tracking-[0.35em] text-on-surface-variant">
                    Private Local Sessions
                  </p>
                  <h1 className="max-w-md text-3xl font-black tracking-tight text-on-surface sm:text-4xl md:text-5xl">
                    {title}
                  </h1>
                </div>

                <p className="max-w-lg text-sm leading-7 text-on-surface-variant md:text-base">
                  {description}
                </p>

                <div className="flex flex-wrap gap-2">
                  <ShellChip label="Host-led sync" />
                  <ShellChip label="No file uploads" />
                  <ShellChip label="Mobile-ready rooms" />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {facts.map((fact, index) => (
                  <InfoBlock
                    key={fact.title}
                    title={fact.title}
                    text={fact.text}
                    icon={fact.icon}
                    className={index === facts.length - 1 ? 'sm:col-span-2' : ''}
                  />
                ))}
              </div>
            </div>

            <div className="mt-8 text-sm text-on-surface-variant">
              {footerPrompt}{' '}
              <Link to={footerHref} className="font-semibold text-primary hover:text-white transition-colors">
                {footerLabel}
              </Link>
            </div>
          </Panel>

          <Panel
            variant="glass"
            padding="lg"
            className="relative w-full overflow-hidden lg:max-w-[34rem]"
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,98,255,0.12),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.03)_0%,rgba(255,255,255,0)_45%,rgba(255,255,255,0.04)_100%)]" />
            <div className="relative z-10">
              <div className="mb-6 flex items-center justify-between gap-3 rounded-[1.4rem] border border-outline-variant/12 bg-black/20 px-4 py-3 sm:px-5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                    {accessMeta.eyebrow}
                  </p>
                  <p className="mt-1 text-xs text-on-surface-variant sm:text-sm">
                    {accessMeta.description}
                  </p>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-primary-container/22 bg-primary-container/10 text-primary">
                  <BrandMarkIcon size={18} />
                </div>
              </div>

              <BrandIllustration variant={illustrationVariant} compact className="mb-6" />

              {children}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function getAccessMeta(illustrationVariant: BrandIllustrationVariant) {
  switch (illustrationVariant) {
    case 'welcome':
      return {
        eyebrow: 'Return Access',
        description: 'Sign in, reopen recent rooms and keep the last stable session context.',
      };
    case 'launch':
      return {
        eyebrow: 'Room Launch',
        description: 'Create your account, open the first room and invite the group in one flow.',
      };
    case 'drift':
      return {
        eyebrow: 'Recovery Access',
        description: 'Get back onto a valid route before reopening your synced sessions.',
      };
    default:
      return {
        eyebrow: 'Session Access',
        description: 'Sign in and jump straight into your synced rooms.',
      };
  }
}

function ShellChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-outline-variant/15 bg-black/18 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
      {label}
    </span>
  );
}

function InfoBlock({
  title,
  text,
  icon,
  className,
}: {
  title: string;
  text: string;
  icon: ReactNode;
  className?: string;
}) {
  return (
    <Panel variant="muted" padding="sm" className={`rounded-[1.6rem] ${className ?? ''}`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex h-9 w-9 items-center justify-center rounded-full border border-primary-container/18 bg-primary-container/10 text-primary">
          {icon}
        </span>
        <p className="min-w-0 text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          {title}
        </p>
      </div>
      <p className="mt-2 text-sm leading-6 text-on-surface-variant">{text}</p>
    </Panel>
  );
}
