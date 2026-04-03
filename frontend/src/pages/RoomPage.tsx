import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { getChatHistory, getRoom, leaveRoom } from '../api/rooms';
import { useAuth } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';
import { useVideoSync } from '../hooks/useVideoSync';
import { ChatPanel } from '../components/room/ChatPanel';
import { ParticipantList } from '../components/room/ParticipantList';
import { FileSelector } from '../components/room/FileSelector';
import { VideoPlayer } from '../components/room/VideoPlayer';
import { PlaybackControls } from '../components/room/PlaybackControls';
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
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<{ match: boolean; reason?: string; file_version?: number } | null>(null);
  const [hostDisconnected, setHostDisconnected] = useState(false);
  const [graceCountdown, setGraceCountdown] = useState(0);
  const fileVersionRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSeqRef = useRef(0);
  const graceTimerRef = useRef<ReturnType<typeof setInterval>>();

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
      // Update global seq for ALL message types (not just sync)
      if (msg.seq !== undefined && msg.seq > lastSeqRef.current) {
        lastSeqRef.current = msg.seq;
      }

      switch (msg.type) {
        case 'room_state':
          setParticipants(msg.participants || []);
          if (msg.file_version !== undefined) {
            fileVersionRef.current = msg.file_version;
          }
          // Apply playback state for late joiners / reconnect
          if (msg.playback_state) {
            const video = videoRef.current;
            if (video) {
              const targetSec = (msg.playback_state.current_time_ms || 0) / 1000;
              video.currentTime = targetSec;
              if (msg.playback_state.is_playing) {
                video.play().catch(() => {});
              } else if (!video.paused) {
                video.pause();
              }
            }
          }
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
          setVerifyResult({ match: msg.match, reason: msg.reason, file_version: msg.file_version });
          if (msg.match && msg.file_version !== undefined) {
            fileVersionRef.current = msg.file_version;
          }
          break;
        case 'file_changed':
          // Host changed file, reset everyone's state
          fileVersionRef.current = msg.file_version || 0;
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
        case 'participant_status':
          setParticipants((prev) =>
            prev.map((p) =>
              p.user_id === msg.user_id ? { ...p, status: msg.status } : p
            )
          );
          break;
        case 'sync_state':
        case 'sync_check':
        case 'sync_correction':
        case 'playback_rate':
          syncMessageRef.current(msg);
          break;
        case 'host_disconnected': {
          setHostDisconnected(true);
          const totalSec = Math.round((msg.grace_period_ms || 30000) / 1000);
          setGraceCountdown(totalSec);
          clearInterval(graceTimerRef.current);
          let remaining = totalSec;
          graceTimerRef.current = setInterval(() => {
            remaining--;
            setGraceCountdown(remaining);
            if (remaining <= 0) clearInterval(graceTimerRef.current);
          }, 1000);
          break;
        }
        case 'host_reconnected':
          setHostDisconnected(false);
          setGraceCountdown(0);
          clearInterval(graceTimerRef.current);
          break;
        case 'room_closed':
          clearInterval(graceTimerRef.current);
          navigate('/');
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
    lastSeqRef,
    fileVersionRef,
  });

  const { handleSyncMessage } = useVideoSync({
    videoRef,
    send,
    fileVersion: fileVersionRef.current,
    lastSeq: lastSeqRef,
  });

  const syncMessageRef = useRef(handleSyncMessage);
  syncMessageRef.current = handleSyncMessage;

  const handleVerifyRequest = useCallback(
    (hash: string, size: number, durationMs: number, fileName: string) => {
      send('file_verify_request', {
        file_hash: hash, file_size: size, file_duration_ms: durationMs, file_name: fileName,
      });
    },
    [send]
  );

  const handleFileVerified = useCallback(
    (url: string, _hash: string, _size: number, _durationMs: number) => {
      setFileUrl(url);
      // Don't send ready yet — wait for video canplay event
    },
    []
  );

  const handleVideoCanPlay = useCallback(() => {
    send('ready', { file_version: fileVersionRef.current });
  }, [send]);

  const handleVideoError = useCallback(
    (errorCode: string) => {
      send('playback_error', { error_code: errorCode });
    },
    [send]
  );

  const handlePlay = useCallback(
    (timeMs: number) => send('play', { current_time_ms: timeMs, file_version: fileVersionRef.current }),
    [send]
  );

  const handlePause = useCallback(
    (timeMs: number) => send('pause', { current_time_ms: timeMs, file_version: fileVersionRef.current }),
    [send]
  );

  const handleSeek = useCallback(
    (timeMs: number) => send('seek', { current_time_ms: timeMs, file_version: fileVersionRef.current }),
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
    clearInterval(graceTimerRef.current);
    await leaveRoom(roomId);
    navigate('/');
  };

  // Cleanup grace timer on unmount
  useEffect(() => {
    return () => clearInterval(graceTimerRef.current);
  }, []);

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
        <section className="flex-1 md:flex-[3] flex flex-col relative">
          {/* Host disconnect overlay */}
          {hostDisconnected && (
            <div className="absolute inset-0 z-40 bg-black/70 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 mx-auto border-4 border-error/30 border-t-error rounded-full animate-spin" />
                <h2 className="text-xl font-bold text-on-surface">Host lost connection</h2>
                <p className="text-on-surface-variant">
                  Waiting for reconnect: <span className="text-error font-mono">{graceCountdown}s</span>
                </p>
              </div>
            </div>
          )}
          {!fileUrl ? (
            <FileSelector
              onFileVerified={handleFileVerified}
              onVerifyRequest={handleVerifyRequest}
              verifyResult={verifyResult}
              isHost={room.host_id === user?.id}
            />
          ) : (
            <VideoPlayer
              ref={videoRef}
              src={fileUrl}
              onCanPlay={handleVideoCanPlay}
              onError={handleVideoError}
            />
          )}

          <PlaybackControls
            videoRef={videoRef}
            isHost={room.host_id === user?.id}
            onPlay={handlePlay}
            onPause={handlePause}
            onSeek={handleSeek}
          />
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
