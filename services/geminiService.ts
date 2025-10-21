// --- هذا الملف: services/geminiService.ts ---
// هذا الكود يعمل في المتصفح (غير آمن)

import { Message, Role, VocabularyItem, Difficulty } from '../types';

// الرابط السري للـ Function الآمنة
const API_ENDPOINT = '/.netlify/functions/chat';

// --- وظيفة مساعدة لإرسال الطلبات إلى "الخلفية" ---
const callSecureFunction = async (type: string, payload: any): Promise<string> => {
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, payload })
        });

        const data = await response.json();

        if (!response.ok) {
            // إذا فشل الخادم، أظهر الخطأ
            throw new Error(data.error || "An unknown server error occurred.");
        }
        
        // إرجاع النص الناجح
        return data.text;

    } catch (error: any) {
        console.error(`Error calling function type ${type}:`, error);
        throw new Error(error.message);
    }
}

// --- وظيفة getSystemInstruction تبقى كما هي ---
// (لأن React ما زال يحتاج لبناء التعليمات)
const getSystemInstruction = (languageName: string, difficulty: Difficulty, contextText?: string, scenarioPrompt?: string) => {
    // ... (انسخ نفس الكود الأصلي لوظيفة getSystemInstruction بالكامل هنا) ...
    
    let baseInstruction = `You are Poly, a friendly and encouraging language tutor. The user wants to learn ${languageName}. Your primary role is to have a natural conversation with them in ${languageName}.
- Your responses MUST be primarily in ${languageName}.
- The user's skill level is ${difficulty}. Adjust your vocabulary and sentence complexity accordingly. For Beginners, use simple words and short sentences. For Advanced, feel free to use more complex and idiomatic language.
- If the user makes a mistake in grammar or vocabulary, gently correct them. First provide the corrected sentence in ${languageName}, then provide a very short, simple explanation in English inside parentheses.
- When you provide a grammar correction explanation, ALWAYS end the explanation with the special token [?]. For example: "... (The verb should be 'go', not 'goes' [?])"
- Based on the user's transcribed text, if you infer a likely mispronunciation of a word, gently provide the correct spelling and a phonetic guide. For example: "I believe you meant to say 'specific' (pronounced: spuh-sif-ik)." Only do this for clear cases.
- Keep your responses concise and conversational to encourage the user to speak.
- Your main language of conversation is ${languageName}. Only provide explanations in English.`;

    if (scenarioPrompt) {
        baseInstruction += `\n\n- You are currently in a role-playing scenario. ${scenarioPrompt}`;
    }

    if (contextText) {
        return `You are Poly, a friendly and encouraging language tutor. The user has provided the following text to discuss in ${languageName}. Their skill level is ${difficulty}. Your role is to help them understand and talk about it.
- Your first response should be in ${languageName}, acknowledging the text and asking the user what they'd like to discuss about it.
- Follow the core conversational rules: gently correct mistakes with the [?] token for explanations, adjust to the user's ${difficulty} level, and keep responses concise.
- Your main language of conversation is ${languageName}. Only provide explanations in English.

Here is the text for discussion:
---
${contextText}
---
`;
    }

    return baseInstruction;
}

// --- الوظائف الرئيسية تم تعديلها (أبسط بكثير) ---

// (ملاحظة: لقد أعدت 'history' هنا لأن App.tsx يرسلها، لكن الخدمة الجديدة لم تعد تدير السجل)
// سنقوم بتعديل بسيط: App.tsx هو من يدير السجل
let history: Message[] = []; // سجل مؤقت في الواجهة
let currentLanguage: string = 'English';
let currentDifficulty: Difficulty = 'Beginner';

export const startChatSession = (languageName: string, difficulty: Difficulty): void => {
    history = [];
    currentLanguage = languageName;
    currentDifficulty = difficulty;
    console.log("Chat session started (Frontend).");
};

export const sendMessageToAI = async (
    message: string, 
    currentHistory: Message[], // App.tsx يجب أن يرسل السجل الحالي
    contextText?: string, 
    scenarioPrompt?: string
): Promise<string> => {
    
    const instruction = getSystemInstruction(currentLanguage, currentDifficulty, contextText, scenarioPrompt);
    
    const payload = {
        message: message,
        history: currentHistory, // إرسال السجل إلى الخلفية
        systemInstruction: instruction
    };

    return callSecureFunction('sendMessage', payload);
};

export const extractVocabulary = async (conversation: Message[]): Promise<VocabularyItem[]> => {
    const relevantConversation = conversation.filter(m => m.role === Role.USER || (m.role === Role.MODEL && !m.text.startsWith("Sorry,")));
    const conversationText = relevantConversation.map(m => `${m.role}: ${m.text}`).join('\n');
    if (relevantConversation.length < 2) return [];

    const payload = { conversationText };
    const responseText = await callSecureFunction('extractVocabulary', payload);
    return JSON.parse(responseText.trim()) as VocabularyItem[];
};

export const getGrammarExplanation = async (userSentence: string, aiCorrection: string): Promise<string> => {
    const payload = { userSentence, aiCorrection };
    return callSecureFunction('getGrammarExplanation', payload);
};

export const validateChallengeSentence = async (word: string, sentence: string): Promise<string> => {
    const payload = { word, sentence };
    return callSecureFunction('validateChallengeSentence', payload);
};