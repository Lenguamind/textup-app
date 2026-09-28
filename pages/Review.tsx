import React, { useState } from 'react';
import { CheckCircle2, Check, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';

const Review: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full">
      <div className="text-center py-6">
        <h2 className="text-3xl font-black text-dark mb-2">{t('review.title')}</h2>
        <p className="text-gray-500 px-8">{t('review.desc')}</p>
      </div>

      <div className="flex flex-col gap-3 flex-1">
        {(t('review.checks') as unknown as string[]).map((check, index) => (
            <CheckItem key={index} text={check} />
        ))}
      </div>

      <div className="mt-8 mb-4">
        <div className="bg-brand-light border border-brand/20 rounded-2xl p-4 flex items-center gap-3 text-center justify-center">
            <SparklesIcon />
            <p className="text-sm font-medium text-brand-dark">{t('review.tip')}</p>
        </div>
      </div>

      <button 
        onClick={() => navigate('/home')}
        className="w-full bg-brand hover:bg-brand-dark text-dark font-bold text-lg py-4 rounded-2xl shadow-lg shadow-brand/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
      >
        <span>{t('review.finish')}</span>
        <ArrowRight size={24} />
      </button>
    </div>
  );
};

const SparklesIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L14.4 7.2L20 9.6L14.4 12L12 17.2L9.6 12L4 9.6L9.6 7.2L12 2Z" fill="#25f478" stroke="#102217" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
)

const CheckItem: React.FC<{ text: string }> = ({ text }) => {
  const [checked, setChecked] = useState(false);

  return (
    <div 
        onClick={() => setChecked(!checked)}
        className={`relative flex items-center p-4 rounded-2xl transition-all duration-200 cursor-pointer border-2 ${checked ? 'bg-white border-brand shadow-soft' : 'bg-white border-transparent hover:border-gray-100 shadow-card'}`}
    >
      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${checked ? 'bg-brand border-brand' : 'border-gray-300'}`}>
        {checked && <Check size={14} className="text-dark" strokeWidth={4} />}
      </div>
      <span className={`ml-4 font-bold text-sm ${checked ? 'text-dark' : 'text-gray-600'}`}>{text}</span>
      
      {checked && (
        <div className="absolute right-4 text-brand">
            <CheckCircle2 size={24} fill="currentColor" className="text-brand-light" />
        </div>
      )}
    </div>
  );
};

export default Review;
