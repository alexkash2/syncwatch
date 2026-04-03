import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { ChatMessage } from '../../types/ws';

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (content: string) => boolean;
  currentUserId: string;
}

export function ChatPanel({ messages, onSend, currentUserId }: ChatPanelProps) {
  const [input, setInput] = useState('');
  const [sendError, setSendError] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      setTimeout(() => setSendError(false), 3000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="space-y-1">
            <div className="flex justify-between items-baseline">
              <span
                className={`font-bold text-[10px] tracking-widest uppercase ${
                  msg.user_id === currentUserId ? 'text-primary' : 'text-on-surface-variant'
                }`}
              >
                {msg.username}
              </span>
              <span className="text-[9px] text-on-surface-variant/50">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-on-surface/90">{msg.content}</p>
          </div>
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
