import React, { useEffect, useMemo, useRef, useState } from 'react';
import { chatAPI } from '../services/api';

function TypingDots() {
  return (
    <div className="flex space-x-1 items-center">
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.2s]"></span>
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.1s]"></span>
      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
    </div>
  );
}

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          role: 'bot',
          content: "Hello 👋 I’m Travello Assistant! How can I help you today?",
        },
      ]);
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    const userMessage = { id: `${Date.now()}-u`, role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    try {
      const response = await chatAPI.sendMessage(trimmed);
      const botText = response?.data?.reply || response?.data?.error || 'Sorry, I could not process that.';
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-b`, role: 'bot', content: botText },
      ]);
    } catch (err) {
      console.error('Chat error:', err);
      let errorMessage = 'Sorry, I encountered an issue. Please try again.';
      
      if (err.response) {
        // Server responded with error
        errorMessage = err.response.data?.error || err.response.data?.reply || errorMessage;
      } else if (err.request) {
        // Request made but no response
        errorMessage = 'Unable to connect to the server. Please check your internet connection.';
      }
      
      setMessages((prev) => [
        ...prev,
        { id: `${Date.now()}-e`, role: 'bot', content: errorMessage },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggle = () => setIsOpen((v) => !v);

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
          <div className="font-semibold">Travello Assistant 🤖</div>
        </div>

        <div ref={scrollRef} className="h-80 max-h-[70vh] overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-900">
          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[80%] px-3 py-2 rounded-2xl shadow-sm text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-primary-600 dark:bg-blue-600 text-white rounded-br-sm'
                    : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-bl-sm'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="max-w-[80%] px-3 py-2 rounded-2xl shadow-sm text-sm leading-relaxed bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-600 rounded-bl-sm">
                <TypingDots />
              </div>
            </div>
          )}
        </div>

        <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-end space-x-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              placeholder="Type your message..."
              className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent max-h-28 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={isLoading || input.trim().length === 0}
              className="shrink-0 inline-flex items-center justify-center rounded-lg bg-primary-600 dark:bg-blue-600 hover:bg-primary-700 dark:hover:bg-blue-700 disabled:opacity-50 text-white px-3 py-2 transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
}


