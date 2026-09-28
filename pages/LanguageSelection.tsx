import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';

const LanguageSelection: React.FC = () => {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();

  const handleContinue = () => {
    // Navegar a la pantalla de login/registro
    navigate('/login');
  };

  return (
    <div className="min-h-[100dvh] bg-brand-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-20%] right-[-20%] w-[80%] h-[80%] bg-brand/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-100/20 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm z-10 flex flex-col gap-8 animate-fade-in">
        <div className="text-center space-y-4">
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-green-600 to-brand italic transform -rotate-2 pb-2">
            TEXTUP!
          </h1>
          <div>
             <h2 className="text-2xl font-bold text-dark">{t('welcome.title')}</h2>
             <p className="text-gray-500 font-medium mt-1">{t('welcome.subtitle')}</p>
          </div>
        </div>

        <div className="space-y-3">
          <LanguageOption 
            id="es" 
            label={t('welcome.lang.es')}
            subLabel={t('welcome.lang.es_sub')}
            emoji="🇪🇸"
            selected={language === 'es'} 
            onClick={() => setLanguage('es')} 
          />
          <LanguageOption 
            id="en" 
            label={t('welcome.lang.en')}
            subLabel={t('welcome.lang.en_sub')}
            emoji="🇬🇧"
            selected={language === 'en'} 
            onClick={() => setLanguage('en')} 
          />
          <LanguageOption 
            id="fr" 
            label={t('welcome.lang.fr')}
            subLabel={t('welcome.lang.fr_sub')}
            emoji="🇫🇷"
            selected={language === 'fr'} 
            onClick={() => setLanguage('fr')} 
          />
          <LanguageOption 
            id="it" 
            label={t('welcome.lang.it') || "Italiano"}
            subLabel={t('welcome.lang.it_sub') || "Italian"}
            emoji="🇮🇹"
            selected={language === 'it'} 
            onClick={() => setLanguage('it')} 
          />
          <LanguageOption 
            id="da" 
            label={t('welcome.lang.da') || "Dansk"}
            subLabel={t('welcome.lang.da_sub') || "Dansk"}
            emoji="🇩🇰"
            selected={language === 'da'} 
            onClick={() => setLanguage('da')} 
          />
          <LanguageOption 
            id="de" 
            label={t('welcome.lang.de') || "Deutsch"}
            subLabel={t('welcome.lang.de_sub') || "German"}
            emoji="🇩🇪"
            selected={language === 'de'} 
            onClick={() => setLanguage('de')} 
          />
          <LanguageOption 
            id="pl" 
            label={t('welcome.lang.pl') || "Polski"}
            subLabel={t('welcome.lang.pl_sub') || "Polski"}
            emoji="🇵🇱"
            selected={language === 'pl'} 
            onClick={() => setLanguage('pl')} 
          />
          <LanguageOption 
            id="pt" 
            label={t('welcome.lang.pt') || "Português"}
            subLabel={t('welcome.lang.pt_sub') || "Português"}
            emoji="🇵🇹"
            selected={language === 'pt'} 
            onClick={() => setLanguage('pt')} 
          />
          <LanguageOption 
            id="nl" 
            label={t('welcome.lang.nl') || "Nederlands"}
            subLabel={t('welcome.lang.nl_sub') || "Nederlands"}
            emoji="🇳🇱"
            selected={language === 'nl'} 
            onClick={() => setLanguage('nl')} 
          />
          <LanguageOption 
            id="uk" 
            label={t('welcome.lang.uk') || "Українська"}
            subLabel={t('welcome.lang.uk_sub') || "Українська"}
            emoji="🇺🇦"
            selected={language === 'uk'} 
            onClick={() => setLanguage('uk')} 
          />
          <LanguageOption 
            id="ru" 
            label={t('welcome.lang.ru') || "Русский"}
            subLabel={t('welcome.lang.ru_sub') || "Русский"}
            emoji="🇷🇺"
            selected={language === 'ru'} 
            onClick={() => setLanguage('ru')} 
          />
          <LanguageOption 
            id="ca" 
            label={t('welcome.lang.ca')}
            subLabel={t('welcome.lang.ca_sub')}
            emoji="🟡" 
            selected={language === 'ca'} 
            onClick={() => setLanguage('ca')} 
          />
        </div>

        <button 
          onClick={handleContinue}
          className="w-full bg-brand hover:bg-brand-dark text-dark font-bold text-lg py-4 rounded-2xl shadow-lg shadow-brand/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] mt-4 group cursor-pointer relative z-20"
        >
          <span>{t('common.continue')}</span>
          <ChevronRight size={24} className="transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </div>
  );
};

interface LanguageOptionProps {
  id: string;
  label: string;
  subLabel: string;
  emoji: string;
  selected: boolean;
  onClick: () => void;
}

const LanguageOption: React.FC<LanguageOptionProps> = ({ label, subLabel, emoji, selected, onClick }) => {
  return (
    <div 
      onClick={onClick}
      className={`relative flex items-center p-4 rounded-2xl transition-all duration-200 cursor-pointer border-2 group ${
        selected 
          ? 'bg-white border-brand shadow-soft' 
          : 'bg-white border-transparent hover:border-gray-100 shadow-card'
      }`}
    >
      <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
        {emoji}
      </div>
      
      <div className="ml-4 flex-1">
        <h3 className={`font-bold text-base leading-tight ${selected ? 'text-dark' : 'text-gray-700'}`}>{label}</h3>
        <p className="text-xs font-medium text-gray-400">{subLabel}</p>
      </div>
      
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${selected ? 'bg-brand border-brand' : 'border-gray-200'}`}>
        {selected && <Check size={14} className="text-dark" strokeWidth={4} />}
      </div>
    </div>
  );
};

export default LanguageSelection;
