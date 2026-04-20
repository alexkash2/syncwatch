import { memo, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage } from '../../types/ws';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (content: string) => boolean;
  currentUserId: string;
  onLoadMore?: () => Promise<boolean> | void;
  hasMore?: boolean;
  /** True if the last history fetch (initial or paginated) failed. */
  loadError?: boolean;
  /** Retry the initial history fetch. */
  onRetryLoad?: () => void | Promise<void>;
}

// Memoized row — the heavy case is long histories where unchanged rows
// shouldn't re-render when a single new message arrives.
const ChatRow = memo(function ChatRow({
  msg,
  currentUserId,
}: {
  msg: ChatMessage;
  currentUserId: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-baseline">
        <span
          className={`font-bold text-[10px] tracking-widest uppercase ${
            msg.user_id === currentUserId ? 'text-primary' : 'text-on-surface-variant'
          }`}
        >
          {msg.username}
        </span>
        <span className="text-[9px] text-on-surface-variant/50">
          {new Date(msg.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      <p className="text-sm leading-relaxed text-on-surface/90">{msg.content}</p>
    </div>
  );
});

export function ChatPanel({
  messages,
  onSend,
  currentUserId,
  onLoadMore,
  hasMore = false,
  loadError = false,
  onRetryLoad,
}: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [sendError, setSendError] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | undefined>(undefined);
  const atBottomRef = useRef(true);
  const sendErrorTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Cancel any pending "send failed" auto-hide timer on unmount so we don't
  // call setState on an unmounted component (React warns; more importantly,
  // leaking timers across fast navigations is just sloppy).
  useEffect(() => {
    return () => clearTimeout(sendErrorTimerRef.current);
  }, []);

  // Auto-scroll to bottom only for NEW incoming messages and only if the user
  // is already near the bottom (don't yank them around while they read history).
  useEffect(() => {
    const latest = messages[messages.length - 1]?.id;
    if (latest && latest !== lastMessageIdRef.current && atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    lastMessageIdRef.current = latest;
  }, [messages]);

  const handleScroll = useCallback(async () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;

    if (el.scrollTop < 40 && hasMore && !loadingMore && onLoadMore) {
      setLoadingMore(true);
      // Preserve scroll offset after prepending older messages.
      const prevHeight = el.scrollHeight;
      try {
        await onLoadMore();
      } finally {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop =
              scrollRef.current.scrollHeight - prevHeight;
          }
          setLoadingMore(false);
        });
      }
    }
  }, [hasMore, loadingMore, onLoadMore]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const content = input.trim();
    if (!content) return;
    const sent = onSend(content);
    if (sent) {
      setInput('');
      setSendError(false);
    } else {
      setSendError(true);
      clearTimeout(sendErrorTimerRef.current);
      sendErrorTimerRef.current = setTimeout(() => setSendError(false), 3000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {loadError && messages.length === 0 && (
          <div className="bg-error-container/20 border border-error/30 text-error p-3 text-xs flex flex-col gap-2">
            <span>Couldn't load chat history.</span>
            {onRetryLoad && (
              <button
                onClick={onRetryLoad}
                className="self-start text-[10px] uppercase tracking-widest underline hover:no-underline cursor-pointer"
              >
                Retry
              </button>
            )}
          </div>
        )}
        {loadError && messages.length > 0 && (
          <div className="text-center text-[10px] text-error">
            Couldn't load earlier messages.{' '}
            {onRetryLoad && (
              <button
                onClick={onRetryLoad}
                className="underline hover:no-underline cursor-pointer"
              >
                Retry
              </button>
            )}
          </div>
        )}
        {loadingMore && (
          <div className="text-center text-[10px] text-on-surface-variant/60">
            Loading earlier messages…
          </div>
        )}
        {!hasMore && messages.length > 0 && (
          <div className="text-center text-[10px] text-on-surface-variant/40">
            Beginning of conversation
          </div>
        )}
        {messages.map((msg) => (
          <ChatRow key={msg.id} msg={msg} currentUserId={currentUserId} />
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-outline-variant/10">
        {sendError && (
          <p className="text-error text-[10px] mb-2">Not connected. Message not sent.</p>
        )}
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full bg-surface-container-low border-b border-outline-variant/20 focus:border-primary-container focus:outline-none text-sm py-3 px-4 text-on-surface transition-colors"
            placeholder="Type a message..."
            maxLength={2000}
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
          >
            ▸
          </button>
        </div>
      </form>
    </div>
  );
}
