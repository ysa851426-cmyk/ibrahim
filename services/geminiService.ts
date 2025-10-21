// --- هذا الملف: services/geminiService.ts ---
import { Message, Role, VocabularyItem, Difficulty } from '../types';

const API_ENDPOINT = '/.netlify/functions/chat';

const callSecureFunction = async (type: string, payload: any): Promise<string> => {
    // أبقينا على Log واحد مهم هنا
    console.log(`Frontend: Calling secure function - Type: ${type}`);
    try {
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, payload })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error(`Frontend: Server responded with error ${response.status} for type ${type}:`, data.error); // <-- Log Error
            throw new Error(data.error || `Server error (${response.status})`);
        }
        
        // لا نحتاج لطباعة الرد هنا، فقط نُرجعه
        return data.text;

    } catch (error: any) {
        console.error(`Frontend: Error in callSecureFunction (Type: ${type}):`, error.message); // <-- Log Error
        if (error instanceof SyntaxError && error.message.includes('JSON')) {
             throw new Error("Received an invalid response from the server.");
        }
        throw new Error(error.message || `Network or parsing error calling function type ${type}`);
    }
}

// --- وظيفة getSystemInstruction تبقى كما هي ---
const getSystemInstruction = (languageName: string, difficulty: Difficulty, contextText?: string, scenarioPrompt?: string) => { /* ... */ };

// --- الوظائف الرئيسية ---
let currentLanguage: string = 'English';
let currentDifficulty: Difficulty = 'Beginner';

export const startChatSession = (languageName: string, difficulty: Difficulty): void => {
    currentLanguage = languageName;
    currentDifficulty = difficulty;
    // لا داعي للـ Log هنا
};

export const sendMessageToAI = async ( message: string, currentHistory: Message[], contextText?: string, scenarioPrompt?: string ): Promise<string> => {
    const instruction = getSystemInstruction(currentLanguage, currentDifficulty, contextText, scenarioPrompt);
    const payload = { message, history: currentHistory, systemInstruction: instruction };
    return callSecureFunction('sendMessage', payload);
};

export const extractVocabulary = async (conversation: Message[]): Promise<VocabularyItem[]> => {
    const relevantConversation = conversation.filter(m => m.role === Role.USER || (m.role === Role.MODEL && !m.text.startsWith("Sorry,")));
    const conversationText = relevantConversation.map(m => `${m.role}: ${m.text}`).join('\n');
    if (relevantConversation.length < 2) return [];
    const payload = { conversationText };
    const responseText = await callSecureFunction('extractVocabulary', payload);
    try {
        return JSON.parse(responseText.trim()) as VocabularyItem[];
    } catch (e: any) { // أبقينا على Log الخطأ هنا لأنه مهم
        console.error("Frontend: Failed to parse vocabulary JSON:", e, "Raw response:", responseText);
        throw new Error("Received invalid vocabulary data from the server.");
    }
};

export const getGrammarExplanation = async (userSentence: string, aiCorrection: string): Promise<string> => {
    const payload = { userSentence, aiCorrection };
    return callSecureFunction('getGrammarExplanation', payload);
};

export const validateChallengeSentence = async (word: string, sentence: string): Promise<string> => {
    const payload = { word, sentence };
    return callSecureFunction('validateChallengeSentence', payload);
};

export const getWordAnalysis = async (word: string): Promise<string> => {
    const payload = { word };
    return callSecureFunction('getWordAnalysis', payload);
};