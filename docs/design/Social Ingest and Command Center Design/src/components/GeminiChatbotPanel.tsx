import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Sparkles, Send, X, ArrowDown } from 'lucide-react';
import { ChatMessage } from '../types';

interface GeminiChatbotPanelProps {
  selectedTopic: string;
  totalPosts: number;
  sentimentIndex: number;
  activeSourceFilter: string | null;
  activeRegionFilter: string | null;
  activePhraseFilter: string | null;
  onClose: () => void;
}

export const GeminiChatbotPanel: React.FC<GeminiChatbotPanelProps> = ({
  selectedTopic,
  totalPosts,
  sentimentIndex,
  activeSourceFilter,
  activeRegionFilter,
  activePhraseFilter,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: `Hello! I am your Gemini-powered reputation consultant. 

I have automatically synced with your current dashboard filters. Ask me to:
1. Suggest response strategies for negative sentiment in specific regions.
2. Draft announcement copy explaining trending volume spikes.
3. Contrast Twitter vs Blog campaign performance.`,
      timestamp: new Date().toLocaleTimeString(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: inputText,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMsg],
          dashboardState: {
            selectedTopic,
            totalPosts,
            sentimentIndex,
            activeSourceFilter,
            activeRegionFilter,
            activePhraseFilter,
          },
        }),
      });

      const data = await response.json();
      setMessages((prev) => [
        ...prev,
        {
          id: `res-${Date.now()}`,
          sender: 'assistant',
          text: data.text,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: "I experienced an issue communicating with the AI. Please verify your GEMINI_API_KEY.",
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (prompt: string) => {
    setInputText(prompt);
  };

  return (
    <div className="bg-white border-l border-slate-200 h-full w-full flex flex-col justify-between shadow-2xl relative select-none">
      {/* HEADER */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
        <div className="flex items-center gap-2">
          <div className="p-1 bg-emerald-600 rounded-none shrink-0 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <h3 className="text-xs font-bold uppercase tracking-wider">Reputation Coach</h3>
            <p className="text-[9px] text-slate-300">Gemini 2.5 Flash Injected</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1"
          title="Close assistant"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* DASHBOARD SYNCHRONIZATION BAR */}
      <div className="px-3 py-1.5 bg-emerald-50 text-[10px] text-emerald-800 border-b border-emerald-100/50 flex items-center justify-between text-left">
        <div className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-ping inline-block" />
          <span className="font-semibold truncate">Dashboard Context Injected</span>
        </div>
        <div className="font-mono text-slate-500 font-bold shrink-0">
          Index: {sentimentIndex} | Vol: {totalPosts}
        </div>
      </div>

      {/* MESSAGES CONVERSATION WINDOW */}
      <div
        ref={scrollRef}
        className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin scroll-smooth"
        style={{ contentVisibility: 'auto' }}
      >
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col max-w-[85%] ${
              msg.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'
            }`}
          >
            <div
              className={`p-3 text-xs leading-relaxed ${
                msg.sender === 'user'
                  ? 'bg-slate-900 text-white rounded-none shadow-sm'
                  : 'bg-slate-50 text-slate-900 border border-slate-200/60 rounded-none text-left'
              }`}
            >
              <div className="whitespace-pre-line">{msg.text}</div>
            </div>
            <span className="text-[8px] text-slate-400 mt-1 uppercase font-semibold">
              {msg.timestamp}
            </span>
          </div>
        ))}

        {loading && (
          <div className="flex flex-col items-start max-w-[85%]">
            <div className="p-3 bg-slate-50 border border-slate-200/60 rounded-none text-xs text-slate-500 text-left flex items-center gap-1.5 font-medium">
              <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce" />
              <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce delay-75" />
              <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-bounce delay-150" />
              <span>Consulting brand context...</span>
            </div>
          </div>
        )}
      </div>

      {/* SUGGESTED PRESET BARS */}
      {messages.length < 3 && (
        <div className="px-4 py-2 border-t border-slate-50 flex flex-col gap-1.5 text-left bg-slate-50/50">
          <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400">Quick Prompts:</span>
          <button
            type="button"
            onClick={() => handleSuggestionClick("Draft a public announcement describing why we had a volume spike on Sep 08.")}
            className="text-[11px] text-slate-700 bg-white hover:bg-slate-100 p-1.5 border border-slate-200 truncate rounded-none text-left"
          >
            "How do we handle the spike on Sep 08?"
          </button>
          <button
            type="button"
            onClick={() => handleSuggestionClick(`Suggest response strategy for negative phrases in our current feed.`)}
            className="text-[11px] text-slate-700 bg-white hover:bg-slate-100 p-1.5 border border-slate-200 truncate rounded-none text-left"
          >
            "Analyze current negative complaints."
          </button>
        </div>
      )}

      {/* INPUT EDITOR AREA */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 border-t border-slate-100 flex items-center gap-2 bg-white"
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask Reputation Coach..."
          className="flex-1 border border-slate-200/80 px-3 py-2 text-xs focus:outline-hidden focus:border-slate-800 placeholder-slate-400"
        />
        <button
          type="submit"
          disabled={loading || !inputText.trim()}
          className="p-2 bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-50 shrink-0 flex items-center justify-center rounded-none"
          title="Send message"
        >
          <Send className="w-4.5 h-4.5" />
        </button>
      </form>
    </div>
  );
};
