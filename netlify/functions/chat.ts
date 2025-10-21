// --- هذا الملف: netlify/functions/chat.ts ---
import { GoogleGenAI, Content, Type } from "@google/genai";

// --- 1. إدارة المفاتيح (Key Management) ---
let apiKeys: string[] = [];
let currentKeyIndex = 0;
let keysLoaded = false;

const loadApiKeys = () => {
    if (keysLoaded) return;
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
    task: (ai: GoogleGenAI) => Promise<string>
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
export const handler = async (event: any) => {
    
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const body = JSON.parse(event.body || "{}");
        const { type, payload } = body;
        
        let resultText: string;

        if (type === 'sendMessage') {
            const { message, history, systemInstruction } = payload;
            resultText = await runAIGeneration(async (ai) => {
                const chat = ai.chats.create({
                    model: 'gemini-2.5-flash',
                    config: { systemInstruction },
                    history: history as Content[]
                });
                const result = await chat.sendMessage({ message });
                return result.text;
            });

        } else if (type === 'extractVocabulary') {
            const { conversationText } = payload;
            resultText = await runAIGeneration(async (ai) => {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: `From the following conversation, extract up to 10 key English vocabulary words.
Your task is to provide JSON. For each word:
1.  Provide the English 'word'.
2.  Provide up to 3 English 'synonyms' in an array.
3.  Provide all corresponding 'arabicMeanings' in an array. This is a strict requirement.
Conversation:\n${conversationText}`,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.ARRAY,
                            description: "A list of key vocabulary words.",
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    word: { type: Type.STRING, description: "The vocabulary word in English." },
                                    synonyms: { type: Type.ARRAY, description: "Up to 3 English synonyms.", items: { type: Type.STRING } },
                                    arabicMeanings: { type: Type.ARRAY, description: "Meanings in Arabic.", items: { type: Type.STRING } }
                                },
                                required: ["word", "synonyms", "arabicMeanings"]
                            }
                        }
                    }
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

        // --- [ الإضافة الجديدة هنا ] ---
        } else if (type === 'getWordAnalysis') {
            const { word } = payload;
            resultText = await runAIGeneration(async (ai) => {
                const response = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    // هذا هو الأمر (Prompt) الجديد لميزتك
                    contents: `Provide a simple analysis for the English word "${word}".
Identify all its possible types (e.g., noun, verb, adjective, adverb).
For each type, provide:
1.  A simple definition in English.
2.  One clear example sentence.
Format the response clearly using Markdown (e.g., use headings like "As an Adjective:" or "As a Noun:").`,
                });
                return response.text;
            });
        // --- [ نهاية الإضافة ] ---

        } else {
            throw new Error('Invalid task type');
        }

        return {
            statusCode: 200,
            body: JSON.stringify({ text: resultText })
        };

    } catch (error: any) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};