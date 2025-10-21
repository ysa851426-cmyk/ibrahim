// --- هذا الملف: netlify/functions/chat.ts ---
// هذا الكود سيعمل على خادم Netlify (آمن)

import { GoogleGenAI, Content } from "@google/genai";

// --- 1. إدارة المفاتيح (Key Management) ---
let apiKeys: string[] = [];
let currentKeyIndex = 0;
let keysLoaded = false;

const loadApiKeys = () => {
    if (keysLoaded) return;
    // نقرأ المفاتيح من متغيرات Netlify الآمنة
    // لاحظ: الاسم هنا GEMINI_KEYS (بدون VITE_)
    apiKeys = (process.env.GEMINI_KEYS || "")
        .split(',')
        .filter(Boolean);
    
    if (apiKeys.length === 0) {
        console.error("FATAL: GEMINI_KEYS environment variable is not set in Netlify.");
    } else {
        console.log(`Loaded ${apiKeys.length} API keys securely.`);
        keysLoaded = true;
    }
    currentKeyIndex = 0;
};

// --- 2. وظيفة الفشل الذكي (Failover Helper) ---
const runAIGeneration = async (
    task: (ai: GoogleGenAI) => Promise<string> // نعدل النوع ليُرجع string
): Promise<string> => {
    loadApiKeys();
    if (apiKeys.length === 0) {
        throw new Error("API keys are not configured on the server.");
    }

    const maxTries = apiKeys.length;
    for (let i = 0; i < maxTries; i++) {
        const keyToTry = apiKeys[currentKeyIndex];
        
        try {
            const ai = new GoogleGenAI({ apiKey: keyToTry });
            const result = await task(ai);
            // console.log(`API Key ${currentKeyIndex} succeeded.`);
            return result;

        } catch (error: any) {
            console.warn(`API Key ${currentKeyIndex} failed. Moving to next key.`);
            currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
            if (i === maxTries - 1) {
                console.error("All API keys failed.", error.message);
                throw new Error("All AI servers are currently busy. Please try again.");
            }
        }
    }
    throw new Error("All API keys failed.");
};

// --- 3. المعالج الرئيسي (The Function Handler) ---
// هذا هو ما يستدعيه تطبيق React
export const handler = async (event: any) => {
    
    // الأمان: التأكد أن الطلب هو POST
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // 1. قراءة البيانات القادمة من تطبيق React
        const body = JSON.parse(event.body || "{}");
        
        // استخراج البيانات المطلوبة
        const { type, payload } = body;
        
        let resultText: string;

        // 2. تحديد المهمة المطلوبة
        if (type === 'sendMessage') {
            const { message, history, systemInstruction } = payload;
            resultText = await runAIGeneration(async (ai) => {
                const chat = ai.chats.create({
                    model: 'gemini-2.5-flash',
                    config: { systemInstruction },
                    history: history as Content[] // نثق بالنوع القادم
                });
                const result = await chat.sendMessage({ message });
                return result.text;
            });

        } else if (type === 'extractVocabulary') {
            const { conversationText } = payload;
            resultText = await runAIGeneration(async (ai) => {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: `From the following conversation, extract up to 10 key English vocabulary words. For each word, provide the word, up to 3 English synonyms, and all corresponding Arabic meanings. Focus on non-trivial words.\n\nConversation:\n${conversationText}`,
                    config: { responseMimeType: "application/json" } // Schema غير مدعوم هنا، سنعتمد على JSON
                });
                return response.text;
            });

        } else if (type === 'getGrammarExplanation') {
            const { userSentence, aiCorrection } = payload;
            resultText = await runAIGeneration(async (ai) => {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: `A language learner wrote: "${userSentence}". The AI tutor provided a correction and a brief explanation: "${aiCorrection.replace('[?]', '')}". Please provide a more detailed but easy-to-understand explanation of the specific grammar rule...`,
                });
                return response.text;
            });

        } else if (type === 'validateChallengeSentence') {
            const { word, sentence } = payload;
             resultText = await runAIGeneration(async (ai) => {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: `A language learner was challenged to use the word "${word}" in a sentence. They wrote: "${sentence}".\nPlease provide feedback...`,
                });
                return response.text;
            });

        } else {
            throw new Error('Invalid task type');
        }

        // 3. إرجاع الرد الناجح إلى React
        return {
            statusCode: 200,
            body: JSON.stringify({ text: resultText })
        };

    } catch (error: any) {
        // 4. إرجاع الخطأ إلى React
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};