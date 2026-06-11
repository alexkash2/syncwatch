import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { getChatHistory, leaveRoom } from '../api/rooms';
import { clearPersistedRoomFile } from '../utils/persistentFileHandle';
import { VideoArea } from '../components/room/VideoArea';
import { RoomHeader } from '../components/room/RoomHeader';
import { RoomSidebar } from '../components/room/RoomSidebar';
import { ChatPanel } from '../components/room/ChatPanel';
import { ParticipantList } from '../components/room/ParticipantList';
import { MobileRoomHeader, MobileTabs } from '../components/room/MobileRoom';
import { Button } from '../components/ui/Button';
import { LogoIcon } from '../components/ui/icons';
import { Spinner } from '../components/ui/Spinner';
import { StatePanel } from '../components/ui/StatePanel';
import { useAuth } from '../hooks/useAuth';
import { useI18n } from '../hooks/useI18n';
import { useIsMobile } from '../hooks/useIsMobile';
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

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { confirm, pushToast } = useUi();
  const { t } = useI18n();
  const isMobile = useIsMobile();

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
  const [verifyResult, setVerifyResult] = useState<FileVerifyResult | null>(null);
  const [roomStatus, setRoomStatus] = useState<RoomStatus>('waiting_file');
  const [referenceFile, setReferenceFile] = useState<ReferenceFileState>(EMPTY_REFERENCE_FILE);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoReady, setVideoReady] = useState(false);
  const [interactionHint, setInteractionHint] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSeqRef = useRef<number | null>(null);
  const fileVersionRef = useRef(0);
  const syncMessageRef = useRef<(message: SyncRelatedMessage) => void>(() => {});
  const fileUrlRef = useRef<string | null>(null);
  const interactionHintTimerRef = useRef<number | null>(null);
  // Initialised to 'connecting' so the very first observed 'reconnecting' is not
  // silently swallowed as the baseline (P2-9).
  const previousConnectionStateRef = useRef<'connected' | 'connecting' | 'reconnecting' | null>(
    'connecting'
  );
  const previousHostDisconnectedRef = useRef(false);
  const announcedReadyVersionRef = useRef<number | null>(null);

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
    announcedReadyVersionRef.current = null;
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
      navigate('/create', { state: { arrivalNotice } });
    },
  });
  const connectionState = isConnected
    ? 'connected'
    : isReconnecting
    ? 'reconnecting'
    : 'connecting';

  const { handleSyncMessage, autoplayBlocked, resumePlayback, resyncToLastState } = useVideoSync({
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
      return send('file_verify_request', {
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

  // Host wants a different file: drop the local one and return to the selector.
  // The server keeps the old reference until the new file is verified, at which
  // point it bumps file_version and broadcasts file_changed to the viewers.
  const handleChangeFile = useCallback(() => {
    if (roomId) {
      // Forget the persisted handle, otherwise the selector's auto-restore
      // would immediately re-load the file we're trying to replace.
      void clearPersistedRoomFile(roomId);
    }
    setVerifyResult(null);
    setFileUrl(null);
  }, [roomId, setFileUrl]);

  const announceLocalFileReady = useCallback(() => {
    const readyVersion = fileVersionRef.current || fileVersion;
    if (readyVersion <= 0) {
      return false;
    }
    const sent = send('ready', { file_version: readyVersion });
    if (sent) {
      announcedReadyVersionRef.current = readyVersion;
    }
    return sent;
  }, [fileVersion, send]);

  const handleVideoCanPlay = useCallback(() => {
    setVideoReady(true);
    setVideoError(null);
    announceLocalFileReady();
    // Re-apply the last known sync snapshot so a reconnect-while-playing resumes
    // instead of freezing (P2-2/P2-3).
    resyncToLastState();
  }, [announceLocalFileReady, resyncToLastState]);

  useEffect(() => {
    if (!isConnected) {
      announcedReadyVersionRef.current = null;
      return;
    }
    const video = videoRef.current;
    const readyVersion = fileVersionRef.current;
    if (
      !fileUrl ||
      videoError ||
      readyVersion <= 0 ||
      announcedReadyVersionRef.current === readyVersion ||
      !video ||
      video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      return;
    }
    announceLocalFileReady();
  }, [announceLocalFileReady, fileUrl, isConnected, videoError]);

  const handleVideoError = useCallback(
    (errorCode: string) => {
      setVideoError(errorCode);
      send('playback_error', { error_code: errorCode });
    },
    [send]
  );

  // Anyone can drive playback (backend permits it; only the host closes the
  // room). Disabled while the host is gone (autopaused grace window) so controls
  // can't fight the host-disconnected overlay.
  const canControl = Boolean(fileUrl) && !hostDisconnected;

  const showInteractionHint = useCallback(
    (message: string = t.hint_load_file) => {
      if (interactionHintTimerRef.current !== null) {
        window.clearTimeout(interactionHintTimerRef.current);
      }
      setInteractionHint(message);
      interactionHintTimerRef.current = window.setTimeout(() => {
        setInteractionHint(null);
      }, 2200);
    },
    [t.hint_load_file]
  );

  const handleVideoClickToggle = useCallback(() => {
    if (!canControl) {
      showInteractionHint();
      return;
    }
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const timeMs = Math.round(video.currentTime * 1000);
    // Send FIRST and only mutate the local element when the socket accepted it.
    // If send() returns false (socket dropped) we neither play/pause locally nor
    // flip roomStatus, so this client can't drift ahead of the shared timeline.
    if (video.paused) {
      if (send('play', { current_time_ms: timeMs, file_version: fileVersion })) {
        video.play().catch(() => {});
        setRoomStatus('playing');
      }
    } else {
      if (send('pause', { current_time_ms: timeMs, file_version: fileVersion })) {
        video.pause();
        setRoomStatus('paused');
      }
    }
  }, [canControl, fileVersion, send, showInteractionHint]);

  const handlePlay = useCallback(
    (timeMs: number) => {
      const sent = send('play', { current_time_ms: timeMs, file_version: fileVersion });
      if (sent) {
        setRoomStatus('playing');
      }
      return sent;
    },
    [fileVersion, send]
  );

  const handlePause = useCallback(
    (timeMs: number) => {
      const sent = send('pause', { current_time_ms: timeMs, file_version: fileVersion });
      if (sent) {
        setRoomStatus('paused');
      }
      return sent;
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

  const isHost = room?.host_id === user?.id;

  const handleLeave = useCallback(async () => {
    if (!roomId) {
      return;
    }
    if (isHost) {
      const confirmed = await confirm({
        title: t.leave_host_q,
        description: t.leave_host_sub,
        confirmLabel: t.leave_host,
        cancelLabel: t.stay_here,
        tone: 'danger',
      });
      if (!confirmed) {
        return;
      }
    }
    try {
      await leaveRoom(roomId);
      pushToast({
        tone: isHost ? 'primary' : 'success',
        title: isHost ? t.toast_closed_title : t.toast_left_title,
        description: isHost ? t.toast_closed_sub : t.toast_left_sub,
      });
    } finally {
      navigate('/create');
    }
  }, [confirm, isHost, navigate, pushToast, roomId, t]);

  // Connection recovery toast (reconnecting → connected).
  useEffect(() => {
    const previous = previousConnectionStateRef.current;
    if (previous === connectionState) {
      return;
    }
    if (previous === 'reconnecting' && connectionState === 'connected') {
      pushToast({
        tone: 'success',
        title: t.toast_conn_restored_title,
        description: t.toast_conn_restored_sub,
        durationMs: 3200,
      });
    }
    previousConnectionStateRef.current = connectionState;
  }, [connectionState, pushToast, t]);

  // Host reconnected toast.
  useEffect(() => {
    const previous = previousHostDisconnectedRef.current;
    if (previous && !hostDisconnected) {
      pushToast({
        tone: 'success',
        title: t.toast_host_back_title,
        description: t.toast_host_back_sub,
        durationMs: 3400,
      });
    }
    previousHostDisconnectedRef.current = hostDisconnected;
  }, [hostDisconnected, pushToast, t]);

  useEffect(() => {
    return () => {
      if (interactionHintTimerRef.current !== null) {
        window.clearTimeout(interactionHintTimerRef.current);
      }
      if (fileUrlRef.current) {
        URL.revokeObjectURL(fileUrlRef.current);
      }
    };
  }, []);

  const readyCount = participants.filter((participant) => participant.is_ready).length;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg px-4">
        <StatePanel
          eyebrow="SyncWatch"
          title={t.loading_room}
          description={t.loading_room_sub}
          icon={<Spinner size={26} tone="ink" />}
          tone="primary"
          className="w-full max-w-md"
        />
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg px-4">
        <StatePanel
          eyebrow="SyncWatch"
          title={t.room_unavailable_title}
          description={t.room_unavailable_sub}
          icon={<LogoIcon size={26} />}
          tone="warning"
          className="w-full max-w-md"
          actions={
            <Button variant="primary" size="md" onClick={() => navigate('/create')}>
              {t.back_to_dashboard}
            </Button>
          }
        />
      </div>
    );
  }

  const videoArea = (
    <VideoArea
      roomId={room.id}
      roomStatus={roomStatus}
      fileUrl={fileUrl}
      videoRef={videoRef}
      isHost={Boolean(isHost)}
      canControl={canControl}
      connectionState={connectionState}
      hostDisconnected={hostDisconnected}
      graceCountdown={graceCountdown}
      referenceFileName={referenceFile.fileName}
      referenceFileVersion={referenceFile.fileVersion}
      videoError={videoError}
      videoReady={videoReady}
      readyParticipants={readyCount}
      totalParticipants={participants.length}
      autoplayBlocked={autoplayBlocked}
      interactionHint={interactionHint}
      mobile={isMobile}
      onResumePlayback={resumePlayback}
      onBlockedControlAttempt={showInteractionHint}
      onFileVerified={handleFileVerified}
      onVerifyRequest={handleVerifyRequest}
      onVideoCanPlay={handleVideoCanPlay}
      onVideoError={handleVideoError}
      onVideoClickToggle={handleVideoClickToggle}
      onChangeFile={handleChangeFile}
      onPlay={handlePlay}
      onPause={handlePause}
      onSeek={handleSeek}
      verifyResult={verifyResult}
    />
  );

  if (isMobile) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-surface text-ink">
        <MobileRoomHeader
          roomName={room.name}
          roomCode={room.room_code}
          isHost={Boolean(isHost)}
          connectionState={connectionState}
          readyParticipants={readyCount}
          totalParticipants={participants.length}
          onLeave={handleLeave}
        />
        {videoArea}
        <MobileTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          chatCount={messages.length}
          peopleCount={participants.length}
        />
        <main
          id="main"
          className="flex min-h-0 flex-1 flex-col"
          role="tabpanel"
          aria-labelledby={`mobile-room-tab-${activeTab}`}
        >
          <h1 className="sr-only">{room.name}</h1>
          {activeTab === 'chat' ? (
            <ChatPanel
              messages={messages}
              onSend={handleSendChat}
              currentUserId={user?.id || ''}
              onLoadMore={handleLoadMoreChat}
              hasMore={chatCursor !== null}
              loadError={chatLoadError}
              onRetryLoad={handleRetryChatLoad}
            />
          ) : (
            <ParticipantList
              participants={participants}
              hostId={room.host_id}
              currentUserId={user?.id || ''}
            />
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-bg text-ink">
      <RoomHeader
        roomName={room.name}
        roomCode={room.room_code}
        connectionState={connectionState}
        isHost={Boolean(isHost)}
        readyParticipants={readyCount}
        totalParticipants={participants.length}
        onLeave={handleLeave}
      />

      <main id="main" className="flex min-h-0 flex-1">
        <h1 className="sr-only">{room.name}</h1>
        {videoArea}
        <RoomSidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
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
      </main>
    </div>
  );
}
