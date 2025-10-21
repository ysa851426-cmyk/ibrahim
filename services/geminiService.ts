// --- ملف: services/geminiService.ts (مُعدل للواجهة الأمامية + اسم النموذج الصحيح) ---
import { GoogleGenAI, Chat, Type, Content } from "@google/genai"; // تأكد من استيراد Content
import { Message, Role, VocabularyItem, Difficulty } from '../types';

// --- API Key Management for multiple keys ---
let apiKeys: string[] = [];
let currentApiKeyIndex = 0;
let keysLoaded = false; // لمنع إعادة التهيئة

/**
 * Initializes the API keys from the environment variable VITE_API_KEY.
 * Supports a single key or a comma-separated list of keys.
 */
const initializeApiKeys = () => {
    // --- التعديل هنا ---
    if (keysLoaded) return;
    const apiKeyEnv = import.meta.env.VITE_API_KEY || ''; // استخدام VITE_API_KEY
    // --- نهاية التعديل ---

    if (apiKeyEnv.includes(',')) {
        apiKeys = apiKeyEnv.split(',').map(key => key.trim()).filter(key => key);
    } else if (apiKeyEnv) {
        apiKeys = [apiKeyEnv.trim()];
    }

    if (apiKeys.length === 0) {
        // سنرمي خطأ ليظهر في القنصول بوضوح
         console.error("VITE_API_KEY environment variable is not set or is empty in .env.local or Netlify settings.");
         throw new Error("API key environment variable is not set or is empty."); // هذا سيوقف التطبيق ويظهر في القنصول
    } else {
         console.log(`Initialized with ${apiKeys.length} API keys.`);
         keysLoaded = true;
    }
    currentApiKeyIndex = 0; // البدء من الأول دائماً
};

/**
 * Gets the next API key from the pool in a round-robin fashion.
 * @returns {string} The next API key.
 * @throws {Error} If no API keys are configured.
 */
const getNextApiKey = (): string => {
    initializeApiKeys(); // تأكد من التهيئة قبل الحصول على المفتاح
    if (apiKeys.length === 0) {
        // هذا الخطأ يجب ألا يحدث إذا تم التعامل مع الخطأ في initializeApiKeys
        throw new Error("No API keys configured after initialization attempt.");
    }
    const key = apiKeys[currentApiKeyIndex];
    currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length; // Move to the next key
    return key;
};

/**
 * Creates a new GoogleGenAI client instance with the next available API key.
 * @returns {GoogleGenAI} A new GoogleGenAI client.
 */
const getGeminiClient = () => {
    const apiKey = getNextApiKey();
    return new GoogleGenAI({ apiKey });
};
// --- End of API Key Management ---


const getApiErrorMessage = (error: any): string => {
    console.error("Gemini API Error details:", error); // طباعة الخطأ الكامل للمساعدة
    const errorMessage = error.message || '';
    // --- [ تعديل: إضافة معالجة خطأ 404 ] ---
    if (error.code === 404 || (error.error && error.error.code === 404) || errorMessage.includes('404')) {
        return `Sorry, the requested AI model was not found. Please check the model name in the code. (${errorMessage.substring(0, 100)})`;
    }
    // --- [ نهاية التعديل ] ---
    if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        return "You've exceeded the request limit. Please wait a moment and try again.";
    }
    if (errorMessage.includes('API key not valid') || errorMessage.includes('API_KEY')) {
        return "An API key used is invalid or missing quota. Please check your keys.";
    }
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
         return "Network error: Could not connect to the AI service. Please check your internet connection.";
    }
    return `Sorry, an unknown error occurred with the AI service: ${errorMessage.substring(0, 100)}`;
}

// The getSystemInstruction function remains the same.
const getSystemInstruction = (languageName: string, difficulty: Difficulty, contextText?: string, scenarioPrompt?: string): string => {
    // ... (انسخ نفس الكود الأصلي لوظيفة getSystemInstruction بالكامل هنا) ...
    let baseInstruction = `You are Poly... [?]...`; // أكمل هذا الجزء من الكود الأصلي
    if (scenarioPrompt) { baseInstruction += `...`; }
    if (contextText) { return `You are Poly... Here is the text:\n---\n${contextText}\n---`; } // أكمل هذا الجزء
    return baseInstruction;
};


// --- الوظائف المصدرة (تستخدم الآن getGeminiClient للتبديل) ---

