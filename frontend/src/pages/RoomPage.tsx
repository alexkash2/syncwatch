import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { getChatHistory, leaveRoom } from '../api/rooms';
import { VideoArea } from '../components/room/VideoArea';
import { RoomHeader } from '../components/room/RoomHeader';
import { RoomSidebar } from '../components/room/RoomSidebar';
import { Button } from '../components/ui/Button';
import { BrandMarkIcon } from '../components/ui/icons';
import { StatePanel } from '../components/ui/StatePanel';
import { useAuth } from '../hooks/useAuth';
import { usePreferences } from '../hooks/usePreferences';
import { useUi } from '../hooks/useUi';
import { useLoadRoom } from '../hooks/useLoadRoom';
import { useRoomWsHandler } from '../hooks/useRoomWsHandler';
import { useVideoSync } from '../hooks/useVideoSync';
import { useWebSocket } from '../hooks/useWebSocket';
import { useRoomStore } from '../store/roomStore';
import { getHomeArrivalNotice } from '../types/navigation';
import type { RoomDetail } from '../types/room';
import type {
  FileVerifyResult,
  ReferenceFileState,
  RoomStatus,
  SyncRelatedMessage,
} from '../types/ws';

const EMPTY_REFERENCE_FILE: ReferenceFileState = {
  fileName: null,
  fileVersion: 0,
};

