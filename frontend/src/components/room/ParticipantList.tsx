import { useMemo } from 'react';
import type { WsParticipant } from '../../types/ws';

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
        <div>
          <p className="text-lg font-bold tracking-tight text-on-surface">No participants yet</p>
          <p className="mt-2 text-sm text-on-surface-variant">
            People who join the room will appear here in real time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-3">
      {sorted.map((participant) => {
        const isHost = participant.user_id === hostId;
        const isCurrentUser = participant.user_id === currentUserId;

        return (
          <div
            key={participant.user_id}
            className="rounded-[1.35rem] border border-outline-variant/12 bg-surface-container-lowest/78 px-4 py-4 transition hover:border-primary-container/18 hover:bg-surface-container-low"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface-container-highest text-sm font-black text-primary">
                {participant.username[0].toUpperCase()}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-on-surface">
                    {participant.username}
                  </p>
                  {isCurrentUser && (
                    <span className="rounded-full border border-outline-variant/18 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-on-surface-variant">
                      You
                    </span>
                  )}
                  {isHost && (
                    <span className="rounded-full border border-primary-container/35 bg-primary-container/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-primary">
                      Host
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-on-surface-variant">
                    {participant.is_ready ? 'Player ready' : 'Still loading'}
                  </p>
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${
                      participant.is_ready
                        ? 'border border-emerald-400/25 bg-emerald-400/10 text-emerald-200'
                        : 'border border-outline-variant/16 bg-black/20 text-on-surface-variant'
                    }`}
                  >
                    {participant.is_ready ? 'Ready' : 'Waiting'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
