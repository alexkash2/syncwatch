import { memo, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage } from '../../types/ws';
import { useI18n } from '../../hooks/useI18n';
import { Button } from '../ui/Button';
import { ArrowRightIcon } from '../ui/icons';

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
  mine,
  youLabel,
}: {
  msg: ChatMessage;
  mine: boolean;
  youLabel: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${mine ? 'items-end' : 'items-start'}`}>
      <div className="flex items-center gap-[7px]">
        <span
          className={`text-xs font-semibold ${mine ? 'text-accent-strong' : 'text-ink-2'}`}
        >
          {mine ? youLabel : msg.username}
        </span>
        <span className="text-[11px] text-ink-4">
          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      <div
        className={`max-w-[85%] break-words px-[13px] py-[9px] text-sm leading-[1.45] ${
          mine
            ? 'rounded-[12px_12px_4px_12px] bg-accent text-white'
            : 'rounded-[12px_12px_12px_4px] bg-surface-3 text-ink'
        }`}
      >
        {msg.content}
      </div>
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
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastMessageIdRef = useRef<string | undefined>(undefined);
  const atBottomRef = useRef(true);

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
    atBottomRef.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80;

    if (element.scrollTop < 40 && hasMore && !loadingMore && onLoadMore) {
      setLoadingMore(true);
      const previousHeight = element.scrollHeight;
      try {
        await onLoadMore();
      } finally {
        requestAnimationFrame(() => {
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight - previousHeight;
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
    if (onSend(content)) {
      setInput('');
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={() => void handleScroll()}
        className="flex min-h-0 flex-1 flex-col gap-[14px] overflow-y-auto px-4 pb-2 pt-4"
        aria-busy={loadingMore}
      >
        {loadError && (
          <div className="flex items-center justify-between gap-2 rounded-[10px] bg-danger-tint px-3 py-2 text-xs text-danger">
            <span>{t.chat_load_error}</span>
            {onRetryLoad && (
              <Button variant="ghost" size="sm" onClick={() => void onRetryLoad()}>
                {t.retry}
              </Button>
            )}
          </div>
        )}

        {messages.length === 0 && !loadError ? (
          <p className="m-auto text-[13.5px] text-ink-4">{t.chat_empty}</p>
        ) : (
          <div
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-label="Room chat messages"
            className="flex flex-col gap-[14px]"
          >
            {messages.map((msg) => (
              <ChatRow
                key={msg.id}
                msg={msg}
                mine={msg.user_id === currentUserId}
                youLabel={t.you}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex shrink-0 gap-2 border-t border-line p-[14px]">
        <label htmlFor="room-chat-input" className="sr-only">
          {t.message_ph}
        </label>
        <input
          id="room-chat-input"
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={t.message_ph}
          maxLength={2000}
          className="h-10 min-w-0 flex-1 rounded-[10px] border border-line-2 bg-surface-2 px-[13px] text-sm text-ink outline-none transition focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-ring)] placeholder:text-ink-4"
        />
        <Button
          type="submit"
          variant="primary"
          iconOnly
          aria-label={t.send}
          disabled={!input.trim()}
        >
          <ArrowRightIcon size={18} />
        </Button>
      </form>
    </div>
  );
}
