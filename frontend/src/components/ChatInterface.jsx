import React, { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../services/chatService';
import { FormattedMessage } from './FormattedMessage';
import { AssistantIcon } from './Icons';

const INITIAL_MESSAGES = [
  {
    id: 'welcome',
    sender: 'assistant',
    text: "Hello! I am your Bus Tracker AI Assistant powered by project knowledge.\n\nYou can ask me anything about arrival predictions, ML delay models, route stops, driver tracking, or timetable scheduling.",
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    sources: [],
  },
];

const SUGGESTED_PROMPTS = [
  "How does arrival prediction work?",
  "Which stops are along the Belman to Udupi corridor?",
  "How does the ML model predict bus delays?",
  "What is the difference between normal and predicted arrival?",
];

export const ChatInterface = ({ isCompact = false }) => {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorNotice, setErrorNotice] = useState(null);
  const [expandedSources, setExpandedSources] = useState({});

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Adjust textarea height dynamically
  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const toggleSourceExpand = (messageId) => {
    setExpandedSources((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }));
  };

  const handleClearChat = () => {
    setMessages(INITIAL_MESSAGES);
    setErrorNotice(null);
  };

  const handleSendMessage = async (textToSend) => {
    const text = (typeof textToSend === 'string' ? textToSend : inputMessage).trim();
    if (!text || isLoading) return;

    setErrorNotice(null);
    const userMsgId = `user-${Date.now()}`;
    const userMessageObj = {
      id: userMsgId,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessageObj]);
    setInputMessage('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    setIsLoading(true);

    try {
      // Direct call to Lovable backend API
      const result = await sendChatMessage(text);

      const assistantMsgId = `assistant-${Date.now()}`;
      console.debug('[Lovable Chat API] Raw response:', result.raw ?? result);
      const assistantMessageObj = {
        id: assistantMsgId,
        sender: 'assistant',
        text: result.answer ||
          `I received a response from the backend but could not extract the answer text.\n\n` +
          `Raw response keys: ${Object.keys(result.raw ?? result).join(', ')}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: Array.isArray(result.sources) ? result.sources : [],
        foundInNotes: result.found_in_notes,
      };

      setMessages((prev) => [...prev, assistantMessageObj]);
    } catch (err) {
      console.error("Chat API error:", err);
      let errorMsg = err.message || "An unexpected error occurred while communicating with the assistant.";

      if (err.status === 401) {
        errorMsg = "401 Unauthorized: The separate backend returned an authentication restriction. Please check API access permissions.";
      } else if (err.isCors) {
        errorMsg = "CORS Connection Error: The Lovable backend at https://chat-launchpad-link.lovable.app must allow requests from your browser origin.";
      }

      setErrorNotice(errorMsg);

      const errorMessageObj = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        isError: true,
        text: `⚠️ **Error:** ${errorMsg}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        sources: [],
      };
      setMessages((prev) => [...prev, errorMessageObj]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className={`flex flex-col bg-cream rounded-2xl border border-beige shadow-soft backdrop-blur-md overflow-hidden ${isCompact ? 'h-[500px]' : 'h-[calc(100vh-8rem)] min-h-[500px]'}`}>
      {/* Header */}
      <div className="px-4 py-3 bg-cream border-b border-beige flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-soft text-base">
              <AssistantIcon size={18} />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-primary border-2 border-cream rounded-full"></span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-heading font-bold text-olive-deep">Transit AI Assistant</h2>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-sage-light text-olive-deep border border-primary">
                AI Connected
              </span>
            </div>
            <p className="text-[11px] text-ink-soft">Ask about corridor ETAs, delay predictions, & schedules</p>
          </div>
        </div>

        <button
          onClick={handleClearChat}
          title="Clear Conversation"
          className="text-xs px-2.5 py-1.5 rounded-btn text-ink-soft hover:text-olive-deep hover:bg-btn-secondary border border-beige transition-colors flex items-center space-x-1 cursor-pointer"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          <span className="hidden sm:inline">Clear</span>
        </button>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-surface">
        {messages.map((msg) => {
          const isUser = msg.sender === 'user';
          const hasSources = msg.sources && msg.sources.length > 0;
          const isSourcesExpanded = expandedSources[msg.id];

          return (
            <div
              key={msg.id}
              className={`flex items-start space-x-2.5 sm:space-x-3 ${isUser ? 'flex-row-reverse space-x-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center shrink-0 text-xs sm:text-sm shadow-soft ${
                  isUser
                    ? 'bg-primary text-white'
                    : msg.isError
                      ? 'bg-olive-deep text-surface border border-olive-deep'
                      : 'bg-sage-light text-olive-deep border border-primary'
                }`}
              >
                {isUser ? '👤' : msg.isError ? '⚠️' : <AssistantIcon size={16} />}
              </div>

              {/* Message Bubble */}
              <div
                className={`max-w-[85%] sm:max-w-[75%] rounded-2xl p-3.5 sm:p-4 text-sm shadow-soft transition-all ${
                  isUser
                    ? 'bg-primary text-white rounded-tr-none'
                    : msg.isError
                      ? 'bg-olive-deep border border-olive-deep text-surface rounded-tl-none'
                      : 'bg-cream text-ink border border-beige rounded-tl-none'
                }`}
              >
                {/* Text Content */}
                {isUser ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.text}</p>
                ) : (
                  <FormattedMessage content={msg.text} />
                )}

                {/* Found-in-Notes Badge */}
                {!isUser && msg.foundInNotes && (
                  <div className="mt-2 flex items-center space-x-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sage-light text-olive-deep border border-primary">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mr-1 animate-pulse"></span>
                      Verified from Knowledge Base
                    </span>
                  </div>
                )}

                {/* Sources & Citations Section */}
                {hasSources && (
                  <div className="mt-3 pt-2.5 border-t border-beige">
                    <button
                      onClick={() => toggleSourceExpand(msg.id)}
                      className="text-xs font-semibold text-olive-deep hover:text-primary flex items-center space-x-1.5 transition-colors cursor-pointer"
                    >
                      <span>📚 Sources & Documentation ({msg.sources.length})</span>
                      <svg
                        className={`w-3.5 h-3.5 transform transition-transform ${isSourcesExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isSourcesExpanded && (
                      <div className="mt-2 space-y-1.5 animate-fadeIn">
                        {msg.sources.map((src, idx) => (
                          <div
                            key={idx}
                            className="text-[11px] p-2 rounded-lg bg-surface border border-beige text-ink"
                          >
                            <div className="flex items-center space-x-1.5 mb-0.5">
                              <span className="text-olive-deep">📄</span>
                              <span className="font-semibold text-olive-deep">{src.document || 'Document'}</span>
                            </div>
                            {src.section && (
                              <p className="text-ink-soft mt-0.5 text-[10px] break-words pl-4 border-l border-sage">
                                {src.section}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Timestamp */}
                <div
                  className={`text-[10px] mt-1.5 text-right font-mono ${
                    isUser ? 'text-white/80' : 'text-ink-soft'
                  }`}
                >
                  {msg.timestamp}
                </div>
              </div>
            </div>
          );
        })}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex items-start space-x-2.5 sm:space-x-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-sage-light border border-primary text-olive-deep flex items-center justify-center shrink-0 text-xs sm:text-sm">
              🤖
            </div>
            <div className="bg-cream border border-beige rounded-2xl rounded-tl-none p-3.5 text-ink-soft shadow-soft flex items-center space-x-2">
              <span className="inline-flex space-x-1">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-2 h-2 bg-sage rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-2 h-2 bg-olive-deep rounded-full animate-bounce"></span>
              </span>
              <span className="text-xs text-ink-soft pl-1 font-mono">Querying Lovable backend...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Prompts (shown when only initial message exists) */}
      {messages.length === 1 && (
        <div className="px-4 py-2 border-t border-beige bg-surface shrink-0">
          <p className="text-[11px] text-ink-soft mb-1.5 font-medium">Suggested queries:</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_PROMPTS.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(prompt)}
                disabled={isLoading}
                className="text-xs px-2.5 py-1 rounded-full bg-btn-secondary hover:bg-sage-light text-ink hover:text-olive-deep border border-beige hover:border-primary transition-all text-left disabled:opacity-50 cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input Form */}
      <div className="p-3 sm:p-4 bg-cream border-t border-beige shrink-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="flex items-end space-x-2"
        >
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputMessage}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="Ask about arrival predictions, routes, delay models... (Enter to send)"
              disabled={isLoading}
              maxLength={2000}
              className="w-full px-3.5 py-2.5 bg-field border border-beige rounded-btn text-ink placeholder-ink-soft text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary resize-none max-h-32 disabled:opacity-50 transition-all shadow-sm"
            />
            {inputMessage.length > 100 && (
              <span className="absolute bottom-1 right-2 text-[9px] font-mono text-ink-soft">
                {inputMessage.length}/2000
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !inputMessage.trim()}
            className="px-4 py-2.5 rounded-btn bg-primary hover:bg-primary-hover text-white font-semibold text-sm shadow-soft focus:outline-none focus:ring-2 focus:ring-olive-deep disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center shrink-0 cursor-pointer"
          >
            {isLoading ? (
              <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            ) : (
              <span className="flex items-center space-x-1">
                <span>Send</span>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </span>
            )}
          </button>
        </form>
        <p className="text-[10px] text-ink-soft mt-1.5 text-center sm:text-left">
          Connected to <code className="text-olive-deep font-mono">https://chat-launchpad-link.lovable.app/api/public/chat</code>
        </p>
      </div>
    </div>
  );
};

export default ChatInterface;
