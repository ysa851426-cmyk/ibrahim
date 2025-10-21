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
    // ... (باقي الـ State declarations) ...
    const [urlInput, setUrlInput] = useState<string>('');

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const cooldownIntervalRef = useRef<number | null>(null);

    // --- الوظائف المساعدة تبقى كما هي ---
    const scrollToBottom = () => { /* ... */ };
    useEffect(() => { /* ... */ }, []); // Cleanup interval
    const startNewSession = useCallback((contextText?: string, scenario?: Scenario, newContextTitle?: string) => { /* ... */ }, [selectedLanguage, difficulty]);
    useEffect(scrollToBottom, [conversation]);
    useEffect(() => { /* Language/Difficulty change effect */ }, [selectedLanguage, difficulty, startNewSession]);
    useEffect(() => { /* Theme loading & pdf.js worker setup */ }, []);

    // --- بداية التعديل: تعطيل Daily Challenge useEffect ---
    // useEffect(() => { // Daily Challenge Check
    //     const savedVocabRaw = localStorage.getItem('polyglot-vocab');
    //     const savedDate = localStorage.getItem('polyglot-vocab-date');
    //     const today = new Date().toISOString().split('T')[0];
    //     if (savedVocabRaw && savedDate !== today) {
    //          const savedVocab: VocabularyItem[] = JSON.parse(savedVocabRaw);
    //          if (savedVocab.length > 0) { /* Set challenge... */ }
    //     }
    // }, []);
    // --- نهاية التعديل ---

    // --- باقي الوظائف تبقى كما هي ---
    const extractTextFromFile = async (file: File) => { /* ... */ };
    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => { /* ... */ };
    const handleRemoveFile = () => { /* ... */ };
    const handleApiError = useCallback((error: any) => { /* ... */ }, []);
    const speak = useCallback((text: string) => { /* ... */ }, [selectedLanguage.code]);
    const processAIResponse = useCallback(async (userText: string) => { /* ... */ }, [conversation, activeContext, currentScenario, handleApiError, speak]);
    const handleRecognitionResult = useCallback((event: SpeechRecognitionEvent) => { /* ... */ }, [processAIResponse]);
    const setupRecognition = useCallback(() => { /* ... */ }, [selectedLanguage, handleRecognitionResult]);

    // --- أعدنا تفعيل هذا ---
    useEffect(setupRecognition, [setupRecognition]);
    // --- ---

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