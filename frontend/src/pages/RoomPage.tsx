import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { getChatHistory, getRoom, leaveRoom } from '../api/rooms';
import { useAuth } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';
import { ChatPanel } from '../components/room/ChatPanel';
import { ParticipantList } from '../components/room/ParticipantList';
import { FileSelector, type FileStatus } from '../components/room/FileSelector';
import type { RoomDetail } from '../types/room';
import type { ChatMessage, WsMessage, WsParticipant } from '../types/ws';

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'participants'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [participants, setParticipants] = useState<WsParticipant[]>([]);
  const [fileStatus, setFileStatus] = useState<FileStatus>('idle');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ match: boolean; reason?: string } | null>(null);

  // Fetch room details + chat history via REST
  useEffect(() => {
    if (!roomId) return;
    Promise.all([getRoom(roomId), getChatHistory(roomId)])
      .then(([data, history]) => {
        setRoom(data);
        setParticipants(
          data.participants.map((p) => ({
            user_id: p.user_id,
            username: p.username,
            is_ready: p.is_ready,
          }))
        );
        setMessages(history.messages);
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
        case 'file_verify_response':
          setVerifyResult({ match: msg.match, reason: msg.reason });
          break;
        case 'file_changed':
          // Host changed file, reset our state
          setFileStatus('idle');
          setFileUrl(null);
          setVerifyResult(null);
          break;
        case 'participant_ready':
          setParticipants((prev) =>
            prev.map((p) =>
              p.user_id === msg.user_id ? { ...p, is_ready: msg.is_ready } : p
            )
          );
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

  const handleVerifyRequest = useCallback(
    (hash: string, size: number, durationMs: number) => {
      send('file_verify_request', { file_hash: hash, file_size: size, file_duration_ms: durationMs });
    },
    [send]
  );

  const handleFileReady = useCallback(
    (url: string, _hash: string, _size: number, _durationMs: number) => {
      setFileUrl(url);
      setFileStatus('verified');
      send('ready', { file_version: 0 });
    },
    [send]
  );

  const handleSendChat = useCallback(
    (content: string): boolean => {
      return send('chat_send', { content });
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
      <header className="bg-surface/80 backdrop-blur-xl flex justify-between items-center px-4 md:px-12 h-14 md:h-16 shadow-[0px_24px_48px_rgba(0,0,0,0.4),0px_0px_12px_rgba(0,98,255,0.1)] z-50 shrink-0">
        <div className="flex items-center gap-2 md:gap-4 min-w-0">
          <Link to="/" className="text-lg md:text-xl font-black tracking-tighter text-primary shrink-0">
            SyncWatch
          </Link>
          <div className="h-4 w-[1px] bg-outline-variant/30 hidden md:block" />
          <div className="flex flex-col min-w-0">
            <span className="text-on-surface text-sm truncate">{room.name}</span>
            <span className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant hidden md:block">
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
        <div className="flex items-center gap-2 md:gap-6 shrink-0">
          {/* Mobile: toggle sidebar */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden text-on-surface-variant hover:text-primary text-xl cursor-pointer"
          >
            💬
          </button>
          <button
            onClick={handleLeave}
            className="text-[10px] md:text-[12px] uppercase tracking-[0.1em] px-3 md:px-6 py-2 bg-error-container text-on-surface hover:bg-error transition-all cursor-pointer"
          >
            Leave
          </button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden relative">
        {/* Video area */}
        <section className="flex-1 md:flex-[3] flex flex-col">
          {!fileUrl ? (
            <FileSelector
              onFileReady={handleFileReady}
              onVerifyRequest={handleVerifyRequest}
              verifyResult={verifyResult}
              status={fileStatus}
              setStatus={setFileStatus}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-black">
              <video
                src={fileUrl}
                className="w-full h-full"
                controls={false}
              />
            </div>
          )}

          {/* Player controls placeholder */}
          <div className="h-20 md:h-24 bg-surface-container/60 backdrop-blur-2xl border-t border-outline-variant/20 flex flex-col justify-center px-4 md:px-12 shrink-0">
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

        {/* Overlay backdrop for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Side panel: overlay on mobile, static on desktop */}
        <aside className={`
          fixed right-0 top-14 bottom-0 w-80 z-50 transition-transform duration-300
          md:static md:top-auto md:bottom-auto md:z-auto md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-full md:translate-x-0'}
          bg-[#0e0e0e] border-l border-outline-variant/10 flex flex-col shrink-0
        `}>
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
