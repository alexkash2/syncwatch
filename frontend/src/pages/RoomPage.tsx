import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { getRoom, leaveRoom } from '../api/rooms';
import { useAuth } from '../hooks/useAuth';
import type { RoomDetail } from '../types/room';

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      const data = await getRoom(roomId);
      setRoom(data);
    } catch {
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [roomId, navigate]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  const handleLeave = async () => {
    if (!roomId) return;
    await leaveRoom(roomId);
    navigate('/');
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <div className="text-on-surface-variant">Loading room...</div>
      </div>
    );
  }

  if (!room) return null;

  const isHost = room.host_id === user?.id;
  const copied = async () => {
    await navigator.clipboard.writeText(room.room_code);
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-surface">
      {/* Top bar */}
      <header className="bg-surface/80 backdrop-blur-xl flex justify-between items-center px-12 h-16 shadow-[0px_24px_48px_rgba(0,0,0,0.4),0px_0px_12px_rgba(0,98,255,0.1)] z-50">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-xl font-black tracking-tighter text-primary">
            SyncWatch
          </Link>
          <div className="h-4 w-[1px] bg-outline-variant/30" />
          <div className="flex flex-col">
            <span className="text-on-surface text-sm">{room.name}</span>
            <span className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant">
              Room Code:{' '}
              <button onClick={copied} className="text-primary-container hover:text-primary transition-colors cursor-pointer">
                {room.room_code}
              </button>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <button
            onClick={handleLeave}
            className="text-[12px] uppercase tracking-[0.1em] px-6 py-2 bg-error-container text-on-surface hover:bg-error transition-all cursor-pointer"
          >
            Leave Room
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        {/* Video area */}
        <section className="flex-[3] flex flex-col">
          <div className="flex-1 flex items-center justify-center bg-surface-container-lowest p-12">
            <div className="text-center space-y-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-surface-container-high flex items-center justify-center border border-primary-container/20">
                <span className="text-primary text-4xl">🎬</span>
              </div>
              <h2 className="font-black text-2xl tracking-tight text-on-surface">
                Select a video file to start
              </h2>
              <p className="text-on-surface-variant max-w-xs mx-auto">
                Choose a local video file to sync playback with the room.
              </p>
              <button className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-br from-primary-container to-[#0053da] text-on-primary-container font-bold uppercase text-xs tracking-widest active:scale-95 transition-all cursor-pointer">
                Choose Video File
              </button>
            </div>
          </div>

          {/* Player controls placeholder */}
          <div className="h-24 bg-surface-container/60 backdrop-blur-2xl border-t border-outline-variant/20 flex flex-col justify-center px-12">
            <div className="w-full mb-4 h-1 bg-surface-container-highest rounded">
              <div className="h-full bg-primary-container rounded" style={{ width: '0%' }} />
            </div>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-10">
                <button className="text-on-surface-variant text-3xl cursor-pointer">▶</button>
                <span className="text-xs uppercase tracking-widest text-primary-container">
                  00:00 / 00:00
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-on-surface-variant text-sm">🔊</span>
                <div className="w-24 h-[2px] bg-surface-container-highest">
                  <div className="h-full bg-primary w-2/3" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Side panel */}
        <aside className="w-80 bg-[#0e0e0e] border-l border-outline-variant/10 flex flex-col">
          <div className="p-6 border-b border-outline-variant/10">
            <h3 className="font-black text-sm tracking-tight">Participants</h3>
            <span className="text-[10px] text-on-surface-variant">
              {room.participants.length} in room
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {room.participants.map((p) => (
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
                    {p.user_id === room.host_id && (
                      <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 border border-primary-container text-primary-container">
                        Host
                      </span>
                    )}
                  </div>
                </div>
                <div className={`w-2 h-2 rounded-full ${p.is_ready ? 'bg-green-500' : 'bg-outline-variant'}`} />
              </div>
            ))}
          </div>

          {/* Chat placeholder */}
          <div className="p-4 border-t border-outline-variant/10">
            <input
              type="text"
              className="w-full bg-surface-container-low border-b border-outline-variant/20 focus:border-primary-container focus:outline-none text-sm py-3 px-4 text-on-surface transition-colors"
              placeholder="Chat coming in Phase 3..."
              disabled
            />
          </div>
        </aside>
      </main>
    </div>
  );
}
