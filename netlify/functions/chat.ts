// --- هذا الملف: netlify/functions/chat.ts ---
import { GoogleGenAI, Content, Type } from "@google/genai";

// --- إدارة المفاتيح تبقى كما هي ---
let apiKeys: string[] = []; let currentKeyIndex = 0; let keysLoaded = false;
const loadApiKeys = () => {
    if (keysLoaded) return;
    apiKeys = (process.env.GEMINI_KEYS || "").split(',').filter(Boolean);
    if (apiKeys.length === 0) { console.error("FATAL: GEMINI_KEYS env var not set."); }
    else { console.log(`Loaded ${apiKeys.length} API keys.`); keysLoaded = true; }
    currentKeyIndex = 0;
};

// --- وظيفة الفشل الذكي تبقى كما هي ---
const runAIGeneration = async ( task: (ai: GoogleGenAI) => Promise<string> ): Promise<string> => {
    loadApiKeys();
    if (apiKeys.length === 0) { throw new Error("API keys not configured."); }
    const maxTries = apiKeys.length;
    for (let i = 0; i < maxTries; i++) {
        const keyToTry = apiKeys[currentKeyIndex];
        try {
            const ai = new GoogleGenAI({ apiKey: keyToTry });
            // --- تعديل: إضافة Log عند محاولة المفتاح ---
            console.log(`runAIGeneration: Attempting task with key index ${currentKeyIndex}`);
            const result = await task(ai);
            console.log(`runAIGeneration: Key index ${currentKeyIndex} succeeded.`); // <-- Log Success
            return result;
        } catch (error: any) {
            console.warn(`runAIGeneration: Key index ${currentKeyIndex} failed. Error: ${error.message}`); // <-- Log Warn with message
            currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
            if (i === maxTries - 1) {
                console.error("runAIGeneration: All API keys failed.", error.message);
                throw new Error("All AI servers busy. Please try again.");
            }
        }
    }
    throw new Error("All API keys failed.");
};

// --- المعالج الرئيسي (The Function Handler) ---
export const handler = async (event: any) => {
    console.log("Netlify Function: Received request."); // <-- Log 1

    if (event.httpMethod !== 'POST') {
        console.warn("Netlify Function: Received non-POST request.");
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    let type: string = 'unknown'; // متغير لتتبع النوع في حالة الخطأ
    let payload: any = {}; // متغير لتتبع البيانات في حالة الخطأ

    try {
        const body = JSON.parse(event.body || "{}");
        type = body.type; // حفظ النوع
        payload = body.payload; // حفظ البيانات
        console.log(`Netlify Function: Processing type "${type}" with payload:`, JSON.stringify(payload, null, 2)); // <-- Log 2 (Detailed)

        let resultText: string;

        if (type === 'sendMessage') {
            const { message, history, systemInstruction } = payload;
            // --- إضافة Log قبل الاستدعاء ---
            console.log(`Netlify Function (sendMessage): Calling runAIGeneration...`);
            resultText = await runAIGeneration(async (ai) => {
                const chat = ai.chats.create({ model: 'gemini-2.5-flash', config: { systemInstruction }, history: history as Content[] });
                const result = await chat.sendMessage({ message });
                return result.text;
            });
            // --- إضافة Log بعد الاستدعاء ---
            console.log(`Netlify Function (sendMessage): Received result.`);

        } else if (type === 'extractVocabulary') {
            const { conversationText } = payload;
             // --- إضافة Log قبل الاستدعاء ---
             console.log(`Netlify Function (extractVocabulary): Calling runAIGeneration...`);
             resultText = await runAIGeneration(async (ai) => {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash', contents: `... Conversation:\n${conversationText}`,
                    config: { responseMimeType: "application/json", responseSchema: { /* ... schema ... */ } }
                });
                return response.text;
            });
            // --- إضافة Log بعد الاستدعاء ---
            console.log(`Netlify Function (extractVocabulary): Received result.`);

        } else if (type === 'getGrammarExplanation') {
            const { userSentence, aiCorrection } = payload;
            // --- إضافة Log قبل الاستدعاء ---
            console.log(`Netlify Function (getGrammarExplanation): Calling runAIGeneration...`);
            resultText = await runAIGeneration(async (ai) => {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash', contents: `A language learner wrote: "${userSentence}". ...`,
                });
                return response.text;
            });
            // --- إضافة Log بعد الاستدعاء ---
            console.log(`Netlify Function (getGrammarExplanation): Received result.`);

        } else if (type === 'validateChallengeSentence') {
            const { word, sentence } = payload;
             // --- إضافة Log قبل الاستدعاء ---
             console.log(`Netlify Function (validateChallengeSentence): Calling runAIGeneration...`);
             resultText = await runAIGeneration(async (ai) => {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash', contents: `A language learner was challenged to use the word "${word}"...`,
                });
                return response.text;
            });
            // --- إضافة Log بعد الاستدعاء ---
            console.log(`Netlify Function (validateChallengeSentence): Received result.`);

        // --- تعديل بسيط في اسم النوع ليتطابق مع service ---
        } else if (type === 'getWordAnalysis') {
            const { word } = payload;
             // --- إضافة Log قبل الاستدعاء ---
             console.log(`Netlify Function (getWordAnalysis): Calling runAIGeneration...`);
             resultText = await runAIGeneration(async (ai) => {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash', contents: `Provide a simple analysis for the English word "${word}"...`,
                });
                return response.text;
            });
            // --- إضافة Log بعد الاستدعاء ---
            console.log(`Netlify Function (getWordAnalysis): Received result.`);

        } else {
            console.error(`Netlify Function: Invalid task type received: ${type}`);
            throw new Error(`Invalid task type: ${type}`);
        }
        
        // --- إضافة Log قبل إرجاع الرد ---
        console.log(`Netlify Function: Successfully processed type "${type}". Returning result.`);
        return {
            statusCode: 200,
            body: JSON.stringify({ text: resultText }) // تأكد من إرجاع JSON
        };

    } catch (error: any) {
        // --- تعديل: إضافة تفاصيل أكثر للخطأ في الخلفية ---
        console.error(`Netlify Function: Error during processing type "${type}" with payload:`, payload, "Error:", error); // <-- Log Error with details
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message || "An internal server error occurred." })
        };
    }
};