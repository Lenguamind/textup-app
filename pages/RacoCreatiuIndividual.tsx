import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { callGemini } from '../services/apiService';
import { db, auth } from '../lib/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { 
  PenTool, BookOpen, RotateCcw, Camera, Loader2, Sparkles, 
  Award, Download, Wand2, ArrowRight, MessageSquare
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { resizeImage, parseRobustJson } from '../lib/utils';
import { generatePdf } from '../lib/pdf';

interface SinglePlayerAnalysis {
  scores: {
    coherence: number;
    creativity: number;
    vocabulary: number;
    expression: number;
    overall: number;
  };
  feedbacks: {
    coherence: string;
    creativity: string;
    vocabulary: string;
    expression: string;
  };
  suggestions: {
    coherence: string[];
    creativity: string[];
    vocabulary: { word: string; suggestion: string; explanation: string }[];
    expression: string[];
  };
  improvedVersion: string;
  globalReview: string;
}

const IND_EVALUATING_LOGS = [
  "Generant espurnes de geni literari...",
  "Analitzant la coherència de la teva història...",
  "Revisant la riquesa del teu vocabulari...",
  "Examinant l'expressió i l'ortografia...",
  "Mesurant la creativitat de les teves idees...",
  "Elaborant propostes de millora pedagògica..."
];

