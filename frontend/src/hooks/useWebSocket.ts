import { useCallback, useEffect, useRef, useState } from 'react';
import type { WsMessage } from '../types/ws';
import client from '../api/client';

interface UseWebSocketOptions {
  roomId: string;
  onMessage: (msg: WsMessage) => void;
}

export function useWebSocket({ roomId, onMessage }: UseWebSocketOptions) {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const reconnectAttempt = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>();
  const onMessageRef = useRef(onMessage);
  const intentionalClose = useRef(false);
  onMessageRef.current = onMessage;

  const connect = useCallback(async () => {
    if (intentionalClose.current) return;

    try {
      const { data } = await client.post('/auth/ws-ticket', { room_id: roomId });
      const ticket = data.ticket;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws/${roomId}?ticket=${ticket}`);

      ws.onopen = () => {
        setIsConnected(true);
        reconnectAttempt.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const msg: WsMessage = JSON.parse(event.data);
          // Don't reconnect if tab was replaced
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
        // Only reconnect if not intentionally closed
        if (!intentionalClose.current) {
          const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000);
          reconnectAttempt.current++;
          reconnectTimer.current = setTimeout(connect, delay);
        }
      };

      ws.onerror = () => {
        ws.close();
      };

      wsRef.current = ws;
    } catch {
      if (!intentionalClose.current) {
        const delay = Math.min(1000 * 2 ** reconnectAttempt.current, 30000);
        reconnectAttempt.current++;
        reconnectTimer.current = setTimeout(connect, delay);
      }
    }
  }, [roomId]);

  useEffect(() => {
    intentionalClose.current = false;
    connect();
    return () => {
      intentionalClose.current = true;
      clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const send = useCallback((type: string, payload: Record<string, any> = {}): boolean => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, ...payload }));
      return true;
    }
    return false;
  }, []);

  return { send, isConnected };
}
