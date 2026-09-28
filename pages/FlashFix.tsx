import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Anchor, 
  RefreshCcw, 
  ArrowRight,
  Eye,
  Brain,
  Sparkles,
  Search,
  Loader2,
  ImageOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../hooks/useLanguage';
import { callGemini } from '../services/apiService';

const FlashFix: React.FC = () => {
  const navigate = useNavigate();
  const { t, language, user } = useLanguage();
  const [word, setWord] = useState('');
  const [status, setStatus] = useState<'input' | 'flashing' | 'anchor' | 'result'>('input');
  const [anchorData, setAnchorData] = useState<{
    correctWord: string;
    phrase: string;
    imagePrompt: string;
    type: string;
    searchKeyword?: string;
    emoji?: string;
    explanation?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [waveProgress, setWaveProgress] = useState(0);

  const waveRandoms = useMemo(() => [
    { duration: 0.5, delay: 0.1 },
    { duration: 0.7, delay: 0.05 },
    { duration: 0.4, delay: 0.15 },
    { duration: 0.6, delay: 0.0 },
    { duration: 0.8, delay: 0.1 },
    { duration: 0.5, delay: 0.2 },
    { duration: 0.7, delay: 0.05 },
    { duration: 0.4, delay: 0.12 },
    { duration: 0.6, delay: 0.08 },
    { duration: 0.8, delay: 0.15 },
    { duration: 0.5, delay: 0.02 },
    { duration: 0.7, delay: 0.18 }
  ], []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (status === 'flashing') {
      interval = setInterval(() => {
        setWaveProgress((prev) => (prev < 12 ? prev + 1 : prev));
      }, 100);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleFlash = async () => {
    if (!word.trim()) return;
    
    setStatus('flashing');
    setWaveProgress(0);
    setImageLoaded(false);
    setImageError(false);
    
    try {
      const prompt = `L'usuari ha escrit: "${word}".

PAS 1 - DETECTA LA FALTA CONCRETA:
Troba la paraula correcta. Compara lletra per lletra i identifica EXACTAMENT quina lletra està mal escrita, falta o sobra. Especifica el tipus d'error (lletra que falta, lletra incorrecta, accent incorrecte, doble lletra, etc.).

PAS 2 - CREA LA METÀFORA SOBRE AQUELLA LLETRA:
Un cop identificada la lletra problemàtica, crea una àncora mnemotècnica específica per a AQUELLA LLETRA CONCRETA que ajudi a recordar per què s'escriu amb aquella lletra i no una altra.

Exemples de bones metàfores sobre la falta concreta:
- "abela" (hauria de ser "abella") -> doble L: "L'abeLLa té dos aLes!"
- "ivern" (hauria de ser "hivern") -> H inicial: "A l'Hivern fa Helada!"
- "cotxe" escrit com "coixe" -> T: "El coTxe té quatre rodes!"
- "bicicleta" escrit com "vicicleta" -> B: "La Bicicleta té dos Botons!"
- "paraula" escrit com "paraule" -> A final: "La pArAulA sempre acAbA en A!"

Regles IMPORTANTS:
1. La metàfora ha de ser sobre LA LLETRA QUE FALLA, no sobre la paraula en general
2. La frase ha de tenir entre 3 i 6 paraules MÀXIM
3. Ha de ser evident i divertit per a un infant de 8 anys
4. searchKeyword: traducció a anglès de l'objecte principal de la metàfora
5. explanation: 1-2 frases explicant per què aquesta metàfora ajuda a recordar la lletra correcta (ex: "Per recordar la doble L...")
6. Afegeix un emoji de l'objecte

Respon NOMÉS amb JSON:
{
  "correctWord": "paraula correcta en majúscules",
  "phrase": "frase mnemotècnica sobre la lletra que falla",
  "searchKeyword": "keyword en anglès (1-2 paraules)",
  "emoji": "emoji",
  "explanation": "explicació breu de per què aquesta metàfora ajuda a recordar la lletra correcta",
  "type": "tipus de dificultat ortogràfica"
}

Idioma: ${language}.`;

      const response = await callGemini(
        'gemini-2.5-flash',
        [{ parts: [{ text: prompt }] }],
        undefined,
        {
          responseMimeType: "application/json",
          responseSchema: {
            "type": "OBJECT",
            "properties": {
              "correctWord": { "type": "STRING" },
              "phrase": { "type": "STRING" },
              "searchKeyword": { "type": "STRING" },
              "emoji": { "type": "STRING" },
              "explanation": { "type": "STRING" },
              "type": { "type": "STRING" }
            },
            "required": ["correctWord", "phrase", "searchKeyword", "emoji", "explanation", "type"]
          }
        },
        user?.apiKey
      );

      const cleanJson = (response.text || '{}').replace(/```json\n?|```/g, '').trim();
      const data = JSON.parse(cleanJson);
      setAnchorData(data);
      setStatus('anchor');

    } catch (error: any) {
      console.error("FlashFix error:", error);
      if (error?.message === 'AI_QUOTA_EXCEEDED') {
          setError(t('errors.quota') || "⏳ Quota diària esgotada al servidor.");
      } else if (error?.message === 'AI_SERVER_OVERLOAD') {
          setError(t('errors.serverOverload') || "⏳ Servidor sobrecarregat. Reintentant...");
      } else {
          setError(t('common.error') || "Error en la connexió. Torna-ho a provar.");
      }
      setStatus('input');
    }
  };

  const handleReset = () => {
    setWord('');
    setAnchorData(null);
    setStatus('input');
    setError(null);
    setImageLoaded(false);
    setImageError(false);
  };

  const imageUrl = useMemo(() => {
    if (!anchorData) return '';
    const keyword = anchorData.searchKeyword || anchorData.correctWord || 'idea';
    const imagePrompt = `ultra simple 2d flat clipart of ${keyword}, minimalist child drawing, white background, no details`;
    return `https://image.pollinations.ai/prompt/${encodeURIComponent(imagePrompt)}?width=400&height=400&nologo=true&enhance=false&model=flux`;
  }, [anchorData]);

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 pb-32 overflow-hidden relative">
      <AnimatePresence mode="wait">
        
        {status === 'input' && (
          <motion.div 
            key="input"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-md space-y-8 text-center"
          >
            <div className="space-y-2">
              <h1 className="text-4xl md:text-5xl font-black text-pop-dark tracking-tighter italic">
                ARRELMIND
              </h1>
              <p className="text-gray-500 font-bold text-lg">{t('flashFix.desc')}</p>
            </div>

            <div className="relative group">
              <input 
                type="text"
                value={word}
                onChange={(e) => setWord(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFlash()}
                placeholder={t('flashFix.inputPlaceholder')}
                className="w-full bg-white border-4 border-pop-dark rounded-3xl p-6 text-3xl font-black text-pop-dark shadow-neo focus:outline-none focus:ring-0 transition-all placeholder:text-gray-200"
                autoFocus
              />
              <div className="absolute -top-3 -right-3 w-12 h-12 bg-pop-yellow rounded-2xl border-3 border-pop-dark flex items-center justify-center shadow-neo transform rotate-12">
                <Search size={24} strokeWidth={3} className="text-pop-dark" />
              </div>
            </div>

            <button 
              onClick={handleFlash}
              disabled={!word.trim()}
              className="w-full bg-pop-dark text-white font-black text-3xl py-6 rounded-3xl border-4 border-pop-dark shadow-neo-lg btn-press flex items-center justify-center gap-4 disabled:opacity-50 disabled:translate-x-0 disabled:translate-y-0"
            >
              <Anchor size={32} fill="currentColor" strokeWidth={0} className="text-pop-yellow animate-pulse" />
              {t('flashFix.flashBtn')}
            </button>

            {error && <p className="text-red-500 font-bold">{error}</p>}
          </motion.div>
        )}

        {status === 'flashing' && (
          <motion.div 
            key="flashing"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center gap-8"
          >
            <motion.div
              animate={{ 
                x: [0, -10, 10, -5, 5, 0],
                y: [0, 5, -5, 2, -2, 0],
                skewX: [0, 5, -5, 2, -2, 0],
                scale: [1, 1.1, 0.9, 1.05, 0.95, 1]
              }}
              transition={{ repeat: Infinity, duration: 0.2 }}
              className="text-5xl md:text-6xl font-black text-pop-dark uppercase tracking-tighter filter hue-rotate-90 select-none text-center break-all px-4"
            >
              {word}
            </motion.div>
            
            <div className="flex items-center justify-center gap-1.5 h-16">
              {[...Array(12)].map((_, i) => {
                const isActive = i < waveProgress;
                return (
                  <motion.div
                    key={i}
                    animate={isActive ? { height: ['40%', '100%', '40%'] } : { height: '10%' }}
                    transition={isActive ? { 
                      repeat: Infinity, 
                      duration: waveRandoms[i].duration, 
                      delay: waveRandoms[i].delay,
                      ease: "easeInOut"
                    } : { duration: 0.2 }}
                    className={`w-3 rounded-full border-2 border-pop-dark shadow-sm transition-colors duration-300 ${
                      isActive 
                        ? (i % 3 === 0 ? 'bg-pop-yellow' : i % 3 === 1 ? 'bg-pop-orange' : 'bg-pop-green')
                        : 'bg-gray-200 border-gray-300 shadow-none'
                    }`}
                  />
                )
              })}
            </div>

            <div className="text-pop-orange font-black text-2xl uppercase tracking-widest animate-pulse mt-2 flex items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin" />
              {t('flashFix.error') || 'DETECTANT ERROR...'}
            </div>
          </motion.div>
        )}

        {status === 'anchor' && (
          <motion.div 
            key="anchor"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="w-full h-full fixed inset-0 bg-white z-50 flex flex-col items-center justify-center p-6 gap-6 pb-24 overflow-y-auto"
          >
            <motion.div 
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', damping: 10, stiffness: 100 }}
              className="relative w-[300px] h-[300px] shrink-0 rounded-[3rem] border-6 border-pop-dark overflow-hidden shadow-neo-lg bg-gray-100 flex items-center justify-center mt-12"
            >
              {(!imageLoaded && !imageError) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-pop-yellow/10 z-0 p-6 text-center">
                  <span className="text-8xl animate-pulse">{anchorData?.emoji || '⏳'}</span>
                </div>
              )}
              
              {imageError && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-pop-orange/20 z-10 p-6 text-center">
                  <span className="text-8xl drop-shadow-lg">{anchorData?.emoji || '🧠'}</span>
                  <p className="text-pop-dark font-black text-xl bg-white/80 px-4 py-2 rounded-xl border-2 border-pop-dark shadow-sm">
                    {anchorData?.searchKeyword?.toUpperCase()}
                  </p>
                </div>
              )}

              {!imageError && (
                <img 
                  src={imageUrl} 
                  alt="Mental Anchor" 
                  className={`relative z-10 w-full h-full object-cover transition-opacity duration-700 ease-in-out ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                  referrerPolicy="no-referrer"
                  onLoad={() => setImageLoaded(true)}
                  onError={() => {
                    setImageError(true);
                    setImageLoaded(true);
                  }}
                />
              )}
              <div className="absolute inset-0 bg-pop-dark/5 pointer-events-none mix-blend-multiply z-20" />
            </motion.div>

            <motion.h2 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-4xl md:text-5xl font-black text-pop-dark text-center leading-tight uppercase italic"
            >
              {anchorData?.phrase}
            </motion.h2>

            {anchorData?.explanation && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 }}
                className="max-w-xs bg-gray-50 border-3 border-gray-200 rounded-2xl p-4 text-center mt-[-10px]"
              >
                <p className="text-gray-600 font-bold text-sm md:text-base leading-snug">
                  {anchorData.explanation}
                </p>
              </motion.div>
            )}

            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="text-pop-orange font-black text-xl uppercase animate-bounce mt-2"
            >
              {t('flashFix.instruction') || "- Repeteix-ho en veu alta! -"}
            </motion.p>

            <motion.button 
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 2 }}
              onClick={() => setStatus('result')}
              className="bg-pop-dark text-white p-6 rounded-full border-4 border-white shadow-neo-lg btn-press flex-shrink-0"
            >
              <ArrowRight size={48} strokeWidth={4} />
            </motion.button>
          </motion.div>
        )}

        {status === 'result' && (
          <motion.div 
            key="result"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg space-y-12 text-center"
          >
            <div className="relative">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 bg-pop-yellow blur-3xl opacity-30"
              />
              <div className="relative space-y-4">
                <p className="text-pop-dark font-black text-xl tracking-widest uppercase opacity-40 mb-2">{t('flashFix.solved') || 'Ho tenim:'}</p>

                {word.trim().toUpperCase() !== anchorData?.correctWord?.trim().toUpperCase() && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }} 
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-red-50 text-red-500 px-6 py-2 rounded-2xl font-black text-xl md:text-2xl inline-flex items-center gap-3 border-4 border-red-200 shadow-sm mb-6"
                  >
                    <span className="line-through decoration-red-500 decoration-4">{word.toUpperCase()}</span>
                    <ArrowRight size={24} strokeWidth={4} className="text-pop-dark opacity-50" />
                    <span className="text-pop-green">{anchorData?.correctWord?.toUpperCase()}</span>
                  </motion.div>
                )}

                <div className="flex flex-col items-center justify-center gap-4">
                  <span className="text-6xl mb-2">{anchorData?.emoji}</span>
                  <div className="text-7xl md:text-8xl font-black text-pop-dark tracking-tighter uppercase break-all">
                    {anchorData?.correctWord.split('').map((char, i) => (
                      <motion.span 
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                      >
                        {char}
                      </motion.span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={handleReset}
                className="bg-white border-4 border-pop-dark text-pop-dark font-black py-4 rounded-3xl shadow-neo btn-press flex items-center justify-center gap-2"
              >
                <RefreshCcw size={24} />
                {t('flashFix.repeat') || 'Nou truc'}
              </button>
              <button 
                onClick={() => navigate('/home')}
                className="bg-pop-green border-4 border-pop-dark text-pop-dark font-black py-4 rounded-3xl shadow-neo btn-press flex items-center justify-center gap-2"
              >
                <ArrowRight size={24} />
                {t('common.finish') || 'Acabar'}
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {status === 'input' && (
        <>
          <div className="absolute top-10 left-10 text-6xl animate-float opacity-20 transform -rotate-12">⚡</div>
          <div className="absolute bottom-20 right-10 text-6xl animate-float-delayed opacity-20 transform rotate-12">🧠</div>
          <div className="absolute top-1/4 right-5 text-4xl animate-float opacity-20">✨</div>
        </>
      )}
    </div>
  );
};

export default FlashFix;
