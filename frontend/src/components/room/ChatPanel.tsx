import { memo, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage } from '../../types/ws';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (content: string) => boolean;
  currentUserId: string;
  onLoadMore?: () => Promise<boolean> | void;
  hasMore?: boolean;
  loadError?: boolean;
  onRetryLoad?: () => void | Promise<void>;
}

const ChatRow = memo(function ChatRow({
  msg,
  currentUserId,
}: {
  msg: ChatMessage;
  currentUserId: string;
}) {
  const isCurrentUser = msg.user_id === currentUserId;

  return (
    <div
      className={`rounded-[1.35rem] border px-4 py-3 ${
        isCurrentUser
          ? 'border-primary-container/20 bg-primary-container/10'
          : 'border-outline-variant/12 bg-surface-container-lowest/80'
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span
          className={`text-[10px] font-bold uppercase tracking-[0.22em] ${
            isCurrentUser ? 'text-primary' : 'text-on-surface-variant'
          }`}
        >
          {isCurrentUser ? 'You' : msg.username}
        </span>
        <span className="text-[10px] text-on-surface-variant/60">
          {new Date(msg.created_at).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      <p className="mt-2 text-sm leading-7 text-on-surface/90">{msg.content}</p>
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

  useEffect(() => {
    return () => clearTimeout(sendErrorTimerRef.current);
  }, []);

  useEffect(() => {
    const latest = messages[messages.length - 1]?.id;
    if (latest && latest !== lastMessageIdRef.current && atBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    lastMessageIdRef.current = latest;
  }, [messages]);

  const handleScroll = useCallback(async () => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    atBottomRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 80;

    if (element.scrollTop < 40 && hasMore && !loadingMore && onLoadMore) {
      setLoadingMore(true);
      const previousHeight = element.scrollHeight;

      try {
        await onLoadMore();
      } finally {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop =
              scrollRef.current.scrollHeight - previousHeight;
          }
          setLoadingMore(false);
        });
      }
    }
  }, [hasMore, loadingMore, onLoadMore]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content) {
      return;
    }

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
    <div className="flex h-full flex-col">
      <div className="border-b border-outline-variant/10 px-4 py-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
          Live Chat
        </p>
        <p className="mt-2 text-sm text-on-surface-variant">
          Messages appear instantly for everyone in the room.
        </p>
      </div>

      <div
        ref={scrollRef}
        onScroll={() => void handleScroll()}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {loadError && messages.length === 0 ? (
          <div className="rounded-[1.5rem] border border-error/30 bg-error-container/25 px-5 py-5 text-center">
            <p className="text-sm font-semibold text-error">Couldn't load chat history.</p>
            {onRetryLoad && (
              <button
                onClick={() => void onRetryLoad()}
                className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface transition hover:text-primary"
              >
                Retry
              </button>
            )}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <div className="max-w-xs rounded-[1.5rem] border border-outline-variant/12 bg-surface-container-lowest/75 px-5 py-6">
              <p className="text-lg font-bold tracking-tight text-on-surface">No messages yet</p>
              <p className="mt-3 text-sm leading-6 text-on-surface-variant">
                Start the conversation while everyone is matching the file and getting ready.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {loadError && (
              <div className="text-center text-[11px] text-error">
                Couldn't load earlier messages.
                {onRetryLoad && (
                  <button
                    onClick={() => void onRetryLoad()}
                    className="ml-2 font-semibold text-on-surface transition hover:text-primary"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}

            {loadingMore && (
              <div className="text-center text-[11px] text-on-surface-variant/60">
                Loading earlier messages...
              </div>
            )}

            {!hasMore && (
              <div className="text-center text-[11px] text-on-surface-variant/40">
                Beginning of conversation
              </div>
            )}

            {messages.map((msg) => (
              <ChatRow key={msg.id} msg={msg} currentUserId={currentUserId} />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-outline-variant/10 p-4">
        {sendError && (
          <p className="mb-3 text-[11px] text-error">You are offline right now. Message not sent.</p>
        )}

        <div className="rounded-[1.35rem] border border-outline-variant/15 bg-surface-container-lowest/80 p-2">
          <div className="flex items-end gap-2">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/40"
              placeholder="Type a message..."
              maxLength={2000}
            />
            <button
              type="submit"
              className="rounded-xl bg-primary-container px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-on-primary-container transition hover:brightness-110"
            >
              Send
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
