// Fix(App.tsx): Add type definitions for the Web Speech API.
// ... (كل التعريفات في الأعلى تبقى كما هي) ...
interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: (event: SpeechRecognitionEvent) => void;
  onend: () => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  start(): void;
  stop(): void;
}
// ... (باقي التعريفات) ...
interface SpeechRecognitionStatic {
  new (): SpeechRecognition;
}
declare const mammoth: any;
declare const pdfjsLib: any;
declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
    pdfjsLib: any;
  }
}

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
    const [conversation, setConversation] = useState<Message[]>([]);
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(SUPPORTED_LANGUAGES[0]);
    const [difficulty, setDifficulty] = useState<Difficulty>('BeginDener');
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

    // Modals State
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

    // --- [ تعديل 2: إضافة State للنافذة الجديدة ] ---
    const [isWordAnalysisModalOpen, setIsWordAnalysisModalOpen] = useState<boolean>(false);
    const [wordAnalysisResult, setWordAnalysisResult] = useState<string>('');
    const [currentWordAnalyzed, setCurrentWordAnalyzed] = useState<string>('');

    // Content Analysis State
    // ... (باقي الـ State كما هو) ...
    const [analysisMode, setAnalysisMode] = useState<'paste' | 'upload' | 'link'>('paste');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileProcessingMessage, setFileProcessingMessage] = useState<string | null>(null);
    const [urlInput, setUrlInput] = useState<string>('');


    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const cooldownIntervalRef = useRef<number | null>(null);

    // ... (كل الوظائف المساعدة مثل 'scrollToBottom', 'startNewSession', 'useEffect' تبقى كما هي) ...
    
    const scrollToBottom = () => { /* ... */ };
    useEffect(() => { /* ... */ }, []);
    const startNewSession = useCallback((contextText?: string, scenario?: Scenario, newContextTitle?: string) => {
        startChatSession(selectedLanguage.name, difficulty);
        setConversation([]);
        setCurrentScenario(scenario || null);
        setContextTitle(newContextTitle || null);
        setActiveContext(contextText);
    }, [selectedLanguage, difficulty]);
    useEffect(scrollToBottom, [conversation]);
    useEffect(() => {
        document.documentElement.lang = selectedLanguage.code.split('-')[0];
        document.documentElement.dir = selectedLanguage.dir;
        startNewSession();
    }, [selectedLanguage, startNewSession]);
    useEffect(() => { /* Theme loading */ }, []);
    useEffect(() => { /* Daily Challenge Check */ }, []);
    const extractTextFromFile = async (file: File) => { /* ... */ };
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };
    const handleRemoveFile = () => { /* ... */ };
    const handleApiError = useCallback((error: any) => { /* ... */ }, []);
    const speak = useCallback((text: string) => { /* ... */ }, [selectedLanguage.code]);
    const processAIResponse = useCallback(async (userText: string) => {
        setIsApiBusy(true);
        setError(null);
        try {
            const aiText = await sendMessageToAI(
                userText,
                conversation,
                activeContext,
                currentScenario?.prompt
            );
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
    const handleContentAnalysisSubmit = () => { /* ... */ };
    const handleCustomScenarioSubmit = () => { /* ... */ };
    
    const handleOpenDictionary = async () => {
        setIsDictionaryModalOpen(true);
        setIsApiBusy(true);
        setError(null);
        try {
            const vocab = await extractVocabulary(conversation);
            setVocabularyList(vocab);
            if (vocab.length > 0) {
                localStorage.setItem('polyglot-vocab', JSON.stringify(vocab));
                localStorage.setItem('polyglot-vocab-date', new Date().toISOString().split('T')[0]);
            }
        } catch (e: any) {
            handleApiError(e);
            setVocabularyList(null);
        } finally {
            setIsApiBusy(false);
        }
    };

    const handleDifficultyChange = (newDifficulty: Difficulty) => { /* ... */ };
    const handleExplainClick = async (messageIndex: number) => { /* ... */ };
    const handleChallengeSubmit = async () => { /* ... */ };
    const handleThemeChange = (themeId: string) => { /* ... */ };

    // --- [ تعديل 3: إضافة وظيفة جديدة للزر الجديد ] ---
    const handleAnalyzeWordClick = async (word: string) => {
        setIsWordAnalysisModalOpen(true); // افتح النافذة الجديدة
        setIsApiBusy(true); // أظهر مؤشر التحميل
        setWordAnalysisResult(''); // امسح النتائج القديمة
        setCurrentWordAnalyzed(word); // ضع الكلمة في العنوان
        
        try {
            const result = await getWordAnalysis(word);
            setWordAnalysisResult(result);
        } catch (e: any) {
            handleApiError(e);
            setWordAnalysisResult("Sorry, I couldn't analyze this word right now.");
        } finally {
            setIsApiBusy(false); // أخفِ مؤشر التحميل
        }
    };
    
    // ... (باقي الوظائف مثل 'renderRecordButtonContent' و 'isAnalysisSubmitDisabled' تبقى كما هي) ...
    const renderRecordButtonContent = () => { /* ... */ };
    const currentTheme = THEMES.find(t => t.id === theme) || THEMES[0];
    const isAnalysisSubmitDisabled = () => { /* ... */ };

    return (
        <div className={`flex flex-col h-screen bg-gradient-to-br ${currentTheme.class} text-white font-sans`}>
            {/* Header يبقى كما هو */}
            <header className="flex justify-between items-center p-4 ...">
                {/* ... (كل الأزرار والقوائم في الهيدر) ... */}
            </header>
            
            {/* Main (Chat Area) يبقى كما هو */}
            <main ref={chatContainerRef} className="flex-1 flex flex-col p-4 overflow-y-auto">
                {/* ... (عرض الرسائل) ... */}
                {conversation.map((msg, index) => (
                    <MessageBubble 
                        key={index} 
                        message={msg} 
                        messageIndex={index} 
                        onExplainClick={handleExplainClick}
                        onPlayAudio={speak} 
                    />
                ))}
            </main>

            {/* Footer يبقى كما هو */}
            <footer className="p-4 bg-black bg-opacity-30 ...">
                {/* ... (أزرار الإرسال والمايكروفون) ... */}
            </footer>

            {/* --- [ تعديل 4: تعديل نافذة القاموس ] --- */}
            <Modal isOpen={isDictionaryModalOpen} onClose={() => setIsDictionaryModalOpen(false)} title="Conversation Dictionary">
                {isApiBusy ? (
                    <div className="flex justify-center items-center h-48"><i className="fa-solid fa-spinner fa-spin text-4xl text-sky-400"></i></div>
                ) : error && !vocabularyList ? (
                    <p className="text-red-400 text-center">{error}</p>
                ) : vocabularyList && (
                    <div className="flex flex-col gap-6">
                        {vocabularyList.length === 0 ? (
                            <p className="text-center">No key vocabulary found. Try having a longer conversation!</p>
                        ) : (
                            vocabularyList.map((item, index) => (
                                <div key={index} className="border-b border-gray-700 pb-4 last:border-b-0">
                                    <h3 className="text-xl font-bold text-sky-400">{item.word}</h3>
                                    
                                    {Array.isArray(item.synonyms) && item.synonyms.length > 0 && (
                                        <p className="mt-1">
                                            <strong className="font-semibold text-gray-400">Synonyms:</strong> {item.synonyms.join(', ')}
                                        </p>
                                    )}
                                    
                                    {Array.isArray(item.arabicMeanings) && item.arabicMeanings.length > 0 && (
                                        <div className="mt-1 text-right" dir="rtl">
                                            <strong className="font-semibold text-gray-400" dir="ltr">المعاني العربية: </strong> 
                                            <span>{item.arabicMeanings.join('، ')}</span>
                                        </div>
                                    )}

                                    {/* --- الإضافة الجديدة (الزر) --- */}
                                    <button
                                        onClick={() => handleAnalyzeWordClick(item.word)}
                                        className="mt-3 px-3 py-1 bg-sky-700 hover:bg-sky-600 rounded-md text-sm transition-colors"
                                    >
                                        Analyze Word Type
                                    </button>
                                    {/* --- نهاية الإضافة --- */}

                                </div>
                            ))
                        )}
                    </div>
                )}
            </Modal>

            {/* --- [ تعديل 5: إضافة النافذة الجديدة ] --- */}
            <Modal isOpen={isWordAnalysisModalOpen} onClose={() => setIsWordAnalysisModalOpen(false)} title={`Analysis for: "${currentWordAnalyzed}"`}>
                {isApiBusy ? (
                    <div className="flex justify-center items-center h-32"><i className="fa-solid fa-spinner fa-spin text-4xl text-sky-400"></i></div>
                ) : (
                    // "whitespace-pre-wrap" مهمة جداً لعرض تنسيق Markdown
                    <p className="text-base whitespace-pre-wrap">{wordAnalysisResult}</p>
                )}
            </Modal>


            {/* باقي الـ Modals تبقى كما هي */}
            <Modal isOpen={isTextAnalysisModalOpen} onClose={() => setIsTextAnalysisModalOpen(false)} title="Analyze Content">{/* ... */}</Modal>
            <Modal isOpen={isScenarioModalOpen} onClose={() => setIsScenarioModalOpen(false)} title="Custom Role-Play Scenario">{/* ... */}</Modal>
            <Modal isOpen={isGrammarModalOpen} onClose={() => setIsGrammarModalOpen(false)} title="Grammar Explanation">{/* ... */}</Modal>
            <Modal isOpen={isDailyChallengeModalOpen} onClose={() => setIsDailyChallengeModalOpen(false)} title="Daily Vocabulary Challenge">{/* ... */}</Modal>
            <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Settings">{/* ... */}</Modal>
        </div>
    );
};

export default App;