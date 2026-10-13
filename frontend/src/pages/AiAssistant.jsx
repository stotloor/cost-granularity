import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { PageHeader, Button, cn } from '../components/ui.jsx';
import { IconMessageSquare, IconSend, IconPlus, IconX } from '../components/icons.jsx';
import { askAssistant } from '../lib/assistant.js';

const STORAGE_KEY = 'cg_assistant_messages';

const SUGGESTIONS = [
  'Which POs have an unallocated difference, and by how much?',
  'Give me a full picture of project GT-P0416.',
  'Which Copperleaf investments are not linked to an SAP project?',
  'What is the YTD SAP spend by regulatory activity?',
];

// Conversation survives switching tabs (the page remounts) but not closing the browser tab.
function loadMessages() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}
function saveMessages(messages) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch (_) { /* storage unavailable */ }
}

const markdown = {
  p: (props) => <p className="my-2 first:mt-0 last:mb-0" {...props} />,
  ul: (props) => <ul className="my-2 list-disc pl-5 space-y-1" {...props} />,
  ol: (props) => <ol className="my-2 list-decimal pl-5 space-y-1" {...props} />,
  h1: (props) => <h3 className="mt-4 mb-2 text-base font-bold text-slate-900" {...props} />,
  h2: (props) => <h3 className="mt-4 mb-2 text-base font-bold text-slate-900" {...props} />,
  h3: (props) => <h4 className="mt-3 mb-1.5 text-sm font-bold text-slate-900" {...props} />,
  a: (props) => <a className="text-teal-700 underline" target="_blank" rel="noreferrer" {...props} />,
  table: (props) => (
    <div className="my-3 overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full text-xs" {...props} />
    </div>
  ),
  thead: (props) => <thead className="bg-slate-50 text-slate-600" {...props} />,
  th: (props) => <th className="px-3 py-2 text-left font-semibold whitespace-nowrap" {...props} />,
  td: (props) => <td className="px-3 py-1.5 border-t border-slate-100 whitespace-nowrap" {...props} />,
  pre: (props) => <pre className="my-3 overflow-x-auto rounded-xl bg-slate-900 p-3 text-xs text-slate-100" {...props} />,
  code: ({ className, children, ...props }) => (className
    ? <code className={className} {...props}>{children}</code>
    : <code className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em] text-slate-800" {...props}>{children}</code>),
};

function Message({ message, onRetry }) {
  const isUser = message.role === 'user';
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
          isUser ? 'bg-teal-600 text-white whitespace-pre-wrap' : 'bg-white border border-slate-200 text-slate-800 shadow-xs',
          message.error && 'bg-rose-50 border-rose-200 text-rose-800',
        )}
      >
        {isUser ? message.content : message.error ? (
          <div className="flex items-start gap-3">
            <span className="flex-1">{message.content}</span>
            {onRetry && (
              <button onClick={onRetry} className="shrink-0 font-semibold underline hover:no-underline">Retry</button>
            )}
          </div>
        ) : (
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdown}>{message.content}</ReactMarkdown>
        )}
      </div>
    </div>
  );
}

function Thinking({ startedAt }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-xs flex items-center gap-2">
        <span className="flex gap-1">
          {[0, 150, 300].map((d) => (
            <span key={d} className="h-1.5 w-1.5 rounded-full bg-teal-500 animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </span>
        Thinking… {Math.round((now - startedAt) / 1000)}s
      </div>
    </div>
  );
}

export default function AiAssistant() {
  const [messages, setMessages] = useState(loadMessages);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(null); // { startedAt, controller }
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => saveMessages(messages), [messages]);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pending]);
  useEffect(() => () => pending && pending.controller.abort(), [pending]);

  const send = async (text, base = messages) => {
    const question = text.trim();
    if (!question || pending) return;
    const history = base.filter((m) => !m.error);
    setMessages([...history, { role: 'user', content: question }]);
    setInput('');
    const controller = new AbortController();
    setPending({ startedAt: Date.now(), controller });
    try {
      const answer = await askAssistant(question, history, controller.signal);
      setMessages((m) => [...m, { role: 'assistant', content: answer || '_(empty response)_' }]);
    } catch (e) {
      setMessages((m) => [...m, { role: 'assistant', content: e.message || 'Something went wrong.', error: true }]);
    } finally {
      setPending(null);
      inputRef.current && inputRef.current.focus();
    }
  };

  // Re-ask the question that failed, without duplicating it in the transcript.
  const retry = () => {
    const lastUser = messages.map((m) => m.role).lastIndexOf('user');
    if (lastUser < 0) return;
    send(messages[lastUser].content, messages.slice(0, lastUser));
  };

  const newChat = () => {
    if (pending) pending.controller.abort();
    setMessages([]);
    setInput('');
  };

  const last = messages[messages.length - 1];

  return (
    <div className="flex flex-col h-[calc(100dvh-7rem)] sm:h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-9rem)] min-h-[420px]">
      <PageHeader
        eyebrow="Ask the data"
        title="AI Assistant"
        subtitle="Ask questions about POs, allocations, SAP projects/WBS and Copperleaf investments. Answers come from live read-only queries."
        actions={messages.length > 0 && (
          <Button variant="outline" size="sm" icon={IconPlus} onClick={newChat}>New chat</Button>
        )}
      />

      <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-slate-200/80 bg-slate-50 shadow-sm overflow-hidden">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4" aria-live="polite">
          {messages.length === 0 && !pending ? (
            <div className="h-full flex flex-col items-center justify-center text-center gap-5 py-8">
              <div className="h-12 w-12 rounded-2xl bg-teal-500/10 text-teal-600 flex items-center justify-center">
                <IconMessageSquare className="h-6 w-6" />
              </div>
              <div>
                <div className="text-base font-bold text-slate-900">What would you like to know?</div>
                <div className="text-sm text-slate-500 mt-1">Try one of these, or ask your own question.</div>
              </div>
              <div className="grid sm:grid-cols-2 gap-2 w-full max-w-2xl">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left text-sm rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 hover:border-teal-400 hover:bg-teal-50/50 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m, i) => (
              <Message key={i} message={m} onRetry={m === last && m.error && !pending ? retry : null} />
            ))
          )}
          {pending && <Thinking startedAt={pending.startedAt} />}
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="border-t border-slate-200 bg-white p-3 sm:p-4 flex items-end gap-2"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={Math.min(6, Math.max(1, input.split('\n').length))}
            placeholder="Ask about a PO, project, WBS or investment…"
            aria-label="Message the AI assistant"
            className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50/75 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
          {pending ? (
            <button
              type="button"
              onClick={() => pending.controller.abort()}
              className="h-[42px] shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-slate-300/80 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <IconX className="h-4 w-4" /> Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Send"
              className="h-[42px] w-[42px] shrink-0 inline-flex items-center justify-center rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
            >
              <IconSend className="h-4 w-4" />
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
