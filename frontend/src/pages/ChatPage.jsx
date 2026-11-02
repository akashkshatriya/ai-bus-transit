import React from 'react';
import { ChatInterface } from '../components/ChatInterface';

export const ChatPage = () => {
  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-2xl bg-cream border border-beige shadow-soft">
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xl">🤖</span>
            <h1 className="text-lg sm:text-xl font-heading font-extrabold text-olive-deep">
              Transit AI Knowledge Assistant
            </h1>
          </div>
          <p className="text-xs text-ink-soft mt-1 max-w-2xl">
            Real-time interactive assistant connected to your deployed Lovable knowledge base. Ask questions regarding arrival predictions, delay models, timetable schedules, and corridor fleet operations.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-sage-light text-olive-deep border border-primary">
            <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1.5 animate-pulse"></span>
            Lovable API Live
          </span>
        </div>
      </div>

      {/* Main Chat Interface */}
      <ChatInterface />
    </div>
  );
};

export default ChatPage;
