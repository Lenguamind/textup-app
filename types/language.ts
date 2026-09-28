export type Language = 'en' | 'es' | 'fr' | 'ca' | 'it' | 'de' | 'pt' | 'pl' | 'nl' | 'sv' | 'no' | 'da' | 'uk' | 'ru';

export interface Translations {
  [key: string]: any;
}

export interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (path: string) => string;
  user: any;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  continueAsGuest: () => void;
  updateUser: (data: any) => Promise<void>;
  addXp: (amount: number) => void;
  checkUsage: () => boolean;
  incrementUsage: () => void;
  isAiStudioConnected: boolean;
  isPremiumUser: () => boolean;
  syncPremiumStatus: () => Promise<boolean>;
}
