import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { LANGUAGE_NAMES } from '../constants/languages';
import { callGemini } from '../services/apiService';
import { 
  Play, Pause, RotateCcw, ArrowRight, CheckCircle2, 
  Camera, Type, Volume2, RefreshCw, AlertCircle, ChevronDown, Sparkles
} from 'lucide-react';
import * as Diff from 'diff';
import confetti from 'canvas-confetti';
import PremiumModal from '../components/PremiumModal';

type Level = 
  | 'primaria_4' | 'primaria_5' | 'primaria_6'
  | 'eso_1' | 'eso_2' | 'eso_3' | 'eso_4'
  | 'batxillerat_1' | 'batxillerat_2';

type DictatState = 'setup' | 'generating' | 'playing' | 'input' | 'correcting' | 'results';

interface DictationData {
  title: string;
  fullText: string;
  sentences: string[];
}

interface CorrectionResult {
  score: number;
  feedback: string;
  mistakes: number;
  diff: { value: string, added?: boolean, removed?: boolean }[];
}

function createWavBlob(base64String: string, sampleRate: number = 24000): Blob {
  const binaryString = atob(base64String);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const buffer = bytes.buffer;
  const wavBytes = new Uint8Array(44 + buffer.byteLength);
  const view = new DataView(wavBytes.buffer);

  const writeString = (v: DataView, offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      v.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF chunk descriptor
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + buffer.byteLength, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, 1, true); // NumChannels (1)
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * 2, true); // ByteRate
  view.setUint16(32, 2, true); // BlockAlign
  view.setUint16(34, 16, true); // BitsPerSample (16)

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, buffer.byteLength, true);

  // Write PCM data
  wavBytes.set(new Uint8Array(buffer), 44);

  return new Blob([wavBytes], { type: 'audio/wav' });
}

const resizeImage = (base64Str: string, maxSize = 1000): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onerror = () => reject(new Error("Failed to load image for resizing"));
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxSize) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        }
      } else {
        if (height > maxSize) {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'low';
      }
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.6));
    };
  });
};

