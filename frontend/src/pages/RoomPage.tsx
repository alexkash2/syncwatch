import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { getRoom, leaveRoom } from '../api/rooms';
import { useAuth } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';
import { ChatPanel } from '../components/room/ChatPanel';
import { ParticipantList } from '../components/room/ParticipantList';
import type { RoomDetail } from '../types/room';
import type { ChatMessage, WsMessage, WsParticipant } from '../types/ws';

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'participants'>('chat');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<WsParticipant[]>([]);

  // Fetch room details via REST
  useEffect(() => {
    if (!roomId) return;
    getRoom(roomId)
      .then((data) => {
        setRoom(data);
        setParticipants(
          data.participants.map((p) => ({
            user_id: p.user_id,
            username: p.username,
            is_ready: p.is_ready,
          }))
        );
      })
      .catch(() => navigate('/'))
      .finally(() => setLoading(false));
  }, [roomId, navigate]);

  // Handle WS messages
  const handleWsMessage = useCallback(
    (msg: WsMessage) => {
      switch (msg.type) {
        case 'room_state':
          setParticipants(msg.participants || []);
          break;
        case 'user_joined':
          setParticipants((prev) => {
            if (prev.some((p) => p.user_id === msg.user_id)) return prev;
            return [...prev, { user_id: msg.user_id, username: msg.username, is_ready: false }];
          });
          break;
        case 'user_left':
          setParticipants((prev) => prev.filter((p) => p.user_id !== msg.user_id));
          break;
        case 'chat_message':
          setMessages((prev) => [
            ...prev,
            {
              id: msg.id,
              user_id: msg.user_id,
              username: msg.username,
              content: msg.content,
              created_at: msg.created_at,
            },
          ]);
          break;
        case 'error':
          if (msg.code === 'tab_replaced') {
            navigate('/');
          }
          break;
      }
    },
    [navigate]
  );

  const { send, isConnected } = useWebSocket({
    roomId: roomId || '',
    onMessage: handleWsMessage,
  });

  const handleSendChat = useCallback(
    (content: string) => {
      send('chat_send', { content });
    },
    [send]
  );

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

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-surface">
      {/* Top bar */}
      <header className="bg-surface/80 backdrop-blur-xl flex justify-between items-center px-12 h-16 shadow-[0px_24px_48px_rgba(0,0,0,0.4),0px_0px_12px_rgba(0,98,255,0.1)] z-50 shrink-0">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-xl font-black tracking-tighter text-primary">
            SyncWatch
          </Link>
          <div className="h-4 w-[1px] bg-outline-variant/30" />
          <div className="flex flex-col">
            <span className="text-on-surface text-sm">{room.name}</span>
            <span className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant">
              Room Code:{' '}
              <button
                onClick={() => navigator.clipboard.writeText(room.room_code)}
                className="text-primary-container hover:text-primary transition-colors cursor-pointer"
              >
                {room.room_code}
              </button>
              {isConnected && (
                <span className="ml-3 text-green-500">● Connected</span>
              )}
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
              <div className="w-20 h-20 mx-auto rounded-full bg-surface-container-high flex items-center justify-center border border-primary-container/20 text-4xl">
                🎬
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
          <div className="h-24 bg-surface-container/60 backdrop-blur-2xl border-t border-outline-variant/20 flex flex-col justify-center px-12 shrink-0">
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
        <aside className="w-80 bg-[#0e0e0e] border-l border-outline-variant/10 flex flex-col shrink-0">
          <div className="p-6 border-b border-outline-variant/10 shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-primary-container shadow-[0_0_8px_#0062ff]' : 'bg-outline-variant'}`} />
              <span className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant">
                {isConnected ? 'Sync Active' : 'Connecting...'}
              </span>
            </div>
            <h3 className="font-black text-sm tracking-tight">Sync Room</h3>
          </div>

          {/* Tabs */}
          <div className="flex shrink-0">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex flex-col items-center py-3 transition-all cursor-pointer ${
                activeTab === 'chat'
                  ? 'text-primary border-l-2 border-primary-container bg-gradient-to-r from-primary-container/10 to-transparent'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
            >
              <span className="text-lg mb-1">💬</span>
              <span className="text-[9px] uppercase tracking-[0.1em]">Chat</span>
            </button>
            <button
              onClick={() => setActiveTab('participants')}
              className={`flex-1 flex flex-col items-center py-3 transition-all cursor-pointer ${
                activeTab === 'participants'
                  ? 'text-primary border-l-2 border-primary-container bg-gradient-to-r from-primary-container/10 to-transparent'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
            >
              <span className="text-lg mb-1">👥</span>
              <span className="text-[9px] uppercase tracking-[0.1em]">
                Participants ({participants.length})
              </span>
            </button>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {activeTab === 'chat' ? (
              <ChatPanel
                messages={messages}
                onSend={handleSendChat}
                currentUserId={user?.id || ''}
              />
            ) : (
              <ParticipantList
                participants={participants}
                hostId={room.host_id}
              />
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
