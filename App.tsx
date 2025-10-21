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
import { Chat } from '@google/genai';
import { Message, Role, LanguageOption, VocabularyItem, Difficulty, Scenario, Theme } from './types';
import { SUPPORTED_LANGUAGES, DIFFICULTIES, THEMES } from './constants';
import { startChatSession, sendMessageToAI, extractVocabulary, getGrammarExplanation, validateChallengeSentence, getWordAnalysis, getWordFamily } from './services/geminiService';
import MessageBubble from './components/MessageBubble';
import Modal from './components/Modal';
import MarkdownRenderer from './components/MarkdownRenderer';


// SpeechRecognition interfaces for cross-browser compatibility
// Fix(App.tsx): Rename SpeechRecognition constant to SpeechRecognitionAPI to avoid conflict with the SpeechRecognition interface type.
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

const App: React.FC = () => {
    const [conversation, setConversation] = useState<Message[]>([]);
    const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(SUPPORTED_LANGUAGES[0]);
    const [difficulty, setDifficulty] = useState<Difficulty>('Beginner');
    const [currentScenario, setCurrentScenario] = useState<Scenario | null>(null);
    const [isRecording, setIsRecording] = useState<boolean>(false);
    const [isApiBusy, setIsApiBusy] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
    const [currentlyPlayingMessageId, setCurrentlyPlayingMessageId] = useState<string | null>(null);
    const [textInput, setTextInput] = useState<string>('');
    const [theme, setTheme] = useState<string>('default');
    const [chatSession, setChatSession] = useState<Chat | null>(null);
    const [contextTitle, setContextTitle] = useState<string | null>(null);
    const [isApiOnCooldown, setIsApiOnCooldown] = useState<boolean>(false);
    const [cooldownTimer, setCooldownTimer] = useState<number>(0);


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

    // Dictionary Modal State
    const [dictionaryActiveTab, setDictionaryActiveTab] = useState<'vocabulary' | 'analysis'>('vocabulary');
    const [wordToAnalyze, setWordToAnalyze] = useState<string>('');
    const [wordAnalysisResult, setWordAnalysisResult] = useState<string | null>(null);
    const [isAnalyzingWord, setIsAnalyzingWord] = useState<boolean>(false);
    const [wordFamilyResult, setWordFamilyResult] = useState<string | null>(null);
    const [isFetchingWordFamily, setIsFetchingWordFamily] = useState<boolean>(false);
    
    // Content Analysis State
    const [analysisMode, setAnalysisMode] = useState<'paste' | 'upload' | 'link'>('paste');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [fileProcessingMessage, setFileProcessingMessage] = useState<string | null>(null);
    const [urlInput, setUrlInput] = useState<string>('');


    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const cooldownIntervalRef = useRef<number | null>(null);
    const isAudioUnlocked = useRef(false);

    const scrollToBottom = () => {
        chatContainerRef.current?.scrollTo({
            top: chatContainerRef.current.scrollHeight,
            behavior: 'smooth'
        });
    };
    
    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (cooldownIntervalRef.current) {
                clearInterval(cooldownIntervalRef.current);
            }
        };
    }, []);

    const startNewSession = useCallback((contextText?: string, scenario?: Scenario, newContextTitle?: string) => {
        const newChat = startChatSession(selectedLanguage.name, difficulty, contextText, scenario?.prompt);
        setChatSession(newChat);
        setConversation([]);
        setCurrentScenario(scenario || null);
        setContextTitle(newContextTitle || null);
    }, [selectedLanguage, difficulty]);

    useEffect(scrollToBottom, [conversation]);
    
    useEffect(() => {
        document.documentElement.lang = selectedLanguage.code.split('-')[0];
        document.documentElement.dir = selectedLanguage.dir;
        startNewSession();
    }, [selectedLanguage, startNewSession]);

    // Theme loading & pdf.js worker setup
    useEffect(() => {
        const savedTheme = localStorage.getItem('polyglot-theme') || 'default';
        setTheme(savedTheme);

        if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js`;
        }
        
        // Ensure speech synthesis is cancelled on language change or page unload
        const handleBeforeUnload = () => window.speechSynthesis.cancel();
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        return () => {
            window.speechSynthesis.cancel();
            window.removeEventListener('beforeunload', handleBeforeUnload);
        }
    }, []);

    // Daily Challenge Check
    useEffect(() => {
        const savedVocabRaw = localStorage.getItem('polyglot-vocab');
        const savedDate = localStorage.getItem('polyglot-vocab-date');
        const today = new Date().toISOString().split('T')[0];

        if (savedVocabRaw && savedDate !== today) {
            const savedVocab: VocabularyItem[] = JSON.parse(savedVocabRaw);
            if (savedVocab.length > 0) {
                const randomChallenge = savedVocab[Math.floor(Math.random() * savedVocab.length)];
                setDailyChallenge(randomChallenge);
                setIsDailyChallengeModalOpen(true);
            }
        }
    }, []);
    
    const extractTextFromFile = async (file: File) => {
        setTextForAnalysis('');
        setFileProcessingMessage('Processing file...');
        setIsApiBusy(true);

        try {
            if (file.type === 'text/plain') {
                const text = await file.text();
                setTextForAnalysis(text);
                setFileProcessingMessage(`File "${file.name}" is ready to discuss.`);
            } else if (file.name.endsWith('.docx')) {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                setTextForAnalysis(result.value);
                setFileProcessingMessage(`File "${file.name}" is ready to discuss.`);
            } else if (file.type === 'application/pdf') {
                 const arrayBuffer = await file.arrayBuffer();
                 const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                 let fullText = '';
                 for (let i = 1; i <= pdf.numPages; i++) {
                     const page = await pdf.getPage(i);
                     const textContent = await page.getTextContent();
                     fullText += textContent.items.map((item: any) => item.str).join(' ') + '\n';
                 }
                 setTextForAnalysis(fullText);
                 setFileProcessingMessage(`File "${file.name}" is ready to discuss.`);
            } else {
                 throw new Error('Unsupported file type. Please upload a TXT, PDF, or DOCX file.');
            }
        } catch (error: any) {
             setFileProcessingMessage(`Error: ${error.message || 'Could not process file.'}`);
             setSelectedFile(null);
        } finally {
            setIsApiBusy(false);
        }
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedFile(file);
            extractTextFromFile(file);
        }
    };
    
    const handleRemoveFile = () => {
        setSelectedFile(null);
        setTextForAnalysis('');
        setFileProcessingMessage(null);
        const fileInput = document.getElementById('file-upload') as HTMLInputElement;
        if(fileInput) fileInput.value = '';
    };

    const handleApiError = useCallback((error: any) => {
        const message = error.message || "An unknown error occurred.";
        
        if (message.includes("exceeded the request limit")) {
             if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);

            setIsApiOnCooldown(true);
            setCooldownTimer(15);

            cooldownIntervalRef.current = window.setInterval(() => {
                setCooldownTimer(prev => {
                    if (prev <= 1) {
                        if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
                        setIsApiOnCooldown(false);
                        setError(null);
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        } else {
            setError(message);
        }
    }, []);

    const unlockAudio = useCallback(() => {
        if (isAudioUnlocked.current || typeof window === 'undefined' || !window.speechSynthesis) return;
        // The act of calling .speak() inside a user gesture (like the first mic click)
        // is what "unlocks" autoplay for many mobile browsers.
        const utterance = new SpeechSynthesisUtterance('');
        window.speechSynthesis.speak(utterance);
        isAudioUnlocked.current = true;
    }, []);
    
    const handleStopSpeaking = useCallback(() => {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        setIsSpeaking(false);
        setCurrentlyPlayingMessageId(null);
    }, []);

    const playAudio = useCallback((message: Message) => {
        const textToSpeak = message.text.trim();
        if (!textToSpeak || typeof window === 'undefined' || !window.speechSynthesis) return;
        
        handleStopSpeaking(); // Stop any currently playing audio first

        // Clean text for speech (remove markdown, special tokens, emojis)
        const emojiRegex = /(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/g;
        const cleanText = textToSpeak
            .replace(emojiRegex, '')   // Remove emojis and many symbols
            .replace(/[()]/g, '')       // Remove parentheses
            .replace(/##/g, '')         // Remove markdown headings
            .replace(/\*\*/g, '')       // Remove markdown bold
            .replace(/\[\?\]/g, '')     // Remove special token [?]
            .replace(/\s+/g, ' ')       // Collapse whitespace into single spaces
            .trim();
        
        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = selectedLanguage.code;
        
        utterance.onstart = () => {
            setIsSpeaking(true);
            setCurrentlyPlayingMessageId(message.id);
        };
        
        utterance.onend = () => {
            setIsSpeaking(false);
            setCurrentlyPlayingMessageId(null);
        };
        
        utterance.onerror = (e) => {
            console.error("SpeechSynthesis Error:", e);
            setError("Sorry, speech playback failed.");
            setIsSpeaking(false);
            setCurrentlyPlayingMessageId(null);
        };
        
        window.speechSynthesis.speak(utterance);
    }, [selectedLanguage.code, handleStopSpeaking]);

    const processAIResponse = useCallback(async (userText: string) => {
        if (!chatSession) {
            setError("Chat session is not initialized. Please start a new conversation.");
            return;
        }
        setIsApiBusy(true);
        setError(null);
        try {
            const aiText = await sendMessageToAI(chatSession, userText);
            const aiMessage: Message = { id: `model-${Date.now()}`, role: Role.MODEL, text: aiText };
            setConversation(prev => [...prev, aiMessage]);
            
            // Attempt to autoplay speech
            playAudio(aiMessage);

        } catch (e: any) {
            handleApiError(e);
            const errorMessage: Message = { id: `model-${Date.now()}`, role: Role.MODEL, text: "Sorry, I couldn't process that. Please try again." };
            setConversation(prev => [...prev, errorMessage]);
        } finally {
            setIsApiBusy(false);
        }
    }, [chatSession, handleApiError, playAudio]);

    const handleRecognitionResult = useCallback((event: SpeechRecognitionEvent) => {
        const transcript = Array.from(event.results)
            .map(result => result[0])
            .map(result => result.transcript)
            .join('');
        
        if (event.results[0].isFinal && transcript.trim()) {
            const userMessage: Message = { id: `user-${Date.now()}`, role: Role.USER, text: transcript };
            setConversation(prev => [...prev, userMessage]);
            processAIResponse(transcript);
        }
    }, [processAIResponse]);
    
    const setupRecognition = useCallback(() => {
        if (!SpeechRecognitionAPI) {
            setError("Speech recognition is not supported in your browser.");
            return;
        }

        const recognition = new SpeechRecognitionAPI();
        recognition.lang = selectedLanguage.code;
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.onresult = handleRecognitionResult;
        recognition.onend = () => setIsRecording(false);
        recognition.onerror = (event) => {
            setError(`Speech recognition error: ${event.error}`);
            setIsRecording(false);
        };
        recognitionRef.current = recognition;
    }, [selectedLanguage, handleRecognitionResult]);

    useEffect(setupRecognition, [setupRecognition]);

    const handleRecordClick = () => {
        unlockAudio();
        if (isRecording) {
            recognitionRef.current?.stop();
        } else {
            handleStopSpeaking();
            try {
                recognitionRef.current?.start();
                setIsRecording(true);
                setError(null);
            } catch (e) {
                console.warn("Retrying speech recognition start...", e);
                setupRecognition();
                setTimeout(() => {
                     try {
                        recognitionRef.current?.start();
                        setIsRecording(true);
                        setError(null);
                     } catch(e2) {
                        setError("Could not start microphone. Please check permissions.");
                     }
                }, 250);
            }
        }
    };

    const handleSendMessage = () => {
        unlockAudio();
        const trimmedMessage = textInput.trim();
        if (!trimmedMessage || isApiBusy || isApiOnCooldown) return;

        const userMessage: Message = { id: `user-${Date.now()}`, role: Role.USER, text: trimmedMessage };
        setConversation(prev => [...prev, userMessage]);
        setTextInput('');
        processAIResponse(trimmedMessage);
    };

    const handleClearConversation = () => {
        startNewSession();
        handleStopSpeaking();
    };

    const handleContentAnalysisSubmit = () => {
        let contentToAnalyze = '';
        let newContextTitle = '';

        if (analysisMode === 'paste') {
            if (!textForAnalysis.trim()) return;
            contentToAnalyze = textForAnalysis;
            newContextTitle = 'Discussing Pasted Text';
        } else if (analysisMode === 'upload') {
            if (!textForAnalysis.trim() || !selectedFile) return;
            contentToAnalyze = textForAnalysis;
            newContextTitle = `Discussing: ${selectedFile.name}`;
        } else if (analysisMode === 'link') {
            if (!urlInput.trim()) return;
            contentToAnalyze = `Please analyze the content of the following URL and prepare to discuss it: ${urlInput}`;
            newContextTitle = `Discussing URL: ${urlInput}`;
        }

        setIsTextAnalysisModalOpen(false);
        startNewSession(contentToAnalyze, undefined, newContextTitle);

        // For files and pasted text, provide an immediate response.
        if (analysisMode !== 'link') {
            const contextMessage: Message = { id: `model-${Date.now()}`, role: Role.MODEL, text: `Ok, I've read the provided content. What would you like to discuss?` };
            setConversation([contextMessage]);
            playAudio(contextMessage);
        } else {
             processAIResponse("Let's discuss the content from the link.");
        }
        
        // Reset analysis state
        setTextForAnalysis('');
        setSelectedFile(null);
        setFileProcessingMessage(null);
        setUrlInput('');
        setAnalysisMode('paste');
    };
    
    const handleCustomScenarioSubmit = () => {
        const trimmedScenario = customScenarioInput.trim();
        if (!trimmedScenario) return;

        setIsScenarioModalOpen(false);

        if (conversation.length > 0 && !window.confirm("Starting a new scenario will clear your current conversation. Are you sure?")) {
            return;
        }

        const scenarioPrompt = `Initiate a role-playing scenario based on the user's request: "${trimmedScenario}". You are the other person in this scenario. You must start the conversation now.`;
        const newScenario: Scenario = {
            id: 'custom',
            title: trimmedScenario,
            emoji: '🎭',
            prompt: scenarioPrompt
        };

        startNewSession(undefined, newScenario, `🎭 Scenario: ${trimmedScenario}`);
        processAIResponse("Let's begin the role-play.");
        setCustomScenarioInput('');
    };

    const handleOpenDictionary = async () => {
        setIsDictionaryModalOpen(true);
        setDictionaryActiveTab('vocabulary'); // Reset to default tab
        setWordToAnalyze('');
        setWordAnalysisResult(null);
        setWordFamilyResult(null);

        setIsApiBusy(true); // For vocab list loading
        setError(null);
        try {
            const vocab = await extractVocabulary(conversation);
            setVocabularyList(vocab);
            // Save vocab for daily challenge
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
    
    const handleAnalyzeWord = async (wordOverride?: string) => {
        const word = (typeof wordOverride === 'string' ? wordOverride : wordToAnalyze).trim();
        if (!word || isAnalyzingWord) return;
    
        // Ensure the input field updates if called from the vocab list
        if (typeof wordOverride === 'string') {
            setWordToAnalyze(word);
        }
    
        setIsAnalyzingWord(true);
        setWordAnalysisResult(null);
        setWordFamilyResult(null); // Reset word family on new analysis
        setError(null);
        try {
            const analysis = await getWordAnalysis(word);
            setWordAnalysisResult(analysis);
        } catch (e: any) {
            handleApiError(e);
            setWordAnalysisResult(`Sorry, I couldn't analyze the word "${word}" at this time.`);
        } finally {
            setIsAnalyzingWord(false);
        }
    };
    
    const handleAnalyzeFromVocab = (word: string) => {
        setDictionaryActiveTab('analysis');
        handleAnalyzeWord(word);
    };

    const handleFetchWordFamily = async () => {
        const word = wordToAnalyze.trim();
        if (!word || isFetchingWordFamily) return;

        setIsFetchingWordFamily(true);
        setWordFamilyResult(null);
        setError(null);
        try {
            const family = await getWordFamily(word);
            setWordFamilyResult(family);
        } catch (e: any) {
            handleApiError(e);
            setWordFamilyResult(`Sorry, I couldn't get the word family for "${word}" at this time.`);
        } finally {
            setIsFetchingWordFamily(false);
        }
    };

    const handleDifficultyChange = (newDifficulty: Difficulty) => {
        if (conversation.length > 0) {
            if (window.confirm("Changing the difficulty will start a new conversation. Are you sure?")) {
                setDifficulty(newDifficulty);
            }
        } else {
            setDifficulty(newDifficulty);
        }
    };

    const handleExplainClick = async (messageIndex: number) => {
        const aiMessage = conversation[messageIndex];
        const userMessage = conversation[messageIndex - 1]; // Assumes user message is right before
        if (!aiMessage || !userMessage || userMessage.role !== Role.USER || isApiBusy || isApiOnCooldown) return;
        
        setIsGrammarModalOpen(true);
        setIsApiBusy(true);
        setGrammarExplanation('');
        try {
            const explanation = await getGrammarExplanation(userMessage.text, aiMessage.text);
            setGrammarExplanation(explanation);
        } catch (e: any) {
             handleApiError(e);
            setGrammarExplanation("Sorry, I couldn't get an explanation at this time.");
        } finally {
            setIsApiBusy(false);
        }
    };

    const handleChallengeSubmit = async () => {
        if (!challengeSentence.trim() || !dailyChallenge) return;
        setIsApiBusy(true);
        setChallengeFeedback('');
        try {
            const feedback = await validateChallengeSentence(dailyChallenge.word, challengeSentence);
            setChallengeFeedback(feedback);
        } catch (e: any) {
            handleApiError(e);
            setChallengeFeedback("Sorry, I couldn't check your sentence right now.");
        } finally {
            setIsApiBusy(false);
        }
    };
    
    const handleThemeChange = (themeId: string) => {
        setTheme(themeId);
        localStorage.setItem('polyglot-theme', themeId);
        setIsSettingsModalOpen(false);
    };

    const renderRecordButtonContent = () => {
        if (isApiBusy || isApiOnCooldown) return <i className="fa-solid fa-spinner fa-spin text-xl"></i>;
        if (isRecording) return <i className="fa-solid fa-square text-lg"></i>;
        return <i className="fa-solid fa-microphone text-xl"></i>;
    };
    
    const currentTheme = THEMES.find(t => t.id === theme) || THEMES[0];
    
    const isAnalysisSubmitDisabled = () => {
        if (isApiBusy || isApiOnCooldown) return true;
        if (analysisMode === 'paste' && !textForAnalysis.trim()) return true;
        if (analysisMode === 'upload' && !textForAnalysis.trim()) return true;
        if (analysisMode === 'link' && !urlInput.trim()) return true;
        return false;
    }

    return (
        <div className={`flex flex-col h-screen bg-gradient-to-br ${currentTheme.class} text-white font-sans`}>
            <header className="flex justify-between items-center p-4 shadow-lg bg-black bg-opacity-30 backdrop-blur-md sticky top-0 z-10 gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold tracking-wider basis-full md:basis-auto text-center md:text-left mb-2 md:mb-0 truncate" title={contextTitle || (currentScenario?.title || 'Poly Glot Pal')}>
                   {contextTitle || `Dr: Ibrahim "Poly Glot Pal"`}
                </h1>
                <div className="flex items-center gap-2 md:gap-3 mx-auto md:mx-0">
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
            
            <main ref={chatContainerRef} className="flex-1 flex flex-col p-4 overflow-y-auto">
                {conversation.length === 0 && (
                    <div className="m-auto text-center text-gray-300">
                        <h2 className="text-3xl font-light">Welcome!</h2>
                        <p className="mt-2">Select a language and press the microphone to start.</p>
                    </div>
                )}
                {conversation.map((msg, index) => (
                    <MessageBubble 
                        key={msg.id} 
                        message={msg} 
                        messageIndex={index} 
                        onExplainClick={handleExplainClick}
                        onPlayAudio={playAudio}
                        isPlaying={currentlyPlayingMessageId === msg.id}
                     />
                ))}
            </main>

            {error && !isApiOnCooldown && <div className="text-center py-2 bg-red-800 bg-opacity-80 text-white">{error}</div>}
            {isApiOnCooldown && <div className="text-center py-2 bg-yellow-800 bg-opacity-80 text-white">You've exceeded the request limit. Please wait {cooldownTimer} seconds.</div>}

            <footer className="p-4 bg-black bg-opacity-30 backdrop-blur-md flex items-center justify-center gap-4">
                 {isSpeaking && (<button onClick={handleStopSpeaking} className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-full bg-yellow-600 hover:bg-yellow-700 transition-colors focus:outline-none focus:ring-4 focus:ring-yellow-400 focus:ring-opacity-50" aria-label="Stop Speaking"><i className="fa-solid fa-stop text-2xl"></i></button>)}
                <div className="w-full max-w-2xl flex items-center gap-2">
                    <input
                        type="text"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        placeholder={`Type in ${selectedLanguage.name}...`}
                        className="flex-grow bg-gray-700 border border-gray-600 rounded-full px-5 py-3 text-white focus:outline-none focus:ring-2 focus:ring-sky-500 placeholder-gray-400"
                        disabled={isRecording || isApiBusy || isApiOnCooldown}
                    />
                    {textInput.trim() ? (
                        <button onClick={handleSendMessage} disabled={isApiBusy || isApiOnCooldown} className="flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-full bg-sky-600 hover:bg-sky-700 transition-colors focus:outline-none focus:ring-4 focus:ring-sky-400 focus:ring-opacity-50 disabled:opacity-50 disabled:cursor-not-allowed" aria-label="Send Message">
                            <i className="fa-solid fa-paper-plane text-xl"></i>
                        </button>
                    ) : (
                        <button onClick={handleRecordClick} disabled={isApiBusy || isApiOnCooldown} className={`relative flex-shrink-0 flex items-center justify-center w-14 h-14 rounded-full transition-all duration-300 ease-in-out focus:outline-none focus:ring-4 focus:ring-opacity-50 ${isRecording ? 'bg-red-600 hover:bg-red-700 focus:ring-red-400' : 'bg-sky-600 hover:bg-sky-700 focus:ring-sky-400'} ${isApiBusy || isApiOnCooldown ? 'cursor-not-allowed bg-gray-600' : ''}`} aria-label={isRecording ? "Stop Recording" : "Start Recording"}>
                            {isRecording && <span className="absolute animate-ping inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                            {renderRecordButtonContent()}
                        </button>
                    )}
                </div>
            </footer>

            {/* Modals */}
            <Modal isOpen={isTextAnalysisModalOpen} onClose={() => setIsTextAnalysisModalOpen(false)} title="Analyze Content">
                <div className="flex flex-col gap-4">
                    <div className="flex border-b border-gray-700">
                        <button onClick={() => setAnalysisMode('paste')} className={`px-4 py-2 text-lg font-semibold transition-colors ${analysisMode === 'paste' ? 'border-b-2 border-sky-500 text-white' : 'text-gray-400 hover:text-white'}`}>Paste Text</button>
                        <button onClick={() => setAnalysisMode('upload')} className={`px-4 py-2 text-lg font-semibold transition-colors ${analysisMode === 'upload' ? 'border-b-2 border-sky-500 text-white' : 'text-gray-400 hover:text-white'}`}>Upload File</button>
                        <button onClick={() => setAnalysisMode('link')} className={`px-4 py-2 text-lg font-semibold transition-colors ${analysisMode === 'link' ? 'border-b-2 border-sky-500 text-white' : 'text-gray-400 hover:text-white'}`}>Enter Link</button>
                    </div>
                    
                    {analysisMode === 'paste' && (
                        <textarea value={textForAnalysis} onChange={(e) => setTextForAnalysis(e.target.value)} className="w-full h-48 p-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-white" placeholder="Paste an article, email, or any text here..."></textarea>
                    )}

                    {analysisMode === 'upload' && (
                        <div className="flex flex-col items-center gap-4">
                           <label htmlFor="file-upload" className="w-full flex flex-col items-center justify-center p-6 border-2 border-dashed border-gray-600 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
                                <i className="fa-solid fa-cloud-arrow-up text-4xl text-gray-500"></i>
                                <p className="mt-2 text-sm text-gray-400">Click to upload or drag and drop</p>
                                <p className="text-xs text-gray-500">TXT, PDF, or DOCX</p>
                           </label>
                           <input id="file-upload" type="file" className="hidden" accept=".txt, .pdf, .docx, application/pdf, application/vnd.openxmlformats-officedocument.wordprocessingml.document, text/plain" onChange={handleFileChange} />
                           {fileProcessingMessage && <p className="text-center text-sm text-gray-300">{fileProcessingMessage}</p>}
                           {selectedFile && <div className="flex items-center gap-2 p-2 bg-gray-900 rounded-md"><i className="fa-solid fa-file-lines text-sky-400"></i><span className="truncate">{selectedFile.name}</span><button onClick={handleRemoveFile} className="ml-2 text-gray-500 hover:text-white">&times;</button></div>}
                        </div>
                    )}
                    
                    {analysisMode === 'link' && (
                         <input type="url" value={urlInput} onChange={(e) => setUrlInput(e.target.value)} className="w-full p-3 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-white" placeholder="https://example.com/article" />
                    )}

                    <button onClick={handleContentAnalysisSubmit} disabled={isAnalysisSubmitDisabled()} className="self-end px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed">{isApiBusy ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Processing...</> : "Start Discussion"}</button>
                </div>
            </Modal>
            <Modal isOpen={isDictionaryModalOpen} onClose={() => setIsDictionaryModalOpen(false)} title="Conversation Dictionary">
                <div className="flex border-b border-gray-700 mb-4">
                    <button onClick={() => setDictionaryActiveTab('vocabulary')} className={`px-4 py-2 text-lg font-semibold transition-colors ${dictionaryActiveTab === 'vocabulary' ? 'border-b-2 border-sky-500 text-white' : 'text-gray-400 hover:text-white'}`}>Vocabulary List</button>
                    <button onClick={() => setDictionaryActiveTab('analysis')} className={`px-4 py-2 text-lg font-semibold transition-colors ${dictionaryActiveTab === 'analysis' ? 'border-b-2 border-sky-500 text-white' : 'text-gray-400 hover:text-white'}`}>Word Analyzer</button>
                </div>
                {dictionaryActiveTab === 'vocabulary' && (
                    isApiBusy ? <div className="flex justify-center items-center h-48"><i className="fa-solid fa-spinner fa-spin text-4xl text-sky-400"></i></div> : error && !vocabularyList ? <p className="text-red-400 text-center">{error}</p> : vocabularyList && <div className="flex flex-col gap-6">{vocabularyList.length === 0 ? <p className="text-center">No key vocabulary found. Try having a longer conversation!</p> : vocabularyList.map((item, index) => (<div key={index} className="border-b border-gray-700 pb-4 last:border-b-0"><div className="flex justify-between items-start gap-4"><div><h3 className="text-xl font-bold text-sky-400">{item.word}</h3>{item.synonyms.length > 0 && <p className="mt-1"><strong className="font-semibold text-gray-400">Synonyms:</strong> {item.synonyms.join(', ')}</p>}{item.arabicMeanings.length > 0 && <div className="mt-1 text-right" dir="rtl"><strong className="font-semibold text-gray-400" dir="ltr">المعاني العربية: </strong> <span>{item.arabicMeanings.join('، ')}</span></div>}</div><button onClick={() => handleAnalyzeFromVocab(item.word)} className="flex-shrink-0 mt-1 px-3 py-1 text-sm bg-gray-600 hover:bg-gray-500 rounded-md transition-colors" title={`Analyze "${item.word}"`}>Analyze 🔬</button></div></div>))}</div>
                )}
                {dictionaryActiveTab === 'analysis' && (
                    <div className="flex flex-col gap-4">
                        <p>Type any English word to analyze its parts of speech, definitions, and example sentences.</p>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={wordToAnalyze}
                                onChange={(e) => setWordToAnalyze(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeWord()}
                                placeholder="e.g., versatile"
                                className="flex-grow bg-gray-900 border border-gray-600 rounded-md px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                                disabled={isAnalyzingWord}
                            />
                            <button
                                onClick={() => handleAnalyzeWord()}
                                disabled={!wordToAnalyze.trim() || isAnalyzingWord}
                                className="px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isAnalyzingWord ? <i className="fa-solid fa-spinner fa-spin"></i> : "Analyze Word"}
                            </button>
                        </div>
                        <div className="mt-2 p-4 bg-gray-900 rounded-md border border-gray-700 min-h-[12rem]">
                            {isAnalyzingWord && <div className="flex justify-center items-center h-full"><i className="fa-solid fa-spinner fa-spin text-3xl text-sky-400"></i></div>}
                            {wordAnalysisResult && !isAnalyzingWord && <MarkdownRenderer content={wordAnalysisResult} />}
                            {!wordAnalysisResult && !isAnalyzingWord && <p className="text-gray-500 text-center pt-10">Analysis will appear here.</p>}
                        </div>

                        {wordAnalysisResult && !isAnalyzingWord && (
                            <div className="mt-2 flex flex-col items-center gap-4">
                                <button
                                    onClick={handleFetchWordFamily}
                                    disabled={isFetchingWordFamily}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors disabled:opacity-50"
                                >
                                    {isFetchingWordFamily ? <><i className="fa-solid fa-spinner fa-spin mr-2"></i>Loading...</> : "Show Word Family"}
                                </button>
                                
                                {isFetchingWordFamily && (
                                    <div className="flex justify-center items-center w-full h-24">
                                        <i className="fa-solid fa-spinner fa-spin text-3xl text-sky-400"></i>
                                    </div>
                                )}
                                
                                {wordFamilyResult && !isFetchingWordFamily && (
                                    <div className="w-full mt-2 p-4 bg-gray-900 rounded-md border border-gray-700">
                                        <h4 className="text-lg font-bold text-indigo-300 mb-2">Word Family</h4>
                                        <MarkdownRenderer content={wordFamilyResult} />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </Modal>
            <Modal isOpen={isScenarioModalOpen} onClose={() => setIsScenarioModalOpen(false)} title="Custom Role-Play Scenario">
                <div className="flex flex-col gap-4">
                    <p>What situation would you like to practice today?</p>
                    <textarea 
                        value={customScenarioInput} 
                        onChange={(e) => setCustomScenarioInput(e.target.value)} 
                        className="w-full h-28 p-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-white" 
                        placeholder="e.g., Ordering food at a restaurant, asking for directions to the train station, complaining about a hotel room..."
                    />
                    <button 
                        onClick={handleCustomScenarioSubmit} 
                        disabled={isApiBusy || !customScenarioInput.trim() || isApiOnCooldown} 
                        className="self-end px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isApiBusy || isApiOnCooldown ? <i className="fa-solid fa-spinner fa-spin"></i> : "Start Scenario"}
                    </button>
                </div>
            </Modal>
            <Modal isOpen={isGrammarModalOpen} onClose={() => setIsGrammarModalOpen(false)} title="Grammar Explanation">{isApiBusy ? <div className="flex justify-center items-center h-32"><i className="fa-solid fa-spinner fa-spin text-4xl text-sky-400"></i></div> : <p className="text-base whitespace-pre-wrap">{grammarExplanation}</p>}</Modal>
            <Modal isOpen={isDailyChallengeModalOpen} onClose={() => setIsDailyChallengeModalOpen(false)} title="Daily Vocabulary Challenge">
                <div className="flex flex-col gap-4">
                    {dailyChallenge && <p>Can you use the word <strong className="text-sky-400">{`"${dailyChallenge.word}"`}</strong> in a sentence?</p>}
                    <textarea value={challengeSentence} onChange={(e) => setChallengeSentence(e.target.value)} className="w-full h-24 p-2 bg-gray-900 border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-sky-500 text-white" placeholder="Type your sentence here..."></textarea>
                    <button onClick={handleChallengeSubmit} disabled={isApiBusy || isApiOnCooldown} className="self-end px-4 py-2 bg-sky-600 hover:bg-sky-700 rounded-md transition-colors disabled:opacity-50">{isApiBusy || isApiOnCooldown ? <i className="fa-solid fa-spinner fa-spin"></i> : "Check Sentence"}</button>
                    {challengeFeedback && <div className="mt-4 p-3 bg-gray-900 rounded-md border border-gray-600"><p className="whitespace-pre-wrap">{challengeFeedback}</p></div>}
                </div>
            </Modal>
             <Modal isOpen={isSettingsModalOpen} onClose={() => setIsSettingsModalOpen(false)} title="Settings">
                <div className="flex flex-col gap-4">
                    <h3 className="text-lg font-semibold text-gray-200">Background Theme</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {THEMES.map(themeOption => (
                            <button 
                                key={themeOption.id} 
                                onClick={() => handleThemeChange(themeOption.id)}
                                className={`p-4 rounded-lg text-left transition-all border-2 ${theme === themeOption.id ? 'border-sky-500' : 'border-gray-700 hover:border-gray-500'}`}
                            >
                                <div className={`w-full h-16 rounded-md bg-gradient-to-br ${themeOption.class} mb-2`}></div>
                                <span className="font-semibold">{themeOption.name}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </Modal>
        </div>
    );
};

export default App;