import type { WsParticipant } from '../../types/ws';

interface ParticipantListProps {
  participants: WsParticipant[];
  hostId: string;
}

export function ParticipantList({ participants, hostId }: ParticipantListProps) {
  // Sort: host first, then alphabetical
  const sorted = [...participants].sort((a, b) => {
    if (a.user_id === hostId) return -1;
    if (b.user_id === hostId) return 1;
    return a.username.localeCompare(b.username);
  });

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      {sorted.map((p) => (
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
          />
        </div>
      ))}
    </div>
  );
}
