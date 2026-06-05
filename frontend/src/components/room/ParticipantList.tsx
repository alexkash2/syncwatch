import { useMemo } from 'react';
import type { WsParticipant } from '../../types/ws';
import { useI18n } from '../../hooks/useI18n';
import { Badge } from '../ui/Badge';
import { CheckIcon } from '../ui/icons';

interface ParticipantListProps {
  participants: WsParticipant[];
  hostId: string;
  currentUserId?: string;
}

export function ParticipantList({ participants, hostId, currentUserId }: ParticipantListProps) {
  const { t } = useI18n();
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

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <p className="sr-only" aria-live="polite">
        {sorted.length} participants in the room. {readyCount} ready for playback.
      </p>

      <div role="list" aria-label="Room participants">
        {sorted.map((participant) => {
          const isHost = participant.user_id === hostId;
          const isCurrentUser = participant.user_id === currentUserId;

          return (
            <div
              key={participant.user_id}
              role="listitem"
              aria-label={`${participant.username}${isCurrentUser ? ', you' : ''}${
                isHost ? ', host' : ''
              }${participant.is_ready ? ', ready' : ', waiting'}`}
              className="flex items-center gap-3 rounded-[14px] px-3 py-[11px]"
            >
              <div
                className={
                  'inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[15px] font-bold ' +
                  (isHost ? 'bg-accent-tint text-accent-strong' : 'bg-surface-3 text-ink-2')
                }
              >
                {participant.username?.[0]?.toUpperCase() ?? '?'}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-[7px]">
                  <span className="truncate text-[14.5px] font-semibold text-ink">
                    {isCurrentUser ? t.you : participant.username}
                  </span>
                  {isHost && <Badge tone="accent">{t.host_badge}</Badge>}
                </div>
              </div>

              <span
                title={participant.is_ready ? t.ready_label : t.waiting_label}
                className={
                  'inline-flex items-center gap-[5px] text-[12px] font-semibold ' +
                  (participant.is_ready ? 'text-accent-strong' : 'text-ink-4')
                }
              >
                {participant.is_ready ? (
                  <CheckIcon size={15} />
                ) : (
                  <span className="h-2 w-2 rounded-full border-2 border-ink-4" />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
