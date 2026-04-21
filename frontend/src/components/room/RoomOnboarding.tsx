import type { ReactNode } from 'react';
import { Badge } from '../ui/Badge';
import {
  BrandMarkIcon,
  CheckIcon,
  PlayIcon,
  UsersIcon,
  VideoIcon,
} from '../ui/icons';
import { Panel } from '../ui/Panel';
import type { RoomStatus } from '../../types/ws';

interface RoomOnboardingProps {
  isHost: boolean;
  roomStatus: RoomStatus;
  referenceFileName: string | null;
  hasLocalFile: boolean;
  videoReady: boolean;
  readyParticipants: number;
  totalParticipants: number;
  compact?: boolean;
}

type StepState = 'complete' | 'current' | 'upcoming';

interface StepMeta {
  key: string;
  label: string;
  description: string;
  state: StepState;
  icon: ReactNode;
}

export function RoomOnboarding({
  isHost,
  roomStatus,
  referenceFileName,
  hasLocalFile,
  videoReady,
  readyParticipants,
  totalParticipants,
  compact = false,
}: RoomOnboardingProps) {
  const everyoneReady = totalParticipants > 0 && readyParticipants === totalParticipants;
  const localStageComplete = hasLocalFile && videoReady;
  const sessionLive =
    everyoneReady &&
    hasLocalFile &&
    (roomStatus === 'playing' || roomStatus === 'paused');

  const steps: StepMeta[] = [
    {
      key: 'reference',
      label: isHost ? 'Choose reference' : 'Wait for reference',
      description: isHost
        ? 'Pick the file that anchors the room for everyone.'
        : 'The host chooses the first file the room will match.',
      state: referenceFileName ? 'complete' : 'current',
      icon: <BrandMarkIcon size={15} />,
    },
    {
      key: 'local',
      label: 'Load your file',
      description: isHost
        ? 'Open the same local video on your device to drive playback.'
        : 'Select the same local video so the room can verify it.',
      state: localStageComplete
        ? 'complete'
        : referenceFileName
        ? 'current'
        : 'upcoming',
      icon: <VideoIcon size={15} />,
    },
    {
      key: 'readiness',
      label: 'Wait for everyone',
      description: isHost
        ? 'Start once every participant is ready.'
        : 'The room stays synced when every participant is ready.',
      state: everyoneReady
        ? 'complete'
        : localStageComplete
        ? 'current'
        : 'upcoming',
      icon: <UsersIcon size={15} />,
    },
    {
      key: 'playback',
      label: isHost ? 'Start playback' : 'Follow playback',
      description: isHost
        ? 'You control the shared timeline when the room is ready.'
        : 'Playback follows the shared host timeline automatically.',
      state: sessionLive ? 'complete' : everyoneReady ? 'current' : 'upcoming',
      icon: <PlayIcon size={15} />,
    },
  ];

  const summary = getSummary({
    isHost,
    roomStatus,
    referenceFileName,
    localStageComplete,
    everyoneReady,
    readyParticipants,
    totalParticipants,
  });

  if (compact) {
    return (
      <Panel variant="outline" padding="sm" className="rounded-[1.5rem] border-primary-container/18 bg-black/34">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
              Room Flow
            </p>
            <p className="mt-2 text-sm leading-6 text-on-surface-variant">{summary}</p>
          </div>
          <Badge tone={sessionLive ? 'success' : 'primary'}>
            {sessionLive ? 'Session live' : 'Guided steps'}
          </Badge>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {steps.map((step, index) => (
            <CompactStep key={step.key} step={step} index={index} />
          ))}
        </div>
      </Panel>
    );
  }

  return (
    <Panel variant="outline" padding="md" className="rounded-[1.75rem]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
            Room Guide
          </p>
          <h3 className="mt-2 text-xl font-black tracking-tight text-on-surface">
            Follow the synced setup
          </h3>
          <p className="mt-2 text-sm leading-7 text-on-surface-variant">{summary}</p>
        </div>
        <Badge tone={sessionLive ? 'success' : 'neutral'}>
          {sessionLive ? 'Ready to watch' : 'In progress'}
        </Badge>
      </div>

      <div className="mt-5 space-y-3">
        {steps.map((step, index) => (
          <DetailedStep key={step.key} step={step} index={index} />
        ))}
      </div>
    </Panel>
  );
}

function DetailedStep({ step, index }: { step: StepMeta; index: number }) {
  const stateClass = getStepClasses(step.state);

  return (
    <div className={`rounded-[1.35rem] border px-4 py-4 ${stateClass.wrapper}`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border ${stateClass.icon}`}>
          {step.state === 'complete' ? <CheckIcon size={16} /> : step.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={step.state === 'complete' ? 'success' : step.state === 'current' ? 'primary' : 'neutral'}>
              Step {index + 1}
            </Badge>
            <p className="text-sm font-semibold text-on-surface">{step.label}</p>
          </div>
          <p className="mt-2 text-xs leading-6 text-on-surface-variant">{step.description}</p>
        </div>
      </div>
    </div>
  );
}

function CompactStep({ step, index }: { step: StepMeta; index: number }) {
  const stateClass = getStepClasses(step.state);

  return (
    <div className={`rounded-[1.2rem] border px-3 py-3 ${stateClass.wrapper}`}>
      <div className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full border ${stateClass.icon}`}>
          {step.state === 'complete' ? <CheckIcon size={14} /> : step.icon}
        </span>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
            {index + 1}. {step.label}
          </p>
          <p className="mt-1 text-xs leading-5 text-on-surface-variant">{step.description}</p>
        </div>
      </div>
    </div>
  );
}

function getStepClasses(state: StepState) {
  switch (state) {
    case 'complete':
      return {
        wrapper: 'border-emerald-400/18 bg-emerald-400/8',
        icon: 'border-emerald-300/20 bg-emerald-400/12 text-emerald-200',
      };
    case 'current':
      return {
        wrapper: 'border-primary-container/22 bg-primary-container/10',
        icon: 'border-primary-container/22 bg-primary-container/12 text-primary',
      };
    default:
      return {
        wrapper: 'border-outline-variant/14 bg-surface-container-lowest/70',
        icon: 'border-outline-variant/18 bg-black/20 text-on-surface-variant',
      };
  }
}

function getSummary({
  isHost,
  roomStatus,
  referenceFileName,
  localStageComplete,
  everyoneReady,
  readyParticipants,
  totalParticipants,
}: {
  isHost: boolean;
  roomStatus: RoomStatus;
  referenceFileName: string | null;
  localStageComplete: boolean;
  everyoneReady: boolean;
  readyParticipants: number;
  totalParticipants: number;
}) {
  if (!referenceFileName) {
    return isHost
      ? 'Pick the first reference file to give the room a shared anchor.'
      : 'The host still needs to choose the first reference file.';
  }

  if (!localStageComplete) {
    return isHost
      ? 'Load the room file locally so you can control playback from this device.'
      : 'Choose the same local video as the host to join the synced session.';
  }

  if (!everyoneReady) {
    return `${
      readyParticipants
    } of ${totalParticipants || 0} participants are ready. ${
      isHost
        ? 'You can start as soon as everyone finishes loading.'
        : 'The host can begin once the room is fully ready.'
    }`;
  }

  if (roomStatus === 'playing') {
    return 'Everyone is matched and the shared timeline is currently live.';
  }

  return isHost
    ? 'The room is fully matched and waiting for you to drive playback.'
    : 'Your player is matched and ready to follow the shared host timeline.';
}
