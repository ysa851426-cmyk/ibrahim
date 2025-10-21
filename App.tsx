// Fix(App.tsx): Add type definitions for the Web Speech API.
// This is necessary because these APIs are not part of standard TypeScript DOM typings.
// These definitions resolve errors related to 'SpeechRecognition' and its events.
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

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionStatic {
  new (): SpeechRecognition;
}

// Add declarations for CDN-loaded libraries to prevent TypeScript errors.
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
import { startChatSession, sendMessageToAI, extractVocabulary, getGrammarExplanation, validateChallengeSentence, getWordAnalysis } from './services/geminiService';
import MessageBubble from './components/MessageBubble';
import Modal from './components/Modal';

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

const App: React.FC = () => {
    // --- States ---
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

    // --- Helper Functions ---
    const scrollToBottom = () => {
        chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: 'smooth' });
    };

    useEffect(() => { // Cleanup interval
        return () => { if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current); };
    }, []);

    const startNewSession = useCallback((contextText?: string, scenario?: Scenario, newContextTitle?: string) => {
        console.log("App.tsx: Starting new session...");
        startChatSession(selectedLanguage.name, difficulty);
        setConversation([]);
        setCurrentScenario(scenario || null);
        setContextTitle(newContextTitle || null);
        setActiveContext(contextText);
    }, [selectedLanguage, difficulty]);

    useEffect(scrollToBottom, [conversation]);

    useEffect(() => { // Language/Difficulty change effect
        console.log("App.tsx: Language/Difficulty changed, starting new session.");
        document.documentElement.lang = selectedLanguage.code.split('-')[0];
        document.documentElement.dir = selectedLanguage.dir;
        startNewSession();
    }, [selectedLanguage, difficulty, startNewSession]);

    useEffect(() => { // Theme loading & pdf.js worker setup
        const savedTheme = localStorage.getItem('polyglot-theme') || 'default';
        setTheme(savedTheme);
        if (window.pdfjsLib) { window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`; }
    }, []);

    useEffect(() => { // Daily Challenge Check
        const savedVocabRaw = localStorage.getItem('polyglot-vocab');
        const savedDate = localStorage.getItem('polyglot-vocab-date');
        const today = new Date().toISOString().split('T')[0];
        if (savedVocabRaw && savedDate !== today) {
             const savedVocab: VocabularyItem[] = JSON.parse(savedVocabRaw);
             if (savedVocab.length > 0) { /* Set challenge... */ }
        }
    }, []);

    const extractTextFromFile = async (file: File) => { /* ... File processing logic ... */ };
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };
    const handleRemoveFile = () => { /* ... */ };

    const handleApiError = useCallback((error: any) => {
        console.error("App.tsx: API Error Handler:", error);
        const message = error.message || "An unknown error occurred.";
        if (message.includes("exceeded the request limit") || message.includes("busy")) { // Handle cooldown for busy error too
             if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
             setIsApiOnCooldown(true); setCooldownTimer(15);
             cooldownIntervalRef.current = window.setInterval(() => { /* ... Cooldown logic ... */ }, 1000);
        } else { setError(message); }
     }, []);

    const speak = useCallback((text: string) => {
        if (!window.speechSynthesis) return;
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = window.speechSynthesis.getVoices();
        const voice = voices.find(v => v.lang === selectedLanguage.code) || voices.find(v => v.lang.startsWith(selectedLanguage.code.split('-')[0]));
        if (voice) utterance.voice = voice;
        utterance.rate = 1; utterance.pitch = 1;
        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        window.speechSynthesis.speak(utterance);
    }, [selectedLanguage.code]);

    const processAIResponse = useCallback(async (userText: string) => {
        console.log("App.tsx: Processing AI response for:", userText);
        setIsApiBusy(true); setError(null);
        try {
            console.log("App.tsx: Calling sendMessageToAI...");
            const aiText = await sendMessageToAI(userText, conversation, activeContext, currentScenario?.prompt);
            console.log("App.tsx: Received AI response:", aiText);
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

    const handleRecognitionResult = useCallback((event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results).map(result => result[0]).map(result => result.transcript).join('');
        if (event.results[0].isFinal && transcript.trim()) {
            const userMessage: Message = { role: Role.USER, text: transcript };
            setConversation(prev => [...prev, userMessage]);
            processAIResponse(transcript);
        }
    }, [processAIResponse]);

    const setupRecognition = useCallback(() => {
        if (!SpeechRecognitionAPI) { setError("Speech recognition not supported."); return; }
        const recognition = new SpeechRecognitionAPI();
        recognition.lang = selectedLanguage.code; recognition.interimResults = true; recognition.continuous = false;
        recognition.onresult = handleRecognitionResult;
        recognition.onend = () => setIsRecording(false);
        recognition.onerror = (event) => { setError(`Speech error: ${event.error}`); setIsRecording(false); };
        recognitionRef.current = recognition;
    }, [selectedLanguage, handleRecognitionResult]);

    useEffect(setupRecognition, [setupRecognition]);

    const unlockAudioContext = () => {
        if (audioUnlocked || !window.speechSynthesis) return;
        console.log("Unlocking audio context...");
        const utterance = new SpeechSynthesisUtterance(' '); utterance.volume = 0;
        window.speechSynthesis.speak(utterance);
        setAudioUnlocked(true);
    };

    const handleStopSpeaking = () => {
        if (window.speechSynthesis) { window.speechSynthesis.cancel(); setIsSpeaking(false); }
    };

    const handleRecordClick = () => {
        unlockAudioContext();
        if (isRecording) { recognitionRef.current?.stop(); }
        else { handleStopSpeaking(); /* ... start recording try/catch ... */ }
    };

    const handleSendMessage = () => {
        unlockAudioContext();
        const trimmedMessage = textInput.trim();
        if (!trimmedMessage || isApiBusy || isApiOnCooldown) return;
        const userMessage: Message = { role: Role.USER, text: trimmedMessage };
        setConversation(prev => [...prev, userMessage]); setTextInput('');
        processAIResponse(trimmedMessage);
    };

    const handleClearConversation = () => { startNewSession(); handleStopSpeaking(); };

    const handleContentAnalysisSubmit = () => {
        console.log("App.tsx: Handling Content Analysis Submit...");
        let contentToAnalyze = ''; let newContextTitle = '';
        if (analysisMode === 'paste') { if (!textForAnalysis.trim()) return; contentToAnalyze = textForAnalysis; newContextTitle = 'Discussing Pasted Text'; }
        else if (analysisMode === 'upload') { if (!textForAnalysis.trim() || !selectedFile) return; contentToAnalyze = textForAnalysis; newContextTitle = `Discussing: ${selectedFile.name}`; }
        else if (analysisMode === 'link') { if (!urlInput.trim()) return; contentToAnalyze = `Analyze URL: ${urlInput}`; newContextTitle = `Discussing URL: ${urlInput}`; }
        setIsTextAnalysisModalOpen(false); startNewSession(contentToAnalyze, undefined, newContextTitle);
        if (analysisMode !== 'link') { const contextMessage: Message = { role: Role.MODEL, text: `Ok, I've read the content. What to discuss?` }; setConversation([contextMessage]); speak(contextMessage.text); }
        else { processAIResponse("Let's discuss the link."); }
        setTextForAnalysis(''); setSelectedFile(null); setFileProcessingMessage(null); setUrlInput(''); setAnalysisMode('paste');
    };

    const handleCustomScenarioSubmit = () => {
        console.log("App.tsx: Handling Custom Scenario Submit...");
        const trimmedScenario = customScenarioInput.trim(); if (!trimmedScenario) return; setIsScenarioModalOpen(false);
        if (conversation.length > 0 && !window.confirm("...")) { return; }
        const scenarioPrompt = `Initiate role-play: "${trimmedScenario}". You start.`; const newScenario: Scenario = { id: 'custom', title: trimmedScenario, emoji: '🎭', prompt: scenarioPrompt };
        startNewSession(undefined, newScenario, `🎭 Scenario: ${trimmedScenario}`);
        processAIResponse("Let's begin."); setCustomScenarioInput('');
    };

    const handleOpenDictionary = async () => {
        console.log("App.tsx: Opening Dictionary..."); setIsDictionaryModalOpen(true); setIsApiBusy(true); setError(null);
        try { console.log("App.tsx: Calling extractVocabulary..."); const vocab = await extractVocabulary(conversation); console.log("App.tsx: Received vocabulary:", vocab); setVocabularyList(vocab); if (vocab.length > 0) { /* localStorage ... */ } }
        catch (e: any) { handleApiError(e); setVocabularyList(null); } finally { setIsApiBusy(false); }
    };

    const handleDifficultyChange = (newDifficulty: Difficulty) => {
        if (conversation.length > 0 && window.confirm("...")) { setDifficulty(newDifficulty); }
        else if (conversation.length === 0) { setDifficulty(newDifficulty); }
    };

    const handleExplainClick = async (messageIndex: number) => {
        console.log("App.tsx: Handling Explain Click for index:", messageIndex);
        const aiMessage = conversation[messageIndex]; const userMessage = conversation[messageIndex - 1];
        if (!aiMessage || !userMessage || userMessage.role !== Role.USER || isApiBusy || isApiOnCooldown) { console.warn("App.tsx: Explain click condition not met."); return; }
        setIsGrammarModalOpen(true); setIsApiBusy(true); setGrammarExplanation('');
        try { console.log("App.tsx: Calling getGrammarExplanation..."); const explanation = await getGrammarExplanation(userMessage.text, aiMessage.text); console.log("App.tsx: Received grammar explanation:", explanation); setGrammarExplanation(explanation); }
        catch (e: any) { handleApiError(e); setGrammarExplanation("Sorry, ..."); } finally { setIsApiBusy(false); }
    };

    const handleChallengeSubmit = async () => { /* ... */ };
    const handleThemeChange = (themeId: string) => { /* ... */ };

    const handleAnalyzeWordClick = async (word: string) => {
        console.log("App.tsx: Handling Analyze Word Click for:", word); setIsWordAnalysisModalOpen(true); setIsApiBusy(true); setWordAnalysisResult(''); setCurrentWordAnalyzed(word);
        try { console.log("App.tsx: Calling getWordAnalysis..."); const result = await getWordAnalysis(word); console.log("App.tsx: Received word analysis:", result); setWordAnalysisResult(result); }
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
                <h1 className="text-xl md:text-2xl font-bold tracking-wider basis-full md:basis-auto text-center md:text-left mb-2 md:mb-0 truncate" title={contextTitle || (currentScenario?.title || 'Poly Glot Pal')}>
                   {contextTitle || `Dr: Ibrahim "Poly Glot Pal"`}
                </h1>
                <div className="flex items-center gap-2 md:gap-3 mx-auto md:mx-0">
                    {/* Header Buttons */}
                    <button onClick={() => setIsScenarioModalOpen(true)} className="px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors" title="Scenarios"><i className="fa-solid fa-masks-theater"></i></button>
                    <button onClick={() => setIsTextAnalysisModalOpen(true)} className="px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors" title="Analyze Content"><i className="fa-solid fa-paperclip"></i></button>
                    <button onClick={handleOpenDictionary} disabled={conversation.length < 2 || isApiBusy || isApiOnCooldown} className="px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50" title="Conversation Dictionary"><i className="fa-solid fa-book"></i></button>
                    <select value={difficulty} onChange={(e) => handleDifficultyChange(e.target.value as Difficulty)} className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500">
                        {DIFFICULTIES.map(level => <option key={level} value={level}>{level}</option>)}
                    </select>
                    <select value={selectedLanguage.code} onChange={(e) => setSelectedLanguage(SUPPORTED_LANGUAGES.find(l => l.code === e.target.value)!)} className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500">
                        {SUPPORTED_LANGUAGES.map(lang => <option key={lang.code} value={lang.code}>{lang.name}</option>)}
                    </select>
                    <button onClick={handleClearConversation} className="px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors" title="New Conversation"><i className="fa-solid fa-trash-can"></i></button>
                    <button onClick={() => setIsSettingsModalOpen(true)} className="px-3 py-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors" title="Settings"><i className="fa-solid fa-cog"></i></button>
                </div>
            </header>

            {/* Main Chat Area */}
            <main ref={chatContainerRef} className="flex-1 flex flex-col p-4 overflow-y-auto">
                {/* --- بداية الإصلاح --- */}
                {/* الرسالة الترحيبية عند بدء المحادثة */}
                {conversation.length === 0 && (
                    <div className="m-auto text-center text-gray-300">
                        <h2 className="text-3xl font-light">Welcome!</h2>
                        <p className="mt-2">Select a language and press the microphone to start.</p>
                    </div>
                )}
                {/* --- نهاية الإصلاح --- */}

                {/* عرض رسائل المحادثة */}
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

            {/* Error/Cooldown Footer */}
            {error && !isApiOnCooldown && <div className="text-center py-2 bg-red-800 bg-opacity-80 text-white">{error}</div>}
            {isApiOnCooldown && <div className="text-center py-2 bg-yellow-800 bg-opacity-80 text-white">Cooldown: {cooldownTimer}s</div>}

            {/* Input Footer */}
            <footer className="p-4 bg-black bg-opacity-30 backdrop-blur-md flex items-center justify-center gap-4">
                 {isSpeaking && (<button onClick={handleStopSpeaking} /* ... */><i className="fa-solid fa-stop text-2xl"></i></button>)}
                <div className="w-full max-w-2xl flex items-center gap-2">
                    <input type="text" value={textInput} onChange={(e) => setTextInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder={`Type in ${selectedLanguage.name}...`} className="..." disabled={isRecording || isApiBusy || isApiOnCooldown} />
                    {textInput.trim() ? ( <button onClick={handleSendMessage} /* ... */><i className="fa-solid fa-paper-plane text-xl"></i></button> ) : ( <button onClick={handleRecordClick} /* ... */> {/* ... */} </button> )}
                </div>
            </footer>

            {/* Modals */}
            <Modal isOpen={isTextAnalysisModalOpen} onClose={() => setIsTextAnalysisModalOpen(false)} title="Analyze Content"> {/* ... Modal Content ... */} </Modal>
            <Modal isOpen={isDictionaryModalOpen} onClose={() => setIsDictionaryModalOpen(false)} title="Conversation Dictionary">
                {/* ... Dictionary Modal Content (with Analyze button) ... */}
                 {vocabularyList && vocabularyList.map((item, index) => (
                     <div key={index} className="...">
                         {/* ... Word, Synonyms, Meanings ... */}
                         <button onClick={() => handleAnalyzeWordClick(item.word)} className="..." > Analyze Word Type </button>
                     </div>
                 ))}
            </Modal>
            <Modal isOpen={isWordAnalysisModalOpen} onClose={() => setIsWordAnalysisModalOpen(false)} title={`Analysis for: "${currentWordAnalyzed}"`}>
                 {isApiBusy ? <div className="..."><i className="..."></i></div> : <p className="text-base whitespace-pre-wrap">{wordAnalysisResult}</p>}
            </Modal>
            <Modal isOpen={isScenarioModalOpen} onClose={() => setIsScenarioModalOpen(false)} title="Custom Role-Play Scenario"> {/* ... */} </Modal>
            <Modal isOpen={isGrammarModalOpen} onClose={() => setIsGrammarModalOpen(false)} title="Grammar Explanation"> {/* ... */} </Modal>
            <Modal isOpen={isDailyChallengeModalOpen} onClose={() => setIsDailyChallengeModalOpen(false)} title="Daily Vocabulary Challenge"> {/* ... */} </Modal>
            <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Settings"> {/* ... */} </Modal>
        </div>
    );
};

export default App;