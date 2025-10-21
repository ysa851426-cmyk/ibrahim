// --- ملف: components/MessageBubble.tsx ---

import React from 'react';
import { Message, Role } from '../types';

// 1. تحديث الـ Props لتقبل وظيفة 'onPlayAudio'
interface MessageBubbleProps {
    message: Message;
    messageIndex: number;
    onExplainClick: (index: number) => void;
    onPlayAudio: (text: string) => void; // <-- الإضافة الجديدة
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, messageIndex, onExplainClick, onPlayAudio }) => {
    const isUser = message.role === Role.USER;
    // التأكد من أن النص موجود قبل البحث فيه
    const hasGrammarToken = message.text && message.text.includes('[?]');

    // 2. وظيفة لتشغيل الصوت عند النقر
    const handlePlayAudioClick = () => {
        if (message.text) {
            onPlayAudio(message.text.replace(/\[\?\]/g, ''));
        }
    };

    // 3. وظيفة لشرح القاعدة
    const handleExplainClick = () => {
        onExplainClick(messageIndex);
    };

    // التأكد من أن الرسالة موجودة قبل عرضها
    if (!message.text) {
        return null; // لا تعرض شيئاً إذا كانت الرسالة فارغة
    }
    
    const cleanText = message.text.replace(/\[\?\]/g, '');

    return (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
            <div className={`p-4 rounded-2xl max-w-lg lg:max-w-xl ${isUser ? 'bg-sky-600 text-white rounded-br-none' : 'bg-gray-700 text-gray-100 rounded-bl-none'}`}>
                <p className="whitespace-pre-wrap">{cleanText}</p>
                
                {/* --- [ 3. إضافة الأزرار هنا ] --- */}
                {!isUser && (
                    <div className="flex items-center mt-2 pt-2 border-t border-gray-600 gap-4"> {/* زدت الـ gap */}
                        
                        {/* زر تشغيل الصوت (الحل الاحتياطي) */}
                        <button 
                            onClick={handlePlayAudioClick} 
                            className="text-gray-400 hover:text-white transition-colors"
                            title="Play audio"
                        >
                            <i className="fa-solid fa-volume-high"></i>
                        </button>

                        {/* زر شرح القاعدة */}
                        {hasGrammarToken && (
                            <button 
                                onClick={handleExplainClick} 
                                className="text-gray-400 hover:text-white transition-colors"
                                title="Explain grammar"
                            >
                                <i className="fa-solid fa-book-open"></i>
                            </button>
                        )}
                    </div>
                )}
                {/* --- نهاية الإضافة --- */}
            </div>
        </div>
    );
};

export default MessageBubble;