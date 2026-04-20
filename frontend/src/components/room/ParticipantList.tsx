import { useMemo } from 'react';
import type { WsParticipant } from '../../types/ws';

interface ParticipantListProps {
  participants: WsParticipant[];
  hostId: string;
  currentUserId?: string;
}

export function ParticipantList({ participants, hostId, currentUserId }: ParticipantListProps) {
  // Sort: host first, then alphabetical. Memoized so we don't re-sort on
  // unrelated re-renders (parent re-renders on every chat message, heartbeat).
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
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {sorted.map((p) => {
        const isYou = p.user_id === currentUserId;
        return (
          <div
            key={p.user_id}
            className="flex items-center gap-3 px-3 py-2 rounded hover:bg-surface-container-low transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-surface-container-highest flex items-center justify-center text-xs font-bold text-primary">
              {p.username[0].toUpperCase()}
            </div>
            <div className="flex-1">
              <div className="text-sm text-on-surface flex items-center gap-2">
                {p.username}
                {isYou && (
                  <span className="text-[9px] uppercase tracking-widest text-on-surface-variant">
                    (you)
                  </span>
                )}
                {p.user_id === hostId && (
                  <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-primary-container text-primary-container">
                    Host
                  </span>
                )}
              </div>
            </div>
            <div
              className={`w-2 h-2 rounded-full ${
                p.is_ready ? 'bg-green-500' : 'bg-outline-variant'
              }`}
              title={p.is_ready ? 'Ready — video loaded' : 'Not ready — still loading'}
            />
          </div>
        );
      })}

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-outline-variant/10 text-[10px] text-on-surface-variant/70 space-y-1 px-3">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          <span>Ready — video loaded on their device</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-outline-variant" />
          <span>Not ready — waiting for file / loading</span>
        </div>
      </div>
    </div>
  );
}
