import React, { useState } from 'react';
import { Message, Role } from '../types';

interface MessageBubbleProps {
  message: Message;
  messageIndex: number;
  onExplainClick: (messageIndex: number) => void;
  onPlayAudio: (message: Message) => void;
  isPlaying: boolean;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, messageIndex, onExplainClick, onPlayAudio, isPlaying }) => {
  const [showPronunciation, setShowPronunciation] = useState(false);

  const isUser = message.role === Role.USER;
  const isModel = message.role === Role.MODEL;
  const hasExplainable = isModel && message.text.includes('[?]');
  const hasAudio = isModel; // Every model message can now be spoken

  const bubbleClasses = isUser
    ? 'bg-sky-600 text-white self-end rounded-ss-2xl rounded-se-md rounded-es-2xl rounded-ee-md'
    : 'bg-gray-700 text-gray-200 self-start rounded-se-2xl rounded-ss-md rounded-ee-2xl rounded-es-md';

  const containerClasses = isUser ? 'justify-end' : 'justify-start';

  const renderMessageContent = () => {
    // 1. Check for Grammar Explanation token [?]
    if (hasExplainable) {
      const parts = message.text.split('[?]');
      return (
        <>
          {parts[0]}
          <button 
            onClick={() => onExplainClick(messageIndex)} 
            className="ml-2 px-2 py-0.5 rounded-full bg-sky-500 hover:bg-sky-400 text-white text-xs font-bold transition-colors"
            title="Explain Grammar Rule"
            aria-label="Explain Grammar Rule"
          >
            <i className="fa-solid fa-question"></i>
          </button>
          {parts[1]}
        </>
      );
    }
    
    // 2. Check for Pronunciation Guide pattern
    const pronunciationRegex = /'([^']*)' \(pronounced: ([^)]*)\)/;
    const pronunciationMatch = message.text.match(pronunciationRegex);

    if (isModel && pronunciationMatch) {
      const parts = message.text.split(pronunciationMatch[0]);
      const correctedWord = pronunciationMatch[1];
      const phoneticGuide = pronunciationMatch[2];

      return (
        <>
          {parts[0]}
          <span className="inline-flex items-center gap-1 bg-gray-800 bg-opacity-50 px-2 py-1 rounded-md">
            <strong className="text-sky-300 font-semibold">{`'${correctedWord}'`}</strong>
            <div className="relative inline-block">
              <button
                onClick={() => setShowPronunciation(!showPronunciation)}
                onBlur={() => setShowPronunciation(false)} // Hide on focus loss
                className="text-sky-400 hover:text-sky-300 transition-colors"
                title="Show pronunciation"
                aria-label="Show pronunciation"
              >
                <i className="fa-solid fa-circle-info"></i>
              </button>
              {showPronunciation && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-xs z-10">
                    <div className="px-3 py-1.5 bg-gray-900 text-white text-sm rounded-md shadow-lg ring-1 ring-gray-600">
                        {phoneticGuide}
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-gray-900"></div>
                </div>
              )}
            </div>
          </span>
          {parts[1]}
        </>
      );
    }

    // 3. Default: Render plain text
    return message.text;
  };

  return (
    <div className={`flex w-full ${containerClasses}`}>
      <div className={`max-w-xl md:max-w-2xl px-5 py-3 my-2 shadow-md ${bubbleClasses}`}>
        <div className="flex items-start gap-3">
          <div className="flex-grow whitespace-pre-wrap text-base">{renderMessageContent()}</div>
          {hasAudio && (
            <button
              onClick={() => onPlayAudio(message)}
              className="flex-shrink-0 text-gray-400 hover:text-white transition-colors pt-1"
              title={isPlaying ? "Playing..." : "Play audio"}
              aria-label="Play audio for this message"
            >
              <i className={`fa-solid ${isPlaying ? 'fa-wave-square fa-fade' : 'fa-volume-high'} text-lg`}></i>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;