import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
} from 'react';
import { createWsTicket } from '../api/auth';
import { useRoomStore } from '../store/roomStore';
import type { WsMessage } from '../types/ws';

interface WebSocketOptions {
  roomId: string;
  onMessage: (msg: WsMessage) => void;
  lastSeqRef: MutableRefObject<number | null>;
  fileVersionRef: MutableRefObject<number>;
  onFatalTicketError?: (status: number) => void;
}

export function useWebSocket({
  roomId,
  onMessage,
  lastSeqRef,
  fileVersionRef,
  onFatalTicketError,
}: WebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const connectRef = useRef<() => Promise<void>>(async () => {});
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reconnectAttemptRef = useRef(0);
  const shouldReconnectRef = useRef(true);
  const intentionalCloseRef = useRef(false);
  const hasConnectedRef = useRef(false);
  const mountIdRef = useRef(0);
  const onMessageRef = useRef(onMessage);
  const onFatalRef = useRef(onFatalTicketError);
  const resetRoom = useRoomStore((state) => state.resetRoom);

  useEffect(() => {
    onMessageRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    onFatalRef.current = onFatalTicketError;
  }, [onFatalTicketError]);

  const scheduleReconnect = useCallback(() => {
    if (
      !shouldReconnectRef.current ||
      intentionalCloseRef.current ||
      reconnectTimeoutRef.current !== null
    ) {
      return;
    }

    const timeoutMs = Math.min(1000 * 2 ** reconnectAttemptRef.current, 30000);
    reconnectAttemptRef.current += 1;
    setIsReconnecting(true);

    reconnectTimeoutRef.current = window.setTimeout(() => {
      reconnectTimeoutRef.current = null;
      void connectRef.current();
    }, timeoutMs);
  }, []);

  const connect = useCallback(async () => {
    if (!roomId || !shouldReconnectRef.current || intentionalCloseRef.current) {
      return;
    }

    const currentMountId = mountIdRef.current;

    try {
      const ticket = await createWsTicket(roomId);

      if (
        !shouldReconnectRef.current ||
        intentionalCloseRef.current ||
        currentMountId !== mountIdRef.current
      ) {
        return;
      }

      const nextWebSocket = new WebSocket(buildWsUrl(roomId, ticket));
      wsRef.current = nextWebSocket;

      nextWebSocket.onopen = () => {
        reconnectAttemptRef.current = 0;
        setIsConnected(true);
        setIsReconnecting(false);

        // Capture before the reset below so the reconnect payload uses the
        // last seq from the previous socket, not the cleared value.
        const seqForReconnect = lastSeqRef.current ?? 0;

        if (hasConnectedRef.current) {
          nextWebSocket.send(
            JSON.stringify({
              type: 'reconnect',
              last_seq: seqForReconnect,
              file_version: fileVersionRef.current,
            })
          );
        }

        // Reset seq dedup on every fresh socket. The backend's per-room
        // counter resets when the room drains or the process restarts, so a
        // new session can hand us a smaller seq than the previous session's
        // last value — without this, the initial room_state on the new socket
        // would be silently dropped and the client would never rehydrate.
        lastSeqRef.current = null;
        hasConnectedRef.current = true;
      };

      nextWebSocket.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);

          if (
            msg.seq !== undefined &&
            lastSeqRef.current !== null &&
            msg.seq <= lastSeqRef.current
          ) {
            return;
          }

          if (msg.seq !== undefined) {
            lastSeqRef.current = msg.seq;
          }

          if (msg.type === 'error' && msg.code === 'tab_replaced') {
            intentionalCloseRef.current = true;
          }

          onMessageRef.current(msg);
        } catch (error) {
          console.error('Failed to parse websocket message:', error);
        }
      };

      nextWebSocket.onerror = () => {
        nextWebSocket.close();
      };

      nextWebSocket.onclose = () => {
        if (wsRef.current === nextWebSocket) {
          wsRef.current = null;
        }

        setIsConnected(false);

        if (
          shouldReconnectRef.current &&
          !intentionalCloseRef.current &&
          currentMountId === mountIdRef.current
        ) {
          scheduleReconnect();
        } else {
          setIsReconnecting(false);
        }
      };
    } catch (error) {
      const status = (error as { response?: { status?: number } })?.response?.status;

      if (
        status !== undefined &&
        status >= 400 &&
        status < 500 &&
        status !== 401 &&
        status !== 429
      ) {
        intentionalCloseRef.current = true;
        shouldReconnectRef.current = false;
        setIsConnected(false);
        setIsReconnecting(false);
        onFatalRef.current?.(status);
        return;
      }

      console.error('Failed to connect websocket:', error);
      setIsConnected(false);
      scheduleReconnect();
    }
  }, [fileVersionRef, lastSeqRef, roomId, scheduleReconnect]);

  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    if (!roomId) {
      return;
    }

    mountIdRef.current += 1;
    shouldReconnectRef.current = true;
    intentionalCloseRef.current = false;
    hasConnectedRef.current = false;
    reconnectAttemptRef.current = 0;

    const connectTimeoutId = window.setTimeout(() => {
      void connect();
    }, 0);

    return () => {
      shouldReconnectRef.current = false;
      intentionalCloseRef.current = true;
      window.clearTimeout(connectTimeoutId);

      if (reconnectTimeoutRef.current !== null) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      wsRef.current?.close();
      wsRef.current = null;
      setIsConnected(false);
      setIsReconnecting(false);
      resetRoom();
    };
  }, [connect, resetRoom, roomId]);

  const send = useCallback(
    (type: string, payload: Record<string, unknown> = {}) => {
      const ws = wsRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return false;
      }

      const message: Record<string, unknown> = {
        type,
        ...payload,
      };

      if (message.file_version === undefined) {
        message.file_version = fileVersionRef.current;
      }

      ws.send(JSON.stringify(message));
      return true;
    },
    [fileVersionRef]
  );

  return { send, isConnected, isReconnecting };
}

function normalizeWsBaseUrl(rawUrl?: string) {
  if (rawUrl) {
    const trimmed = rawUrl.replace(/\/$/, '');
    return trimmed.endsWith('/ws') ? trimmed : `${trimmed}/ws`;
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

function buildWsUrl(roomId: string, ticket: string) {
  const wsBaseUrl = normalizeWsBaseUrl(import.meta.env.VITE_WS_URL);
  return `${wsBaseUrl}/${roomId}?ticket=${encodeURIComponent(ticket)}`;
}
