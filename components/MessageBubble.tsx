import React from 'react';
import { Message, Role } from '../types';

interface MessageBubbleProps {
  message: Message;
  messageIndex: number;
  onExplainClick: (messageIndex: number) => void;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, messageIndex, onExplainClick }) => {
  const isUser = message.role === Role.USER;
  const hasExplainable = !isUser && message.text.includes('[?]');

  const bubbleClasses = isUser
    ? 'bg-sky-600 text-white self-end rounded-ss-2xl rounded-se-md rounded-es-2xl rounded-ee-md'
    : 'bg-gray-700 text-gray-200 self-start rounded-se-2xl rounded-ss-md rounded-ee-2xl rounded-es-md';

  const containerClasses = isUser ? 'justify-end' : 'justify-start';

  const renderMessageContent = () => {
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
    return message.text;
  };

  return (
    <div className={`flex w-full ${containerClasses}`}>
      <div className={`max-w-xl md:max-w-2xl px-5 py-3 my-2 shadow-md ${bubbleClasses}`}>
        <p className="text-base whitespace-pre-wrap">{renderMessageContent()}</p>
      </div>
    </div>
  );
};

export default MessageBubble;