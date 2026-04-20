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
  const [verifyResult, setVerifyResult] = useState<{
    match: boolean;
    reason?: string;
    file_version?: number;
    file_hash?: string;
  } | null>(null);
  const [hostDisconnected, setHostDisconnected] = useState(false);
  const [graceCountdown, setGraceCountdown] = useState(0);
  const [fileVersion, setFileVersion] = useState(0);
  const [fileChangedNotice, setFileChangedNotice] = useState(false);
  const [controlNotice, setControlNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [chatCursor, setChatCursor] = useState<string | null>(null);
  const [chatLoadError, setChatLoadError] = useState(false);
  const fileVersionRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSeqRef = useRef(0);
  const graceTimerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  // Holds the latest sync handler so handleWsMessage below can call it without
  // re-memoizing the switch on every render.
  const syncMessageRef = useRef<(msg: WsMessage) => void>(() => {});

  // Fetch room details + chat history via REST
  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    // Take roomId as an argument so TypeScript narrows it once on entry,
    // rather than relying on the outer `if (!roomId) return` guard holding
    // across the async boundaries below.
    async function load(id: string) {
      try {
        const data = await getRoom(id);
        if (cancelled) return;
        setRoom(data);
        setParticipants(
          data.participants.map((p) => ({
            user_id: p.user_id,
            username: p.username,
            is_ready: p.is_ready,
          }))
        );
        // Chat history is optional for rendering the room, but we still need
        // to surface a failure so the user doesn't read an empty scroll-view
        // as "nobody has ever chatted here".
        try {
          const history = await getChatHistory(id);
          if (!cancelled) {
            setMessages(history.messages);
            setChatCursor(history.next_cursor ?? null);
            setChatLoadError(false);
          }
        } catch {
          if (!cancelled) setChatLoadError(true);
        }
      } catch (err: unknown) {
        const axiosErr = err as { response?: { status?: number; data?: unknown } };
        console.error('Failed to load room:', axiosErr.response?.status, axiosErr.response?.data);
        if (!cancelled) {
          const status = axiosErr.response?.status;
          if (status === 404) {
            navigate('/', {
              state: { flash: "Room not found. It may have been deleted." },
            });
          } else if (status === 403) {
            navigate('/', {
              state: { flash: "You don't have access to this room." },
            });
          } else {
            navigate('/', {
              state: { flash: 'Could not load the room. Please try again.' },
            });
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load(roomId);
    return () => { cancelled = true; };
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
            const prevFv = fileVersionRef.current;
            fileVersionRef.current = msg.file_version;
            setFileVersion(msg.file_version);
            // Host changed the file while we were disconnected — drop the stale blob
            // so the user is prompted to re-select the new file.
            if (prevFv > 0 && msg.file_version !== prevFv) {
              setFileUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
              });
              setVerifyResult(null);
            }
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
          setVerifyResult({
            match: msg.match,
            reason: msg.reason,
            file_version: msg.file_version,
            file_hash: msg.file_hash,
          });
          if (msg.match && msg.file_version !== undefined) {
            fileVersionRef.current = msg.file_version;
            setFileVersion(msg.file_version);
            // The "host changed the video" banner is only meaningful until
            // the user has re-verified against the new file.
            setFileChangedNotice(false);
          }
          break;
        case 'file_changed':
          // Host changed file, reset everyone's state
          fileVersionRef.current = msg.file_version || 0;
          setFileVersion(msg.file_version || 0);
          setFileChangedNotice(true);
          setFileUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return null;
          });
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
        case 'room_closed': {
          clearInterval(graceTimerRef.current);
          const reasonMap: Record<string, string> = {
            host_left: 'The host left the room.',
            host_timeout: 'The host lost connection and did not return in time.',
            deleted: 'The room was deleted by the host.',
          };
          const text = reasonMap[msg.reason as string] || 'The room was closed.';
          navigate('/', { state: { flash: text } });
          break;
        }
        case 'error':
          if (msg.code === 'tab_replaced') {
            navigate('/', {
              state: {
                flash: 'You opened this room in another tab. This session was closed.',
              },
            });
          } else if (msg.code === 'rate_limited') {
            setControlNotice(msg.message || 'You are sending messages too quickly.');
            setTimeout(() => setControlNotice(''), 3000);
          } else if (msg.code === 'room_gone') {
            navigate('/', { state: { flash: 'The room no longer exists.' } });
          }
          break;
      }
    },
    [navigate]
  );

  const { send, isConnected, isReconnecting } = useWebSocket({
    roomId: roomId || '',
    onMessage: handleWsMessage,
    lastSeqRef,
    fileVersionRef,
    onFatalTicketError: (status) => {
      const reason =
        status === 403
          ? "You're no longer a participant of this room."
          : status === 404
          ? 'The room no longer exists.'
          : 'Could not connect to this room.';
      navigate('/', { state: { flash: reason } });
    },
  });

  const { handleSyncMessage, autoplayBlocked, resumePlayback } = useVideoSync({
    videoRef,
    send,
    fileVersionRef,
  });
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
    (url: string) => {
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

  const showNonHostHint = useCallback(() => {
    setControlNotice('Only the host can control playback.');
    setTimeout(() => setControlNotice(''), 2500);
  }, []);

  const handleVideoClickToggle = useCallback(() => {
    if (room?.host_id !== user?.id) {
      showNonHostHint();
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    const timeMs = Math.round(video.currentTime * 1000);
    if (video.paused) {
      video.play().catch(() => {});
      send('play', { current_time_ms: timeMs, file_version: fileVersionRef.current });
    } else {
      video.pause();
      send('pause', { current_time_ms: timeMs, file_version: fileVersionRef.current });
    }
  }, [room?.host_id, user?.id, send, showNonHostHint]);

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

  const handleLoadMoreChat = useCallback(async (): Promise<boolean> => {
    if (!roomId || !chatCursor) return false;
    try {
      const history = await getChatHistory(roomId, chatCursor);
      setMessages((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        const older = history.messages.filter((m) => !existing.has(m.id));
        return [...older, ...prev];
      });
      setChatCursor(history.next_cursor ?? null);
      setChatLoadError(false);
      return true;
    } catch {
      setChatLoadError(true);
      return false;
    }
  }, [roomId, chatCursor]);

  const handleRetryChatLoad = useCallback(async () => {
    if (!roomId) return;
    try {
      const history = await getChatHistory(roomId);
      setMessages(history.messages);
      setChatCursor(history.next_cursor ?? null);
      setChatLoadError(false);
    } catch {
      setChatLoadError(true);
    }
  }, [roomId]);

  const handleLeave = async () => {
    if (!roomId) return;
    const isHost = room?.host_id === user?.id;
    if (isHost) {
      const ok = window.confirm(
        'Leaving as the host will close the room for everyone. Continue?'
      );
      if (!ok) return;
    }
    clearInterval(graceTimerRef.current);
    try {
      await leaveRoom(roomId);
    } catch {
      // best-effort; still navigate away
    }
    navigate('/');
  };

  // Cleanup grace timer on unmount
  useEffect(() => {
    return () => clearInterval(graceTimerRef.current);
  }, []);

  // Revoke the active blob URL on unmount so leaving the room doesn't leak memory.
  const fileUrlRef = useRef<string | null>(null);
  fileUrlRef.current = fileUrl;
  useEffect(() => {
    return () => {
      if (fileUrlRef.current) URL.revokeObjectURL(fileUrlRef.current);
    };
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
            {/* Keep the code copyable and the connection indicator visible on
                every viewport. Only the verbose labels ("Room Code:",
                "Connected") collapse on mobile to save horizontal space. */}
            <span className="text-[10px] uppercase tracking-[0.1em] text-on-surface-variant flex items-center gap-2 min-w-0">
              <span className="hidden md:inline">Room Code:</span>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(room.room_code);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  } catch {
                    // Clipboard API blocked (insecure context, no permission).
                    // Don't lie to the user with "Copied!".
                  }
                }}
                className="text-primary-container hover:text-primary transition-colors cursor-pointer truncate"
                title="Click to copy"
                aria-label={`Room code ${room.room_code}. Click to copy.`}
              >
                {copied ? 'Copied!' : room.room_code}
              </button>
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isConnected ? 'bg-green-500' : 'bg-outline-variant'
                }`}
                title={isConnected ? 'Connected' : 'Not connected'}
                aria-label={isConnected ? 'Connected' : 'Not connected'}
              />
              {isConnected && (
                <span className="hidden md:inline text-green-500">Connected</span>
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

      {/* Persistent connectivity banner — sits below header, above main. */}
      {isReconnecting && !isConnected && (
        <div className="bg-error-container/30 border-b border-error/40 text-error text-xs uppercase tracking-widest text-center py-2 shrink-0">
          <span className="inline-block w-3 h-3 mr-2 align-middle border-2 border-error/40 border-t-error rounded-full animate-spin" />
          Reconnecting to server…
        </div>
      )}

      <main className="flex flex-1 overflow-hidden relative">
        {/* Ephemeral toasts (file_changed, non-host hint, rate-limit) */}
        {(controlNotice || fileChangedNotice) && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 pointer-events-none">
            {fileChangedNotice && (
              <div className="pointer-events-auto px-4 py-2 bg-surface-container/95 border border-primary-container/40 text-primary text-sm shadow-lg flex items-center gap-3">
                <span>The host changed the video. Please select the new file.</span>
                <button
                  onClick={() => setFileChangedNotice(false)}
                  className="text-on-surface-variant hover:text-on-surface cursor-pointer"
                  aria-label="Dismiss"
                >
                  ×
                </button>
              </div>
            )}
            {controlNotice && (
              <div className="pointer-events-auto px-4 py-2 bg-surface-container/95 border border-outline-variant/30 text-on-surface text-sm shadow-lg">
                {controlNotice}
              </div>
            )}
          </div>
        )}

        {/* Video area */}
        <section className="flex-1 md:flex-[3] flex flex-col relative">
          {/* Autoplay-blocked overlay — browser requires user gesture to start */}
          {autoplayBlocked && fileUrl && (
            <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center">
              <div className="text-center space-y-4">
                <div className="text-5xl">▶</div>
                <h2 className="text-xl font-bold text-on-surface">
                  Autoplay is blocked
                </h2>
                <p className="text-on-surface-variant max-w-xs mx-auto text-sm">
                  Your browser requires a click to start playback. Click below to join.
                </p>
                <button
                  onClick={resumePlayback}
                  className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-br from-primary-container to-[#0053da] text-on-primary-container font-bold uppercase text-xs tracking-widest active:scale-95 transition-all cursor-pointer"
                >
                  Click to play
                </button>
              </div>
            </div>
          )}

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
              hostFilePending={fileVersion === 0}
            />
          ) : (
            <VideoPlayer
              ref={videoRef}
              src={fileUrl}
              onCanPlay={handleVideoCanPlay}
              onError={handleVideoError}
              onClickToggle={handleVideoClickToggle}
            />
          )}

          {fileUrl && (
            <PlaybackControls
              videoRef={videoRef}
              isHost={room.host_id === user?.id}
              onPlay={handlePlay}
              onPause={handlePause}
              onSeek={handleSeek}
              videoReady={!!fileUrl}
              onNonHostControlAttempt={showNonHostHint}
            />
          )}
        </section>

        {/* Overlay backdrop for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Side panel: overlay on mobile, static on desktop, hidden in theater mode */}
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
                onLoadMore={handleLoadMoreChat}
                hasMore={!!chatCursor}
                loadError={chatLoadError}
                onRetryLoad={handleRetryChatLoad}
              />
            ) : (
              <ParticipantList
                participants={participants}
                hostId={room.host_id}
                currentUserId={user?.id}
              />
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
