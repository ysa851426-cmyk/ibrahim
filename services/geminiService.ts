// --- هذا الملف: services/geminiService.ts ---
import { Message, Role, VocabularyItem, Difficulty } from '../types';

const API_ENDPOINT = '/.netlify/functions/chat';

const callSecureFunction = async (type: string, payload: any): Promise<string> => {
    console.log(`geminiService.ts: Calling secure function - Type: ${type}`, payload); // <-- Log 1
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, payload })
        });
        console.log(`geminiService.ts: Received response status: ${response.status}`); // <-- Log 2

        const data = await response.json();

        if (!response.ok) {
            console.error(`geminiService.ts: Server responded with error: ${response.status}`, data); // <-- Log Error
            throw new Error(data.error || `Server error: ${response.status}`);
        }
        
        console.log(`geminiService.ts: Received successful data for type ${type}`); // <-- Log 3
        return data.text;

    } catch (error: any) {
        // --- تعديل: إضافة تفاصيل أكثر للخطأ ---
        console.error(`geminiService.ts: Error in callSecureFunction (Type: ${type}):`, error);
        // التحقق إذا كان الخطأ بسبب فشل .json()
        if (error instanceof SyntaxError && error.message.includes('JSON')) {
             throw new Error("Received an invalid response from the server. It might be down or returning HTML instead of JSON.");
        }
        throw new Error(error.message || `Network or parsing error calling function type ${type}`);
        // --- نهاية التعديل ---
    }
}

// --- وظيفة getSystemInstruction تبقى كما هي ---
const getSystemInstruction = (languageName: string, difficulty: Difficulty, contextText?: string, scenarioPrompt?: string) => { /* ... */ };

// --- الوظائف الرئيسية ---
let currentLanguage: string = 'English';
let currentDifficulty: Difficulty = 'Beginner';

export const startChatSession = (languageName: string, difficulty: Difficulty): void => {
    console.log("geminiService.ts: Starting session (Frontend state reset)."); // <-- Log
    currentLanguage = languageName;
    currentDifficulty = difficulty;
};

export const sendMessageToAI = async ( message: string, currentHistory: Message[], contextText?: string, scenarioPrompt?: string ): Promise<string> => {
    console.log("geminiService.ts: Preparing to send message..."); // <-- Log
    const instruction = getSystemInstruction(currentLanguage, currentDifficulty, contextText, scenarioPrompt);
    const payload = { message, history: currentHistory, systemInstruction: instruction };
    return callSecureFunction('sendMessage', payload);
};

export const extractVocabulary = async (conversation: Message[]): Promise<VocabularyItem[]> => {
    console.log("geminiService.ts: Preparing to extract vocabulary..."); // <-- Log
    const relevantConversation = conversation.filter(m => m.role === Role.USER || (m.role === Role.MODEL && !m.text.startsWith("Sorry,")));
    const conversationText = relevantConversation.map(m => `${m.role}: ${m.text}`).join('\n');
    if (relevantConversation.length < 2) {
        console.log("geminiService.ts: Conversation too short for vocab extraction."); // <-- Log
        return [];
    }
    const payload = { conversationText };
    const responseText = await callSecureFunction('extractVocabulary', payload);
    try {
        return JSON.parse(responseText.trim()) as VocabularyItem[];
    } catch (e) {
        console.error("geminiService.ts: Failed to parse vocabulary JSON:", e, "Raw response:", responseText); // <-- Log Parse Error
        throw new Error("Received invalid vocabulary data from the server.");
    }
};

export const getGrammarExplanation = async (userSentence: string, aiCorrection: string): Promise<string> => {
    console.log("geminiService.ts: Preparing to get grammar explanation..."); // <-- Log
    const payload = { userSentence, aiCorrection };
    return callSecureFunction('getGrammarExplanation', payload);
};

export const validateChallengeSentence = async (word: string, sentence: string): Promise<string> => {
    console.log("geminiService.ts: Preparing to validate challenge sentence..."); // <-- Log
    const payload = { word, sentence };
    return callSecureFunction('validateChallengeSentence', payload);
};

export const getWordAnalysis = async (word: string): Promise<string> => {
    console.log("geminiService.ts: Preparing to get word analysis for:", word); // <-- Log
    const payload = { word };
    return callSecureFunction('getWordAnalysis', payload);
};