const Dictat: React.FC = () => {
  const { t, user, addXp, isPremiumUser, checkUsage, incrementUsage, language } = useLanguage();
  const navigate = useNavigate();

  const LEVEL_LABELS: Record<Level, string> = {
    'primaria_4': t('common.schoolLevels.primary4'),
    'primaria_5': t('common.schoolLevels.primary5'),
    'primaria_6': t('common.schoolLevels.primary6'),
    'eso_1': t('common.schoolLevels.eso1'),
    'eso_2': t('common.schoolLevels.eso2'),
    'eso_3': t('common.schoolLevels.eso3'),
    'eso_4': t('common.schoolLevels.eso4'),
    'batxillerat_1': t('common.schoolLevels.bat1'),
    'batxillerat_2': t('common.schoolLevels.bat2'),
  };
  
  const [state, setState] = useState<DictatState>('setup');
  const [level, setLevel] = useState<Level>('primaria_4');
  const [dictationData, setDictationData] = useState<DictationData | null>(null);
  
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioCache, setAudioCache] = useState<Record<number, string>>({});
  const [prefetching, setPrefetching] = useState<Record<number, boolean>>({});
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [studentText, setStudentText] = useState('');
  const [correctionResult, setCorrectionResult] = useState<CorrectionResult | null>(null);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [progress, setProgress] = useState(0);
  const [loadingTip, setLoadingTip] = useState('');

  const TIPS = useMemo(() => [
    t('dictat.tips.1') || 'Sabies que llegir 15 minuts al dia millora la teva ortografia?',
    t('dictat.tips.2') || 'Els accents ens ajuden a saber quina síl·laba sona més forta.',
    t('dictat.tips.3') || 'La lletra "h" és muda, però molt important per diferenciar paraules!',
    t('dictat.tips.4') || 'Pensa en la paraula "vaca"... saps per què va amb "v"?',
    t('dictat.tips.5') || 'Escriure a mà ajuda al teu cervell a recordar millor les paraules.'
  ], [t]);

  useEffect(() => {
    if (state === 'generating' || state === 'correcting') {
      setLoadingTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
      const tipInterval = setInterval(() => {
        setLoadingTip(TIPS[Math.floor(Math.random() * TIPS.length)]);
      }, 4000);
      return () => clearInterval(tipInterval);
    }
  }, [state, TIPS]);

  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  // Audio cleanup
  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      Object.values(audioCache).forEach(url => URL.revokeObjectURL(url as string));
    };
  }, [audioUrl, audioCache]);

  const getSpeedInstruction = (lvl: string, lang: string) => {
    if (lvl.includes('primaria_3') || lvl.includes('primaria_4')) {
      return `Llegeix en ${lang} de forma EXTREMADAMENT lenta, gairebé síl·laba per síl·laba, amb pauses molt llargues, ideal per a un dictat escolar de nens de 8-9 anys.`;
    } else if (lvl.includes('primaria_5') || lvl.includes('primaria_6')) {
      return `Llegeix en ${lang} de forma molt lenta i pausada, fent pauses molt llargues a cada coma i punt, ideal per a un dictat escolar.`;
    } else if (lvl.includes('eso')) {
      return `Llegeix en ${lang} a un ritme molt lent i clar, amb pauses marcades, ideal per a un dictat de secundària.`;
    } else {
      return `Llegeix en ${lang} a un ritme lent, pausat i molt clar, per a un dictat de batxillerat.`;
    }
  };

  const fetchAudio = async (text: string, index: number): Promise<string | null> => {
    if (audioCache[index]) return audioCache[index];
    if (prefetching[index]) {
      // Wait for it to finish if already prefetching
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (audioCache[index]) {
            clearInterval(check);
            resolve(audioCache[index]);
          }
        }, 100);
      });
    }

    setPrefetching(prev => ({ ...prev, [index]: true }));
    const langName = LANGUAGE_NAMES[language] || 'Catalan';
    
    try {
      const speedInstruction = getSpeedInstruction(level, langName);

      const response = await callGemini(
        'gemini-2.5-flash',
        [{ parts: [{ text: `${speedInstruction} Dicta el següent: ${text}` }] }],
        undefined,
        {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' }
            }
          }
        }
      );

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const blob = createWavBlob(base64Audio, 24000);
        const url = URL.createObjectURL(blob);
        setAudioCache(prev => ({ ...prev, [index]: url }));
        setPrefetching(prev => ({ ...prev, [index]: false }));
        return url;
      }
    } catch (err) {
      console.warn(`Error fetching audio for sentence ${index}:`, err);
      setPrefetching(prev => ({ ...prev, [index]: false }));
    }
    return null;
  };

  const prefetchRemaining = async (sentences: string[]) => {
    // Start prefetching all remaining sentences in parallel
    // We skip index 0 as it's handled by the initial load
    const remainingIndices = sentences.map((_, i) => i).filter(i => i > 0 && !audioCache[i]);
    
    // Use a small delay between batches if needed, but for 3-5 sentences we can do all
    await Promise.all(remainingIndices.map(i => fetchAudio(sentences[i], i)));
  };

  const generateDictation = async () => {
    setState('generating');
    setError(null);
    setProgress(5);

    let progressInterval: NodeJS.Timeout | null = null;

    try {
      // Simulate initial progress
      progressInterval = setInterval(() => {
        setProgress(prev => (prev < 40 ? prev + 2 : prev));
      }, 150);

      const langName = LANGUAGE_NAMES[language] || 'Catalan';
      
      const prompt = `Generate a short dictation (3-5 sentences) in ${langName} suitable for students at ${LEVEL_LABELS[level]} level.
The dictation should be dynamic, based on the corresponding educational curriculum.
Adapt the vocabulary, complexity, and spelling rules to this grade.
Ensure the sentences have an appropriate length to be dictated.
Return ONLY a JSON object with title, fullText, and sentences.`;

      const response = await callGemini(
        'gemini-2.5-flash',
        [{ parts: [{ text: prompt }] }],
        undefined,
        {
          responseMimeType: 'application/json',
          responseSchema: {
            type: "OBJECT",
            properties: {
              title: { type: "STRING", description: "Títol del dictat" },
              fullText: { type: "STRING", description: "Text complet del dictat" },
              sentences: {
                type: "ARRAY",
                items: { type: "STRING" },
                description: "Llista de frases del dictat"
              }
            },
            required: ["title", "fullText", "sentences"]
          }
        }
      );

      if (progressInterval) clearInterval(progressInterval);
      setProgress(50);

      const cleanJson = (response.text || '{}').replace(/```json\n?|```/g, '').trim();
      const data = JSON.parse(cleanJson) as DictationData;
      if (!data.fullText || !data.sentences || data.sentences.length === 0) {
        throw new Error('Invalid dictation data generated');
      }

      setDictationData(data);
      setCurrentSentenceIndex(0);
      setStudentText('');
      incrementUsage();
      
      // Clear old cache
      Object.values(audioCache).forEach(url => URL.revokeObjectURL(url as string));
      setAudioCache({});
      setPrefetching({});

      // Fetch sentences sequentially to avoid hitting limits or parallel request errors
      setProgress(60);
      
      const sentences = data.sentences;
      for (let i = 0; i < sentences.length; i++) {
        await fetchAudio(sentences[i], i);
        const newProgress = 60 + ((i + 1) / sentences.length) * 40;
        setProgress(prev => Math.max(prev, Math.min(newProgress, 100)));
        
        // After the first sentence is ready, we can transition to 'playing' state
        // but we continue fetching the rest in background if we were waiting
        if (i === 0) {
          setProgress(70);
          // Small delay to ensure state update
          setTimeout(() => {
              if (state !== 'results') {
                  setState('playing');
                  generateAudioForSentence(sentences[0], 0);
              }
          }, 100);
        }
      }
      
      setProgress(100);
    } catch (err: any) {
      if (progressInterval) clearInterval(progressInterval);
      console.warn('Error generating dictation:', err);
      const errorMessage = typeof err === 'string' ? err : (err?.error?.message || err?.message || t('common.error') || 'Error generant el dictat');
      setError(String(errorMessage));
      setState('setup');
    }
  };

  const fallbackToWebSpeech = (text: string, langCode: string, playbackSpeed: number) => {
    console.log("Using Web Speech API fallback");
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Try to find a voice matching the language
      const voices = window.speechSynthesis.getVoices();
      
      // Map our language codes to Web Speech API language codes
      const webSpeechLangCodes: Record<string, string> = {
        ca: 'ca-ES',
        es: 'es-ES',
        en: 'en-US',
        fr: 'fr-FR',
        zh: 'zh-CN',
        hi: 'hi-IN',
        ar: 'ar-SA',
        bn: 'bn-IN',
        ru: 'ru-RU',
        pt: 'pt-BR',
        ur: 'ur-PK',
        id: 'id-ID',
        de: 'de-DE'
      };
      
      const targetLangCode = webSpeechLangCodes[langCode] || 'ca-ES';
      utterance.lang = targetLangCode;
      
      // Find a specific voice if possible
      const voice = voices.find(v => v.lang.startsWith(targetLangCode.split('-')[0]));
      if (voice) utterance.voice = voice;
      
      utterance.rate = playbackSpeed;
      
      utterance.onend = () => {
        setIsPlaying(false);
        handleAudioEnded();
      };
      
      utterance.onerror = (e) => {
        console.error("Web Speech API error:", e);
        setIsPlaying(false);
      };
      
      window.speechSynthesis.speak(utterance);
    } else {
      setError(t('common.error') || "El teu navegador no suporta la síntesi de veu com a alternativa.");
      setIsPlaying(false);
    }
  };

  const generateAudioForSentence = async (text: string, index: number) => {
    const langName = LANGUAGE_NAMES[language] || 'català';
    let playbackSpeed = 0.65; // Default speed (relaxed)
    
    if (level.includes('primaria_3') || level.includes('primaria_4')) {
      playbackSpeed = 0.45; // Extremely slow
    } else if (level.includes('primaria_5') || level.includes('primaria_6')) {
      playbackSpeed = 0.5; // Very slow
    } else if (level.includes('eso')) {
      playbackSpeed = 0.6; // Slow
    }

    try {
      setIsPlaying(true);
      
      // Cancel any ongoing web speech
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      const url = await fetchAudio(text, index);

      if (url) {
        setAudioUrl(url);
        
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = url;
          audioRef.current.load();
          audioRef.current.playbackRate = playbackSpeed;
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              console.warn("Audio playback interrupted:", error);
              setIsPlaying(false);
            });
          }
        }
      } else {
        // Fallback if AI audio fails
        fallbackToWebSpeech(text, language, playbackSpeed);
      }
    } catch (err: any) {
      console.warn('Error in generateAudioForSentence:', err);
      fallbackToWebSpeech(text, language, playbackSpeed);
    }
  };

  const handleAudioEnded = () => {
    setIsPlaying(false);
    
    // Auto-repeat logic for lower levels
    if (level === 'primaria_3' || level === 'primaria_4') {
      // We could implement a repeat counter here if needed
    }
  };

  const playCurrentSentence = () => {
    if (dictationData && dictationData.sentences[currentSentenceIndex]) {
      generateAudioForSentence(dictationData.sentences[currentSentenceIndex], currentSentenceIndex);
    }
  };

  const nextSentence = () => {
    if (dictationData && currentSentenceIndex < dictationData.sentences.length - 1) {
      const nextIdx = currentSentenceIndex + 1;
      setCurrentSentenceIndex(nextIdx);
      generateAudioForSentence(dictationData.sentences[nextIdx], nextIdx);
    } else {
      setState('input');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setState('correcting');
    setProgress(10);
    const progressInterval = setInterval(() => {
      setProgress(prev => (prev < 90 ? prev + 2 : prev));
    }, 300);

    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const originalBase64 = reader.result as string;
        let base64 = originalBase64;
        try {
          base64 = await resizeImage(originalBase64);
        } catch (e) {
          console.error("Optimization failed", e);
          if (originalBase64.length > 1_500_000) {
              clearInterval(progressInterval);
              setError("La imatge és massa grossa o no té un format suportat.");
              setState('input');
              return;
          }
        }
        const langName = LANGUAGE_NAMES[language] || 'Catalan';
        
        const response = await callGemini(
          'gemini-2.5-flash',
          [
            {
              parts: [
                { text: `OCR transcription (${langName}). Exact text, no corrections, no commentary.` },
                { inlineData: { data: base64.split(',')[1], mimeType: "image/jpeg" } }
              ]
            }
          ]
        );

        const extracted = response.text || '';
        setStudentText(extracted);
        clearInterval(progressInterval);
        performCorrection(extracted);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      clearInterval(progressInterval);
      console.warn('Error reading image:', err);
      const errorMessage = err?.error?.message || err?.message || t('common.error') || 'Error llegint la imatge';
      setError(errorMessage);
      setState('input');
    }
  };

  const performCorrection = async (textToCorrect: string = studentText) => {
    if (!dictationData || !textToCorrect.trim()) return;
    
    setState('correcting');
    if (progress < 50) setProgress(50);
    const progressInterval = setInterval(() => {
      setProgress(prev => (prev < 98 ? prev + 1 : prev));
    }, 200);

    try {
      const langName = LANGUAGE_NAMES[language] || 'Catalan';
      
      const prompt = `You are an expert and very strict ${langName} teacher evaluating a dictation from a student at ${LEVEL_LABELS[level]} level.
Original text (correct): "${dictationData.fullText}"
Student text: "${textToCorrect}"

Analyze with extreme care all spelling, accentuation, punctuation, and capitalization errors.
Be implacable: any difference from the original text (except extra spaces) must be considered an error.
Pay special attention to silent letters, letters with similar sounds, and accents specific to ${langName}.

Return ONLY a JSON object with this format:
{
  "score": Score from 0 to 10 (be demanding),
  "mistakes": Total number of errors found,
  "feedback": "A constructive and motivating feedback message in ${langName} adapted to the student's level, explaining the main errors clearly."
}`;

      const response = await callGemini(
        'gemini-2.5-flash',
        [{ parts: [{ text: prompt }] }],
        undefined,
        {
          responseMimeType: 'application/json'
        }
      );

      const parseRobustJson = (text: string) => {
        try {
          return JSON.parse(text);
        } catch (e) {
          const startIndex = text.indexOf('{');
          const endIndex = text.lastIndexOf('}');
          if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
            const cleaned = text.substring(startIndex, endIndex + 1);
            try {
              return JSON.parse(cleaned);
            } catch (e2) {
              return {};
            }
          }
          return {};
        }
      };

      const data = parseRobustJson(response.text || '{}');
      
      // Calculate diff
      const diffResult = Diff.diffWords(dictationData.fullText, textToCorrect);
      
      clearInterval(progressInterval);
      setProgress(100);
      setTimeout(() => {
        setCorrectionResult({
          score: data.score || 0,
          feedback: data.feedback || '',
          mistakes: data.mistakes || 0,
          diff: diffResult
        });
        
        addXp(50 + (data.score * 5));
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        
        setState('results');
      }, 500);
    } catch (err: any) {
      clearInterval(progressInterval);
      console.warn('Error correcting dictation:', err);
      if (err?.message?.includes('429') || err?.message?.includes('quota') || err?.status === 429) {
          setError("⏳ Quota diària esgotada al servidor. El servei d'Intel·ligència Artificial està molt sol·licitat en aquest moment. Si us plau, prova-ho de nou més tard.");
      } else {
          const errorMessage = err?.error?.message || err?.message || t('common.error') || 'Error en la correcció';
          setError(String(errorMessage));
      }
      setState('input');
    }
  };

  // --- Views ---

  if (state === 'setup') {
    return (
      <div className="max-w-2xl mx-auto space-y-8 animate-slide-up pb-12">
        <PremiumModal isOpen={showPremiumModal} onClose={() => setShowPremiumModal(false)} />
        
        <div className="text-center space-y-4">
          <div className="w-24 h-24 bg-pop-blue rounded-full border-4 border-pop-dark flex items-center justify-center mx-auto shadow-neo">
            <Volume2 size={48} className="text-white" />
          </div>
          <h2 className="text-4xl font-black text-pop-dark uppercase italic tracking-tight">{t('dictat.title')}</h2>
          <p className="text-xl font-bold text-gray-500">{t('dictat.subtitle')}</p>
        </div>

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-2xl font-bold text-center border-3 border-pop-dark shadow-neo">
            {error}
          </div>
        )}

        <div className="bg-white p-8 rounded-[2.5rem] border-4 border-pop-dark shadow-neo space-y-8">
          <div className="space-y-4">
            <label className="text-xl font-black text-pop-dark uppercase italic">{t('dictat.selectLevel')}</label>
            <div className="relative">
              <select 
                value={level}
                onChange={(e) => setLevel(e.target.value as Level)}
                className="w-full appearance-none bg-gray-50 border-4 border-pop-dark rounded-2xl px-6 py-4 text-xl font-bold text-pop-dark focus:outline-none focus:ring-4 focus:ring-pop-blue/30 cursor-pointer"
              >
                <optgroup label={t('common.schoolLevels.primary')}>
                  <option value="primaria_4">{t('common.schoolLevels.primary4')}</option>
                  <option value="primaria_5">{t('common.schoolLevels.primary5')}</option>
                  <option value="primaria_6">{t('common.schoolLevels.primary6')}</option>
                </optgroup>
                <optgroup label={t('common.schoolLevels.secondary')}>
                  <option value="eso_1">{t('common.schoolLevels.eso1')}</option>
                  <option value="eso_2">{t('common.schoolLevels.eso2')}</option>
                  <option value="eso_3">{t('common.schoolLevels.eso3')}</option>
                  <option value="eso_4">{t('common.schoolLevels.eso4')}</option>
                </optgroup>
                <optgroup label={t('common.schoolLevels.highSchool')}>
                  <option value="batxillerat_1">{t('common.schoolLevels.bat1')}</option>
                  <option value="batxillerat_2">{t('common.schoolLevels.bat2')}</option>
                </optgroup>
              </select>
              <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 text-pop-dark pointer-events-none" size={24} />
            </div>
          </div>

          <button 
            onClick={generateDictation}
            className="w-full bg-pop-blue text-white font-black text-2xl py-6 rounded-3xl border-4 border-pop-dark shadow-neo flex items-center justify-center gap-4 hover:bg-blue-500 transition-colors btn-press"
          >
            <Sparkles size={32} />
            {t('dictat.generateBtn')}
          </button>
        </div>
      </div>
    );
  }

  if (state === 'generating' || state === 'correcting') {
    const circumference = 2 * Math.PI * 58;
    const offset = circumference - (progress / 100) * circumference;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 animate-slide-up">
        <div className="relative w-32 h-32">
          {/* Background Circle */}
          <svg className="w-full h-full -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="58"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="10"
              className="text-gray-100"
            />
            {/* Progress Circle */}
            <circle
              cx="64"
              cy="64"
              r="58"
              fill="transparent"
              stroke="currentColor"
              strokeWidth="10"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="text-pop-yellow transition-all duration-500 ease-out"
              strokeLinecap="round"
            />
          </svg>
          {/* Center Icon & Percentage */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-black text-pop-dark">{Math.round(progress)}%</span>
          </div>
        </div>
        <div className="text-center space-y-4 max-w-sm">
          <h2 className="text-3xl font-black text-pop-dark uppercase italic tracking-tight">
            {state === 'generating' ? t('dictat.preparing') : t('dictat.correcting')}
          </h2>
          <div className="bg-white/50 backdrop-blur-sm p-4 rounded-2xl border-2 border-pop-dark/10 min-h-[80px] flex items-center justify-center">
            <p className="text-gray-600 font-bold italic text-sm leading-tight">
              "{loadingTip}"
            </p>
          </div>
          <p className="text-pop-blue font-black animate-pulse uppercase tracking-widest text-xs">
            {state === 'generating' 
              ? (progress < 50 ? t('dictat.generatingText') : t('dictat.preparingVoice')) 
              : t('dictat.analyzingWriting')}
          </p>
        </div>
      </div>
    );
  }

  if (state === 'playing') {
    return (
      <div className="max-w-2xl mx-auto space-y-8 animate-slide-up pb-12">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-black text-pop-dark uppercase italic tracking-tight">{dictationData?.title}</h2>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border-4 border-pop-dark shadow-neo space-y-8 text-center">
          <div className="flex justify-center items-center gap-6">
            <button 
              onClick={playCurrentSentence}
              disabled={isPlaying}
              className="w-20 h-20 bg-pop-yellow rounded-full border-4 border-pop-dark flex items-center justify-center shadow-neo btn-press disabled:opacity-50"
            >
              {isPlaying ? <Volume2 size={32} className="animate-pulse" /> : <Play size={32} className="ml-2" />}
            </button>
            <button 
              onClick={playCurrentSentence}
              className="w-16 h-16 bg-gray-100 rounded-full border-4 border-pop-dark flex items-center justify-center shadow-neo btn-press hover:bg-gray-200"
              title={t('dictat.repeatSentence')}
            >
              <RotateCcw size={24} />
            </button>
          </div>

          <audio 
            ref={audioRef} 
            onEnded={handleAudioEnded}
            className="hidden"
          />

          <div className="pt-8 border-t-4 border-pop-dark/10">
            <button 
              onClick={nextSentence}
              className="w-full bg-pop-green text-pop-dark font-black text-xl py-5 rounded-2xl border-4 border-pop-dark shadow-neo flex items-center justify-center gap-3 btn-press"
            >
              {currentSentenceIndex < (dictationData?.sentences.length || 0) - 1 ? t('dictat.nextSentence') : t('dictat.takePhoto')}
              <ArrowRight size={24} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'input') {
    return (
      <div className="max-w-3xl mx-auto space-y-8 animate-slide-up pb-12">
        <div className="text-center space-y-4">
          <h2 className="text-3xl font-black text-pop-dark uppercase italic tracking-tight">{t('dictat.correctDictation')}</h2>
          <p className="text-xl font-bold text-gray-500">{t('dictat.takePhotoDesc')}</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border-4 border-pop-dark shadow-neo flex flex-col items-center justify-center space-y-6 text-center">
          <div className="bg-pop-yellow/20 p-6 rounded-full">
            <Camera size={48} className="text-pop-yellow" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-pop-dark">{t('dictat.uploadManuscript')}</h3>
            <p className="text-gray-600 font-medium max-w-md mx-auto">{t('dictat.uploadDesc')}</p>
          </div>
          
          <div className="relative w-full max-w-sm mt-4">
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-pop-yellow text-pop-dark font-black text-xl py-5 rounded-2xl border-4 border-pop-dark shadow-neo flex items-center justify-center gap-3 btn-press"
            >
              <Camera size={24} />
              {t('dictat.takePhoto')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (state === 'results' && correctionResult) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-slide-up pb-12">
        <div className="text-center space-y-4">
          <div className="inline-block bg-pop-green text-pop-dark font-black text-6xl py-4 px-8 rounded-full border-4 border-pop-dark shadow-neo mb-4">
            {correctionResult.score}/10
          </div>
          <h2 className="text-3xl font-black text-pop-dark uppercase italic tracking-tight">{t('dictat.correctionLabel')}</h2>
          <p className="text-xl font-bold text-gray-500">{correctionResult.mistakes} {t('dictat.mistakesDetected')}</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border-4 border-pop-dark shadow-neo space-y-8">
          <div className="bg-pop-blue/10 p-6 rounded-2xl border-3 border-pop-blue">
            <h3 className="text-xl font-black text-pop-dark mb-2 flex items-center gap-2">
              <Sparkles className="text-pop-blue" />
              {t('dictat.teacherFeedback')}
            </h3>
            <p className="text-lg font-medium text-gray-700 leading-relaxed">{correctionResult.feedback}</p>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-black text-pop-dark uppercase italic">{t('dictat.correctedText')}</h3>
            <div className="bg-gray-50 p-6 rounded-2xl border-3 border-pop-dark text-lg font-medium leading-relaxed">
              {correctionResult.diff.map((part, index) => {
                if (part.added) {
                  return <span key={index} className="bg-red-200 text-red-800 line-through px-1 rounded mx-0.5">{part.value}</span>;
                }
                if (part.removed) {
                  return <span key={index} className="bg-green-200 text-green-800 font-bold px-1 rounded mx-0.5">{part.value}</span>;
                }
                return <span key={index}>{part.value}</span>;
              })}
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-2xl font-black text-pop-dark uppercase italic">{t('dictat.originalText')}</h3>
            <div className="bg-gray-50 p-6 rounded-2xl border-3 border-pop-dark text-lg font-medium leading-relaxed">
              {dictationData?.fullText}
            </div>
          </div>

          <button 
            onClick={() => setState('setup')}
            className="w-full bg-pop-yellow text-pop-dark font-black text-2xl py-6 rounded-3xl border-4 border-pop-dark shadow-neo flex items-center justify-center gap-4 btn-press"
          >
            <RotateCcw size={32} />
            {t('dictat.anotherDictation')}
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default Dictat;
