import { LanguageOption, Difficulty, Theme } from './types';

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en-US', name: 'English', dir: 'ltr' },
  { code: 'fr-FR', name: 'Français', dir: 'ltr' },
  { code: 'ar-SA', name: 'العربية', dir: 'rtl' },
];

export const DIFFICULTIES: Difficulty[] = ['Beginner', 'Intermediate', 'Advanced'];

export const THEMES: Theme[] = [
    { id: 'default', name: 'Dark Slate', class: 'from-gray-900 to-slate-800' },
    { id: 'ocean', name: 'Deep Ocean', class: 'from-cyan-900 to-blue-900' },
    { id: 'forest', name: 'Enchanted Forest', class: 'from-green-900 to-teal-900' },
    { id: 'dusk', name: 'Twilight Dusk', class: 'from-indigo-900 to-purple-900' },
];