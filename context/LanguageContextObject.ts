import { createContext } from 'react';
import { LanguageContextType } from '../types/language';

export const LanguageContext = createContext<LanguageContextType | null>(null);
