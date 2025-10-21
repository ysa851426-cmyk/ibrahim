// --- ملف: services/geminiService.ts (مُعدل للواجهة الأمامية) ---
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
    // console.log(`Using API Key Index: ${currentApiKeyIndex > 0 ? currentApiKeyIndex -1 : apiKeys.length - 1}`); // لـ Debugging
    return key;
};

/**
 * Creates a new GoogleGenAI client instance with the next available API key.
 * @returns {GoogleGenAI} A new GoogleGenAI client.
 */
const getGeminiClient = () => {
    // لا حاجة لـ try...catch هنا، getNextApiKey سترمي الخطأ
    const apiKey = getNextApiKey();
    return new GoogleGenAI({ apiKey });
};
// --- End of API Key Management ---


const getApiErrorMessage = (error: any): string => {
    console.error("Gemini API Error details:", error); // طباعة الخطأ الكامل للمساعدة
    const errorMessage = error.message || '';
    if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        return "You've exceeded the request limit. Please wait a moment and try again.";
    }
    // تعديل رسالة الخطأ لتكون أوضح
    if (errorMessage.includes('API key not valid') || errorMessage.includes('API_KEY')) {
        return "An API key used is invalid or missing quota. Please check your keys.";
    }
    // إضافة معالجة لأخطاء الشبكة المحتملة
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
         return "Network error: Could not connect to the AI service. Please check your internet connection.";
    }
    return `Sorry, an unknown error occurred with the AI service: ${errorMessage.substring(0, 100)}`; // إظهار جزء من الخطأ
}

// The getSystemInstruction function remains the same.
const getSystemInstruction = (languageName: string, difficulty: Difficulty, contextText?: string, scenarioPrompt?: string) => { /* ... نفس الكود ... */ };


// --- الوظائف المصدرة (تستخدم الآن getGeminiClient للتبديل) ---

export const startChatSession = (languageName: string, difficulty: Difficulty, contextText?: string, scenarioPrompt?: string): Chat => {
    const ai = getGeminiClient(); // احصل على عميل بمفتاح جديد
    const chat = ai.chats.create({
        model: 'gemini-1.5-flash', // تأكد من اسم الموديل
        config: { systemInstruction: getSystemInstruction(languageName, difficulty, contextText, scenarioPrompt) },
        history: [] // ابدأ بسجل فارغ
    });
    console.log("geminiService.ts (Multi-Key): New chat session started.");
    return chat;
};

// sendMessageToAI الأصلي الذي يتلقى Chat object
export const sendMessageToAI = async (chat: Chat, message: string): Promise<string> => {
    try {
        console.log("geminiService.ts (Multi-Key): Sending message...");
        // ملاحظة: هذا سيستخدم نفس المفتاح الذي تم إنشاء الشات به
        // قد تحتاج لتعديل هذا إذا أردت تبديل المفتاح *أثناء* المحادثة
        const result = await chat.sendMessage({ message });
        console.log("geminiService.ts (Multi-Key): Received response.");
        return result.text;
    } catch (error) {
        throw new Error(getApiErrorMessage(error));
    }
};

// باقي الوظائف تستخدم generateContent وتتبدل المفاتيح تلقائياً
export const extractVocabulary = async (conversation: Message[]): Promise<VocabularyItem[]> => {
    const ai = getGeminiClient(); // يحصل على مفتاح جديد مع كل استدعاء
    // ... (نفس منطق الطلب مع try/catch) ...
     try {
         const response = await ai.models.generateContent({ /* ... */ });
         return JSON.parse(response.text.trim()) as VocabularyItem[];
     } catch (error) { throw new Error(getApiErrorMessage(error)); }
};

export const getGrammarExplanation = async (userSentence: string, aiCorrection: string): Promise<string> => {
    const ai = getGeminiClient(); // مفتاح جديد
    // ... (نفس منطق الطلب مع try/catch) ...
     try {
         const response = await ai.models.generateContent({ /* ... */ });
         return response.text;
     } catch (error) { throw new Error(getApiErrorMessage(error)); }
};

export const validateChallengeSentence = async (word: string, sentence: string): Promise<string> => {
    const ai = getGeminiClient(); // مفتاح جديد
    // ... (نفس منطق الطلب مع try/catch) ...
     try {
         const response = await ai.models.generateContent({ /* ... */ });
         return response.text;
     } catch (error) { throw new Error(getApiErrorMessage(error)); }
};

export const getWordAnalysis = async (word: string): Promise<string> => {
    const ai = getGeminiClient(); // مفتاح جديد
    // ... (نفس منطق الطلب مع try/catch) ...
     try {
         const response = await ai.models.generateContent({ /* ... */ });
         return response.text;
     } catch (error) { throw new Error(getApiErrorMessage(error)); }
};

export const getWordFamily = async (word: string): Promise<string> => {
    const ai = getGeminiClient(); // مفتاح جديد
    // ... (نفس منطق الطلب مع try/catch) ...
     try {
         const response = await ai.models.generateContent({ /* ... */ });
         return response.text;
     } catch (error) { throw new Error(getApiErrorMessage(error)); }
};