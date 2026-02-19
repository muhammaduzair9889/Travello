import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chatAPI } from '../services/api';

function TypingDots() {
  return (
    <div className="flex space-x-1 items-center py-1">
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.2s]"></span>
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.1s]"></span>
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce"></span>
    </div>
  );
}

/**
 * Render simple markdown-like formatting:
 *   **bold**, *italic*, `code`, bullet lists (- item), numbered lists (1. item)
 */
function FormattedMessage({ text }) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let listBuffer = [];
  let listType = null;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const Tag = listType === 'ol' ? 'ol' : 'ul';
    const cls = listType === 'ol'
      ? 'list-decimal list-inside space-y-0.5 my-1'
      : 'list-disc list-inside space-y-0.5 my-1';
    elements.push(
      <Tag key={`list-${elements.length}`} className={cls}>
        {listBuffer.map((item, i) => (
          <li key={i}>{formatInline(item)}</li>
        ))}
      </Tag>
    );
    listBuffer = [];
    listType = null;
  };

  const formatInline = (line) => {
    const parts = [];
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let lastIndex = 0;
    let match;
    let key = 0;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      if (match[2]) {
        parts.push(<strong key={key++}>{match[2]}</strong>);
      } else if (match[3]) {
        parts.push(<em key={key++}>{match[3]}</em>);
      } else if (match[4]) {
        parts.push(
          <code key={key++} className="bg-gray-100 dark:bg-gray-600 px-1 rounded text-xs">
            {match[4]}
          </code>
        );
      }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    return parts.length > 0 ? parts : line;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();

    const ulMatch = trimmed.match(/^[-\u2022]\s+(.+)/);
    const olMatch = trimmed.match(/^\d+[.)]\s+(.+)/);

    if (ulMatch) {
      if (listType === 'ol') flushList();
      listType = 'ul';
      listBuffer.push(ulMatch[1]);
    } else if (olMatch) {
      if (listType === 'ul') flushList();
      listType = 'ol';
      listBuffer.push(olMatch[1]);
    } else {
      flushList();
      if (trimmed === '') {
        elements.push(<div key={`br-${i}`} className="h-1.5" />);
      } else {
        elements.push(
          <p key={`p-${i}`} className="my-0.5">
            {formatInline(trimmed)}
          </p>
        );
      }
    }
  }
  flushList();

  return <div className="space-y-0">{elements}</div>;
}

const QUICK_ACTIONS = [
  { label: 'Hotels', message: 'Show me popular hotels in Lahore' },
  { label: 'Flights', message: 'Help me find flights' },
  { label: 'Tips', message: 'Travel tips for Pakistan' },
];

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'bot',
          content: "Hi there! I'm your Travello assistant. Ask me about hotels, flights, sightseeing, or anything travel-related.",
        },
      ]);
    }
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = (text || '').trim();
    if (!trimmed || isLoading) return;

    const userMessage = { id: `${Date.now()}-u`, role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await chatAPI.sendMessage(trimmed);
      const botText = response?.data?.reply || 'Sorry, I could not process that.';
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-b`, role: 'bot', content: botText },
      ]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMessage =
        err?.response?.data?.error ||
        err?.message ||
        (err?.request ? 'Unable to connect. Check your internet connection.' : 'Something went wrong. Please try again.');
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-e`, role: 'bot', content: errorMessage },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const handleSend = () => sendMessage(input);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggle = () => setIsOpen((v) => !v);

  const showQuickActions = messages.length <= 1 && !isLoading;

  const buttonClasses = useMemo(
    () =>
      'fixed bottom-6 right-6 z-40 rounded-full shadow-lg bg-primary-600 hover:bg-primary-700 text-white w-14 h-14 flex items-center justify-center transition-transform duration-200',
    []
  );

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
        className={buttonClasses}
        onClick={toggle}
      >
        {isOpen ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7">
            <path fillRule="evenodd" d="M6.225 4.811a1 1 0 0 1 1.414 0L12 9.172l4.361-4.361a1 1 0 1 1 1.414 1.414L13.414 10.586l4.361 4.361a1 1 0 0 1-1.414 1.414L12 12l-4.361 4.361a1 1 0 1 1-1.414-1.414l4.361-4.361-4.361-4.361a1 1 0 0 1 0-1.414Z" clipRule="evenodd" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3h9m-9 3h5.25M21 12c0 4.97-4.477 9-10 9-1.225 0-2.397-.215-3.477-.61-.52-.192-1.086-.127-1.561.135L3 21l.475-2.379c.104-.523-.063-1.065-.446-1.449A8.943 8.943 0 0 1 1 12c0-4.97 4.477-9 10-9s10 4.03 10 9Z" />
          </svg>
        )}
      </button>

      {/* Chat Panel */}
      <div
        className={`fixed bottom-24 right-6 z-40 w-[22rem] max-w-[90vw] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden transform transition-all duration-200 ${
          isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="bg-primary-600 dark:bg-blue-700 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span className="font-semibold text-sm">Travello Assistant</span>
          </div>
          <button onClick={toggle} className="text-white/70 hover:text-white transition-colors p-1">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        <div ref={scrollRef} className="h-80 max-h-[70vh] overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-2xl shadow-sm text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-primary-600 dark:bg-blue-600 text-white rounded-br-sm'
                    : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-bl-sm'
                }`}
              >
                {m.role === 'user' ? m.content : <FormattedMessage text={m.content} />}
              </div>
            </div>
          ))}

          {/* Quick action chips after welcome */}
          {showQuickActions && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.label}
                  onClick={() => sendMessage(a.message)}
                  className="text-xs px-2.5 py-1 rounded-full border border-primary-300 dark:border-blue-600 text-primary-600 dark:text-blue-400 hover:bg-primary-50 dark:hover:bg-blue-900/30 transition-colors"
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}

          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[85%] px-3 py-2 rounded-2xl shadow-sm text-sm leading-relaxed bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-bl-sm">
                <TypingDots />
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-end space-x-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Ask me anything about travel..."
              className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent max-h-28 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isLoading || input.trim().length === 0}
              className="shrink-0 inline-flex items-center justify-center rounded-lg bg-primary-600 dark:bg-blue-600 hover:bg-primary-700 dark:hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
