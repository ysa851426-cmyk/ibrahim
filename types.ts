export enum Role {
  USER = 'user',
  MODEL = 'model'
}

export interface Message {
  role: Role;
  text: string;
}

export interface LanguageOption {
  code: 'en-US' | 'fr-FR' | 'ar-SA';
  name: string;
  dir: 'ltr' | 'rtl';
}

export interface VocabularyItem {
  word: string;
  synonyms: string[];
  arabicMeanings: string[];
}

export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Scenario {
  id: string;
  title: string;
  emoji: string;
  prompt: string;
}

export interface Theme {
  id: string;
  name: string;
  class: string;
}