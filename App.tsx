// Fix(App.tsx): Add type definitions for the Web Speech API.
// ... (كل التعريفات في الأعلى تبقى كما هي) ...
interface SpeechRecognition extends EventTarget { /* ... */ }
// ... (باقي التعريفات) ...
interface SpeechRecognitionStatic { new (): SpeechRecognition; }
declare const mammoth: any; declare const pdfjsLib: any;
declare global { interface Window { /* ... */ } }

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Message, Role, LanguageOption, VocabularyItem, Difficulty, Scenario, Theme } from './types';
import { SUPPORTED_LANGUAGES, DIFFICULTIES, THEMES } from './constants';
// --- [ تعديل 1: استيراد الوظيفة الجديدة ] ---
import { startChatSession, sendMessageToAI, extractVocabulary, getGrammarExplanation, validateChallengeSentence, getWordAnalysis } from './services/geminiService';
import MessageBubble from './components/MessageBubble';
import Modal from './components/Modal';

// ... (باقي الكود) ...
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

const App: React.FC = () => {
    // --- States تبقى كما هي ---
    const [conversation, setConversation] = useState<Message[]>([]);
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(SUPPORTED_LANGUAGES[0]);
    const [difficulty, setDifficulty] = useState<Difficulty>('Beginner'); // <-- تم إصلاح الخطأ المطبعي
    const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isApiBusy, setIsApiBusy] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
    const [textInput, setTextInput] = useState<string>('');
    const [theme, setTheme] = useState<string>('default');
    const [activeContext, setActiveContext] = useState<string | undefined>();
    const [contextTitle, setContextTitle] = useState<string | null>(null);
    const [isApiOnCooldown, setIsApiOnCooldown] = useState<boolean>(false);
    const [cooldownTimer, setCooldownTimer] = useState<number>(0);
    const [audioUnlocked, setAudioUnlocked] = useState(false);
    const [isTextAnalysisModalOpen, setIsTextAnalysisModalOpen] = useState<boolean>(false);
    const [textForAnalysis, setTextForAnalysis] = useState<string>('');
    const [isDictionaryModalOpen, setIsDictionaryModalOpen] = useState<boolean>(false);
    const [vocabularyList, setVocabularyList] = useState<VocabularyItem[] | null>(null);
    const [isScenarioModalOpen, setIsScenarioModalOpen] = useState<boolean>(false);
    const [customScenarioInput, setCustomScenarioInput] = useState<string>('');
    const [isGrammarModalOpen, setIsGrammarModalOpen] = useState<boolean>(false);
    const [grammarExplanation, setGrammarExplanation] = useState<string>('');
    const [isDailyChallengeModalOpen, setIsDailyChallengeModalOpen] = useState<boolean>(false);
    const [dailyChallenge, setDailyChallenge] = useState<VocabularyItem | null>(null);
    const [challengeSentence, setChallengeSentence] = useState<string>('');
    const [challengeFeedback, setChallengeFeedback] = useState<string>('');
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
    const [isWordAnalysisModalOpen, setIsWordAnalysisModalOpen] = useState<boolean>(false);
    const [wordAnalysisResult, setWordAnalysisResult] = useState<string>('');
    const [currentWordAnalyzed, setCurrentWordAnalyzed] = useState<string>('');
    const [analysisMode, setAnalysisMode] = useState<'paste' | 'upload' | 'link'>('paste');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileProcessingMessage, setFileProcessingMessage] = useState<string | null>(null);
    const [urlInput, setUrlInput] = useState<string>('');

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const cooldownIntervalRef = useRef<number | null>(null);

    // --- الوظائف المساعدة تبقى كما هي ---
    const scrollToBottom = () => { /* ... */ };
    useEffect(() => { /* ... */ }, []);
    const startNewSession = useCallback((contextText?: string, scenario?: Scenario, newContextTitle?: string) => {
        console.log("App.tsx: Starting new session..."); // <-- Log
        startChatSession(selectedLanguage.name, difficulty);
        setConversation([]);
        setCurrentScenario(scenario || null);
        setContextTitle(newContextTitle || null);
        setActiveContext(contextText);
    }, [selectedLanguage, difficulty]);
    useEffect(scrollToBottom, [conversation]);
    useEffect(() => {
        console.log("App.tsx: Language/Difficulty changed, starting new session."); // <-- Log
        document.documentElement.lang = selectedLanguage.code.split('-')[0];
        document.documentElement.dir = selectedLanguage.dir;
        startNewSession();
    }, [selectedLanguage, difficulty, startNewSession]); // <-- تم إضافة difficulty
    useEffect(() => { /* Theme loading */ }, []);
    useEffect(() => { /* Daily Challenge Check */ }, []);
    const extractTextFromFile = async (file: File) => { /* ... */ };
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };
    const handleRemoveFile = () => { /* ... */ };
    const handleApiError = useCallback((error: any) => {
         console.error("App.tsx: API Error Handler:", error); // <-- Log Error
        const message = error.message || "An unknown error occurred.";
        if (message.includes("exceeded the request limit")) { /* ... */ }
        else { setError(message); }
     }, []);
    const speak = useCallback((text: string) => { /* ... */ }, [selectedLanguage.code]);
    const processAIResponse = useCallback(async (userText: string) => {
        console.log("App.tsx: Processing AI response for:", userText); // <-- Log
        setIsApiBusy(true); setError(null);
        try {
            console.log("App.tsx: Calling sendMessageToAI..."); // <-- Log
            const aiText = await sendMessageToAI(userText, conversation, activeContext, currentScenario?.prompt);
            console.log("App.tsx: Received AI response:", aiText); // <-- Log
            const aiMessage: Message = { role: Role.MODEL, text: aiText };
            setConversation(prev => [...prev, aiMessage]);
            speak(aiText.replace(/\[\?\]/g, ''));
        } catch (e: any) {
            handleApiError(e);
            const errorMessage: Message = { role: Role.MODEL, text: "Sorry, I couldn't process that. Please try again." };
            setConversation(prev => [...prev, errorMessage]);
        } finally {
            setIsApiBusy(false);
        }
    }, [conversation, activeContext, currentScenario, handleApiError, speak]);
    const handleRecognitionResult = useCallback((event: SpeechRecognitionEvent) => { /* ... */ }, [processAIResponse]);
    const setupRecognition = useCallback(() => { /* ... */ }, [selectedLanguage, handleRecognitionResult]);
    useEffect(setupRecognition, [setupRecognition]);
    const unlockAudioContext = () => { /* ... */ };
    const handleStopSpeaking = () => { /* ... */ };
    const handleRecordClick = () => { /* ... */ };
    const handleSendMessage = () => { /* ... */ };
    const handleClearConversation = () => { /* ... */ };
    const handleContentAnalysisSubmit = () => {
        console.log("App.tsx: Handling Content Analysis Submit..."); // <-- Log
        let contentToAnalyze = ''; let newContextTitle = '';
        // ... (منطق تحديد المحتوى) ...
        setIsTextAnalysisModalOpen(false);
        startNewSession(contentToAnalyze, undefined, newContextTitle);
        if (analysisMode !== 'link') { /* ... */ }
        else { processAIResponse("Let's discuss the content from the link."); } // <-- التأكد من استدعاء processAIResponse
        // ... (Reset state) ...
    };
    const handleCustomScenarioSubmit = () => {
        console.log("App.tsx: Handling Custom Scenario Submit..."); // <-- Log
        const trimmedScenario = customScenarioInput.trim(); if (!trimmedScenario) return;
        setIsScenarioModalOpen(false);
        if (conversation.length > 0 && !window.confirm("...")) { return; }
        const scenarioPrompt = `...`; const newScenario: Scenario = { /* ... */ };
        startNewSession(undefined, newScenario, `🎭 Scenario: ${trimmedScenario}`);
        processAIResponse("Let's begin the role-play."); // <-- التأكد من استدعاء processAIResponse
        setCustomScenarioInput('');
    };
    const handleOpenDictionary = async () => {
        console.log("App.tsx: Opening Dictionary..."); // <-- Log
        setIsDictionaryModalOpen(true); setIsApiBusy(true); setError(null);
        try {
            console.log("App.tsx: Calling extractVocabulary..."); // <-- Log
            const vocab = await extractVocabulary(conversation);
            console.log("App.tsx: Received vocabulary:", vocab); // <-- Log
            setVocabularyList(vocab);
            if (vocab.length > 0) { /* localStorage ... */ }
        } catch (e: any) { handleApiError(e); setVocabularyList(null); }
        finally { setIsApiBusy(false); }
    };
    const handleDifficultyChange = (newDifficulty: Difficulty) => { /* ... */ };
    const handleExplainClick = async (messageIndex: number) => {
        console.log("App.tsx: Handling Explain Click for index:", messageIndex); // <-- Log
        const aiMessage = conversation[messageIndex]; const userMessage = conversation[messageIndex - 1];
        if (!aiMessage || !userMessage || userMessage.role !== Role.USER || isApiBusy || isApiOnCooldown) {
            console.warn("App.tsx: Explain click condition not met."); // <-- Log Warn
            return;
        }
        setIsGrammarModalOpen(true); setIsApiBusy(true); setGrammarExplanation('');
        try {
            console.log("App.tsx: Calling getGrammarExplanation..."); // <-- Log
            const explanation = await getGrammarExplanation(userMessage.text, aiMessage.text);
            console.log("App.tsx: Received grammar explanation:", explanation); // <-- Log
            setGrammarExplanation(explanation);
        } catch (e: any) { handleApiError(e); setGrammarExplanation("Sorry, ..."); }
        finally { setIsApiBusy(false); }
    };
    const handleChallengeSubmit = async () => { /* ... */ };
    const handleThemeChange = (themeId: string) => { /* ... */ };
    const handleAnalyzeWordClick = async (word: string) => {
        console.log("App.tsx: Handling Analyze Word Click for:", word); // <-- Log
        setIsWordAnalysisModalOpen(true); setIsApiBusy(true); setWordAnalysisResult(''); setCurrentWordAnalyzed(word);
        try {
            console.log("App.tsx: Calling getWordAnalysis..."); // <-- Log
            const result = await getWordAnalysis(word);
            console.log("App.tsx: Received word analysis:", result); // <-- Log
            setWordAnalysisResult(result);
        } catch (e: any) { handleApiError(e); setWordAnalysisResult("Sorry, ..."); }
        finally { setIsApiBusy(false); }
    };
    const renderRecordButtonContent = () => { /* ... */ };
    const currentTheme = THEMES.find(t => t.id === theme) || THEMES[0];
    const isAnalysisSubmitDisabled = () => { /* ... */ };

    // --- JSX يبقى كما هو ---
    return (
        <div className={`flex flex-col h-screen bg-gradient-to-br ${currentTheme.class} text-white font-sans`}>
            <header className="flex justify-between items-center p-4 ..."> {/* ... */} </header>
            <main ref={chatContainerRef} className="flex-1 flex flex-col p-4 overflow-y-auto">
                 {conversation.length === 0 && ( /* ... */ )}
                 {conversation.map((msg, index) => (
                    <MessageBubble key={index} message={msg} messageIndex={index} onExplainClick={handleExplainClick} onPlayAudio={speak} />
                 ))}
            </main>
            {/* ... Error/Cooldown Footer ... */}
            <footer className="p-4 bg-black bg-opacity-30 ..."> {/* ... */} </footer>
            
            {/* --- Modals تبقى كما هي (مع إضافة الزر في القاموس) --- */}
            <Modal isOpen={isDictionaryModalOpen} onClose={() => setIsDictionaryModalOpen(false)} title="Conversation Dictionary">
                {/* ... (منطق عرض القاموس) ... */}
                {vocabularyList && vocabularyList.map((item, index) => (
                    <div key={index} className="...">
                        {/* ... (عرض الكلمة والمعاني) ... */}
                        <button onClick={() => handleAnalyzeWordClick(item.word)} /* ... */ > Analyze Word Type </button>
                    </div>
                ))}
            </Modal>
            <Modal isOpen={isWordAnalysisModalOpen} onClose={() => setIsWordAnalysisModalOpen(false)} title={`Analysis for: "${currentWordAnalyzed}"`}>
                 {isApiBusy ? <div className="..."><i className="..."></i></div> : <p className="text-base whitespace-pre-wrap">{wordAnalysisResult}</p>}
            </Modal>
            {/* ... (باقي الـ Modals) ... */}
        </div>
    );
};

export default App;