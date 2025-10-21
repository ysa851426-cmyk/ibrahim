// Fix(App.tsx): Add type definitions for the Web Speech API.
// ... (كل التعريفات في الأعلى تبقى كما هي) ...
interface SpeechRecognition extends EventTarget { /* ... */ }
// ... (باقي التعريفات) ...
interface SpeechRecognitionStatic { new (): SpeechRecognition; }
declare const mammoth: any; declare const pdfjsLib: any;
declare global { interface Window { /* ... */ } }

import React, { useState, useEffect, useRef, useCallback } from 'react';
// --- [ تعديل 1: إزالة Chat ] ---
// import { Chat } from '@google/genai';
import { Message, Role, LanguageOption, VocabularyItem, Difficulty, Scenario, Theme } from './types';
import { SUPPORTED_LANGUAGES, DIFFICULTIES, THEMES } from './constants';
// --- [ تعديل 2: التأكد من استيراد كل الوظائف ] ---
import { startChatSession, sendMessageToAI, extractVocabulary, getGrammarExplanation, validateChallengeSentence, getWordAnalysis } from './services/geminiService';
import MessageBubble from './components/MessageBubble';
import Modal from './components/Modal';

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

const App: React.FC = () => {
    // --- States (تبقى كما هي + إضافة activeContext + حالات النافذة الجديدة) ---
    const [conversation, setConversation] = useState<Message[]>([]);
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(SUPPORTED_LANGUAGES[0]);
    const [difficulty, setDifficulty] = useState<Difficulty>('Beginner');
    const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isApiBusy, setIsApiBusy] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
    const [textInput, setTextInput] = useState<string>('');
    const [theme, setTheme] = useState<string>('default');
    // --- [ تعديل 3: إزالة chatSession وإضافة activeContext ] ---
    // const [chatSession, setChatSession] = useState<Chat | null>(null);
    const [activeContext, setActiveContext] = useState<string | undefined>();
    const [contextTitle, setContextTitle] = useState<string | null>(null);
    const [isApiOnCooldown, setIsApiOnCooldown] = useState<boolean>(false);
    const [cooldownTimer, setCooldownTimer] = useState<number>(0);
    const [audioUnlocked, setAudioUnlocked] = useState(false); // لإضافة الحيلة لاحقاً
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
    // --- [ إضافة State لتحليل الكلمة ] ---
    const [isWordAnalysisModalOpen, setIsWordAnalysisModalOpen] = useState<boolean>(false);
    const [wordAnalysisResult, setWordAnalysisResult] = useState<string>('');
    const [currentWordAnalyzed, setCurrentWordAnalyzed] = useState<string>('');
    // --- [ باقي الـ State للملفات والروابط ] ---
    const [analysisMode, setAnalysisMode] = useState<'paste' | 'upload' | 'link'>('paste');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileProcessingMessage, setFileProcessingMessage] = useState<string | null>(null);
    const [urlInput, setUrlInput] = useState<string>('');

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const cooldownIntervalRef = useRef<number | null>(null);

    // --- الوظائف المساعدة ---
    const scrollToBottom = () => { /* ... */ };
    useEffect(() => { /* Cleanup interval */ }, []);

    // --- [ تعديل 4: تحديث startNewSession ] ---
    const startNewSession = useCallback((contextText?: string, scenario?: Scenario, newContextTitle?: string) => {
        // لا نحتاج لاستقبال Chat object بعد الآن
        startChatSession(selectedLanguage.name, difficulty);
        setConversation([]);
        setCurrentScenario(scenario || null);
        setContextTitle(newContextTitle || null);
        setActiveContext(contextText); // حفظ السياق هنا
    }, [selectedLanguage, difficulty]);

    useEffect(scrollToBottom, [conversation]);
    useEffect(() => { /* Language/Difficulty change effect + dir/lang set */ }, [selectedLanguage, difficulty, startNewSession]); // <-- التأكد من إضافة difficulty
    useEffect(() => { /* Theme loading & pdf.js worker setup */ }, []);
    useEffect(() => { /* Daily Challenge Check */ }, []);
    const extractTextFromFile = async (file: File) => { /* ... File processing logic ... */ };
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };
    const handleRemoveFile = () => { /* ... */ };
    const handleApiError = useCallback((error: any) => { /* ... Error handling ... */ }, []);
    const speak = useCallback((text: string) => { /* ... Speech synthesis logic ... */ }, [selectedLanguage.code]);

    // --- [ تعديل 5: تحديث processAIResponse ] ---
    const processAIResponse = useCallback(async (userText: string) => {
        // لم نعد نحتاج للتحقق من chatSession
        setIsApiBusy(true); setError(null);
        try {
            // استدعاء الوظيفة الجديدة التي لا تحتاج Chat object
            const aiText = await sendMessageToAI(
                userText,
                conversation, // إرسال السجل
                activeContext,
                currentScenario?.prompt
            );
            const aiMessage: Message = { role: Role.MODEL, text: aiText };
            setConversation(prev => [...prev, aiMessage]);
            speak(aiText.replace(/\[\?\]/g, '')); // التشغيل التلقائي + الحيلة
        } catch (e: any) {
            handleApiError(e);
            const errorMessage: Message = { role: Role.MODEL, text: "Sorry, I couldn't process that. Please try again." };
            setConversation(prev => [...prev, errorMessage]);
        } finally {
            setIsApiBusy(false);
        }
    }, [conversation, activeContext, currentScenario, handleApiError, speak]); // <-- تحديث الاعتماديات

    // --- باقي الوظائف تبقى كما هي (مع إضافة وظيفة تحليل الكلمة وإصلاح شرح القاعدة) ---
    const handleRecognitionResult = useCallback((event: SpeechRecognitionEvent) => { /* ... */ }, [processAIResponse]);
    const setupRecognition = useCallback(() => { /* ... */ }, [selectedLanguage, handleRecognitionResult]);
    useEffect(setupRecognition, [setupRecognition]);
    const unlockAudioContext = () => { /* ... */ };
    const handleStopSpeaking = () => { /* ... */ };
    const handleRecordClick = () => { unlockAudioContext(); /* ... */ };
    const handleSendMessage = () => { unlockAudioContext(); /* ... */ };
    const handleClearConversation = () => { /* ... */ };
    const handleContentAnalysisSubmit = () => { /* ... */ };
    const handleCustomScenarioSubmit = () => { /* ... */ };
    const handleOpenDictionary = async () => { /* ... */ };
    const handleDifficultyChange = (newDifficulty: Difficulty) => { /* ... */ };

    // --- [ تعديل 6: استخدام الإصلاح لوظيفة شرح القاعدة ] ---
    const handleExplainClick = async (messageIndex: number) => {
        const aiMessage = conversation[messageIndex];
        if (!aiMessage || isApiBusy || isApiOnCooldown) return;
        let userMessage: Message | undefined;
        for (let i = messageIndex - 1; i >= 0; i--) { if (conversation[i].role === Role.USER) { userMessage = conversation[i]; break; } }
        if (!userMessage) { console.warn("Could not find preceding user message for grammar explanation."); return; }
        setIsGrammarModalOpen(true); setIsApiBusy(true); setGrammarExplanation('');
        try { const explanation = await getGrammarExplanation(userMessage.text, aiMessage.text); setGrammarExplanation(explanation); }
        catch (e: any) { handleApiError(e); setGrammarExplanation("Sorry, ..."); } finally { setIsApiBusy(false); }
    };

    const handleChallengeSubmit = async () => { /* ... */ };
    const handleThemeChange = (themeId: string) => { /* ... */ };

    // --- [ تعديل 7: إضافة وظيفة تحليل الكلمة ] ---
    const handleAnalyzeWordClick = async (word: string) => {
        setIsWordAnalysisModalOpen(true); setIsApiBusy(true); setWordAnalysisResult(''); setCurrentWordAnalyzed(word);
        try { const result = await getWordAnalysis(word); setWordAnalysisResult(result); }
        catch (e: any) { handleApiError(e); setWordAnalysisResult("Sorry, ..."); } finally { setIsApiBusy(false); }
    };

    const renderRecordButtonContent = () => { /* ... */ };
    const currentTheme = THEMES.find(t => t.id === theme) || THEMES[0];
    const isAnalysisSubmitDisabled = () => { /* ... */ };

    // --- Render ---
    return (
        <div className={`flex flex-col h-screen bg-gradient-to-br ${currentTheme.class} text-white font-sans`}>
            {/* Header */}
            <header className="flex justify-between items-center p-4 shadow-lg bg-black bg-opacity-30 backdrop-blur-md sticky top-0 z-10 gap-2 flex-wrap">
                 {/* ... (نفس محتوى الهيدر الأصلي) ... */}
                 <h1 className="...">{contextTitle || `Dr: Ibrahim "Poly Glot Pal"`}</h1>
                 <div className="flex ..."> {/* ... Buttons ... */} </div>
            </header>

            {/* Main Chat Area */}
            <main ref={chatContainerRef} className="flex-1 flex flex-col p-4 overflow-y-auto">
                {conversation.length === 0 && ( <div className="m-auto ..."> {/* ... Welcome ... */} </div> )}
                {/* --- [ تعديل 8: إضافة onPlayAudio لـ MessageBubble ] --- */}
                {conversation.map((msg, index) => (
                    <MessageBubble key={index} message={msg} messageIndex={index} onExplainClick={handleExplainClick} onPlayAudio={speak} />
                ))}
            </main>

            {/* Error/Cooldown Footer */}
            {/* ... (نفس كود عرض الخطأ والـ Cooldown) ... */}

            {/* Input Footer */}
            <footer className="p-4 bg-black bg-opacity-30 backdrop-blur-md flex items-center justify-center gap-4">
                 {/* ... (نفس محتوى الفوتر الأصلي مع زر Stop Speaking) ... */}
                 {isSpeaking && (<button onClick={handleStopSpeaking} /* ... */> {/* ... */} </button>)}
                 <div className="w-full max-w-2xl flex ..."> {/* Input, Send, Mic */} </div>
            </footer>

            {/* Modals */}
            {/* --- [ تعديل 9: إضافة زر التحليل في نافذة القاموس وإضافة النافذة الجديدة ] --- */}
            <Modal isOpen={isTextAnalysisModalOpen} onClose={() => setIsTextAnalysisModalOpen(false)} title="Analyze Content"> {/* ... (نفس المحتوى الأصلي) ... */} </Modal>
            <Modal isOpen={isDictionaryModalOpen} onClose={() => setIsDictionaryModalOpen(false)} title="Conversation Dictionary">
                {/* ... (منطق عرض القاموس الأصلي) ... */}
                 {vocabularyList && vocabularyList.map((item, index) => (
                     <div key={index} className="border-b border-gray-700 pb-4 last:border-b-0">
                         <h3 className="text-xl font-bold text-sky-400">{item.word}</h3>
                         {Array.isArray(item.synonyms) && item.synonyms.length > 0 && ( <p className="mt-1"> {/* ... */} </p> )}
                         {Array.isArray(item.arabicMeanings) && item.arabicMeanings.length > 0 && ( <div className="mt-1 text-right" dir="rtl"> {/* ... */} </div> )}
                         {/* الزر الجديد */}
                         <button onClick={() => handleAnalyzeWordClick(item.word)} className="mt-3 px-3 py-1 bg-sky-700 hover:bg-sky-600 rounded-md text-sm transition-colors" > Analyze Word Type </button>
                     </div>
                 ))}
            </Modal>
            <Modal isOpen={isWordAnalysisModalOpen} onClose={() => setIsWordAnalysisModalOpen(false)} title={`Analysis for: "${currentWordAnalyzed}"`}>
                 {isApiBusy ? <div className="..."><i className="..."></i></div> : <p className="text-base whitespace-pre-wrap">{wordAnalysisResult}</p>}
            </Modal>
            {/* --- (باقي النوافذ الأصلية) --- */}
            <Modal isOpen={isScenarioModalOpen} onClose={() => setIsScenarioModalOpen(false)} title="Custom Role-Play Scenario"> {/* ... */} </Modal>
            <Modal isOpen={isGrammarModalOpen} onClose={() => setIsGrammarModalOpen(false)} title="Grammar Explanation"> {/* ... */} </Modal>
            <Modal isOpen={isDailyChallengeModalOpen} onClose={() => setIsDailyChallengeModalOpen(false)} title="Daily Vocabulary Challenge"> {/* ... */} </Modal>
            <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Settings"> {/* ... */} </Modal>
        </div>
    );
};

export default App;