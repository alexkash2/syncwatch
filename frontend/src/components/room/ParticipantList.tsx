import { useMemo } from 'react';
import type { ParticipantRuntimeStatus, WsParticipant } from '../../types/ws';
import { Badge } from '../ui/Badge';
import { UsersIcon } from '../ui/icons';
import { StatePanel } from '../ui/StatePanel';

interface ParticipantListProps {
  participants: WsParticipant[];
  hostId: string;
  currentUserId?: string;
}

export function ParticipantList({
  participants,
  hostId,
  currentUserId,
}: ParticipantListProps) {
  const readyCount = participants.filter((participant) => participant.is_ready).length;
  const sorted = useMemo(
    () =>
      [...participants].sort((a, b) => {
        if (a.user_id === hostId) return -1;
        if (b.user_id === hostId) return 1;
        return a.username.localeCompare(b.username);
      }),
    [participants, hostId]
  );

  if (sorted.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-center">
        <StatePanel
          eyebrow="Room Presence"
          title="No participants yet"
          description="People who join the room will appear here in real time and their readiness will update automatically."
          icon={<UsersIcon size={22} />}
          className="w-full max-w-sm"
        />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <p className="sr-only" aria-live="polite">
        {sorted.length} participants in the room. {readyCount} ready for playback.
      </p>

      <div className="space-y-3" role="list" aria-label="Room participants">
        {sorted.map((participant) => {
          const isHost = participant.user_id === hostId;
          const isCurrentUser = participant.user_id === currentUserId;

          return (
            <div
              key={participant.user_id}
              role="listitem"
              aria-label={`${participant.username}${isCurrentUser ? ', you' : ''}${isHost ? ', host' : ''}${participant.is_ready ? ', ready' : ', waiting'}`}
              className="rounded-[1.35rem] border border-outline-variant/12 bg-surface-container-lowest/78 px-4 py-4 transition hover:border-primary-container/18 hover:bg-surface-container-low"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-container-highest text-sm font-black text-primary">
                  {participant.username?.[0]?.toUpperCase() ?? '?'}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-on-surface">
                      {participant.username}
                    </p>
                    {isCurrentUser && (
                      <Badge tone="neutral" className="px-2 py-0.5 text-[9px]">
                        You
                      </Badge>
                    )}
                    {isHost && (
                      <Badge tone="primary" className="px-2 py-0.5 text-[9px]">
                        Host
                      </Badge>
                    )}
                  </div>

                  <p className="mt-2 text-xs leading-6 text-on-surface-variant">
                    {isHost
                      ? 'Drives the shared playback timeline for the room.'
                      : participant.is_ready
                      ? 'Ready to follow the shared host timeline.'
                      : 'Still preparing the local player for sync.'}
                  </p>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">
                      {participant.is_ready ? 'Player ready' : 'Still loading'}
                    </p>
                    <Badge tone={participant.is_ready ? 'success' : 'neutral'}>
                      {participant.is_ready ? 'Ready' : 'Waiting'}
                    </Badge>
                  </div>

                  {participant.status && participant.status !== 'playing' && participant.status !== 'paused' && (
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <Badge tone={getRuntimeStatusTone(participant.status)}>
                        {getRuntimeStatusLabel(participant.status, participant.status_detail)}
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getRuntimeStatusLabel(status: ParticipantRuntimeStatus, detail?: string) {
  switch (status) {
    case 'buffering':
      return 'Buffering';
    case 'error':
      return detail ? `Error: ${detail}` : 'Playback error';
    case 'waiting_interaction':
      return 'Needs tap to play';
    default:
      return status;
  }
}

function getRuntimeStatusTone(status: ParticipantRuntimeStatus) {
  switch (status) {
    case 'buffering':
      return 'warning' as const;
    case 'error':
      return 'danger' as const;
    case 'waiting_interaction':
      return 'warning' as const;
    default:
      return 'neutral' as const;
  }
}