interface SessionNotice {
  tone: 'warning' | 'success';
  title: string;
  description: string;
}

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { confirm, pushToast } = useUi();
  const { preferences } = usePreferences();

  const participants = useRoomStore((state) => state.participants);
  const setParticipants = useRoomStore((state) => state.setParticipants);

  const messages = useRoomStore((state) => state.messages);
  const setMessages = useRoomStore((state) => state.setMessages);
  const addMessage = useRoomStore((state) => state.addMessage);

  const fileUrl = useRoomStore((state) => state.fileUrl);
  const setFileUrl = useRoomStore((state) => state.setFileUrl);

  const fileVersion = useRoomStore((state) => state.fileVersion);
  const setFileVersion = useRoomStore((state) => state.setFileVersion);

  const hostDisconnected = useRoomStore((state) => state.hostDisconnected);
  const setHostDisconnected = useRoomStore((state) => state.setHostDisconnected);

  const graceCountdown = useRoomStore((state) => state.graceCountdown);
  const setGraceCountdown = useRoomStore((state) => state.setGraceCountdown);

  const chatCursor = useRoomStore((state) => state.chatCursor);
  const setChatCursor = useRoomStore((state) => state.setChatCursor);

  const chatLoadError = useRoomStore((state) => state.chatLoadError);
  const setChatLoadError = useRoomStore((state) => state.setChatLoadError);

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'participants'>('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [verifyResult, setVerifyResult] = useState<FileVerifyResult | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus>('waiting_file');
  const [referenceFile, setReferenceFile] = useState<ReferenceFileState>(EMPTY_REFERENCE_FILE);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [interactionHint, setInteractionHint] = useState<string | null>(null);
  const [sessionNotice, setSessionNotice] = useState<SessionNotice | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSeqRef = useRef<number | null>(null);
  const fileVersionRef = useRef(0);
  const syncMessageRef = useRef<(message: SyncRelatedMessage) => void>(() => {});
  const fileUrlRef = useRef<string | null>(null);
  const interactionHintTimerRef = useRef<number | null>(null);
  const sessionNoticeTimerRef = useRef<number | null>(null);
  const previousConnectionStateRef = useRef<'connected' | 'connecting' | 'reconnecting' | null>(
    null
  );
  const previousHostDisconnectedRef = useRef(false);

  fileUrlRef.current = fileUrl;

  useEffect(() => {
    fileVersionRef.current = fileVersion;
  }, [fileVersion]);

  useLoadRoom({
    roomId: roomId || '',
    setRoom,
    setParticipants,
    setMessages,
    setChatCursor,
    setChatLoadError,
    setLoading,
    navigate,
  });

  const clearPlaybackState = useCallback(() => {
    setVideoReady(false);
    setVideoError(null);
  }, []);

  const handleWsMessage = useRoomWsHandler({
    navigate,
    setParticipants,
    addMessage,
    setFileUrl,
    setFileVersion,
    fileVersionRef,
    setHostDisconnected,
    setGraceCountdown,
    setVerifyResult,
    setRoomStatus,
    setReferenceFile,
    clearPlaybackState,
    onSyncMessage: (message) => syncMessageRef.current(message),
  });

  const { send, isConnected, isReconnecting } = useWebSocket({
    roomId: roomId || '',
    onMessage: handleWsMessage,
    lastSeqRef,
    fileVersionRef,
    onFatalTicketError: (status) => {
      const arrivalNotice = getHomeArrivalNotice(
        status === 403
          ? 'access_lost'
          : status === 404
          ? 'room_not_found'
          : 'room_connection_failed'
      );

      navigate('/', { state: { arrivalNotice } });
    },
  });
  const connectionState = isConnected
    ? 'connected'
    : isReconnecting
    ? 'reconnecting'
    : 'connecting';

  const clearSessionNoticeTimer = useCallback(() => {
    if (sessionNoticeTimerRef.current !== null) {
      window.clearTimeout(sessionNoticeTimerRef.current);
      sessionNoticeTimerRef.current = null;
    }
  }, []);

  const showTimedSessionNotice = useCallback(
    (notice: SessionNotice, durationMs = 3200) => {
      clearSessionNoticeTimer();
      setSessionNotice(notice);
      sessionNoticeTimerRef.current = window.setTimeout(() => {
        setSessionNotice(null);
        sessionNoticeTimerRef.current = null;
      }, durationMs);
    },
    [clearSessionNoticeTimer]
  );

  const { handleSyncMessage, autoplayBlocked, resumePlayback } = useVideoSync({
    videoRef,
    send,
    fileVersion,
  });

  useEffect(() => {
    syncMessageRef.current = handleSyncMessage;
  }, [handleSyncMessage]);

  const handleVerifyRequest = useCallback(
    (hash: string, size: number, durationMs: number, fileName: string) => {
      setVerifyResult(null);
      clearPlaybackState();
      send('file_verify_request', {
        file_hash: hash,
        file_size: size,
        file_duration_ms: durationMs,
        file_name: fileName,
      });
    },
    [clearPlaybackState, send]
  );

  const handleFileVerified = useCallback(
    (url: string) => {
      clearPlaybackState();
      setFileUrl(url);
    },
    [clearPlaybackState, setFileUrl]
  );

  const handleVideoCanPlay = useCallback(() => {
    setVideoReady(true);
    setVideoError(null);
    send('ready', { file_version: fileVersion });
  }, [fileVersion, send]);

  const handleVideoError = useCallback(
    (errorCode: string) => {
      setVideoError(errorCode);
      send('playback_error', { error_code: errorCode });
    },
    [send]
  );

  const showInteractionHint = useCallback((message = 'Only the host can control playback.') => {
    if (interactionHintTimerRef.current !== null) {
      window.clearTimeout(interactionHintTimerRef.current);
    }

    setInteractionHint(message);
    interactionHintTimerRef.current = window.setTimeout(() => {
      setInteractionHint(null);
    }, 2200);
  }, []);

  const handleVideoClickToggle = useCallback(() => {
    if (room?.host_id !== user?.id) {
      showInteractionHint();
      return;
    }

    const video = videoRef.current;
    if (!video) {
      return;
    }

    const timeMs = Math.round(video.currentTime * 1000);

    if (video.paused) {
      video.play().catch(() => {});
      send('play', { current_time_ms: timeMs, file_version: fileVersion });
      setRoomStatus('playing');
    } else {
      video.pause();
      send('pause', { current_time_ms: timeMs, file_version: fileVersion });
      setRoomStatus('paused');
    }
  }, [fileVersion, room?.host_id, send, showInteractionHint, user?.id]);

  const handlePlay = useCallback(
    (timeMs: number) => {
      setRoomStatus('playing');
      return send('play', { current_time_ms: timeMs, file_version: fileVersion });
    },
    [fileVersion, send]
  );

  const handlePause = useCallback(
    (timeMs: number) => {
      setRoomStatus('paused');
      return send('pause', { current_time_ms: timeMs, file_version: fileVersion });
    },
    [fileVersion, send]
  );

  const handleSeek = useCallback(
    (timeMs: number) => send('seek', { current_time_ms: timeMs, file_version: fileVersion }),
    [fileVersion, send]
  );

  const handleSendChat = useCallback((content: string) => send('chat_send', { content }), [send]);

  const handleLoadMoreChat = useCallback(async (): Promise<boolean> => {
    if (!roomId || !chatCursor) {
      return false;
    }

    try {
      const history = await getChatHistory(roomId, chatCursor);
      setMessages((current) => {
        const existing = new Set(current.map((message) => message.id));
        const older = history.messages.filter((message) => !existing.has(message.id));
        return [...older, ...current];
      });
      setChatCursor(history.next_cursor ?? null);
      setChatLoadError(false);
      return true;
    } catch {
      setChatLoadError(true);
      return false;
    }
  }, [chatCursor, roomId, setChatCursor, setChatLoadError, setMessages]);

  const handleRetryChatLoad = useCallback(async () => {
    if (!roomId) {
      return;
    }

    try {
      const history = await getChatHistory(roomId);
      setMessages(history.messages);
      setChatCursor(history.next_cursor ?? null);
      setChatLoadError(false);
    } catch {
      setChatLoadError(true);
    }
  }, [roomId, setChatCursor, setChatLoadError, setMessages]);

  const handleLeave = useCallback(async () => {
    if (!roomId) {
      return;
    }

    const isHost = room?.host_id === user?.id;
    if (isHost) {
      const confirmed = await confirm({
        eyebrow: 'Leave As Host',
        title: 'Close the room for everyone?',
        description:
          'Leaving as host ends the synced session and disconnects every participant in the room.',
        confirmLabel: 'Leave room',
        cancelLabel: 'Stay here',
        tone: 'danger',
      });

      if (!confirmed) {
        return;
      }
    } else if (preferences.confirmViewerLeave) {
      const confirmed = await confirm({
        eyebrow: 'Leave Room',
        title: 'Leave this synced session?',
        description:
          'You will return to the dashboard and can rejoin later from your recent rooms if the session is still active.',
        confirmLabel: 'Leave room',
        cancelLabel: 'Stay here',
        tone: 'warning',
      });

      if (!confirmed) {
        return;
      }
    }

    try {
      await leaveRoom(roomId);
      pushToast({
        tone: 'primary',
        title: isHost ? 'Room closed' : 'You left the room',
        description: isHost
          ? 'The synced session was closed for everyone.'
          : 'You can rejoin later from the dashboard.',
      });
    } finally {
      navigate('/');
    }
  }, [
    confirm,
    navigate,
    preferences.confirmViewerLeave,
    pushToast,
    room?.host_id,
    roomId,
    user?.id,
  ]);

  useEffect(() => {
    const previousConnectionState = previousConnectionStateRef.current;

    if (previousConnectionState === null) {
      previousConnectionStateRef.current = connectionState;
      return;
    }

    if (previousConnectionState === connectionState) {
      return;
    }

    if (connectionState === 'reconnecting') {
      clearSessionNoticeTimer();
      setSessionNotice({
        tone: 'warning',
        title: 'Reconnecting to the live room',
        description:
          'SyncWatch is restoring the room channel without discarding your local file or playback position.',
      });
    } else if (previousConnectionState === 'reconnecting' && connectionState === 'connected') {
      showTimedSessionNotice(
        {
          tone: 'success',
          title: 'Connection restored',
          description: 'Realtime sync is back and the room timeline is current again.',
        },
        3400
      );
      pushToast({
        tone: 'success',
        title: 'Connection restored',
        description: 'The live room link is healthy again.',
        durationMs: 3200,
      });
    } else if (connectionState === 'connected') {
      clearSessionNoticeTimer();
      setSessionNotice(null);
    }

    previousConnectionStateRef.current = connectionState;
  }, [clearSessionNoticeTimer, connectionState, pushToast, showTimedSessionNotice]);

  useEffect(() => {
    const previousHostDisconnected = previousHostDisconnectedRef.current;

    if (!previousHostDisconnected && hostDisconnected) {
      clearSessionNoticeTimer();
      setSessionNotice(null);
    }

    if (previousHostDisconnected && !hostDisconnected) {
      showTimedSessionNotice(
        {
          tone: 'success',
          title: 'Host is back in the room',
          description:
            'The session stayed preserved, and shared playback control is available again.',
        },
        3600
      );
      pushToast({
        tone: 'success',
        title: 'Host reconnected',
        description: 'The room recovered without losing its current state.',
        durationMs: 3400,
      });
    }

    previousHostDisconnectedRef.current = hostDisconnected;
  }, [clearSessionNoticeTimer, hostDisconnected, pushToast, showTimedSessionNotice]);

  useEffect(() => {
    return () => {
      if (interactionHintTimerRef.current !== null) {
        window.clearTimeout(interactionHintTimerRef.current);
      }
      if (sessionNoticeTimerRef.current !== null) {
        window.clearTimeout(sessionNoticeTimerRef.current);
      }
      if (fileUrlRef.current) {
        URL.revokeObjectURL(fileUrlRef.current);
      }
    };
  }, []);

  const readyCount = participants.filter((participant) => participant.is_ready).length;
  const isHost = room?.host_id === user?.id;

  if (loading) {
    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden bg-surface px-4 text-on-surface">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,98,255,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(180,197,255,0.14),transparent_24%),linear-gradient(180deg,#090909_0%,#111111_45%,#151515_100%)]" />
        </div>
        <StatePanel
          eyebrow="Preparing Room"
          title="Loading the synced session"
          description="Restoring room details, participant presence and recent chat before the player opens."
          icon={<BrandMarkIcon size={26} />}
          tone="primary"
          className="relative z-10 w-full max-w-md"
          aria-live="polite"
        />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="relative flex h-screen items-center justify-center overflow-hidden bg-surface px-4 text-on-surface">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,98,255,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(180,197,255,0.14),transparent_24%),linear-gradient(180deg,#090909_0%,#111111_45%,#151515_100%)]" />
        </div>
        <StatePanel
          eyebrow="Room Unavailable"
          title="This session is no longer open"
          description="The room may have been removed, or your access to it has changed. You can safely return to the dashboard."
          icon={<BrandMarkIcon size={26} />}
          tone="warning"
          className="relative z-10 w-full max-w-md"
          actions={
            <Button variant="primary" size="md" onClick={() => navigate('/')}>
              Back to dashboard
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-surface text-on-surface">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(0,98,255,0.16),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(180,197,255,0.14),transparent_24%),linear-gradient(180deg,#090909_0%,#111111_45%,#151515_100%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:36px_36px] opacity-25" />
      </div>

      <div className="relative z-10 flex h-full flex-col">
        <RoomHeader
          roomName={room.name}
          roomCode={room.room_code}
          connectionState={connectionState}
          isHost={Boolean(isHost)}
          roomStatus={roomStatus}
          readyParticipants={readyCount}
          totalParticipants={participants.length}
          sidebarOpen={sidebarOpen}
          onLeave={handleLeave}
          onToggleSidebar={() => setSidebarOpen((current) => !current)}
        />

        <main className="flex min-h-0 flex-1 overflow-hidden px-3 pb-3 md:px-4 md:pb-4">
          <div className="flex min-h-0 flex-1 gap-3 md:gap-4">
            <VideoArea
              roomStatus={roomStatus}
              fileUrl={fileUrl}
              videoRef={videoRef}
              isHost={Boolean(isHost)}
              connectionState={connectionState}
              hostDisconnected={hostDisconnected}
              graceCountdown={graceCountdown}
              referenceFileName={referenceFile.fileName}
              videoError={videoError}
              videoReady={videoReady}
              readyParticipants={readyCount}
              totalParticipants={participants.length}
              autoplayBlocked={autoplayBlocked}
              interactionHint={interactionHint}
              sessionNotice={sessionNotice}
              onResumePlayback={resumePlayback}
              onNonHostControlAttempt={showInteractionHint}
              onFileVerified={handleFileVerified}
              onVerifyRequest={handleVerifyRequest}
              onVideoCanPlay={handleVideoCanPlay}
              onVideoError={handleVideoError}
              onVideoClickToggle={handleVideoClickToggle}
              onPlay={handlePlay}
              onPause={handlePause}
              onSeek={handleSeek}
              verifyResult={verifyResult}
            />

            <RoomSidebar
              roomName={room.name}
              roomCode={room.room_code}
              connectionState={connectionState}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              sidebarOpen={sidebarOpen}
              closeSidebar={() => setSidebarOpen(false)}
              participants={participants}
              messages={messages}
              currentUserId={user?.id || ''}
              hostId={room.host_id}
              onSendChat={handleSendChat}
              onLoadMoreChat={handleLoadMoreChat}
              hasMoreChat={chatCursor !== null}
              chatLoadError={chatLoadError}
              onRetryChatLoad={handleRetryChatLoad}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
