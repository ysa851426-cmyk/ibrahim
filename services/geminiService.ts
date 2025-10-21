import { GoogleGenAI, Chat, Type } from "@google/genai";
import { Message, Role, VocabularyItem, Difficulty } from '../types';

// --- API Key Management for multiple keys ---
let apiKeys: string[] = [];
let currentApiKeyIndex = 0;

/**
 * Initializes the API keys from the environment variable.
 * Supports a single key or a comma-separated list of keys.
 */
const initializeApiKeys = () => {
    const apiKeyEnv = process.env.API_KEY || '';
    if (apiKeyEnv.includes(',')) {
        // Split by comma, trim whitespace from each key, and filter out any empty strings
        apiKeys = apiKeyEnv.split(',').map(key => key.trim()).filter(key => key);
    } else if (apiKeyEnv) {
        apiKeys = [apiKeyEnv.trim()];
    }

    if (apiKeys.length === 0) {
        console.error("API_KEY environment variable is not set or is empty.");
    }
};

// Initialize the keys when the module is loaded
initializeApiKeys();

/**
 * Gets the next API key from the pool in a round-robin fashion.
 * @returns {string} The next API key.
 * @throws {Error} If no API keys are configured.
 */
const getNextApiKey = (): string => {
    if (apiKeys.length === 0) {
        throw new Error("API_KEY is invalid or missing. Please configure it correctly.");
    }
    const key = apiKeys[currentApiKeyIndex];
    currentApiKeyIndex = (currentApiKeyIndex + 1) % apiKeys.length; // Move to the next key for the next call
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
    console.error("Gemini API Error:", error);
    const errorMessage = error.message || '';
    if (errorMessage.includes('429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
        return "You've exceeded the request limit. Please wait a moment and try again.";
    }
    if (errorMessage.includes('API_KEY')) {
        return "An API key is invalid or missing. Please check your configuration.";
    }
    return "Sorry, an unknown error occurred with the AI service. Please try again later.";
}

// The getSystemInstruction function remains the same as it's a pure function.
const getSystemInstruction = (languageName: string, difficulty: Difficulty, contextText?: string, scenarioPrompt?: string) => {
    
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


export const startChatSession = (languageName: string, difficulty: Difficulty, contextText?: string, scenarioPrompt?: string): Chat => {
    const ai = getGeminiClient();
    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
            systemInstruction: getSystemInstruction(languageName, difficulty, contextText, scenarioPrompt),
        }
    });
    return chat;
};

export const sendMessageToAI = async (chat: Chat, message: string): Promise<string> => {
    try {
        const result = await chat.sendMessage({ message });
        return result.text;
    } catch (error) {
        throw new Error(getApiErrorMessage(error));
    }
};

export const extractVocabulary = async (conversation: Message[]): Promise<VocabularyItem[]> => {
    const ai = getGeminiClient();
    const relevantConversation = conversation.filter(m => m.role === Role.USER || (m.role === Role.MODEL && !m.text.startsWith("Sorry,")));
    const conversationText = relevantConversation.map(m => `${m.role}: ${m.text}`).join('\n');
    if (relevantConversation.length < 2) return [];

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `From the following conversation, extract up to 10 key English vocabulary words. For each word, provide the word, up to 3 English synonyms, and all corresponding Arabic meanings. Focus on non-trivial words.\n\nConversation:\n${conversationText}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY, description: "A list of key vocabulary words.", items: {
                        type: Type.OBJECT, properties: {
                            word: { type: Type.STRING, description: "The vocabulary word in English." },
                            synonyms: { type: Type.ARRAY, description: "Up to 3 English synonyms.", items: { type: Type.STRING } },
                            arabicMeanings: { type: Type.ARRAY, description: "Meanings in Arabic.", items: { type: Type.STRING } }
                        }, required: ["word", "synonyms", "arabicMeanings"]
                    }
                }
            }
        });
        return JSON.parse(response.text.trim()) as VocabularyItem[];
    } catch (error) {
        throw new Error(getApiErrorMessage(error));
    }
};

export const getGrammarExplanation = async (userSentence: string, aiCorrection: string): Promise<string> => {
    const ai = getGeminiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `A language learner wrote: "${userSentence}". The AI tutor provided a correction and a brief explanation: "${aiCorrection.replace('[?]', '')}". Please provide a more detailed but easy-to-understand explanation of the specific grammar rule the user made a mistake on. Structure your response with a clear heading for the rule and use bullet points or a short paragraph to explain it. Do not reference the user or AI directly, just explain the grammar concept.`,
        });
        return response.text;
    } catch (error) {
        throw new Error(getApiErrorMessage(error));
    }
};

export const validateChallengeSentence = async (word: string, sentence: string): Promise<string> => {
    const ai = getGeminiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `A language learner was challenged to use the word "${word}" in a sentence. They wrote: "${sentence}".
Please provide feedback on their attempt.
- If the sentence is correct and uses the word well, congratulate them.
- If the sentence has grammatical errors, provide the corrected sentence and a brief explanation.
- If the grammar is correct but the word usage is awkward, explain why and provide a better example.
Keep the feedback concise, positive, and encouraging.`,
        });
        return response.text;
    } catch (error) {
        throw new Error(getApiErrorMessage(error));
    }
};

export const getWordAnalysis = async (word: string): Promise<string> => {
    const ai = getGeminiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Provide a detailed analysis of the English word "${word}". Your response must be in Markdown format.
For each part of speech the word can be, include:
- A heading for the part of speech (e.g., "## Noun").
- A **Definition:** with a simple, one-sentence definition.
- An **Example:** with one clear example sentence using the word.

For example, for the word "run":

## Verb
**Definition:** To move at a speed faster than a walk.
**Example:** I need to run to catch the bus.

## Noun
**Definition:** A period of time spent running, or the distance covered.
**Example:** She went for a long run this morning.`,
        });
        return response.text;
    } catch (error) {
        throw new Error(getApiErrorMessage(error));
    }
};

export const getWordFamily = async (word: string): Promise<string> => {
    const ai = getGeminiClient();
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `For the English word "${word}", provide a list of its word family (related nouns, verbs, adjectives, etc.). For each word in the family, provide its corresponding Arabic translation. Format the response in Markdown using bullet points.
Example for the word 'decide':

- **decision** (noun): قرار
- **decisive** (adjective): حاسم`,
        });
        return response.text;
    } catch (error) {
        throw new Error(getApiErrorMessage(error));
    }
};