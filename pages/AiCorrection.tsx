import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Save, Layout, Link as LinkIcon, BookOpen, Edit3, ArrowDown, Sparkles, X, RotateCcw, ScanLine, Target, AlignLeft, CheckCircle2, Sun, Lightbulb, Loader2, FileText, Check, AlertCircle, Signal, GraduationCap, Trophy, Type, Eye, PenTool, Eraser, Star, ThumbsUp, ChevronDown, Download, Quote, Share2, User } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { LANGUAGE_NAMES } from '../constants/languages';
import { useNavigate } from 'react-router-dom';
import { callGemini, callGeminiStream } from '../services/apiService';
import { LiveCorrectionShow } from '../components/LiveCorrectionShow';
import { generateModernCorrectionPdf, generatePdf } from '../lib/pdf';
import confetti from 'canvas-confetti';
import * as Diff from 'diff';
import { getQuotesByLanguage } from '../constants/quotes';
import { parseRobustJson, resizeImage } from '../lib/utils';
import { StorageService, StorageKey } from '../services/storageService';
import PremiumModal from '../components/PremiumModal';

const { diffWords } = Diff;

type AnalysisState = 'intro' | 'dictation-setup' | 'transcribing' | 'verify' | 'analyzing' | 'results';
type Level = 'primary' | 'primaria_4' | 'primaria_5' | 'primaria_6' | 'eso_1' | 'eso_2' | 'eso_3' | 'eso_4' | 'batxillerat_1' | 'batxillerat_2';
type AnalysisMode = 'free' | 'dictation';

interface AnalysisResult {
  scores?: {
    coherence_cohesion?: number;
    presentation?: number;
    coherence?: number;
    cohesion?: number;
    orthography?: number;
    grammar?: number;
    lexicon?: number;
  };
  scoreExplanations?: {
    coherence_cohesion?: string;
    presentation?: string;
    coherence?: string;
    cohesion?: string;
    orthography?: string;
    grammar?: string;
    lexicon?: string;
  };
  calligraphyScores?: {
    legibility: number;
    strokes: number;
    spacing: number;
    cleanliness: number;
  };
  improvedText: string;
  correctedText?: string;
  spellingMistakes?: number;
  feedback?: string;
  positiveAspects?: string[];
  aspectsToImprove?: string[];
  teacherComment?: string;
}

interface DictationComparison {
    originalWord: string;
    studentWord: string;
    isCorrect: boolean;
}

// Hook per animar números amb 1 decimal
const useCountUp = (end: number = 0, duration: number = 2000) => {
  const [count, setCount] = useState(0);
  const safeEnd = end || 0;

  useEffect(() => {
    let startTime: number | null = null;
    let rafId: number;
    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setCount(Number((ease * safeEnd).toFixed(1)));
      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        setCount(safeEnd);
      }
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [safeEnd, duration]);

  return count;
};

