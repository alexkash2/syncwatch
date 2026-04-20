import type { ReactNode } from 'react';
import { cn } from '../ui/cn';
import {
  ArrowUpRightIcon,
  BrandMarkIcon,
  ChatBubbleIcon,
  CheckIcon,
  RefreshIcon,
  UsersIcon,
  VideoIcon,
} from '../ui/icons';

export type BrandIllustrationVariant = 'sync' | 'drift' | 'welcome' | 'launch';

interface BrandIllustrationProps {
  variant?: BrandIllustrationVariant;
  compact?: boolean;
  className?: string;
}

export function BrandIllustration({
  variant = 'sync',
  compact = false,
  className,
}: BrandIllustrationProps) {
  const config = brandIllustrationConfig[variant];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[1.9rem] border border-outline-variant/14 bg-black/24 shadow-[0_24px_60px_rgba(0,0,0,0.26)]',
        compact ? 'p-4' : 'p-5 md:p-6',
        className
      )}
    >
      <div className={cn('absolute inset-0 opacity-95', config.auraClass)} />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.022)_1px,transparent_1px)] bg-[size:24px_24px] opacity-35" />
      <div className="absolute -right-16 top-8 h-40 w-40 rounded-full border border-white/6 bg-white/6 blur-3xl" />

      <div className="relative z-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              {config.accentLabel}
            </p>
            <h3 className="mt-2 text-2xl font-black tracking-tight text-on-surface">
              {config.headline}
            </h3>
          </div>

          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-[1.1rem] border shadow-[0_16px_40px_rgba(0,0,0,0.22)]',
              config.orbitClass
            )}
          >
            {config.centerIcon}
          </div>
        </div>

        <div className="relative mt-6 flex items-center justify-center py-4">
          <div className="absolute h-44 w-44 rounded-full border border-white/10" />
          <div className="absolute h-32 w-32 rounded-full border border-white/10" />
          <div className={cn('absolute h-20 w-20 rounded-full border', config.ringClass)} />

          {config.nodes.map((node) => (
            <SignalNode
              key={node.label}
              className={node.className}
              icon={node.icon}
              toneClass={config.nodeClass}
            />
          ))}

          <div
            className={cn(
              'relative flex h-20 w-20 items-center justify-center rounded-[1.7rem] border shadow-[0_16px_36px_rgba(0,0,0,0.22)]',
              config.orbitClass
            )}
          >
            {config.centerGlyph}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {config.cards.map((card) => (
            <BrandFact
              key={card.label}
              icon={card.icon}
              label={card.label}
              text={card.text}
              toneClass={config.factToneClass}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const brandIllustrationConfig: Record<
  BrandIllustrationVariant,
  {
    accentLabel: string;
    headline: string;
    auraClass: string;
    orbitClass: string;
    ringClass: string;
    nodeClass: string;
    factToneClass: string;
    centerIcon: ReactNode;
    centerGlyph: ReactNode;
    nodes: Array<{
      label: string;
      className: string;
      icon: ReactNode;
    }>;
    cards: Array<{
      label: string;
      text: string;
      icon: ReactNode;
    }>;
  }
> = {
  sync: {
    accentLabel: 'Shared room map',
    headline: 'Signal locked',
    auraClass:
      'bg-[radial-gradient(circle_at_top_right,rgba(0,98,255,0.22),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(180,197,255,0.16),transparent_30%),linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]',
    orbitClass: 'border-primary-container/26 bg-primary-container/10 text-primary',
    ringClass: 'border-primary-container/24',
    nodeClass: 'border-primary-container/20 bg-black/38 text-primary',
    factToneClass: 'border-primary-container/18 bg-primary-container/10 text-primary',
    centerIcon: <BrandMarkIcon size={20} />,
    centerGlyph: <BrandMarkIcon size={28} />,
    nodes: [
      {
        label: 'reference',
        className: '-translate-x-[5.8rem] -translate-y-5',
        icon: <VideoIcon size={14} />,
      },
      {
        label: 'ready',
        className: 'translate-x-[5.6rem] -translate-y-2',
        icon: <UsersIcon size={14} />,
      },
      {
        label: 'chat',
        className: 'translate-y-[4.5rem]',
        icon: <ChatBubbleIcon size={14} />,
      },
    ],
    cards: [
      {
        label: 'Reference file',
        text: 'Everyone matches the same local video before playback begins.',
        icon: <VideoIcon size={15} />,
      },
      {
        label: 'Group ready',
        text: 'Room readiness stays visible so the host knows when to start.',
        icon: <UsersIcon size={15} />,
      },
      {
        label: 'Live chat',
        text: 'The conversation stays anchored to the session timeline.',
        icon: <ChatBubbleIcon size={15} />,
      },
    ],
  },
  drift: {
    accentLabel: 'Recovery path',
    headline: 'Route drift',
    auraClass:
      'bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.22),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(255,180,110,0.16),transparent_30%),linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]',
    orbitClass: 'border-amber-300/26 bg-amber-300/10 text-amber-100',
    ringClass: 'border-amber-300/22',
    nodeClass: 'border-amber-300/18 bg-black/38 text-amber-100',
    factToneClass: 'border-amber-300/18 bg-amber-300/10 text-amber-100',
    centerIcon: <ArrowUpRightIcon size={20} />,
    centerGlyph: <ArrowUpRightIcon size={28} />,
    nodes: [
      {
        label: 'return',
        className: '-translate-x-[5.8rem] -translate-y-5',
        icon: <BrandMarkIcon size={14} />,
      },
      {
        label: 'recover',
        className: 'translate-x-[5.6rem] -translate-y-2',
        icon: <RefreshIcon size={14} />,
      },
      {
        label: 'route',
        className: 'translate-y-[4.5rem]',
        icon: <ArrowUpRightIcon size={14} />,
      },
    ],
    cards: [
      {
        label: 'Return path',
        text: 'SyncWatch guides you back to a stable room state instead of leaving you stranded.',
        icon: <ArrowUpRightIcon size={15} />,
      },
      {
        label: 'Session recovery',
        text: 'Reconnects, host returns and room endings now have clearer arrival states.',
        icon: <RefreshIcon size={15} />,
      },
      {
        label: 'Clear signals',
        text: 'The interface keeps showing what changed and where to go next.',
        icon: <BrandMarkIcon size={15} />,
      },
    ],
  },
  welcome: {
    accentLabel: 'Return with context',
    headline: 'Back on the same beat',
    auraClass:
      'bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.22),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(110,231,183,0.14),transparent_30%),linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]',
    orbitClass: 'border-emerald-400/24 bg-emerald-400/10 text-emerald-100',
    ringClass: 'border-emerald-300/20',
    nodeClass: 'border-emerald-400/18 bg-black/38 text-emerald-100',
    factToneClass: 'border-emerald-400/18 bg-emerald-400/10 text-emerald-100',
    centerIcon: <CheckIcon size={20} />,
    centerGlyph: <BrandMarkIcon size={28} />,
    nodes: [
      {
        label: 'resume',
        className: '-translate-x-[5.8rem] -translate-y-5',
        icon: <RefreshIcon size={14} />,
      },
      {
        label: 'rooms',
        className: 'translate-x-[5.6rem] -translate-y-2',
        icon: <UsersIcon size={14} />,
      },
      {
        label: 'chat',
        className: 'translate-y-[4.5rem]',
        icon: <ChatBubbleIcon size={14} />,
      },
    ],
    cards: [
      {
        label: 'Recent rooms',
        text: 'Pick up the sessions you already know instead of rebuilding the flow from scratch.',
        icon: <RefreshIcon size={15} />,
      },
      {
        label: 'Steady access',
        text: 'One account keeps your dashboard, room codes and room roles consistent across visits.',
        icon: <BrandMarkIcon size={15} />,
      },
      {
        label: 'Shared context',
        text: 'Presence, readiness and live chat all return with the room instead of feeling reset.',
        icon: <UsersIcon size={15} />,
      },
    ],
  },
  launch: {
    accentLabel: 'First room map',
    headline: 'Start the signal',
    auraClass:
      'bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.22),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(125,211,252,0.16),transparent_30%),linear-gradient(160deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))]',
    orbitClass: 'border-cyan-300/24 bg-cyan-300/10 text-cyan-100',
    ringClass: 'border-cyan-300/22',
    nodeClass: 'border-cyan-300/18 bg-black/38 text-cyan-100',
    factToneClass: 'border-cyan-300/18 bg-cyan-300/10 text-cyan-100',
    centerIcon: <ArrowUpRightIcon size={20} />,
    centerGlyph: <BrandMarkIcon size={28} />,
    nodes: [
      {
        label: 'host',
        className: '-translate-x-[5.8rem] -translate-y-5',
        icon: <UsersIcon size={14} />,
      },
      {
        label: 'media',
        className: 'translate-x-[5.6rem] -translate-y-2',
        icon: <VideoIcon size={14} />,
      },
      {
        label: 'join',
        className: 'translate-y-[4.5rem]',
        icon: <ArrowUpRightIcon size={14} />,
      },
    ],
    cards: [
      {
        label: 'Open the room',
        text: 'Create the session first, then let the UI guide the rest of the sync flow.',
        icon: <UsersIcon size={15} />,
      },
      {
        label: 'Share the code',
        text: 'Every room gives you a clean code handoff so people can join without friction.',
        icon: <ArrowUpRightIcon size={15} />,
      },
      {
        label: 'Match local media',
        text: 'The group keeps files on-device while SyncWatch lines up the same timeline.',
        icon: <VideoIcon size={15} />,
      },
    ],
  },
};

function SignalNode({
  icon,
  className,
  toneClass,
}: {
  icon: ReactNode;
  className?: string;
  toneClass: string;
}) {
  return (
    <div
      className={cn(
        'absolute flex h-10 w-10 items-center justify-center rounded-full border shadow-[0_10px_24px_rgba(0,0,0,0.22)]',
        toneClass,
        className
      )}
    >
      {icon}
    </div>
  );
}

function BrandFact({
  icon,
  label,
  text,
  toneClass,
}: {
  icon: ReactNode;
  label: string;
  text: string;
  toneClass: string;
}) {
  return (
    <div className="rounded-[1.3rem] border border-outline-variant/14 bg-black/20 px-4 py-4 backdrop-blur-xl">
      <div className="flex items-center gap-2">
        <span className={cn('flex h-8 w-8 items-center justify-center rounded-full border', toneClass)}>
          {icon}
        </span>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
          {label}
        </p>
      </div>
      <p className="mt-3 text-xs leading-6 text-on-surface-variant">{text}</p>
    </div>
  );
}
