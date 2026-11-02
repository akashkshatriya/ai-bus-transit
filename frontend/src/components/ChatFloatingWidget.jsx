import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChatInterface } from './ChatInterface';
import { AssistantIcon } from './Icons';

export const ChatFloatingWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  // Do not show floating button if user is already on the dedicated /chat page
  if (location.pathname === '/chat') {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {isOpen ? (
        <div className="w-[calc(100vw-2rem)] sm:w-[440px] max-w-full rounded-2xl shadow-soft border border-beige bg-cream backdrop-blur-xl overflow-hidden animate-slideIn">
          <div className="flex items-center justify-between px-3.5 py-2.5 bg-cream border-b border-beige">
            <div className="flex items-center space-x-2">
              <AssistantIcon size={18} />
              <span className="text-xs font-heading font-bold text-olive-deep">AI Transit Chatbot</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg text-ink-soft hover:text-olive-deep hover:bg-btn-secondary transition-colors cursor-pointer"
              title="Close chat window"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <ChatInterface isCompact={true} />
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="group flex items-center space-x-2 px-4 py-3 rounded-full bg-primary hover:bg-primary-hover text-white font-semibold text-sm shadow-soft hover:scale-105 active:scale-95 transition-all cursor-pointer border border-primary"
          title="Open Transit AI Assistant"
        >
          <AssistantIcon size={18} className="group-hover:rotate-12 transition-transform" />
          <span className="hidden xs:inline text-xs sm:text-sm font-semibold">Ask Transit AI</span>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sage-light opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-sage-light"></span>
          </span>
        </button>
      )}
    </div>
  );
};

export default ChatFloatingWidget;