export const startChatSession = (languageName: string, difficulty: Difficulty, contextText?: string, scenarioPrompt?: string): Chat => {
    const ai = getGeminiClient(); // احصل على عميل بمفتاح جديد
    const chat = ai.chats.create({
        // --- [ التعديل هنا ] ---
        model: 'gemini-1.5-flash-latest', // استخدام الاسم الصحيح
        // --- [ نهاية التعديل ] ---
        config: { systemInstruction: getSystemInstruction(languageName, difficulty, contextText, scenarioPrompt) },
        history: []
    });
    console.log("geminiService.ts (Multi-Key): New chat session started.");
    return chat;
};

// sendMessageToAI الأصلي الذي يتلقى Chat object
export const sendMessageToAI = async (chat: Chat, message: string): Promise<string> => {
    try {
        console.log("geminiService.ts (Multi-Key): Sending message...");
        const result = await chat.sendMessage({ message });
        console.log("geminiService.ts (Multi-Key): Received response.");
        return result.text;
    } catch (error: any) { // <-- تعديل بسيط هنا لإضافة النوع 'any'
        // إضافة طباعة للخطأ قبل رميه
        console.error("sendMessageToAI Error:", error);
        throw new Error(getApiErrorMessage(error));
    }
};

// باقي الوظائف تستخدم generateContent وتتبدل المفاتيح تلقائياً
export const extractVocabulary = async (conversation: Message[]): Promise<VocabularyItem[]> => {
    const ai = getGeminiClient();
    const relevantConversation = conversation.filter(m => m.role === Role.USER || (m.role === Role.MODEL && !m.text.startsWith("Sorry,")));
    const conversationText = relevantConversation.map(m => `${m.role}: ${m.text}`).join('\n');
    if (relevantConversation.length < 2) return [];
     try {
         const response = await ai.models.generateContent({
             // --- [ التعديل هنا ] ---
             model: 'gemini-1.5-flash-latest',
             // --- [ نهاية التعديل ] ---
             contents: `From the following conversation... Conversation:\n${conversationText}`,
             config: { responseMimeType: "application/json", responseSchema: { /* ... schema ... */ } }
         });
         return JSON.parse(response.text.trim()) as VocabularyItem[];
     } catch (error: any) { throw new Error(getApiErrorMessage(error)); }
};

export const getGrammarExplanation = async (userSentence: string, aiCorrection: string): Promise<string> => {
    const ai = getGeminiClient();
     try {
         const response = await ai.models.generateContent({
             // --- [ التعديل هنا ] ---
             model: 'gemini-1.5-flash-latest',
             // --- [ نهاية التعديل ] ---
             contents: `A language learner wrote: "${userSentence}"... Please provide a detailed explanation...`,
         });
         return response.text;
     } catch (error: any) { throw new Error(getApiErrorMessage(error)); }
};

export const validateChallengeSentence = async (word: string, sentence: string): Promise<string> => {
    const ai = getGeminiClient();
     try {
         const response = await ai.models.generateContent({
             // --- [ التعديل هنا ] ---
             model: 'gemini-1.5-flash-latest',
             // --- [ نهاية التعديل ] ---
             contents: `A language learner was challenged to use the word "${word}"... Please provide feedback...`,
         });
         return response.text;
     } catch (error: any) { throw new Error(getApiErrorMessage(error)); }
};

export const getWordAnalysis = async (word: string): Promise<string> => {
    const ai = getGeminiClient();
     try {
         const response = await ai.models.generateContent({
             // --- [ التعديل هنا ] ---
             model: 'gemini-1.5-flash-latest',
             // --- [ نهاية التعديل ] ---
             contents: `Provide a simple analysis for the English word "${word}"...`,
         });
         return response.text;
     } catch (error: any) { throw new Error(getApiErrorMessage(error)); }
};

export const getWordFamily = async (word: string): Promise<string> => {
    const ai = getGeminiClient();
     try {
         const response = await ai.models.generateContent({
             // --- [ التعديل هنا ] ---
             model: 'gemini-1.5-flash-latest',
             // --- [ نهاية التعديل ] ---
             contents: `List words belonging to the same word family as "${word}"...`, // أكمل الـ prompt هنا
         });
         return response.text;
     } catch (error: any) { throw new Error(getApiErrorMessage(error)); }
};