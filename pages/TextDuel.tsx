import React, { useState } from 'react';
import { Swords, ArrowRight, CheckCircle, RefreshCw, Zap, Download, Share2 } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { callGemini } from '../services/apiService';
import confetti from 'canvas-confetti';
import PremiumModal from '../components/PremiumModal';
import { generatePdf } from '../lib/pdf';
import { LANGUAGE_NAMES } from '../constants/languages';

type DuelState = 'intro' | 'analyzing' | 'duel' | 'reasoning' | 'success';

interface DuelData {
  type: string;
  title: string;
  optionA: string;
  optionB: string;
  question: string;
}

const TextDuel: React.FC = () => {
  const { t, language, user, addXp, checkUsage, incrementUsage, isPremiumUser } = useLanguage();
  const [state, setState] = useState<DuelState>('intro');
  const [text, setText] = useState('');
  const [duelData, setDuelData] = useState<DuelData | null>(null);
  const [selectedOption, setSelectedOption] = useState<'A' | 'B' | null>(null);
  const [reason, setReason] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState('');

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const generateDuel = async () => {
    if (!text.trim()) return;
    
    if (!checkUsage()) {
        setShowPremiumModal(true);
        return;
    }

    setState('analyzing');
    setError(null);

    try {
      const idioma = LANGUAGE_NAMES[language] || 'English';
      
      const systemInstruction = `
Ets "Duel de Textos", un assistent d’escriptura gamificat per a alumnes de primària.
OBJECTIU: Ajudar l’alumne a millorar el seu text comparant dues opcions i triant la millor.
No corregeixes directament. No expliques teoria. Crees una comparació (duel) perquè l’alumne pensi i decideixi.

IDIOMA: Respon SEMPRE en ${idioma}. Llenguatge adaptat a primària.

TIPUS DE DUEL (tria automàticament):
- IDEA → si el text és curt o poc desenvolupat
- EXPRESSIÓ → si la frase és simple
- EMOCIÓ → si falta sentiment
- ACCIÓ → si falta moviment o interès

Genera dues opcions millorades del text de l'alumne, amb estils diferents (ex: una més descriptiva, l'altra més directa).

Has de retornar format JSON estrictament amb aquestes propietats:
- type: STRING (IDEA, EXPRESSIÓ, EMOCIÓ, o ACCIÓ)
- title: STRING (Ex: ⚔️ DUEL D'EXPRESSIÓ ⚔️)
- optionA: STRING (Primera versió millorada)
- optionB: STRING (Segona versió millorada)
- question: STRING (Pregunta final, ex: Quina t'agrada més i per què? 🤔)
`;

      const response = await callGemini(
        'gemini-2.5-flash',
        [{ parts: [{ text: `Text de l'alumne:\n"${text}"\n\nRespon només el JSON.` }] }],
        systemInstruction
      );

      let rawText = response.text || '{}';
      
      // Cleanup backticks formatting sometimes returned
      if (rawText.startsWith('```json')) {
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      } else if (rawText.startsWith('```')) {
        rawText = rawText.replace(/```/g, '').trim();
      }
      const data = JSON.parse(rawText) as DuelData;
      setDuelData(data);
      setState('duel');
      incrementUsage();

    } catch (err) {
      console.error("Duel Error", err);
      setError(t('common.error'));
      setState('intro');
    }
  };

  const handleOptionSelect = (option: 'A' | 'B') => {
    setSelectedOption(option);
    setState('reasoning');
  };

  const handleSubmitReason = () => {
    if (!reason.trim()) return;
    setState('success');
    addXp(30);
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 }
    });
  };

  const handleDownload = async () => {
    if (!duelData || !selectedOption) return;
    
    const chosenText = selectedOption === 'A' ? duelData.optionA : duelData.optionB;
    
    const content = [
      { type: 'title' as const, text: t('pdf.battle') },
      { type: 'author' as const, text: authorName || user?.name || '' },
      { type: 'subtitle' as const, text: duelData.title },
      { type: 'subtitle' as const, text: t('battle.originalText') || 'Original Text' },
      { type: 'text' as const, text: text },
      { type: 'subtitle' as const, text: t('battle.chosenOption') || 'Chosen Option' },
      { type: 'text' as const, text: chosenText },
      { type: 'subtitle' as const, text: t('battle.reasoning') || 'Reasoning' },
      { type: 'text' as const, text: reason }
    ];

    await generatePdf({
      title: t('pdf.battle'),
      author: authorName || user?.name || '',
      content,
      labels: {
        authorPrefix: t('pdf.author'),
        generatedOn: t('pdf.generatedOn'),
        pageLabel: t('pdf.page'),
        ofLabel: t('pdf.of') || 'de',
        shareTextPrefix: t('pdf.shareTextPrefix') || 'Informe de',
        shareDialogTitle: t('common.shareReport') || 'Comparteix el PDF'
      }
    });
  };

  const reset = () => {
    setText('');
    setDuelData(null);
    setSelectedOption(null);
    setReason('');
    setState('intro');
  };

  return (
    <div className="flex flex-col h-full gap-6 px-4 py-6 animate-slide-up pb-24 max-w-2xl mx-auto">
      <PremiumModal isOpen={showPremiumModal} onClose={() => setShowPremiumModal(false)} />
      
      {state === 'intro' && (
        <>
          <div className="space-y-2 text-center">
            <div className="w-20 h-20 bg-pop-purple rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-pop-dark shadow-neo">
              <Swords size={40} className="text-white" strokeWidth={2.5} />
            </div>
            <h2 className="text-4xl font-black text-pop-dark uppercase italic tracking-tight">{t('battle.title')}</h2>
            <p className="text-gray-600 font-bold text-lg leading-snug">
              {t('battle.desc')}
            </p>
          </div>
          
          <div className="w-full px-2 opacity-60 hover:opacity-100 transition-opacity mb-2">
              <input 
                  type="text" 
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder={t('aiCorrection.authorPlaceholder') || 'El teu nom...'}
                  className="w-full bg-transparent border-none focus:outline-none text-xs font-bold text-gray-400 placeholder:text-gray-200"
              />
          </div>

          <div className="bg-white p-4 rounded-3xl border-3 border-pop-dark shadow-neo flex-grow flex flex-col mt-4">
            <textarea 
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              className="w-full flex-grow min-h-[200px] text-xl font-medium text-pop-dark outline-none resize-none placeholder-gray-300"
              placeholder={t('battle.placeholder')}
            />
          </div>

          {error && (
            <div className="bg-red-100 text-red-700 p-4 rounded-2xl font-bold text-center border-3 border-pop-dark shadow-neo">
              {error}
            </div>
          )}

          <button 
            onClick={generateDuel}
            disabled={!text.trim()}
            className="w-full bg-pop-purple text-white font-black text-xl py-4 rounded-2xl border-3 border-pop-dark shadow-neo btn-press flex items-center justify-center gap-3 disabled:opacity-50 disabled:active:translate-y-0 disabled:active:shadow-neo"
          >
             <Swords size={24} strokeWidth={3} />
             <span>{t('battle.startBtn')}</span>
          </button>
        </>
      )}

      {state === 'analyzing' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center animate-pop-in">
             <div className="relative">
                <div className="absolute inset-0 bg-pop-purple blur-xl opacity-50 animate-pulse"></div>
                <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center relative border-3 border-pop-dark shadow-neo animate-spin-slow">
                    <Swords size={48} className="text-pop-dark" strokeWidth={3} />
                </div>
            </div>
            <h3 className="text-2xl font-black text-pop-dark uppercase tracking-tight">{t('battle.analyzing')}</h3>
        </div>
      )}

      {state === 'duel' && duelData && (
        <div className="flex flex-col gap-6 animate-fade-in">
          <h2 className="text-3xl font-black text-center text-pop-dark uppercase tracking-tight bg-pop-yellow py-2 px-4 rounded-xl border-3 border-pop-dark shadow-sm inline-block mx-auto transform -rotate-2">
            {duelData.title}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Option A */}
            <button 
              onClick={() => handleOptionSelect('A')}
              className="bg-white p-6 rounded-3xl border-3 border-pop-dark shadow-neo btn-press text-left flex flex-col gap-4 group hover:bg-blue-50 transition-colors"
            >
              <div className="w-12 h-12 bg-pop-blue text-white rounded-full flex items-center justify-center font-black text-2xl border-3 border-pop-dark shadow-sm group-hover:scale-110 transition-transform">
                A
              </div>
              <p className="text-xl font-medium text-pop-dark leading-relaxed">
                "{duelData.optionA}"
              </p>
              <div className="mt-auto pt-4 flex items-center text-pop-blue font-bold gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {t('battle.chooseA')} <ArrowRight size={20} />
              </div>
            </button>

            {/* Option B */}
            <button 
              onClick={() => handleOptionSelect('B')}
              className="bg-white p-6 rounded-3xl border-3 border-pop-dark shadow-neo btn-press text-left flex flex-col gap-4 group hover:bg-pop-pink/10 transition-colors"
            >
              <div className="w-12 h-12 bg-pop-pink text-white rounded-full flex items-center justify-center font-black text-2xl border-3 border-pop-dark shadow-sm group-hover:scale-110 transition-transform">
                B
              </div>
              <p className="text-xl font-medium text-pop-dark leading-relaxed">
                "{duelData.optionB}"
              </p>
              <div className="mt-auto pt-4 flex items-center text-pop-pink font-bold gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                {t('battle.chooseB')} <ArrowRight size={20} />
              </div>
            </button>
          </div>
        </div>
      )}

      {state === 'reasoning' && duelData && (
        <div className="flex flex-col gap-6 animate-slide-up">
          <div className="bg-white p-6 rounded-3xl border-3 border-pop-dark shadow-neo">
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xl text-white border-2 border-pop-dark ${selectedOption === 'A' ? 'bg-pop-blue' : 'bg-pop-pink'}`}>
                {selectedOption}
              </div>
              <p className="text-lg font-bold text-gray-500 uppercase tracking-wider">{t('battle.choose' + selectedOption)}</p>
            </div>
            <p className="text-xl font-medium text-pop-dark italic">
              "{selectedOption === 'A' ? duelData.optionA : duelData.optionB}"
            </p>
          </div>

          <div className="bg-pop-yellow p-6 rounded-3xl border-3 border-pop-dark shadow-neo">
            <h3 className="text-2xl font-black text-pop-dark mb-4">{duelData.question}</h3>
            <textarea 
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full min-h-[120px] p-4 rounded-2xl border-3 border-pop-dark text-lg font-medium outline-none resize-none focus:ring-4 focus:ring-pop-dark/20 transition-all"
              placeholder={t('battle.whyPlaceholder')}
              autoFocus
            />
            <button 
              onClick={handleSubmitReason}
              disabled={!reason.trim()}
              className="w-full mt-4 bg-pop-dark text-white font-black text-xl py-4 rounded-2xl border-3 border-pop-dark shadow-sm active:translate-y-1 active:shadow-none transition-all disabled:opacity-50"
            >
              {t('battle.submit')}
            </button>
          </div>
        </div>
      )}

      {state === 'success' && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center animate-pop-in">
            <div className="w-32 h-32 bg-pop-green rounded-full flex items-center justify-center border-4 border-pop-dark shadow-neo-lg mb-4">
                <CheckCircle size={64} className="text-white" strokeWidth={3} />
            </div>
            <h2 className="text-4xl font-black text-pop-dark uppercase italic tracking-tight">{t('battle.success')}</h2>
            
            <div className="w-full px-2 opacity-60 hover:opacity-100 transition-opacity mb-4">
                <input 
                    type="text" 
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder={t('aiCorrection.authorPlaceholder')}
                    className="w-full bg-transparent border-none focus:outline-none text-xs font-bold text-gray-400 placeholder:text-gray-200 text-center"
                />
            </div>

            <div className="flex flex-col gap-3 w-full max-w-xs">
              <button 
                onClick={handleDownload}
                className="w-full bg-pop-blue text-white font-black text-xl py-4 px-8 rounded-2xl border-3 border-pop-dark shadow-neo btn-press flex items-center justify-center gap-3"
              >
                {isMobile ? <Share2 size={24} strokeWidth={3} /> : <Download size={24} strokeWidth={3} />}
                <span>{isMobile ? t('common.shareReport') : t('common.downloadPdf')}</span>
              </button>

              <button 
                onClick={reset}
                className="w-full bg-white text-pop-dark font-black text-xl py-4 px-8 rounded-2xl border-3 border-pop-dark shadow-neo btn-press flex items-center justify-center gap-3"
              >
                <RefreshCw size={24} strokeWidth={3} />
                <span>{t('battle.tryAgain')}</span>
              </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default TextDuel;
