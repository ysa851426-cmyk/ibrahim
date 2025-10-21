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
import { startChatSession, sendMessageToAI, extractVocabulary, getGrammarExplanation, validateChallengeSentence, getWordAnalysis } from './services/geminiService';
import MessageBubble from './components/MessageBubble';
import Modal from './components/Modal';

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

const App: React.FC = () => {
    // --- States تبقى كما هي ---
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
    const startNewSession = useCallback((contextText?: string, scenario?: Scenario, newContextTitle?: string) => { /* ... */ }, [selectedLanguage, difficulty]);
    useEffect(scrollToBottom, [conversation]);
    useEffect(() => { /* Language/Difficulty change effect */ }, [selectedLanguage, difficulty, startNewSession]);
    useEffect(() => { /* Theme loading & pdf.js worker setup */ }, []);
    useEffect(() => { /* Daily Challenge Check */ }, []);
    const extractTextFromFile = async (file: File) => { /* ... File processing logic ... */ };
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };
    const handleRemoveFile = () => { /* ... */ };
    const handleApiError = useCallback((error: any) => { /* ... Error handling ... */ }, []);
    const speak = useCallback((text: string) => { /* ... Speech synthesis logic ... */ }, [selectedLanguage.code]);
    const processAIResponse = useCallback(async (userText: string) => { /* ... API call logic ... */ }, [conversation, activeContext, currentScenario, handleApiError, speak]);
    const handleRecognitionResult = useCallback((event: SpeechRecognitionEvent) => { /* ... */ }, [processAIResponse]);

    // --- بداية التعديل: تعطيل setupRecognition ---
    const setupRecognition = useCallback(() => {
        if (!SpeechRecognitionAPI) { setError("Speech recognition not supported."); return; }
        const recognition = new SpeechRecognitionAPI();
        recognition.lang = selectedLanguage.code; recognition.interimResults = true; recognition.continuous = false;
        recognition.onresult = handleRecognitionResult;
        recognition.onend = () => setIsRecording(false);
        recognition.onerror = (event) => { setError(`Speech error: ${event.error}`); setIsRecording(false); };
        recognitionRef.current = recognition;
    }, [selectedLanguage, handleRecognitionResult]);

    // --- تم تعطيل هذا الـ useEffect مؤقتاً ---
    // useEffect(setupRecognition, [setupRecognition]);
    // --- نهاية التعطيل ---

    const unlockAudioContext = () => { /* ... */ };
    const handleStopSpeaking = () => { /* ... */ };
    const handleRecordClick = () => { /* ... */ };
    const handleSendMessage = () => { /* ... */ };
    const handleClearConversation = () => { /* ... */ };
    const handleContentAnalysisSubmit = () => { /* ... */ };
    const handleCustomScenarioSubmit = () => { /* ... */ };
    const handleOpenDictionary = async () => { /* ... */ };
    const handleDifficultyChange = (newDifficulty: Difficulty) => { /* ... */ };
    const handleExplainClick = async (messageIndex: number) => { /* ... */ };
    const handleChallengeSubmit = async () => { /* ... */ };
    const handleThemeChange = (themeId: string) => { /* ... */ };
    const handleAnalyzeWordClick = async (word: string) => { /* ... */ };
    const renderRecordButtonContent = () => { /* ... */ };
    const currentTheme = THEMES.find(t => t.id === theme) || THEMES[0];
    const isAnalysisSubmitDisabled = () => { /* ... */ };

    // --- Render يبقى كما هو ---
    return (
        <div className={`flex flex-col h-screen bg-gradient-to-br ${currentTheme.class} text-white font-sans`}>
            {/* ... Header ... */}
            {/* ... Main ... */}
            {/* ... Footer ... */}
            {/* ... Modals ... */}
        </div>
    );
};

export default App;