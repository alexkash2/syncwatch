import { memo, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage } from '../../types/ws';
import { usePreferences } from '../../hooks/usePreferences';
import { Button } from '../ui/Button';
import { ChatBubbleIcon, RefreshIcon } from '../ui/icons';
import { Panel } from '../ui/Panel';
import { StatePanel } from '../ui/StatePanel';

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
  const { preferences } = usePreferences();
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
      bottomRef.current?.scrollIntoView({
        behavior: preferences.reduceMotion ? 'auto' : 'smooth',
      });
    }
    lastMessageIdRef.current = latest;
  }, [messages, preferences.reduceMotion]);

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

  const trimmedInput = input.trim();

  return (
    <div className="flex h-full min-h-0 flex-col">
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
        className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
        aria-busy={loadingMore}
      >
        {loadError && messages.length === 0 ? (
          <StatePanel
            eyebrow="Chat History"
            title="Couldn't load previous messages"
            description="The live room is still available, but earlier chat history could not be restored right now."
            icon={<RefreshIcon size={22} />}
            tone="danger"
            className="mx-auto max-w-sm"
            actions={
              onRetryLoad ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void onRetryLoad()}
                  leadingIcon={<RefreshIcon size={14} />}
                >
                  Retry
                </Button>
              ) : undefined
            }
          />
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <StatePanel
              eyebrow="Live Chat"
              title="No messages yet"
              description="Start the conversation while everyone is matching the file and getting ready."
              icon={<ChatBubbleIcon size={22} />}
              className="max-w-sm"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {loadError && (
              <Panel
                variant="outline"
                padding="sm"
                className="rounded-[1.35rem] border-error/28 bg-error-container/25"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs leading-6 text-error">
                    Earlier chat history could not be loaded.
                  </p>
                  {onRetryLoad && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void onRetryLoad()}
                      leadingIcon={<RefreshIcon size={14} />}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </Panel>
            )}

            {loadingMore && (
              <div
                className="text-center text-[11px] text-on-surface-variant/60"
                role="status"
                aria-live="polite"
              >
                Loading earlier messages...
              </div>
            )}

            {!hasMore && (
              <div className="text-center text-[11px] text-on-surface-variant/40" role="status">
                Conversation starts here
              </div>
            )}

            <div
              role="log"
              aria-live="polite"
              aria-relevant="additions text"
              aria-label="Room chat messages"
              className="space-y-4"
            >
              {messages.map((msg) => (
                <ChatRow key={msg.id} msg={msg} currentUserId={currentUserId} />
              ))}
              <div ref={bottomRef} />
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="shrink-0 border-t border-outline-variant/10 p-4">
        {sendError && (
          <Panel
            id="room-chat-error"
            variant="outline"
            padding="sm"
            className="mb-3 rounded-[1.35rem] border-error/28 bg-error-container/25"
            role="alert"
          >
            <p className="text-[11px] text-error">You are offline right now. Message not sent.</p>
          </Panel>
        )}

        <div className="rounded-[1.35rem] border border-outline-variant/15 bg-surface-container-lowest/80 p-2">
          <label htmlFor="room-chat-input" className="sr-only">
            Type a chat message
          </label>
          <div className="flex items-end gap-2">
            <input
              id="room-chat-input"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/40"
              placeholder="Type a message..."
              maxLength={2000}
              aria-label="Type a chat message"
              aria-invalid={sendError}
              aria-describedby={sendError ? 'room-chat-error' : undefined}
            />
            <button
              type="submit"
              disabled={!trimmedInput}
              className="rounded-xl bg-primary-container px-4 py-3 text-[11px] font-bold uppercase tracking-[0.18em] text-on-primary-container transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100"
              aria-label="Send chat message"
            >
              Send
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
