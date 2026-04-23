import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsMessage } from '../types/ws';
import client from '../api/client';

interface UseWebSocketOptions {
  roomId: string;
  onMessage: (msg: WsMessage) => void;
  lastSeqRef?: React.MutableRefObject<number>;
  fileVersionRef?: React.MutableRefObject<number>;
}

export function useWebSocket({ roomId, onMessage, lastSeqRef, fileVersionRef }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onMessageRef = useRef(onMessage);
  const intentionalClose = useRef(false);
  const hasConnectedBefore = useRef(false);
  const mountIdRef = useRef(0);
  const connectRef = useRef<(() => Promise<void>) | undefined>(undefined);
  onMessageRef.current = onMessage;

  // Store connect in a ref to allow self-referencing in onclose without lint issues
  const connect = useCallback(async () => {
    const myMountId = mountIdRef.current;
    if (intentionalClose.current) return;

    try {
      const { data } = await client.post('/auth/ws-ticket', { room_id: roomId });
      if (intentionalClose.current || myMountId !== mountIdRef.current) return;
      const ticket = data.ticket;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${roomId}?ticket=${ticket}`);

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempt.current = 0;
        if (hasConnectedBefore.current) {
          ws.send(JSON.stringify({
            type: 'reconnect',
            last_seq: lastSeqRef?.current ?? 0,
            file_version: fileVersionRef?.current ?? 0,
          }));
        }
        hasConnectedBefore.current = true;
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          if (msg.type === 'error' && msg.code === 'tab_replaced') {
            intentionalClose.current = true;
          }
          onMessageRef.current(msg);
        } catch {
          // Invalid JSON
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        if (!intentionalClose.current && myMountId === mountIdRef.current) {
          const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000);
          reconnectAttempt.current++;
          reconnectTimer.current = setTimeout(() => connectRef.current?.(), delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      if (!intentionalClose.current && myMountId === mountIdRef.current) {
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000);
        reconnectAttempt.current++;
        reconnectTimer.current = setTimeout(() => connectRef.current?.(), delay);
      }
    }
    // lastSeqRef and fileVersionRef are stable refs, not reactive deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  connectRef.current = connect;

  useEffect(() => {
    mountIdRef.current++;
    intentionalClose.current = false;
    hasConnectedBefore.current = false;
    connect();
    return () => {
      intentionalClose.current = true;
      clearTimeout(reconnectTimer.current);
      const ws = wsRef.current;
      if (ws) {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
        wsRef.current = null;
      }
    };
  }, [connect]);

  const send = useCallback((type: string, payload: Record<string, unknown> = {}): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
      return true;
    }
    return false;
  }, []);

  return { send, isConnected };
}