const AiCorrection: React.FC<AiCorrectionProps> = ({ initialMode = 'free' }) => {
  const { t, language, addXp, user, checkUsage, incrementUsage } = useLanguage();
  const quotes = getQuotesByLanguage(language);
  const navigate = useNavigate();

  const LEVEL_LABELS: Record<Level, string> = {
    'primary': (t('common.schoolLevels.primary') || 'Educació Primària') + ' (6-12a)',
    'primaria_4': (t('common.schoolLevels.primary4') || '4t Primària') + ' (9-10a)',
    'primaria_5': (t('common.schoolLevels.primary5') || '5è Primària') + ' (10-11a)',
    'primaria_6': (t('common.schoolLevels.primary6') || '6è Primària') + ' (11-12a)',
    'eso_1': (t('common.schoolLevels.eso1') || '1r ESO') + ' (12-13a)',
    'eso_2': (t('common.schoolLevels.eso2') || '2n ESO') + ' (13-14a)',
    'eso_3': (t('common.schoolLevels.eso3') || '3r ESO') + ' (14-15a)',
    'eso_4': (t('common.schoolLevels.eso4') || '4t ESO') + ' (15-16a)',
    'batxillerat_1': (t('common.schoolLevels.bat1') || '1r BAT') + ' (16-17a)',
    'batxillerat_2': (t('common.schoolLevels.bat2') || '2n BAT') + ' (17-18a)',
  };
  const [state, setState] = useState<AnalysisState>('intro');
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [mode, setMode] = useState<AnalysisMode>(initialMode);
  
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [extractedText, setExtractedText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [streamedText, setStreamedText] = useState('');
  
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [dictationComparison, setDictationComparison] = useState<DictationComparison[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<Level>('eso_1');
  const [wordLimit, setWordLimit] = useState<number | 'all'>('all');
  const [avgScore, setAvgScore] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === 'transcribing' || state === 'analyzing') {
      setCurrentQuoteIndex(Math.floor(Math.random() * quotes.length));
      interval = setInterval(() => {
        setCurrentQuoteIndex(prev => (prev + 1) % quotes.length);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [state, quotes.length]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === 'transcribing' || state === 'analyzing') {
      setAnalysisProgress(0);
      interval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev < 95) return prev + (95 - prev) * 0.2;
          return prev;
        });
      }, 200);
    }
    return () => clearInterval(interval);
  }, [state]);

  useEffect(() => {
    if (state === 'results') {
      // Trigger instant reward celebration cascades
      handleInteractiveConfetti();
      const t1 = setTimeout(() => handleInteractiveConfetti(), 350);
      const t2 = setTimeout(() => handleInteractiveConfetti(), 800);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
      };
    }
  }, [state]);

  const [showReward, setShowReward] = useState(false);
  const [xpEarned, setXpEarned] = useState(0);
  const [error, setError] = useState<React.ReactNode | null>(null);
  const [authorName, setAuthorName] = useState('');

  const handleInteractiveConfetti = () => {
    confetti({
      particleCount: 20,
      angle: 60,
      spread: 45,
      origin: { x: 0.1, y: 0.8 },
      colors: ['#facc15', '#fb7185', '#38bdf8', '#4ade80']
    });
    confetti({
      particleCount: 20,
      angle: 120,
      spread: 45,
      origin: { x: 0.9, y: 0.8 },
      colors: ['#facc15', '#fb7185', '#38bdf8', '#4ade80']
    });
  };

  const animatedScore = useCountUp(state === 'results' ? avgScore : 0);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const compareTexts = (original: string, student: string): { comparisons: DictationComparison[], accuracy: number } => {
    const clean = (s: string) => s.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").trim();
    const originalWords = original.split(/\s+/).filter(w => w.length > 0);
    const studentWords = student.split(/\s+/).filter(w => w.length > 0);
    
    const comparisons: DictationComparison[] = [];
    let correctCount = 0;
    
    originalWords.forEach((word, index) => {
        const cleanedOriginal = clean(word);
        const studentWordRaw = studentWords[index] || "";
        const cleanedStudent = clean(studentWordRaw);
        const isCorrect = cleanedOriginal === cleanedStudent;
        if (isCorrect) correctCount++;
        comparisons.push({ originalWord: word, studentWord: studentWordRaw, isCorrect });
    });

    const accuracy = originalWords.length > 0 ? (correctCount / originalWords.length) * 10 : 0;
    return { comparisons, accuracy: Math.min(10, Math.max(0, accuracy)) };
  };

  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const originalBase64 = reader.result as string;
        
        try {
            const optimizedBase64 = await resizeImage(originalBase64);
            setImageSrc(optimizedBase64);
            setState('transcribing');
        } catch (e) {
            console.error("Optimization failed", e);
            if (originalBase64.length > 1_500_000) {
                setError(t('errors.imageTooLarge'));
                setState('intro');
                return;
            }
            setImageSrc(originalBase64);
            setState('transcribing');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const retakePhoto = () => {
    setImageSrc(null);
    setExtractedText('');
    triggerCamera();
  };

  const getOrthoTable = (level: string): string => {
    const tables: Record<string, string> = {
      'primary':       '0 errors=2.0, 1=1.8, 2=1.6, 3=1.4, 4=1.2, 5=1.0, 6=0.8, 7=0.6, 8+=0.0',
      'primaria_4':    '0 errors=2.0, 1=1.8, 2=1.6, 3=1.4, 4=1.2, 5=1.0, 6=0.8, 7=0.6, 8+=0.0',
      'primaria_5':    '0 errors=2.0, 1=1.8, 2=1.6, 3=1.4, 4=1.2, 5=1.0, 6=0.8, 7=0.6, 8+=0.0',
      'primaria_6':    '0 errors=2.0, 1=1.8, 2=1.6, 3=1.4, 4=1.2, 5=1.0, 6=0.8, 7=0.6, 8+=0.0',
      'eso_1':         '0 errors=2.0, 1=1.8, 2=1.6, 3=1.4, 4=1.2, 5=1.0, 6=0.8, 7+=0.0',
      'eso_2':         '0 errors=2.0, 1=1.8, 2=1.6, 3=1.4, 4=1.2, 5=1.0, 6=0.8, 7+=0.0',
      'eso_3':         '0 errors=2.0, 1=1.8, 2=1.6, 3=1.4, 4=1.2, 5+=0.0',
      'eso_4':         '0 errors=2.0, 1=1.8, 2=1.6, 3=1.4, 4=1.2, 5=1.0, 6+=0.0',
      'batxillerat_1': '0 errors=2.0, 1=1.8, 2=1.6, 3=1.4, 4+=0.0',
      'batxillerat_2': '0 errors=2.0, 1=1.6, 2=1.2, 3+=0.0',
    };
    return tables[level] || tables['eso_1'];
  };

  const performOCR = useCallback(async () => {
    if (!imageSrc) return;
    try {
      setError(null);
      const langName = LANGUAGE_NAMES[language] || 'Catalan';
      const response = await callGemini(
        'gemini-2.5-flash',
        [
          {
            parts: [
              { text: `Transcribe the text EXACTLY as written in the image. DO NOT correct spelling, grammar, or wording. If it looks wrong, transcribe it wrong exactly as it appears. OCR transcription (${langName}). Just the raw text, no commentary.` },
              { inlineData: { data: imageSrc.split(',')[1], mimeType: 'image/jpeg' } }
            ]
          }
        ],
        undefined,
        { temperature: 0 },
        user?.apiKey
      );
      
      const text = (response.text || '').trim();
      if (!text || text.length < 2) {
          setError(t('errors.noText') || "No s'ha pogut detectar text a la imatge.");
          setState('intro');
          return;
      }
      setAnalysisProgress(100);
      setExtractedText(text);
      setState('verify');
    } catch (error: any) {
      console.error("OCR Error", error);
      const errorMsg = typeof error?.message === 'string' ? error.message : JSON.stringify(error || {});
      if (error?.message === 'AI_QUOTA_EXCEEDED' || errorMsg.includes('QUOTA_EXCEEDED') || error?.code === 'resource-exhausted' || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('429')) {
          setError(t('errors.quota') || "⏳ Has esgotat el límit de correccions gratuïtes. Espera 12h o fes-te Premium per corregir sense límits 🚀");
      } else if (error?.message === 'AI_SERVER_OVERLOAD' || errorMsg.includes('overload')) {
          setError(t('errors.serverOverload') || "⏳ Servidor sobrecarregat. Reintentant...");
      } else {
          setError(error?.message || t('errors.transcription') || "Error en la transcripció.");
      }
      setState('intro');
    }
  }, [imageSrc, user?.apiKey, t, language]);

  const performAnalysis = async () => {
    if (!extractedText) return;

    setState('analyzing');
    setError(null);

    try {
      if (mode === 'free') {
        const langName = LANGUAGE_NAMES[language] || 'Catalan';
        const UI_LANG_NAMES: Record<string, string> = { es: 'Spanish', en: 'English', fr: 'French', it: 'Italian', da: 'Danish', de: 'German', pl: 'Polish', pt: 'Portuguese', nl: 'Dutch', uk: 'Ukrainian', ru: 'Russian', ca: 'Catalan' };
        const uiLang = UI_LANG_NAMES[language] || 'Catalan';
        const levelName = LEVEL_LABELS[selectedLevel];
        const orthoTable = getOrthoTable(selectedLevel);

        const safeText = extractedText
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/`/g, '\\`')
          .replace(/\n/g, ' ')
          .replace(/\r/g, ' ')
          .replace(/\t/g, ' ');

        const spellingRule1 = wordLimit === 'all'
          ? "1. Reconta TOTS els errors d'ortografia detectats en el text sencer."
          : `1. Reconta els errors d'ortografia NOMÉS dins de les primeres ${wordLimit} paraules del text. Ignora tot el que quedi fora d'aquest límit per a la nota d'ortografia i per al camp spellingMistakes.`;

        const spellingRule5 = wordLimit === 'all'
          ? `5. La nota d'ortografia HA de ser calculada segons aquesta graella per a ${levelName}: ${orthoTable}`
          : `5. La nota d'ortografia HA de ser calculada segons aquesta graella per a ${levelName}: ${orthoTable} (aplicat NOMÉS a les primeres ${wordLimit} paraules).`;

        const prompt = `Ets un corrector i professor de llengua formal o acadèmica molt divertit, proper i engrescador. Avalua el següent text d'un alumne d'escola.

NIVELL DE L'ESTUDIANT: ${levelName}
IDIOMA DEL TEXT: ${langName}
TEXT PER AVALUAR: ${safeText}
${wordLimit !== 'all' ? `LÍMIT DE RECONTE D'ERRORS ORTOGRÀFICS: primeres ${wordLimit} paraules només.` : ''}

Per fer un espectacle interactiu súper divertit en viu a la meva aplicació, m'has de donar la teva resposta en dues parts clarament delimitades exactes sota els marcadors especificats.

PART 1: LA CORRECCIÓ EN VIU SOTA L'ETIQUETA ===CORRECTION===
Escriu el text corregit línia per línia d'un sol fil. Quan trobis un error ortogràfic, gramatical o de puntuació, has d'incloure la darrera paraula incorrecta i la seva correcció exacta en aquest format de fita de correcció en text:
\`[ERROR:paraula_incorrecta -> paraula_corregida]\`
Per exemple: "Hola, avui [ERROR:he anat -> vaig anar] a dinar [ERROR:ascola -> escola]."
Surt directament corrent sota l'etiqueta ===CORRECTION=== i no afegeixis salutacions ni preàmbuls.

PART 2: LES DADES DE L'AVALUACIÓ SOTA L'ETIQUETA ===JSON===
Després d'acabar tot el text de la part 1, inclou literalment el delimitador exacte:
===JSON===
I a continuació, posa UN SÒL OBJECTE JSON complet i vàlid que contingui les notes i l'anàlisi detallada del text en l'idioma de la interfície (${uiLang}). Estructura esperada EXACTA de l'objecte JSON:

{
  "scores": {
    "coherence_cohesion": 1.3,
    "presentation": 1.7,
    "orthography": 0.8,
    "grammar": 1.4,
    "lexicon": 1.1
  },
  "scoreExplanations": {
    "coherence_cohesion": "explicació breu de la coherència i cohesió (sentit global del text, estructura lògica per paràgrafs i ús correcte de connectors de l'oració/paràgraf)",
    "presentation": "explicació de la presentació (si la imatge està adjunta: avalua de forma neta la llegibilitat de la text escrit a mà o grafia, l'absència de borrons o tatxons, el respecte pels marges de la fulla i línies rectes; si s'ha entrat amb teclat digital: avalua el format, estètica i paràgrafs), respectant sobretot el nivell que escull l'usuari d'escola d'acord amb la seva edat",
    "orthography": "S'han trobat X errors ortogràfics: llista'ls breument",
    "grammar": "explicació de la morfosintaxi i gramàtica dels elements estructurals de la frase",
    "lexicon": "explicació de la riquesa lèxica i diversitat de vocabulari"
  },
  "positiveAspects": ["un aspecte positiu trobat", "un altre aspecte positiu trobat"],
  "aspectsToImprove": ["un aspecte a millorar trobat", "un altre aspecte a millorar trobat"],
  "teacherComment": "una frase del docent molt maca de suport, estima, empatia i motivació activa de millorar",
  "correctedText": "la versió corregida sencera final (sense afegir marcadors [ERROR:...])",
  "improvedText": "la versió millorada i polida creativament (sense errors i estil més elegant i bonic)",
  "spellingMistakes": 0
}

NORMES CRÍTIQUES D'AVALUACIÓ I PUNTUACIÓ (scores de 0.0 a 2.0):
${spellingRule1}
L'escala de scores de cada un d'aquests 5 criteris és estrictament de 0.0 a 2.0 (puntuació amb decimals, ONE DECIMAL precision).
FORBIDDEN scores exactes: 0, 0.5, 1, 1.5, 2. No puntuïs mai amb aquests nombres sans exactes sense decimals! Empra exclusivament decimals precisos com ara: 1.3, 1.7, 0.9, 1.4, 1.8, 1.9, 1.1, 0.7.
El camp "spellingMistakes" ha de ser exactament el nombre de faltes ortogràfiques reals detectades${wordLimit !== 'all' ? ` dins del límit de les primeres ${wordLimit} paraules` : ''}.
Assegura't de fer que el nombre indicat a 'spellingMistakes' sigui 100% congruent amb les faltes d'ortografia reals que has assenyalat amb etiquetes [ERROR:...] a la PART 1. Compta només els errors purament ortogràfics per a aquest recompte. Els suggeriments purament estilístics o millores fluides s'han d'aplicar només al camp 'improvedText' i no compten com a error ni a recomptes ni a la versió 'correctedText'.
La nota d'ortografia ha de seguir exactament aquesta taula de puntuació del nivell de l'alumne per a ${levelName}: ${orthoTable}.
Escriu totes les explicacions, comentaris, textos explicatius i "teacherComment" en l'idioma català (${uiLang}).`;

        const promptParts: any[] = [
          { text: prompt }
        ];

        if (imageSrc) {
          promptParts.push({
            inlineData: {
              data: imageSrc.split(',')[1],
              mimeType: 'image/jpeg'
            }
          });
        }

        setStreamedText("");
        const fullTextResult = await callGeminiStream(
            'gemini-2.5-flash',
            [{ parts: promptParts }],
            undefined,
            (chunkText) => {
                setStreamedText(chunkText);
            },
            undefined, 
            user?.apiKey
        );
        
        try {
            console.log("Full Stream Raw Result Content:", fullTextResult);
            
            const jsonStartIdx = fullTextResult.indexOf('===JSON===');
            if (jsonStartIdx === -1) {
                throw new Error("No s'ha pogut localitzar les dades de l'avaluació en la resposta del servidor.");
            }
            
            const rawTextJson = fullTextResult.slice(jsonStartIdx + '===JSON==='.length).trim();
            console.log("Extracted JSON String from Stream:", rawTextJson);
            
            let result;
            try {
                result = parseRobustJson(rawTextJson);
                if (!result || typeof result !== 'object') {
                    throw new Error(t('errors.invalidJson') || "La resposta de la IA no és un objecte vàlid.");
                }
                
                // Helper to normalize keys to lowercase and parse floats
                const normalizeScores = (obj: any): any => {
                   if (!obj || typeof obj !== 'object') return {};
                   const normalized: any = {};
                   Object.keys(obj).forEach(k => {
                       normalized[k.toLowerCase()] = parseFloat(obj[k] as string) || 0;
                   });
                   return normalized;
                };

                // Ensure required fields exist or have defaults
                result.scores = normalizeScores(result.scores);
                if (Object.keys(result.scores).length === 0) {
                    result.scores = { coherence_cohesion: 0, presentation: 0, orthography: 0, grammar: 0, lexicon: 0 };
                }
                
                result.scoreExplanations = result.scoreExplanations || result.feedback || {};
                // normalize scoreExplanations keys too
                const normalizedExplanations: any = {};
                Object.keys(result.scoreExplanations).forEach(k => {
                     normalizedExplanations[k.toLowerCase()] = result.scoreExplanations[k];
                });
                result.scoreExplanations = normalizedExplanations;

                result.positiveAspects = result.positiveAspects || [];
                result.aspectsToImprove = result.aspectsToImprove || [];
                result.teacherComment = result.teacherComment || "";
                result.correctedText = result.correctedText || extractedText;
                result.improvedText = result.improvedText || extractedText;
            } catch (jsonError: any) {
                console.error("JSON Parsing Error, attempting fix", jsonError);
                throw new Error(jsonError.message || t('errors.parsing') || "No s'ha pogut processar les dades de l'avaluació formatada per la IA.");
            }
            
            setAnalysisResult(result);
            
            const scores = result.scores;
            let finalScore = 0;
            
            if (scores) {
                finalScore = (scores.coherence_cohesion || scores.coherence || 0) + (scores.presentation || scores.cohesion || 0) + (scores.orthography || 0) + (scores.grammar || 0) + (scores.lexicon || 0);
            }
            
            setAvgScore(Math.round(finalScore * 10) / 10);
            incrementUsage();
            setAnalysisProgress(100);
            
            // Give a sleek 1.5 seconds delay so they can enjoy the gorgeous finalized live scrolling words show
            await new Promise((resolve) => setTimeout(resolve, 1500));
            setState('results');
        } catch (err: any) {
            console.error("Analysis processing stream error", err);
            setError(err.message || t('errors.processing') || "Error al processar la resposta de la IA.");
            setState('verify');
            return;
        }
      } else {
        const { comparisons, accuracy } = compareTexts(targetText, extractedText);
        setDictationComparison(comparisons);
        const visualPrompt = `Analyze visual handwriting quality. Rate exactly from 0 to 10 on Legibility, Strokes, Spacing, Cleanliness using tiny decimal increments (e.g., 7.4, 8.2, 9.1). Do not round to whole numbers. Response JSON with keys: legibility, strokes, spacing, cleanliness.`;
        const visualSchema = {
            type: "OBJECT",
            properties: {
                legibility: { type: "NUMBER" },
                strokes: { type: "NUMBER" },
                spacing: { type: "NUMBER" },
                cleanliness: { type: "NUMBER" }
            },
            required: ["legibility", "strokes", "spacing", "cleanliness"]
        };
        const response = await callGemini(
            'gemini-2.5-flash', 
            [
                {
                    parts: [
                        { text: visualPrompt },
                        { inlineData: { data: imageSrc!.split(',')[1], mimeType: 'image/jpeg' } }
                    ]
                }
            ],
            undefined,
            { responseMimeType: "application/json", responseSchema: visualSchema as any },
            user?.apiKey
        );
        
        try {
            const rawText = response.text || '{}';
            console.log("Visual Analysis AI Response:", rawText);
            const parsedVisualScores = parseRobustJson(rawText);
            
            const normalizeScores = (obj: any): any => {
               if (!obj || typeof obj !== 'object') return {};
               const normalized: any = {};
               Object.keys(obj).forEach(k => {
                   normalized[k.toLowerCase()] = parseFloat(obj[k] as string) || 0;
               });
               return normalized;
            };
            
            const visualScores = normalizeScores(parsedVisualScores);

            setAnalysisResult({ improvedText: targetText, calligraphyScores: visualScores });
            const visualAvg = ((visualScores.legibility || 0) + (visualScores.strokes || 0) + (visualScores.spacing || 0) + (visualScores.cleanliness || 0)) / 4;
            setAvgScore(Math.round(((accuracy * 0.6) + (visualAvg * 0.4)) * 10) / 10);
            setAnalysisProgress(100);
            setState('results');
        } catch (jsonError: any) {
             console.error("JSON Parsing Error (Visual)", jsonError, response.text);
             setError(t('errors.visual') + (jsonError.message || "format incorrecte"));
             setState('verify');
             return;
        }
      }
    } catch (error: any) {
      console.error("Analysis Error:", error);
      const errorMsg = typeof error?.message === 'string' ? error.message : JSON.stringify(error || {});
      if (error?.message === 'AI_QUOTA_EXCEEDED' || errorMsg.includes('QUOTA_EXCEEDED') || error?.code === 'resource-exhausted' || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('429')) {
          setError(t('errors.quota') || "⏳ Has esgotat el límit de correccions gratuïtes. Espera 12h o fes-te Premium per corregir sense límits 🚀");
      } else if (error?.message === 'AI_SERVER_OVERLOAD' || errorMsg.includes('overload')) {
          setError(t('errors.serverOverload') || "⏳ Servidor sobrecarregat. Reintentant...");
      } else {
          setError(error?.message || t('errors.connection') || "Error en la connexió amb la IA.");
      }
      setState('verify');
    }
  };

  useEffect(() => { if (state === 'transcribing') performOCR(); }, [state, performOCR]);

  const handleSave = () => {
    const earned = 50 + Math.floor(avgScore * 5);
    setXpEarned(earned);
    addXp(earned);
    setShowReward(true);

    const duration = 3000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#4ade80', '#fb7185', '#38bdf8', '#facc15']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#4ade80', '#fb7185', '#38bdf8', '#facc15']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());

    if (analysisResult) {
      const newCorrection = {
        id: Date.now(),
        title: mode === 'free' ? extractedText.slice(0, 20) + "..." : "Dictado: " + targetText.slice(0, 20),
        date: new Date().toLocaleDateString(),
        score: avgScore,
        original: extractedText,
        corrected: analysisResult.correctedText || extractedText,
        improved: analysisResult.improvedText,
        spellingMistakes: analysisResult.spellingMistakes,
        level: selectedLevel,
        wordLimit: mode === 'free' ? wordLimit : undefined,
        author: authorName || user?.name || '',
        fullScores: mode === 'free' ? analysisResult.scores : analysisResult.calligraphyScores,
        mode: mode,
        feedback: analysisResult.teacherComment || analysisResult.feedback
      };
      
      const saved = StorageService.getItem<any[]>(StorageKey.CORRECTIONS, []);
      StorageService.setItem(StorageKey.CORRECTIONS, [newCorrection, ...saved]);
    }
  };

  const handleDownload = async () => { 
    if (!analysisResult) return;
    
    try {
      const correctedText = analysisResult.correctedText || extractedText || '';
      const improvedText = analysisResult.improvedText || '';

      const translatedScores: Record<string, number> = {};
      const translatedScoreExplanations: Record<string, string> = {};
      if (analysisResult.scores) {
          const addScore = (key: keyof typeof analysisResult.scores, title: string) => {
             if (analysisResult.scores[key] !== undefined) {
                 translatedScores[title] = analysisResult.scores[key]!;
                 if (analysisResult.scoreExplanations && analysisResult.scoreExplanations[key]) {
                     translatedScoreExplanations[title] = analysisResult.scoreExplanations[key]!;
                 }
             }
          };
          if ('coherence_cohesion' in analysisResult.scores || 'presentation' in analysisResult.scores) {
              addScore('coherence_cohesion', t('aiCorrection.cards.coherence_cohesion.title') || 'Coherència i Cohesió');
              addScore('presentation', t('aiCorrection.cards.presentation.title') || 'Presentació');
          } else {
              addScore('coherence', t('aiCorrection.cards.coherence.title') || 'Coherència');
              addScore('cohesion', t('aiCorrection.cards.cohesion.title') || 'Cohesió');
          }
          addScore('orthography', (t('aiCorrection.cards.orthography.title') || 'Ortografia') + (analysisResult.spellingMistakes !== undefined ? ` (${analysisResult.spellingMistakes} ${t('aiCorrection.mistakes') || 'faltes'})` : ''));
          addScore('grammar', t('aiCorrection.cards.grammar.title') || 'Gramàtica');
          addScore('lexicon', t('aiCorrection.cards.lexicon.title') || 'Riquesa lèxica');
      }
      if (analysisResult.calligraphyScores) {
          if (analysisResult.calligraphyScores.legibility !== undefined) translatedScores[t('aiCorrection.cards.legibility.title') || 'Llegibilitat'] = analysisResult.calligraphyScores.legibility;
          if (analysisResult.calligraphyScores.strokes !== undefined) translatedScores[t('aiCorrection.cards.strokes.title') || 'Traç'] = analysisResult.calligraphyScores.strokes;
          if (analysisResult.calligraphyScores.spacing !== undefined) translatedScores[t('aiCorrection.cards.spacing.title') || 'Espaiat'] = analysisResult.calligraphyScores.spacing;
          if (analysisResult.calligraphyScores.cleanliness !== undefined) translatedScores[t('aiCorrection.cards.cleanliness.title') || 'Neteja'] = analysisResult.calligraphyScores.cleanliness;
      }

      await generateModernCorrectionPdf({
        correctedText,
        improvedText,
        scores: translatedScores,
        scoreExplanations: translatedScoreExplanations,
        globalScore: avgScore,
        author: authorName || user?.name || undefined,
        feedback: analysisResult.teacherComment || analysisResult.feedback,
        maxScore: 10,
        scoreComment: mode === 'free' ? t('pdf.scoreComment') : undefined,
        labels: {
          title: t('pdf.aiCorrection'),
          authorPrefix: t('pdf.author'),
          globalScorePrefix: t('pdf.globalScore'),
          originalText: t('aiCorrection.originalCorrected'),
          improvedText: t('aiCorrection.improved'),
          improvedBadge: t('aiCorrection.improvedBadge'),
          teacherFeedback: t('pdf.teacherFeedback'),
          generatedOn: t('pdf.generatedOn'),
          shareTitle: t('pdf.aiCorrection') || 'Correcció amb IA',
          shareText: t('aiCorrection.shareText') || 'Informe de correcció',
          shareDialogTitle: t('common.shareReport') || 'Comparteix el PDF'
        }
      });
    } catch (error: any) {
      console.error("Error generating PDF:", error);
      setError(t('common.error') || `Could not generate PDF: ${error.message || "Unknown error"}`);
    }
  };

  const handleFinishReward = () => {
    navigate('/history');
  }

  // --- Views ---

  const nativeInput = (
    <input 
      type="file" 
      accept="image/*" 
      capture="environment" 
      ref={fileInputRef} 
      onChange={handleImageUpload} 
      className="hidden" 
    />
  );

  if (showReward) {
      return (
          <div className="fixed inset-0 bg-pop-bg z-50 flex flex-col items-center justify-center p-6 text-center animate-pop-in">
              <div className="relative w-full max-w-sm">
                   <div className="absolute inset-0 bg-pop-dark rounded-3xl translate-x-3 translate-y-3"></div>
                   <div className="relative bg-white border-4 border-pop-dark rounded-3xl p-8 shadow-neo-lg overflow-hidden">
                       <div className="absolute inset-0 bg-[repeating-conic-gradient(#fef9c3_0_20deg,transparent_20deg_40deg)] opacity-30 animate-spin-slow"></div>
                       <div className="relative z-10">
                           <h2 className="text-4xl font-black text-pop-dark mb-1 uppercase italic tracking-tighter">{t('gamification.rewards.awesome')}</h2>
                           <p className="text-gray-500 font-bold mb-6">{t('gamification.rewards.keepGoing')}</p>
                           <div className="bg-pop-green p-6 rounded-2xl border-3 border-pop-dark mb-6 animate-bounce-slow shadow-neo">
                               <p className="text-xs font-black text-pop-dark uppercase tracking-widest bg-white/40 inline-block px-2 rounded mb-2">{t('gamification.rewards.points')}</p>
                               <p className="text-6xl font-black text-white drop-shadow-md stroke-pop-dark">+{xpEarned}</p>
                           </div>
                           <button onClick={handleFinishReward} className="w-full bg-pop-blue text-pop-dark font-black text-xl py-4 rounded-xl border-3 border-pop-dark shadow-neo btn-press transition-all hover:bg-pop-blueLight">{t('gamification.rewards.finish')}</button>
                       </div>
                   </div>
              </div>
          </div>
      )
  }

  if (state === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 text-center animate-slide-up px-4">
         <PremiumModal isOpen={showPremiumModal} onClose={() => setShowPremiumModal(false)} />
         {error && (
            <div className="w-full max-w-md bg-red-100 text-red-700 p-4 rounded-2xl font-bold text-center border-3 border-pop-dark shadow-neo mb-4">
              {error}
            </div>
         )}
         {nativeInput}
         <div className="relative group cursor-pointer" onClick={() => mode === 'dictation' ? setState('dictation-setup') : triggerCamera()}>
            <div className="absolute inset-0 bg-pop-dark rounded-3xl translate-x-2 translate-y-2 group-hover:translate-x-3 group-hover:translate-y-3 transition-transform"></div>
            <div className={`relative w-40 h-40 ${mode === 'free' ? 'bg-pop-blue' : 'bg-pop-yellow'} rounded-3xl border-3 border-pop-dark flex items-center justify-center btn-press`}>
                {mode === 'free' ? <ScanLine size={80} strokeWidth={3} className="text-white" /> : <FileText size={80} strokeWidth={3} className="text-pop-dark" />}
                <div className="absolute -bottom-4 -right-4 w-14 h-14 bg-pop-pink text-white rounded-xl flex items-center justify-center border-3 border-pop-dark shadow-neo animate-bounce-slow">
                    <Camera size={28} strokeWidth={3} />
                </div>
            </div>
         </div>
         <div className="space-y-3 max-w-[280px]">
            <h2 className="text-4xl font-black text-pop-dark uppercase italic tracking-tight">{mode === 'free' ? t('aiCorrection.introTitle') : t('aiCorrection.dictationIntroTitle')}</h2>
            <p className="text-gray-600 font-bold leading-tight">{mode === 'free' ? t('aiCorrection.introDesc') : t('aiCorrection.dictationIntroDesc')}</p>
         </div>
         <button onClick={() => mode === 'dictation' ? setState('dictation-setup') : triggerCamera()} className="w-full max-w-xs bg-pop-dark text-white font-black text-xl py-4 rounded-2xl border-3 border-pop-dark shadow-neo btn-press transition-all flex items-center justify-center gap-3">
            {mode === 'free' ? <Camera size={26} strokeWidth={3} /> : <PenTool size={26} strokeWidth={3} />}
            <span>{mode === 'free' ? t('aiCorrection.startBtn') : t('aiCorrection.startDictationBtn')}</span>
         </button>
      </div>
    );
  }

  if (state === 'dictation-setup') {
      return (
          <div className="flex flex-col h-full gap-4 animate-slide-up">
              {error && (
                  <div className="bg-red-100 text-red-700 p-4 rounded-2xl font-bold text-center border-3 border-pop-dark shadow-neo">
                      {error}
                  </div>
              )}
              {nativeInput}
              <h2 className="text-3xl font-black text-pop-dark uppercase tracking-tight">{t('aiCorrection.dictationSetup.title')}</h2>
              <div className="relative flex-1">
                  <div className="absolute inset-0 bg-pop-dark rounded-3xl translate-x-2 translate-y-2"></div>
                  <textarea value={targetText} onChange={(e) => setTargetText(e.target.value)} placeholder={t('aiCorrection.dictationSetup.placeholder')} className="relative w-full h-full p-6 bg-white rounded-3xl border-3 border-pop-dark focus:outline-none resize-none text-xl font-medium leading-relaxed" />
              </div>
              <button onClick={triggerCamera} disabled={!targetText.trim()} className="w-full mt-4 bg-pop-green text-pop-dark font-black text-xl py-4 rounded-2xl border-3 border-pop-dark shadow-neo btn-press flex items-center justify-center gap-3 disabled:opacity-50 disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0">
                  <span>{t('aiCorrection.dictationSetup.start')}</span>
                  <ArrowDown size={28} strokeWidth={3} />
              </button>
          </div>
      )
  }

  if (state === 'analyzing' && mode === 'free') {
    return <LiveCorrectionShow streamedText={streamedText} />;
  }

  if (state === 'transcribing' || state === 'analyzing') {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 text-center animate-pop-in px-6">
            <div className="relative">
                <div className="absolute inset-0 bg-pop-blue blur-xl opacity-50 animate-pulse"></div>
                <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center relative border-3 border-pop-dark shadow-neo animate-bounce-slow">
                    <ScanLine size={48} className="text-pop-dark" strokeWidth={3} />
                </div>
            </div>
            
            <div className="w-full max-w-xs space-y-4">
               <div className="space-y-2">
                 <h3 className="text-2xl font-black text-pop-dark uppercase tracking-tight">{state === 'transcribing' ? t('aiCorrection.transcribing') : t('aiCorrection.analyzing')}</h3>
                 <p className="text-gray-500 font-bold animate-pulse">
                   {state === 'transcribing' ? t('aiCorrection.transcribingSubtitle') : t('aiCorrection.analyzingSubtitle')}
                 </p>
               </div>
               
               {/* Progress Bar */}
               <div className="relative h-6 bg-gray-100 rounded-full border-3 border-pop-dark overflow-hidden shadow-neo-sm">
                 <div 
                   className="absolute inset-y-0 left-0 bg-pop-blue transition-all duration-500 ease-out"
                   style={{ width: `${analysisProgress}%` }}
                 >
                   <div className="absolute inset-0 bg-[linear-gradient(45deg,rgba(255,255,255,0.2)_25%,transparent_25%,transparent_50%,rgba(255,255,255,0.2)_50%,rgba(255,255,255,0.2)_75%,transparent_75%,transparent)] bg-[length:20px_20px] animate-shimmer"></div>
                 </div>
                 <div className="absolute inset-0 flex items-center justify-center">
                   <span className="text-[10px] font-black text-pop-dark uppercase tracking-widest">
                     {Math.round(analysisProgress)}%
                   </span>
                 </div>
               </div>

               {/* Writer Quotes */}
               <div className="mt-4 p-6 bg-white rounded-2xl border-3 border-pop-dark shadow-neo relative animate-fade-in min-h-[120px] flex flex-col justify-center">
                 <div className="absolute -top-3 -left-3 bg-pop-purple text-white p-2 rounded-lg border-2 border-pop-dark rotate-[-10deg]">
                   <Quote size={20} fill="currentColor" />
                 </div>
                 <p className="text-pop-dark font-bold italic text-lg leading-tight mb-2">
                   "{quotes[currentQuoteIndex].text}"
                 </p>
                 <p className="text-pop-purple font-black text-sm uppercase tracking-wider">
                   — {quotes[currentQuoteIndex].author}
                 </p>
               </div>
            </div>
        </div>
    );
  }

  if (state === 'verify') {
      return (
          <div className="flex flex-col h-full gap-4 animate-slide-up pb-24">
              {error && (
                  <div className="bg-red-100 text-red-700 p-4 rounded-2xl font-bold text-center border-3 border-pop-dark shadow-neo">
                      {error}
                  </div>
              )}
              {nativeInput}
              <h3 className="text-2xl font-black text-pop-dark uppercase tracking-tight">{t('aiCorrection.verifyTitle')}</h3>
              <div className="w-full h-48 bg-gray-100 rounded-3xl overflow-hidden border-3 border-pop-dark relative shrink-0 shadow-sm">
                  {imageSrc ? <img src={imageSrc} alt="Capture" className="w-full h-full object-contain" /> : <Layout size={32} />}
              </div>

              <div className="bg-white p-3 rounded-2xl border-3 border-pop-dark flex items-center gap-3">
                  <User size={20} className="text-gray-400" strokeWidth={3} />
                  <input 
                      type="text" 
                      value={authorName} 
                      onChange={(e) => setAuthorName(e.target.value)} 
                      placeholder={t('aiCorrection.authorPlaceholder')} 
                      className="flex-1 bg-transparent border-none focus:outline-none text-sm font-bold text-pop-dark placeholder:text-gray-400"
                  />
              </div>

              <div className="flex-1 relative">
                 <div className="absolute inset-0 bg-pop-dark rounded-3xl translate-x-1 translate-y-1"></div>
                 <div className="relative h-full bg-white p-4 rounded-3xl border-3 border-pop-dark flex flex-col">
                     <div className="flex items-center gap-2 mb-2 text-pop-blue">
                         <FileText size={20} strokeWidth={3} />
                         <span className="font-black text-xs uppercase">{t('aiCorrection.original')}</span>
                     </div>
                     <textarea value={extractedText} onChange={(e) => setExtractedText(e.target.value)} className="flex-1 w-full p-2 bg-gray-50 rounded-xl border-2 border-transparent focus:border-pop-blue font-mono text-sm leading-relaxed outline-none transition-all resize-none text-pop-dark font-bold" />
                 </div>
              </div>

              {mode === 'free' && (
                  <div className="bg-white p-4 rounded-3xl border-3 border-pop-dark shadow-neo">
                      <div className="flex items-center gap-2 mb-4">
                        <GraduationCap size={20} className="text-pop-dark" strokeWidth={3}/>
                        <h4 className="font-black text-sm uppercase text-pop-dark tracking-tight">{t('aiCorrection.selectLevel')}</h4>
                      </div>
                      
                      <div className="space-y-6">
                        {/* Primària */}
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">{t('common.schoolLevels.primary')}</p>
                          <div className="grid grid-cols-1 gap-2 mb-2">
                             {(['primary'] as Level[]).map((lvl) => (
                                <button key={lvl} onClick={() => setSelectedLevel(lvl)} className={`py-4 px-1 rounded-xl border-3 font-black text-xs transition-all uppercase ${selectedLevel === lvl ? 'bg-pop-yellow text-pop-dark border-pop-dark shadow-neo-sm -translate-y-0.5' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                    {LEVEL_LABELS[lvl]}
                                </button>
                            ))}
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {(['primaria_4', 'primaria_5', 'primaria_6'] as Level[]).map((lvl) => (
                                <button key={lvl} onClick={() => setSelectedLevel(lvl)} className={`py-3 px-1 rounded-xl border-2 font-black text-[10px] transition-all uppercase ${selectedLevel === lvl ? 'bg-pop-yellow text-pop-dark border-pop-dark shadow-neo-sm -translate-y-0.5' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                    {LEVEL_LABELS[lvl]}
                                </button>
                            ))}
                          </div>
                        </div>

                        {/* ESO */}
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">{t('common.schoolLevels.secondary')}</p>
                          <div className="grid grid-cols-4 gap-2">
                            {(['eso_1', 'eso_2', 'eso_3', 'eso_4'] as Level[]).map((lvl) => (
                                <button key={lvl} onClick={() => setSelectedLevel(lvl)} className={`py-3 px-1 rounded-xl border-2 font-black text-[10px] transition-all uppercase ${selectedLevel === lvl ? 'bg-pop-blue text-white border-pop-dark shadow-neo-sm -translate-y-0.5' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                    {LEVEL_LABELS[lvl]}
                                </button>
                            ))}
                          </div>
                        </div>

                        {/* Batxillerat */}
                        <div>
                          <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">{t('common.schoolLevels.highSchool')}</p>
                          <div className="grid grid-cols-2 gap-2">
                            {(['batxillerat_1', 'batxillerat_2'] as Level[]).map((lvl) => (
                                <button key={lvl} onClick={() => setSelectedLevel(lvl)} className={`py-3 px-1 rounded-xl border-2 font-black text-[10px] transition-all uppercase ${selectedLevel === lvl ? 'bg-pop-purple text-white border-pop-dark shadow-neo-sm -translate-y-0.5' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                                    {LEVEL_LABELS[lvl]}
                                </button>
                            ))}
                          </div>
                        </div>
                      </div>

                  </div>
              )}

              {mode === 'free' && (
                  <div className="bg-white p-4 rounded-3xl border-3 border-pop-dark shadow-neo">
                      <div className="flex items-center gap-2 mb-4">
                        <FileText size={20} className="text-pop-dark" strokeWidth={3}/>
                        <h4 className="font-black text-sm uppercase text-pop-dark tracking-tight">{t('aiCorrection.wordCountSelection')}</h4>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {([50, 100, 150, 'all'] as const).map((limit) => {
                          const optionLabel = limit === 'all' 
                            ? t('aiCorrection.wordCountOptions.all') 
                            : t('aiCorrection.wordCountOptions.nWords').replace('{n}', limit.toString());
                          return (
                            <button
                              key={limit}
                              type="button"
                              onClick={() => setWordLimit(limit)}
                              className={`py-3 px-1 rounded-xl border-2 font-black text-[10px] sm:text-xs transition-all uppercase ${wordLimit === limit ? 'bg-pop-green text-pop-dark border-pop-dark shadow-neo-sm -translate-y-0.5' : 'bg-gray-50 text-gray-400 border-gray-200'}`}
                            >
                              {optionLabel}
                            </button>
                          );
                        })}
                      </div>
                  </div>
              )}
              <div className="grid grid-cols-2 gap-4 mt-1">
                  <button onClick={retakePhoto} className="py-4 rounded-2xl font-black text-gray-500 bg-gray-200 border-3 border-transparent hover:border-gray-400 flex items-center justify-center gap-2"><RotateCcw size={20} strokeWidth={3} /><span>{t('aiCorrection.retake')}</span></button>
                  <button onClick={performAnalysis} disabled={!extractedText.trim()} className="py-4 rounded-2xl font-black text-pop-dark bg-pop-green border-3 border-pop-dark shadow-neo btn-press flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"><Check size={24} strokeWidth={4} /><span>{t('aiCorrection.evaluateBtn')}</span></button>
              </div>
          </div>
      )
  }

  const freeCriteriaData = !analysisResult || !analysisResult.scores || ('coherence_cohesion' in analysisResult.scores || 'presentation' in analysisResult.scores)
    ? [
        { key: 'coherence_cohesion', icon: AlignLeft, color: 'text-pop-dark', bg: 'bg-pop-yellow' },
        { key: 'presentation', icon: PenTool, color: 'text-white', bg: 'bg-pop-blue' },
        { key: 'orthography', icon: CheckCircle2, color: 'text-pop-dark', bg: 'bg-pop-green' },
        { key: 'grammar', icon: BookOpen, color: 'text-white', bg: 'bg-pop-purple' },
        { key: 'lexicon', icon: Target, color: 'text-pop-dark', bg: 'bg-pop-pink' }
      ]
    : [
        { key: 'coherence', icon: AlignLeft, color: 'text-pop-dark', bg: 'bg-pop-yellow' },
        { key: 'cohesion', icon: LinkIcon, color: 'text-white', bg: 'bg-pop-blue' },
        { key: 'orthography', icon: CheckCircle2, color: 'text-pop-dark', bg: 'bg-pop-green' },
        { key: 'grammar', icon: BookOpen, color: 'text-white', bg: 'bg-pop-purple' },
        { key: 'lexicon', icon: Target, color: 'text-pop-dark', bg: 'bg-pop-pink' }
      ];

  const dictationCriteriaData = [
      { key: 'legibility', icon: Eye, color: 'text-white', bg: 'bg-pop-blue' },
      { key: 'strokes', icon: PenTool, color: 'text-white', bg: 'bg-pop-purple' },
      { key: 'spacing', icon: Layout, color: 'text-pop-dark', bg: 'bg-pop-yellow' },
      { key: 'cleanliness', icon: Eraser, color: 'text-pop-dark', bg: 'bg-pop-green' },
  ];

  const currentCriteria = mode === 'free' 
    ? freeCriteriaData
    : dictationCriteriaData;

  const maxScore = 10;

  return (
    <div className="flex flex-col gap-6 animate-slide-up pb-10">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-pop-dark transform rotate-45"></span>
            {t('aiCorrection.results')}
        </h3>
        <div className="relative animate-pop-in">
             <div className="absolute inset-0 bg-pop-dark rounded-xl translate-x-1 translate-y-1"></div>
            <div className="relative bg-white border-3 border-pop-dark px-4 py-2 rounded-xl flex items-end gap-2">
                <div className="text-5xl font-black text-pop-dark tracking-tighter tabular-nums">{(animatedScore || 0).toFixed(1)}</div>
                <div className="text-sm font-bold text-gray-400 mb-2">/ 10</div>
            </div>
             {avgScore >= 9 && (<div className="absolute -top-4 -right-4 bg-pop-yellow text-pop-dark border-3 border-pop-dark p-2 rounded-full shadow-sm animate-bounce-slow"><Trophy size={20} strokeWidth={3} fill="white" /></div>)}
        </div>
      </div>
      
      <div className="grid gap-3">
          {currentCriteria.map((item, idx) => {
              const scoresRef = mode === 'free' ? analysisResult?.scores : analysisResult?.calligraphyScores;
              const score = scoresRef ? scoresRef[item.key as keyof typeof scoresRef] : 0;
              let badge = null;
              if (item.key === 'orthography' && analysisResult?.spellingMistakes !== undefined) {
                  badge = `${analysisResult.spellingMistakes} ${t('aiCorrection.mistakes')}`;
              }
              const explanation = mode === 'free' ? analysisResult?.scoreExplanations?.[item.key as keyof typeof analysisResult.scoreExplanations] : t(`aiCorrection.cards.${item.key}.desc`);
              
              return <ScoreCard key={item.key} icon={<item.icon size={20} strokeWidth={3} />} title={t(`aiCorrection.cards.${item.key}.title`) || item.key} score={score as number} description={explanation || ''} color={item.color} bg={item.bg} delay={idx * 0.1} badge={badge} maxScore={maxScore} />;
          })}
      </div>

      <div className="space-y-6 pt-6 border-t-4 border-dashed border-gray-300">
        {mode === 'free' && analysisResult?.teacherComment && (
             <CollapsibleCard title={t('aiCorrection.feedback')} icon={<Quote size={18} strokeWidth={3} />} defaultOpen={true} borderColor="border-pop-blue" titleColor="text-pop-dark" iconColor="text-pop-blue">
                <p className="text-pop-dark font-medium italic text-lg leading-relaxed">"{analysisResult.teacherComment}"</p>
            </CollapsibleCard>
        )}

        {mode === 'free' && analysisResult?.positiveAspects && analysisResult.positiveAspects.length > 0 && (
             <CollapsibleCard title={t('aiCorrection.positiveAspects')} icon={<Star size={18} strokeWidth={3} />} defaultOpen={true} borderColor="border-pop-green" titleColor="text-pop-dark" iconColor="text-pop-green">
                <ul className="list-disc pl-5 space-y-2 text-pop-dark font-medium">
                    {analysisResult.positiveAspects.map((aspect, i) => <li key={i}>{aspect}</li>)}
                </ul>
            </CollapsibleCard>
        )}

        {mode === 'free' && analysisResult?.aspectsToImprove && analysisResult.aspectsToImprove.length > 0 && (
             <CollapsibleCard title={t('aiCorrection.aspectsToImprove')} icon={<Target size={18} strokeWidth={3} />} defaultOpen={true} borderColor="border-pop-orange" titleColor="text-pop-dark" iconColor="text-pop-orange">
                <ul className="list-disc pl-5 space-y-2 text-pop-dark font-medium">
                    {analysisResult.aspectsToImprove.map((aspect, i) => <li key={i}>{aspect}</li>)}
                </ul>
            </CollapsibleCard>
        )}
        
        {mode === 'dictation' && analysisResult?.feedback && (
             <CollapsibleCard title={t('aiCorrection.feedback')} icon={<Quote size={18} strokeWidth={3} />} defaultOpen={true} borderColor="border-pop-blue" titleColor="text-pop-dark" iconColor="text-pop-blue">
                <p className="text-pop-dark font-medium italic text-lg leading-relaxed">"{analysisResult.feedback}"</p>
            </CollapsibleCard>
        )}
        
        {mode === 'free' && (
            <>
                <CollapsibleCard title={t('aiCorrection.originalCorrected')} icon={<Edit3 size={18} strokeWidth={3} />} defaultOpen={false} borderColor="border-pop-dark" titleColor="text-gray-400" iconColor="text-gray-400">
                    <div className="max-h-80 overflow-y-auto pr-2">
                        <DiffViewer original={extractedText} corrected={analysisResult?.correctedText || extractedText} />
                    </div>
                </CollapsibleCard>

                <CollapsibleCard title={t('aiCorrection.improved')} icon={<Sparkles size={16} strokeWidth={3} />} defaultOpen={false} borderColor="border-pop-dark" titleColor="text-pop-dark" iconColor="text-pop-dark" badge={t('aiCorrection.improvedBadge')}>
                    <div className="max-h-80 overflow-y-auto pr-2">
                        <p className="text-pop-dark text-sm leading-relaxed font-bold">{analysisResult?.improvedText || ''}</p>
                    </div>
                </CollapsibleCard>
            </>
        )}

        {mode === 'dictation' && (
             <div className="bg-white p-5 rounded-3xl border-3 border-pop-dark shadow-neo">
                <h4 className="font-black mb-4 uppercase text-pop-dark">{t('aiCorrection.comparison.diffTitle')}</h4>
                <div className="flex flex-wrap gap-2 text-lg font-mono leading-relaxed bg-gray-50 p-4 rounded-2xl border-2 border-gray-200">
                    {dictationComparison.map((item, idx) => (
                        <span key={idx} className={`px-1.5 rounded-md font-bold border-2 ${item.isCorrect ? 'text-pop-dark bg-pop-green border-pop-dark' : 'text-white bg-pop-pink border-pop-dark line-through'}`}>{item.originalWord}</span>
                    ))}
                </div>
             </div>
        )}
      </div>

       <div className="flex gap-2">
         <button onClick={handleDownload} className="flex-1 bg-white text-pop-dark font-black text-xl py-5 rounded-2xl border-3 border-pop-dark shadow-neo flex items-center justify-center gap-3 transition-all btn-press hover:bg-gray-50">
          {isMobile ? <Share2 size={26} strokeWidth={3} /> : <Download size={26} strokeWidth={3} />}
          <span>{isMobile ? t('common.shareReport') : t('common.downloadPdf')}</span>
         </button>
         <button onClick={handleSave} className="flex-1 bg-pop-dark text-white font-black text-xl py-5 rounded-2xl border-3 border-pop-dark shadow-neo flex items-center justify-center gap-3 transition-all btn-press hover:bg-black">
          <Save size={26} strokeWidth={3} /><span>{t('aiCorrection.saveBtn')}</span>
         </button>
       </div>
       <PremiumModal isOpen={showPremiumModal} onClose={() => setShowPremiumModal(false)} />
    </div>
  );
};

interface CollapsibleCardProps {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    defaultOpen?: boolean;
    borderColor: string;
    titleColor: string;
    iconColor: string;
    badge?: string;
}

const CollapsibleCard: React.FC<CollapsibleCardProps> = ({ title, icon, children, defaultOpen = false, borderColor, titleColor, iconColor, badge }) => {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    return (
        <div className="relative group">
            <div className={`absolute inset-0 bg-pop-dark rounded-3xl translate-x-1.5 translate-y-1.5 transition-all ${isOpen ? 'translate-x-1.5 translate-y-1.5' : 'translate-x-1 translate-y-1'}`}></div>
            <div className={`relative bg-white rounded-3xl border-3 ${borderColor} overflow-hidden transition-all`}>
                <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between p-5 text-left bg-white z-10 relative">
                    <div className={`flex items-center gap-2 ${iconColor}`}>
                        {icon}<h4 className={`font-black uppercase text-sm ${titleColor}`}>{title}</h4>{badge && (<span className="bg-pop-green text-pop-dark text-[10px] font-black px-2 py-0.5 rounded-md uppercase border-2 border-pop-dark ml-2">{badge}</span>)}
                    </div>
                    <div className={`w-8 h-8 rounded-full border-2 border-pop-dark flex items-center justify-center transition-transform duration-300 ${isOpen ? 'bg-pop-dark text-white rotate-180' : 'bg-white text-pop-dark'}`}><ChevronDown size={20} strokeWidth={3} /></div>
                </button>
                <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                    <div className="p-5 pt-0 border-t-2 border-dashed border-gray-100 mt-2">
                        <div className="bg-gray-50 p-4 rounded-2xl border-2 border-gray-100 mt-4">{children}</div>
                    </div>
                </div>
            </div>
        </div>
    );
}

interface ScoreCardProps {
  icon: React.ReactNode;
  title: string;
  score: number;
  description: string;
  color: string;
  bg: string;
  delay: number;
  badge?: string | null;
  maxScore?: number;
}

const ScoreCard: React.FC<ScoreCardProps> = ({ icon, title, score, description, color, bg, delay, badge, maxScore = 10 }) => {
  const animatedCardScore = useCountUp(score, 1000 + delay * 300);
  const percentage = Math.min(100, (animatedCardScore / maxScore) * 100);
  return (
    <div className="relative group animate-slide-up" style={{ animationDelay: `${delay}s` }}>
      <div className="absolute inset-0 bg-pop-dark rounded-2xl translate-x-1 translate-y-1"></div>
      <div className="relative bg-white p-4 rounded-2xl border-3 border-pop-dark flex flex-col gap-3 btn-press">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className={`w-10 h-10 rounded-xl ${bg} ${color} border-2 border-pop-dark flex items-center justify-center shrink-0 shadow-sm`}>{icon}</div>
              <div>
                  <div className="flex items-center gap-2">
                     <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">{title}</h4>
                     {badge && (<span className="bg-red-100 text-red-500 border-2 border-red-200 text-[9px] font-black uppercase px-1.5 rounded mb-1">{badge}</span>)}
                  </div>
                  <p className="text-sm text-pop-dark leading-snug font-bold line-clamp-2">{description}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-4 bg-gray-200 rounded-full overflow-hidden p-0.5 border-2 border-pop-dark">
                <div className={`h-full rounded-full ${bg} border-r-2 border-pop-dark transition-all duration-1000 ease-out`} style={{ width: `${percentage}%` }}></div>
            </div>
            <div className="text-right shrink-0 min-w-[30px]">
                <span className={`text-xl font-black text-pop-dark`}>{(animatedCardScore || 0).toFixed(1)}</span>
                <span className="text-[10px] text-gray-400 font-bold ml-0.5">/{maxScore}</span>
            </div>
          </div>
      </div>
    </div>
  );
};

const DiffViewer: React.FC<{ original: string, corrected: string }> = ({ original, corrected }) => {
    if (!original || !corrected) return <p className="text-pop-dark font-mono text-sm leading-relaxed font-bold">{corrected || original}</p>;
    
    let diff;
    try {
        diff = diffWords(original, corrected);
    } catch (e) {
        return <p className="text-pop-dark font-mono text-sm leading-relaxed font-bold">{corrected}</p>;
    }

    return (
        <p className="text-pop-dark font-mono text-sm leading-relaxed whitespace-pre-wrap">
            {diff.map((part, i) => {
                if (part.removed) {
                    return <span key={i} className="text-red-500 line-through decoration-2 mr-1">{part.value}</span>;
                }
                if (part.added) {
                    return <span key={i} className="text-green-600 font-bold bg-green-100 px-1 rounded mr-1">{part.value}</span>;
                }
                return <span key={i} className="font-medium text-gray-700">{part.value}</span>;
            })}
        </p>
    );
};

export interface AiCorrectionProps {
  initialMode?: AnalysisMode;
}

export default AiCorrection;