const RacoCreatiuIndividual: React.FC = () => {
  const { t, language, user } = useLanguage();
  const navigate = useNavigate();

  const [indState, setIndState] = useState<'setup' | 'writing' | 'evaluating' | 'result'>('setup');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [narrativeStyle, setNarrativeStyle] = useState<string>('mystery');
  const [individualPrompt, setIndividualPrompt] = useState<string>('');
  const [userContinuation, setUserContinuation] = useState<string>('');
  const [indEvaluatingLogIndex, setIndEvaluatingLogIndex] = useState(0);
  const [indAnalysis, setIndAnalysis] = useState<SinglePlayerAnalysis | null>(null);
  const [indError, setIndError] = useState<string | null>(null);
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState<boolean>(false);
  const [isOCRing, setIsOCRing] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const LOCALIZED_TEXTS = {
    ca: {
      title: "Racó Creatiu",
      desc: "Al teu apartat anomenat “Racó Creatiu”, l’usuari pot escollir el nivell de dificultat i l’estil narratiu que prefereix. A partir d’aquestes opcions, la IA genera l’inici d’una història perquè l’usuari la continuï amb la seva pròpia creativitat.\n\nUn cop la història està acabada, la IA n’avalua l’escriptura, valorant aspectes com la coherència, la creativitat, el vocabulari i l’expressió escrita, i ofereix suggeriments de millora per ajudar l’usuari a progressar.",
      difficultyLabel: "1. Tria el nivell de dificultat:",
      narrativeStyleLabel: "2. Tria l'estil narratiu:",
      generateStarterBtn: "CREAR INICI D'HISTÒRIA",
      difficultyEasyTitle: "Principiant",
      difficultyEasyDesc: "Un inici de partida senzill i clar per agafar impuls. (Mínim +20 paraules)",
      difficultyMediumTitle: "Intermedi",
      difficultyMediumDesc: "Un punt de partida evocador per desenvolupar riquesa verbal. (Mínim +40 paraules)",
      difficultyHardTitle: "Avançat / Desafiament",
      difficultyHardDesc: "Un ambient literari profund i riquesa de vocabulari. (Mínim +60 paraules)",
      // Styles
      styleMysteryTitle: "🔍 Misteri i Detectius",
      styleMysteryDesc: "Intrigues, secrets ocults i enigmes de detectius.",
      styleFantasyTitle: "🧙‍♂️ Fantasia i Màgia",
      styleFantasyDesc: "Regnes fantàstics, criatures, dracs i encanteris.",
      styleSciFiTitle: "🚀 Ciència-Ficció",
      styleSciFiDesc: "Futurs distòpics, naus espacials i la cibernètica de demà.",
      styleAdventureTitle: "🤠 Aventures del Món",
      styleAdventureDesc: "Exploracions de perill, viatges i tresors perduts.",
      styleHorrorTitle: "👻 Terror i Suspens",
      styleHorrorDesc: "Cases de por, ombres sota la lluna i misteris inexplicables.",
      styleRealisticTitle: "🏡 Realista i Quotidiana",
      styleRealisticDesc: "Relats de vida ordinaris, emocions i amistats reals.",
      // Writing
      writingTitle: "Escriu la teva història",
      writingSubtitle: "L'IA ha creat aquest inici per a tu. Ara és el teu torn! Escriu la continuació de la història utilitzant la teva pròpia creativitat.",
      storyStarterLabel: "Inici generat per l'IA:",
      yourContinuationLabel: "La teva continuació:",
      inputTextPlaceholder: "Escriu aquí per continuar la història... Deixa volar la teva imaginació!",
      wordsGoal: "Objectiu de paraules",
      wordsWritten: "S'han escrit {{words}} paraules.",
      wordsLeft: "Falten {{words}} paraules per a l'objectiu.",
      goalMet: "Objectiu complert! Pots enviar-ho o continuar expandint el relat.",
      ocrTooltip: "📷 Digitalitza text escrit a mà",
      ocrProcessing: "Transcribint lletra manuscrita...",
      backToSetupBtn: "Canviar de repte",
      evaluateBtn: "ACABAR HISTÒRIA I AVALUAR 🚀",
      // Evaluating
      evaluatingTitle: "AVALUANT CREATIVITAT...",
      evaluatingSubtitle: "Anant a la cambra de fusió de llenguatge... Analitzant coherència, vocabulari, ortografia i estructura...",
      // Result
      resultTitle: "Avaluació d'Escriptura",
      resultSubtitle: "Aquí tens l'anàlisi professional de la teva història i consells per seguir millorant de forma autònoma.",
      parchmentBookTitle: "El teu relat complet:",
      pillarCoherence: "Coherència",
      pillarCreativity: "Creativitat",
      pillarVocabulary: "Vocabulari",
      pillarExpression: "Expressió Escrita",
      overallScore: "Puntuació Global",
      teacherReview: "Feedback del Professor d'Escriptura",
      suggestionsTitle: "Suggeriments de millora pedagògics",
      vocabularyUpgradesTitle: "Enriquiment de Vocabulari",
      vocabWordHasWritten: "Has escrit",
      vocabWordRecommendation: "Recomanem canviar per",
      vocabWordWhy: "Motiu pedagògic",
      improvedVersionTitle: "✨ La Versió Polida de l'IA (Model literari)",
      improvedVersionExplanation: "Hem millorat el teu propi text mantenint les teves idees, de manera que puguis veure i aprendre com s'utilitzen d'altres sinònims rics en català literari. Compara els dos textos atentament!",
      downloadPdfBtn: "Descarregar PDF de correcció",
      startNewStoryBtn: "Escriure un nou relat",
      errorGeneratingPrompt: "S'ha produït un error de connexió amb en Gemini per generar el repte. Torna-ho a provar.",
      errorEvaluating: "S'ha produït un error en analitzar la història. Torna-ho a provar.",
      notEnoughTextAlert: "Per oferir-te una avaluació literària autèntica, escriu una continuació amb sentit (mínim 4 paraules)!"
    },
    es: {
      title: "Rincón Creativo",
      desc: "En tu sección llamada “Rincón Creativo”, el usuario puede elegir el nivel de dificultad y el estilo narrativo que prefieras. A partir de estas opciones, la IA genera el inicio de una historia para que el usuario la continúe con su propia creatividad.\n\nUna vez finalizada la historia, la IA evalúa la escritura, valorando aspectos como la coherencia, la creatividad, el vocabulario y la expresión escrita, y ofrece sugerencias de mejora para ayudar al usuario a progresar.",
      difficultyLabel: "1. Elige el nivel de dificultad:",
      narrativeStyleLabel: "2. Elige el estilo narrativo:",
      generateStarterBtn: "CREAR INICIO DE HISTORIA",
      difficultyEasyTitle: "Principiante",
      difficultyEasyDesc: "Un inicio de partida claro y sencillo para tomar impulso. (Mínimo +20 palabras)",
      difficultyMediumTitle: "Intermedio",
      difficultyMediumDesc: "Un punto de partida evocador para desarrollar riqueza verbal. (Mínimo +40 palabras)",
      difficultyHardTitle: "Avanzado / Reto",
      difficultyHardDesc: "Un ambiente literario profundo y riqueza de vocabulario. (Mínimo +60 palabras)",
      // Styles
      styleMysteryTitle: "🔍 Misterio y Detectives",
      styleMysteryDesc: "Intrigas, secretos ocultos y enigmas detectivescos.",
      styleFantasyTitle: "🧙‍♂️ Fantasía y Magia",
      styleFantasyDesc: "Reinos fantásticos, criaturas mágicas, dragones y hechizos.",
      styleSciFiTitle: "🚀 Ciencia Ficción",
      styleSciFiDesc: "Futuros distópicos, naves espaciales y la cibernética del mañana.",
      styleAdventureTitle: "🤠 Aventuras del Món",
      styleAdventureDesc: "Exploraciones de peligro, viajes y tesoros perdidos.",
      styleHorrorTitle: "👻 Terror y Suspenso",
      styleHorrorDesc: "Casas de miedo, sombras bajo la luna y misterios inexplicables.",
      styleRealisticTitle: "🏡 Realista y Cotidiana",
      styleRealisticDesc: "Relatos de vida ordinaria, emociones y amistades reales.",
      // Writing
      writingTitle: "Escribe tu historia",
      writingSubtitle: "La IA ha creado este inicio para ti. ¡Ahora es tu turno! Completa la historia utilizando tu propia creatividad.",
      storyStarterLabel: "Inicio generado por la IA:",
      yourContinuationLabel: "Tu continuación:",
      inputTextPlaceholder: "Escribe aquí para continuar la historia... ¡Deja volar tu imaginación!",
      textGoal: "Meta de texto",
      wordsGoal: "Objetivo de palabras",
      wordsWritten: "Has escrito {{words}} palabras.",
      wordsLeft: "Faltan {{words}} palabras para el objetivo.",
      goalMet: "¡Objetivo cumplido! Puedes enviarlo o continuar expandiendo el relato.",
      ocrTooltip: "📷 Digitalizar texto escrito a mano",
      ocrProcessing: "Transcribiendo letra manuscrita...",
      backToSetupBtn: "Cambiar de reto",
      evaluateBtn: "ACABAR HISTORIA Y EVALUAR 🚀",
      // Evaluating
      evaluatingTitle: "EVALUANDO CREATIVIDAD...",
      evaluatingSubtitle: "Yendo a la cámara de fusión de lenguaje... Analizando coherencia, vocabulario, ortografía y estructura...",
      // Result
      resultTitle: "Evaluación de Escritura",
      resultSubtitle: "Aquí tienes el análisis profesional de tu historia y consejos para seguir mejorando de forma autónoma.",
      parchmentBookTitle: "Tu relato completo:",
      pillarCoherence: "Coherencia",
      pillarCreativity: "Creatividad",
      pillarVocabulary: "Vocabulario",
      pillarExpression: "Expresión Escrita",
      overallScore: "Puntuación Global",
      teacherReview: "Feedback del Profesor de Escritura",
      suggestionsTitle: "Sugerencias de mejora pedagógicas",
      vocabularyUpgradesTitle: "Enriquecimiento de Vocabulario",
      vocabWordHasWritten: "Escribiste",
      vocabWordRecommendation: "Recomendamos cambiar por",
      vocabWordWhy: "Motivo pedagógico",
      improvedVersionTitle: "✨ Versión Pulida de la IA (Modelo literario)",
      improvedVersionExplanation: "Hemos optimizado tu propio texto manteniendo tus ideas, enriqueciendo el estilo, vocabulario y conexiones. ¡Compáralo para aprender nuevas fórmulas!",
      downloadPdfBtn: "Descargar PDF de corrección",
      startNewStoryBtn: "Escribir un nuevo relato",
      errorGeneratingPrompt: "Se ha producido un error al conectar con Gemini para generar el reto. Inténtalo de nuevo.",
      errorEvaluating: "Se ha producido un error al analizar la historia. Inténtalo de nuevo.",
      notEnoughTextAlert: "Para ofrecerte una evaluación literaria auténtica, escribe una continuación con sentido (mínimo 4 palabras)."
    }
  };

  const getTexts = () => {
    return language === 'ca' ? LOCALIZED_TEXTS.ca : LOCALIZED_TEXTS.es;
  };

  const addXp = async (xpAmount: number) => {
    if (!auth.currentUser) return;
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        xp: increment(xpAmount)
      });
    } catch (e) {
      console.error("Error updating XP:", e);
    }
  };

  const handleGenerateStoryStarter = async () => {
    setIsGeneratingPrompt(true);
    setIndError(null);
    const langLabel = language === 'ca' ? 'Catalan' : 'Spanish';
    const currentDiff = difficulty;
    const currentStyle = narrativeStyle;

    const diffGuide = {
      easy: `Principiant (Fàcil): El text de partida ha de ser breu (20-35 paraules), molt directe, clar i amb un vocabulari fàcilment comprensible en ${langLabel}. Proposa una situació o pregunta senzilla de continuar.`,
      medium: `Intermedi (Mitjà): El text ha de ser de 40-60 paraules en ${langLabel}, evocador, amb algunes descripcions de misteri, emoció o ambient, encoratjant l'escriptura d'adjectius i connectors.`,
      hard: `Avançat / Repte literari: El text ha de ser de 70-100 paraules en ${langLabel}, altament literari, amb personatges rics o atmosfera molt marcada, plantejant un dilema, enigma o limitació reutilitzable perquè el continuï.`
    }[currentDiff];

    const styleGuide = {
      mystery: "Misteri i Detectius: intrigues de nit, empremtes, objectes misteriosos, detectius i secrets per resoldre.",
      fantasy: "Fantasia: màgia, encanteris, criatures llegendàries com elfs o dragons, i regnes en perill.",
      scifi: "Ciència-Ficció: futurs llunyans, viatges espacials, intel·ligències artificials i la cibernètica de demà.",
      adventure: "Aventura: viatgers, selves profundes, mapes de tresors perduts i perills heroics.",
      horror: "Terror i Sospens: foscor, misteris fantasmagòrics, portes grinyolant i ombres espantoses.",
      realistic: "Realista / Quotidiana: històries i emocions reals de cada dia, amistats, llar o vivències personals molt properes."
    }[currentStyle as 'mystery' | 'fantasy' | 'scifi' | 'adventure' | 'horror' | 'realistic'];

    const promptText = `Actua com un escriptor d'elit i un formador de llengua i literatura. Genera exactament l'inici sugeridor d'un relat de ficció destinat a un estudiant.
Idioma de resposta: ${langLabel}.
Dificultat: ${currentDiff}. Guia: ${diffGuide}.
Estil Narratiu: ${currentStyle}. Guia: ${styleGuide}.

Genera només el fragment de l'inici del relat, de manera que acabi de forma oberta, amb un bon ganxo o suspens immediat que insti l'alumne a continuar-lo des d'aquell punt exacte.
IMPORTANT: No afegeixis presentacions ni títols (ex: "Inici:"), no responguis amb cometes a l'inici i final, respon només el text del relat en ${langLabel}.`;

  try {
      const response = await callGemini(
        'gemini-2.5-flash',
        [{ parts: [{ text: promptText }] }]
      );
      const cleaned = (response.text || "").trim().replace(/^["']|["']$/g, '');
      if (!cleaned) {
        throw new Error("Empty prompt returned.");
      }
      setIndividualPrompt(cleaned);
      setUserContinuation('');
      setIndState('writing');
    } catch (e) {
      console.error(e);
      setIndError(getTexts().errorGeneratingPrompt);
    } finally {
      setIsGeneratingPrompt(false);
    }
  };

  const handleEvaluateIndividualStory = async () => {
    const wordCount = userContinuation.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount < 4) {
      setIndError(getTexts().notEnoughTextAlert);
      return;
    }

    setIndState('evaluating');
    setIndError(null);
    setIndEvaluatingLogIndex(0);

    const langLabel = language === 'ca' ? 'Catalan' : 'Spanish';

    const promptText = `Actua com a tutor docent avançat d'escriptura creativa i crític literari expert de la llengua ${langLabel}.
Corregiràs, avaluaràs de forma sincera i de nivell pedagògic excel·lent la continuació de l'història de l'usuari en la mateixa llengua.

Dades de l'exercici:
- Estil narratiu de la història: ${narrativeStyle}
- Nivell de dificultat config: ${difficulty}
- Inici original facilitat per la IA: "${individualPrompt}"
- Continuació que ha escrit l'alumne: "${userContinuation}"

Task:
Interpreta l'escriptura de l'alumne i demana un objecte JSON en format estricte detallant l'anàlisi de llengua i de l'expressió escrita.
Assegura't de cobrir cada aspecte de forma sàvia i constructiva:
1. scores: Puntuació del 0 al 100 de:
   - coherence (coherència narrativa física i lògica, continuïtat d'estil).
   - creativity (creativitat de la proposta, girs, detalls originals, emoció).
   - vocabulary (riquesa lèxica, sinònims rics en lloc de verbs comodins).
   - expression (ortografia, puntuació, gramàtica general).
   - overall (mitjana dels esforços).
2. feedbacks: Un paràgraf inspirador d'unes 2 frases per a cascuna de les dimensions (coherence, creativity, vocabulary, expression) escrit amb amor pedagògic.
3. suggestions: Un llistat de 1-2 suggeriments molt concrets d'escriptura per a cada àrea (coherence, creativity, expression).
   - Per a "vocabulary": Ha de ser un array d'objectes concrets on detectis exactament paraules febles, repetides o simples que l'usuari ha redactat i els donguis una proposta de millora més literària, explicant el motiu.
4. improvedVersion: Una reelaboració completa de tota la continuació de l'usuari on l'IA mostra com es pot escriure la mateixa seqüència de forma elegant i molt polida en ${langLabel}.
5. globalReview: Comentari final tutoritzador d'unes 3 línies incentivant la passió d'escriptor.

Return EXACTLY a JSON structure matching this TS Interface:
{
  "scores": { "coherence": number, "creativity": number, "vocabulary": number, "expression": number, "overall": number },
  "feedbacks": { "coherence": "string", "creativity": "string", "vocabulary": "string", "expression": "string" },
  "suggestions": {
    "coherence": ["string", "string"],
    "creativity": ["string", "string"],
    "vocabulary": [
      { "word": "string", "suggestion": "string", "explanation": "string" }
    ],
    "expression": ["string", "string"]
  },
  "improvedVersion": "string",
  "globalReview": "string"
}

IMPORTANT: All keys and values must be returned strictly in ${langLabel}! Do not provide any conversational formatting around JSON block.`;

    const evaluationSchema = {
       type: "OBJECT",
       properties: {
         scores: {
           type: "OBJECT",
           properties: { coherence: {type: "NUMBER"}, creativity: {type: "NUMBER"}, vocabulary: {type: "NUMBER"}, expression: {type: "NUMBER"}, overall: {type: "NUMBER"} }
         },
         feedbacks: {
           type: "OBJECT",
           properties: { coherence: {type: "STRING"}, creativity: {type: "STRING"}, vocabulary: {type: "STRING"}, expression: {type: "STRING"} }
         },
         suggestions: {
           type: "OBJECT",
           properties: {
             coherence: { type: "ARRAY", items: { type: "STRING" } },
             creativity: { type: "ARRAY", items: { type: "STRING" } },
             vocabulary: { type: "ARRAY", items: { type: "OBJECT", properties: { word: {type: "STRING"}, suggestion: {type: "STRING"}, explanation: {type: "STRING"} } } },
             expression: { type: "ARRAY", items: { type: "STRING" } }
           }
         },
         improvedVersion: { type: "STRING" },
         globalReview: { type: "STRING" }
       },
       required: ["scores", "feedbacks", "suggestions", "improvedVersion", "globalReview"]
    };

    try {
      const response = await callGemini(
        'gemini-2.5-flash',
        [{ parts: [{ text: promptText }] }],
        undefined,
        { responseMimeType: 'application/json', responseSchema: evaluationSchema as any }
      );

      const parsed = parseRobustJson(response.text || '{}') as SinglePlayerAnalysis;
      setIndAnalysis(parsed);
      setIndState('result');
      
      const earnedXp = Math.round((parsed.scores.overall || 50) / 2);
      addXp(earnedXp);

      confetti({
        particleCount: 150,
        spread: 90,
        origin: { y: 0.6 },
        colors: ["#ec4899", "#3b82f6", "#22c55e", "#facc15"]
      });

    } catch (e) {
      console.error(e);
      setIndState('writing');
      setIndError(getTexts().errorEvaluating);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const originalBase64 = reader.result as string;
        try {
          const optimizedBase64 = await resizeImage(originalBase64);
          performOCR(optimizedBase64);
        } catch (e) {
          performOCR(originalBase64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const performOCR = async (imageSrc: string) => {
    setIsOCRing(true);
    try {
      const response = await callGemini(
        'gemini-2.5-flash',
        [
          {
            parts: [
              { text: "OCR transcript of handwritten creative story writing. Please return ONLY the transcribed text itself, with no comments, no titles." },
              { inlineData: { data: imageSrc.split(',')[1], mimeType: 'image/jpeg' } }
            ]
          }
        ]
      );
      const text = (response.text || '').trim();
      if (text) {
        setUserContinuation(prev => prev + (prev ? ' ' : '') + text);
      }
    } catch (err) {
      console.error('OCR Error:', err);
    } finally {
      setIsOCRing(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!indAnalysis) return;
    const texts = getTexts();

    const content = `
${texts.title.toUpperCase()} REPORT
---------------------------------------------------
${texts.pillarCoherence}: ${indAnalysis.scores.coherence}/100
${texts.pillarCreativity}: ${indAnalysis.scores.creativity}/100
${texts.pillarVocabulary}: ${indAnalysis.scores.vocabulary}/100
${texts.pillarExpression}: ${indAnalysis.scores.expression}/100
---------------------------------------------------
${texts.overallScore}: ${indAnalysis.scores.overall}/100

${texts.storyStarterLabel}
"${individualPrompt}"

${texts.yourContinuationLabel}
"${userContinuation}"

${texts.teacherReview.toUpperCase()}
"${indAnalysis.globalReview}"

---------------------------------------------------
${texts.suggestionsTitle.toUpperCase()}:

* ${texts.pillarCoherence}:
${indAnalysis.suggestions.coherence.map((s) => "  - " + s).join("\n")}

* ${texts.pillarCreativity}:
${indAnalysis.suggestions.creativity.map((s) => "  - " + s).join("\n")}

* ${texts.pillarExpression}:
${indAnalysis.suggestions.expression.map((s) => "  - " + s).join("\n")}

* ${texts.vocabularyUpgradesTitle}:
${indAnalysis.suggestions.vocabulary.map((v) => `  - "${v.word}" -> "${v.suggestion}" (${v.explanation})`).join("\n")}

---------------------------------------------------
${texts.improvedVersionTitle.toUpperCase()}
"${indAnalysis.improvedVersion}"
    `.trim();

    generatePdf({
      title: `${texts.title} - report`,
      author: user?.name || 'TextUP Writer',
      content: content,
      filename: `textup-raco-creatiu-${difficulty}-${narrativeStyle}.pdf`,
      labels: {
        authorPrefix: "Informe de",
        generatedOn: "Generat el",
        pageLabel: "Pàgina",
        ofLabel: "de",
        shareTextPrefix: "Progrés d'escriptura",
        shareDialogTitle: "Comparteix l'informe PDF",
      },
    });
  };

  useEffect(() => {
    let interval: any;
    if (indState === 'evaluating') {
      interval = setInterval(() => {
        setIndEvaluatingLogIndex((prev) => (prev < IND_EVALUATING_LOGS.length - 1 ? prev + 1 : 0));
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [indState]);

  const texts = getTexts();
  const wordCount = userContinuation.trim().split(/\s+/).filter(w => w.length > 0).length;
  const targetMin = difficulty === 'easy' ? 20 : difficulty === 'medium' ? 40 : 60;
  const isGoalMet = wordCount >= targetMin;

  // 1. SETUP VIEW
  if (indState === 'setup') {
    return (
      <div className="max-w-2xl mx-auto space-y-8 animate-slide-up pb-12 px-4 font-sans">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 bg-pop-green rounded-full border-4 border-pop-dark flex items-center justify-center mx-auto shadow-neo rotate-3">
            <PenTool size={48} className="text-white" />
          </div>
          <h2 className="text-4xl font-black text-pop-dark uppercase italic tracking-tight">{texts.title}</h2>
          <p className="text-lg font-bold text-gray-500 whitespace-pre-line leading-relaxed">{texts.desc}</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border-4 border-pop-dark shadow-neo space-y-8">
          {/* Difficulty selector */}
          <div className="space-y-4">
            <label className="text-lg font-black text-pop-dark uppercase italic ml-2">{texts.difficultyLabel}</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'easy', title: texts.difficultyEasyTitle, desc: texts.difficultyEasyDesc, color: 'bg-pop-green', hoverColor: 'hover:bg-green-50' },
                { key: 'medium', title: texts.difficultyMediumTitle, desc: texts.difficultyMediumDesc, color: 'bg-pop-yellow', hoverColor: 'hover:bg-yellow-50' },
                { key: 'hard', title: texts.difficultyHardTitle, desc: texts.difficultyHardDesc, color: 'bg-pop-pink', hoverColor: 'hover:bg-pink-50' }
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setDifficulty(item.key as any)}
                  className={`p-5 rounded-2xl border-3 border-pop-dark text-left transition-all ${
                    difficulty === item.key 
                      ? `${item.color} text-pop-dark font-black shadow-neo-sm translate-x-1 translate-y-1`
                      : `bg-white text-gray-600 ${item.hoverColor} shadow-neo-sm`
                  }`}
                >
                  <div className="font-black text-lg uppercase tracking-tight mb-1">{item.title}</div>
                  <div className="text-xs font-bold leading-snug">{item.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Narrative Style selector */}
          <div className="space-y-4">
            <label className="text-lg font-black text-pop-dark uppercase italic ml-2">{texts.narrativeStyleLabel}</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { key: 'mystery', title: texts.styleMysteryTitle, desc: texts.styleMysteryDesc, color: 'border-pop-blue border-l-8' },
                { key: 'fantasy', title: texts.styleFantasyTitle, desc: texts.styleFantasyDesc, color: 'border-purple-500 border-l-8' },
                { key: 'scifi', title: texts.styleSciFiTitle, desc: texts.styleSciFiDesc, color: 'border-indigo-500 border-l-8' },
                { key: 'adventure', title: texts.styleAdventureTitle, desc: texts.styleAdventureDesc, color: 'border-pop-green border-l-8' },
                { key: 'horror', title: texts.styleHorrorTitle, desc: texts.styleHorrorDesc, color: 'border-pop-pink border-l-8' },
                { key: 'realistic', title: texts.styleRealisticTitle, desc: texts.styleRealisticDesc, color: 'border-pop-yellow border-l-8' }
              ].map((style) => (
                <button
                  key={style.key}
                  type="button"
                  onClick={() => setNarrativeStyle(style.key)}
                  className={`p-4 rounded-xl border-3 border-pop-dark hover:bg-gray-50 text-left transition-all flex flex-col justify-between h-28 ${style.color} ${
                    narrativeStyle === style.key
                      ? 'bg-slate-50 shadow-neo-sm translate-x-0.5 translate-y-0.5'
                      : 'bg-white shadow-neo-sm'
                  }`}
                >
                  <div className="font-black text-base text-pop-dark uppercase tracking-wide">{style.title}</div>
                  <div className="text-[11px] font-bold text-gray-400 leading-snug">{style.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {indError && (
            <div className="bg-red-50 text-red-700 p-4 rounded-2xl font-bold border-2 border-red-200">
              {indError}
            </div>
          )}

          <button
            onClick={handleGenerateStoryStarter}
            disabled={isGeneratingPrompt}
            className="w-full bg-pop-green text-pop-dark font-black text-xl py-6 rounded-3xl border-4 border-pop-dark shadow-neo flex items-center justify-center gap-3 hover:bg-green-400 transition-colors btn-press disabled:opacity-50"
          >
            {isGeneratingPrompt ? (
              <>
                <Loader2 className="animate-spin text-pop-dark" size={24} />
                <span>{language === 'ca' ? 'GENERANT RECEPTA CREATIVA...' : 'GENERANDO RETO CREATIVO...'}</span>
              </>
            ) : (
              <>
                <Wand2 size={24} />
                <span>{texts.generateStarterBtn}</span>
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // 2. WRITING VIEW
  if (indState === 'writing') {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-slide-up pb-12 px-4 font-sans">
        <div className="bg-pop-dark p-6 rounded-3xl border-4 border-pop-dark text-white shadow-neo relative overflow-hidden">
          <div className="absolute -right-6 -bottom-6 opacity-10 rotate-12">
            <BookOpen size={140} />
          </div>
          <div className="relative z-10">
            <span className="text-xs font-black uppercase text-pop-yellow tracking-widest bg-pop-yellow/10 px-3 py-1 rounded-full border border-pop-yellow/20">
              {narrativeStyle.toUpperCase()} • {difficulty.toUpperCase()}
            </span>
            <h2 className="text-2xl font-black italic uppercase tracking-tight mt-2">{texts.writingTitle}</h2>
            <p className="text-sm font-bold opacity-80 mt-1">{texts.writingSubtitle}</p>
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border-4 border-pop-dark shadow-neo space-y-6">
          <div className="bg-amber-50/70 p-6 rounded-2xl border-l-8 border-l-pop-yellow border-t-2 border-r-2 border-b-2 border-pop-dark shadow-neo-sm relative overflow-hidden">
            <p className="text-xs font-black text-amber-800 uppercase tracking-widest mb-1">{texts.storyStarterLabel}</p>
            <p className="text-lg font-bold text-pop-dark italic leading-relaxed">
              "{individualPrompt}"
            </p>
          </div>

          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
              <label className="text-lg font-black text-pop-dark uppercase italic ml-2">
                {texts.yourContinuationLabel}
              </label>
              <div className={`px-4 py-1.5 rounded-full border-2 border-pop-dark text-xs font-black flex items-center gap-1.5 shadow-neo-sm ${
                isGoalMet ? 'bg-pop-green text-pop-dark' : 'bg-pop-yellow text-pop-dark'
              }`}>
                <Award size={14} />
                <span>
                  {texts.wordsGoal}: {wordCount}/{targetMin} {language === 'ca' ? 'paraules' : 'palabras'}
                </span>
              </div>
            </div>

            <textarea
              value={userContinuation}
              onChange={(e) => setUserContinuation(e.target.value)}
              placeholder={texts.inputTextPlaceholder}
              className="w-full bg-indigo-50/30 border-4 border-pop-dark p-6 rounded-3xl text-lg font-bold text-pop-dark placeholder:text-gray-400 focus:outline-none focus:ring-4 focus:ring-pop-blue/20 min-h-[220px] shadow-inner resize-none leading-relaxed"
              disabled={isOCRing}
            />
          </div>

          <div className="flex items-center gap-2 px-3 py-1 bg-gray-50 border border-gray-100 rounded-xl">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></span>
            <p className="text-xs font-bold text-gray-500">
              {isGoalMet
                ? texts.goalMet
                : texts.wordsLeft.replace('{{words}}', String(targetMin - wordCount))}
            </p>
          </div>

          {indError && (
            <div className="bg-red-50 text-red-700 p-4 rounded-2xl font-bold border-2 border-red-200">
              {indError}
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pt-2">
            <div className="flex gap-2">
              <button
                onClick={() => setIndState('setup')}
                className="bg-white text-pop-dark font-black px-6 py-4 rounded-2xl border-4 border-pop-dark shadow-neo hover:bg-gray-50 transition-colors flex items-center gap-2 btn-press"
              >
                <RotateCcw size={18} />
                <span>{texts.backToSetupBtn}</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isOCRing}
                className="bg-pop-yellow text-pop-dark border-4 border-pop-dark px-6 py-4 rounded-2xl shadow-neo flex items-center gap-2 hover:bg-yellow-400 transition-colors btn-press disabled:opacity-50"
                title={texts.ocrTooltip}
              >
                {isOCRing ? (
                  <>
                    <Loader2 size={18} className="animate-spin text-pop-dark" />
                    <span className="text-sm font-black uppercase text-pop-dark">{texts.ocrProcessing}</span>
                  </>
                ) : (
                  <>
                    <Camera size={18} />
                    <span className="text-sm font-black uppercase text-pop-dark">{texts.ocrTooltip}</span>
                  </>
                )}
              </button>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            <button
              onClick={handleEvaluateIndividualStory}
              disabled={isOCRing}
              className="bg-pop-green text-pop-dark font-black text-lg px-8 py-5 rounded-3xl border-4 border-pop-dark shadow-neo flex items-center justify-center gap-3 hover:bg-green-400 transition-all btn-press duration-150"
            >
              <span>{texts.evaluateBtn}</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 3. EVALUATING VIEW
  if (indState === 'evaluating') {
    return (
      <div className="max-w-xl mx-auto space-y-8 animate-slide-up pb-12 px-4 py-12 font-sans">
        <div className="bg-white p-12 rounded-[2.5rem] border-4 border-pop-dark shadow-neo text-center space-y-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-indigo-50/10 pointer-events-none"></div>
          
          <div className="relative mx-auto w-32 h-32 bg-pop-yellow rounded-full border-4 border-pop-dark flex items-center justify-center shadow-neo animate-spin-slow">
            <Sparkles size={64} className="text-pop-dark animate-pulse" />
          </div>

          <div className="space-y-4 relative z-10">
            <h2 className="text-3xl font-black text-pop-dark uppercase italic tracking-tight">{texts.evaluatingTitle}</h2>
            <p className="text-lg font-bold text-gray-500 leading-relaxed max-w-md mx-auto">{texts.evaluatingSubtitle}</p>
          </div>

          <div className="bg-indigo-50 p-6 rounded-2xl border-3 border-pop-dark flex items-center justify-center gap-3 max-w-md mx-auto relative overflow-hidden">
            <Loader2 className="animate-spin text-pop-blue shrink-0" size={24} />
            <p className="font-extrabold text-pop-blue tracking-tight animate-pulse text-sm">
              {IND_EVALUATING_LOGS[indEvaluatingLogIndex]}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 4. RESULT VIEW
  if (indState === 'result' && indAnalysis) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-slide-up pb-12 px-4 font-sans">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 bg-pop-green rounded-full border-4 border-pop-dark flex items-center justify-center mx-auto shadow-neo rotate-3">
            <Award size={48} className="text-pop-dark" />
          </div>
          <h2 className="text-4xl font-black text-pop-dark uppercase italic tracking-tight">{texts.resultTitle}</h2>
          <p className="text-xl font-bold text-gray-500">{texts.resultSubtitle}</p>
        </div>

        {/* Core Story Parchment */}
        <div className="bg-amber-50 rounded-[2.5rem] border-4 border-pop-dark p-8 md:p-12 shadow-neo relative">
          <div className="absolute -top-4 -left-4 bg-pop-dark text-white px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border-3 border-pop-dark transform -rotate-2">
            {texts.parchmentBookTitle}
          </div>
          
          <div className="prose prose-lg leading-relaxed text-pop-dark font-bold text-lg italic space-y-4 pt-4 select-none">
            <p className="text-gray-500">
              {individualPrompt}
            </p>
            <p className="border-t-3 border-dashed border-pop-dark/10 pt-4 leading-relaxed whitespace-pre-line not-italic text-pop-dark">
              {userContinuation}
            </p>
          </div>
        </div>

        {/* Score Grid & Performance */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Global Grade */}
          <div className="lg:col-span-2 bg-pop-dark text-white rounded-[2rem] border-4 border-pop-dark p-6 flex flex-col justify-between shadow-neo min-h-[220px]">
            <div>
              <span className="text-[10px] uppercase font-black tracking-widest text-pop-yellow bg-pop-yellow/10 border border-pop-yellow/20 px-3 py-1 rounded-full animate-pulse">GRADE REPORT</span>
              <h3 className="text-2xl font-black italic mt-4 uppercase tracking-tighter">{texts.overallScore}</h3>
            </div>
            <div className="flex items-baseline gap-2 py-4">
              <span className="text-7xl font-black text-pop-yellow tracking-tighter select-none">{indAnalysis.scores.overall}</span>
              <span className="text-xl font-bold opacity-60">/ 100 XP</span>
            </div>
            <div className="text-xs font-bold opacity-80 leading-relaxed">
              {language === 'ca' 
                ? "S'ha afegit un bonus d'experiència al teu perfil com a recompensa literària!"
                : "¡Se ha añadido un gran bonus de experiencia a tu perfil como recompensa literaria!"}
            </div>
          </div>

          {/* Pillars */}
          <div className="lg:col-span-3 grid grid-cols-2 gap-4">
            {[
              { name: texts.pillarCoherence, score: indAnalysis.scores.coherence, feedback: indAnalysis.feedbacks.coherence, color: 'bg-pop-blue' },
              { name: texts.pillarCreativity, score: indAnalysis.scores.creativity, feedback: indAnalysis.feedbacks.creativity, color: 'bg-pop-pink' },
              { name: texts.pillarVocabulary, score: indAnalysis.scores.vocabulary, feedback: indAnalysis.feedbacks.vocabulary, color: 'bg-pop-yellow' },
              { name: texts.pillarExpression, score: indAnalysis.scores.expression, feedback: indAnalysis.feedbacks.expression, color: 'bg-pop-green' }
            ].map((pill, i) => (
              <div key={i} className="bg-white p-5 rounded-2xl border-3 border-pop-dark shadow-neo-sm flex flex-col justify-between gap-1">
                <div className="flex justify-between items-center border-b-2 border-slate-100 pb-2 mb-2">
                  <span className="text-[11px] font-black uppercase text-pop-dark tracking-wide">{pill.name}</span>
                  <span className="text-base font-black text-pop-dark">{pill.score}%</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mb-2">
                  <div className={`${pill.color} h-full`} style={{ width: `${pill.score}%` }}></div>
                </div>
                <p className="text-[10px] font-bold text-gray-500 leading-snug line-clamp-3">
                  {pill.feedback}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Teacher Feedback */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border-4 border-pop-dark shadow-neo relative overflow-hidden">
          <div className="absolute top-4 right-4 text-pop-pink rotate-12 opacity-10">
            <MessageSquare size={130} />
          </div>
          <div className="relative z-10 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-pop-pink border-2 border-pop-dark flex items-center justify-center text-white">
                ✍️
              </div>
              <h3 className="font-black text-base uppercase text-pop-dark tracking-tight italic">
                {texts.teacherReview}
              </h3>
            </div>
            <p className="text-lg font-bold text-pop-dark italic leading-relaxed">
              "{indAnalysis.globalReview}"
            </p>
          </div>
        </div>

        {/* Suggestions & Vocabulary Upgrade */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 md:p-8 rounded-3xl border-4 border-pop-dark shadow-neo space-y-4">
            <h3 className="text-xl font-black text-pop-dark uppercase italic tracking-tight">
              {texts.suggestionsTitle}
            </h3>
            <div className="space-y-4">
              {indAnalysis.suggestions.coherence && indAnalysis.suggestions.coherence.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase text-pop-blue">• {texts.pillarCoherence}</h4>
                  <ul className="list-disc list-inside pl-1 space-y-1 text-xs font-bold text-gray-600 leading-relaxed">
                    {indAnalysis.suggestions.coherence.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
              
              {indAnalysis.suggestions.creativity && indAnalysis.suggestions.creativity.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase text-pop-pink">• {texts.pillarCreativity}</h4>
                  <ul className="list-disc list-inside pl-1 space-y-1 text-xs font-bold text-gray-600 leading-relaxed">
                    {indAnalysis.suggestions.creativity.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}

              {indAnalysis.suggestions.expression && indAnalysis.suggestions.expression.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-xs font-black uppercase text-pop-green">• {texts.pillarExpression}</h4>
                  <ul className="list-disc list-inside pl-1 space-y-1 text-xs font-bold text-gray-600 leading-relaxed">
                    {indAnalysis.suggestions.expression.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white p-6 md:p-8 rounded-3xl border-4 border-pop-dark shadow-neo space-y-4">
            <h3 className="text-xl font-black text-pop-dark uppercase italic tracking-tight">
              {texts.vocabularyUpgradesTitle}
            </h3>
            <div className="divide-y-2 divide-gray-100 space-y-3">
              {indAnalysis.suggestions.vocabulary.map((v, i) => (
                <div key={i} className="pt-3 first:pt-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5 animate-fade-in">
                    <span className="text-[10px] font-black uppercase bg-red-100 text-red-700 px-2 py-0.5 rounded-full border border-red-200">
                      {texts.vocabWordHasWritten}: "{v.word}"
                    </span>
                    <span className="text-xs font-black text-gray-400">➡️</span>
                    <span className="text-[10px] font-black uppercase bg-pop-green text-pop-dark px-2 py-0.5 rounded-full border border-pop-dark animate-pulse">
                      {texts.vocabWordRecommendation}: "{v.suggestion}"
                    </span>
                  </div>
                  <p className="text-xs font-bold text-gray-500 leading-relaxed">
                    <strong>{texts.vocabWordWhy}:</strong> {v.explanation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* AI Polished Version */}
        <div className="bg-emerald-50/70 p-6 md:p-8 rounded-[2.5rem] border-4 border-emerald-500 shadow-neo space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xl text-emerald-600">✨</span>
            <h3 className="text-2xl font-black text-emerald-900 uppercase italic tracking-tight">
              {texts.improvedVersionTitle}
            </h3>
          </div>
          
          <p className="text-xs font-bold text-emerald-800 bg-emerald-100/50 p-4 rounded-xl border border-emerald-200 leading-relaxed">
            {texts.improvedVersionExplanation}
          </p>

          <blockquote className="border-l-4 border-emerald-500 pl-6 italic font-bold text-emerald-950 text-lg leading-relaxed pt-2">
            "{indAnalysis.improvedVersion}"
          </blockquote>
        </div>

        {/* Footer Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-stretch">
          <button
            onClick={handleDownloadPdf}
            className="flex-1 bg-white text-pop-dark font-black text-xl py-6 rounded-3xl border-4 border-pop-dark shadow-neo flex items-center justify-center gap-3 hover:bg-gray-100 transition-colors btn-press"
          >
            <Download size={24} />
            <span>{texts.downloadPdfBtn}</span>
          </button>
          <button
            onClick={() => {
              setIndAnalysis(null);
              setIndState('setup');
            }}
            className="flex-1 bg-pop-blue text-white font-black text-xl py-6 rounded-3xl border-4 border-pop-dark shadow-neo flex items-center justify-center gap-3 hover:bg-blue-500 transition-colors btn-press"
          >
            <PenTool size={24} />
            <span>{texts.startNewStoryBtn}</span>
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default RacoCreatiuIndividual;
