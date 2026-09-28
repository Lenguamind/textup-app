import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, PenTool, Eraser, Star, Lightbulb, Flame } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { Language } from '../types/language';

interface LiveCorrectionShowProps {
  streamedText: string;
}

interface StreamToken {
  id: string;
  type: 'word' | 'error';
  word: string;
  original?: string;
  corrected?: string;
  isIncomplete?: boolean;
}

interface TranslationSet {
  headerBadge: string;
  subheading: string;
  connectingOverlay: string[];
  connectingStatus: string;
  revising: string;
  magicBadge: string;
  footerStatus: string;
  activeModel: string;
  subtitle: string;
  alchemyTitle: string;
  bursts: string[];
}

const localTranslations: Record<Language, TranslationSet> = {
  ca: {
    headerBadge: "COMENTARI EN DIRECTE! 🚀",
    subheading: "✍️ REVISANT PARAULA PER PARAULA...",
    connectingOverlay: [
      "🧠 Connectant neurones...",
      "✍️ Esmolant el llapis...",
      "🎨 Calibrant els colors del bolígraf...",
      "🔥 Escalfant motors de correcció...",
      "📖 Repassant diccionaris antics...",
      "⚡ Invocant el súper corrector virtual...",
      "💥 Gairebé a punt per a la correcció màgica..."
    ],
    connectingStatus: "ESTABLINT CONNEXIÓ MÀGICA AMB LA IA DELS PROFESSORS...",
    revising: "REVISANT...",
    magicBadge: "MÀGIA EN DIRECTE ACADÈMICA DE COLOR I CORRECCIÓ...",
    footerStatus: "L'informe d'avaluació amb les notes i consells es carregarà tot seguit",
    activeModel: "MODEL ACTIU",
    subtitle: "ESTIL, GRAMÀTICA I ORTOGRAFIA ⚡",
    alchemyTitle: "⚡ L'ALQUÍMIA DE LES PARAULES ✨",
    bursts: ['BOOM!', 'ZAP!', 'CORREGIT!', 'SUPER!', 'MÀGIC!', 'WOW!', 'PUM!', 'ÒSTRES!']
  },
  es: {
    headerBadge: "¡COMENTARIO EN DIRECTO! 🚀",
    subheading: "✍️ REVISANDO PALABRA POR PALABRA...",
    connectingOverlay: [
      "🧠 Conectando neuronas...",
      "✍️ Sacando punta al lápiz...",
      "🎨 Calibrando los colores del bolígrafo...",
      "🔥 Calentando motores de corrección...",
      "📖 Repasando diccionarios antiguos...",
      "⚡ Invocando al supercorrector virtual...",
      "💥 Casi listos para la corrección mágica..."
    ],
    connectingStatus: "ESTABLECIENDO CONEXIÓN MÁGICA CON LA IA DE PROFESORES...",
    revising: "REVISANDO...",
    magicBadge: "MAGIA EN DIRECTO DE COLOR Y CORRECCIÓN ACADÉMICA...",
    footerStatus: "El informe de evaluación con notas y consejos se cargará a continuación",
    activeModel: "MODELO ACTIVO",
    subtitle: "ESTILO, GRAMÁTICA Y ORTOGRAFÍA ⚡",
    alchemyTitle: "⚡ LA ALQUIMIA DE LAS PALABRAS ✨",
    bursts: ['¡BUM!', '¡ZAS!', '¡CORREGIDO!', '¡SÚPER!', '¡MÁGICO!', '¡WOW!', '¡PUM!', '¡OSTRAS!']
  },
  en: {
    headerBadge: "LIVE FEEDBACK! 🚀",
    subheading: "✍️ CHECKING WORD BY WORD...",
    connectingOverlay: [
      "🧠 Connecting neurons...",
      "✍️ Sharpening the pencil...",
      "🎨 Calibrating pen colors...",
      "🔥 Warming up the correction engines...",
      "📖 Flipping through old dictionaries...",
      "⚡ Summoning the virtual super tutor...",
      "💥 Almost ready for the magic correction..."
    ],
    connectingStatus: "ESTABLISHING MAGIC CONNECTION WITH THE AI TUTORS...",
    revising: "CHECKING...",
    magicBadge: "LIVE ACADEMIC COLOR & CORRECTION MAGIC...",
    footerStatus: "The evaluation report with grades and tips will load shortly",
    activeModel: "ACTIVE MODEL",
    subtitle: "STYLE, GRAMMAR & SPELLING ⚡",
    alchemyTitle: "⚡ THE ALCHEMY OF WORDS ✨",
    bursts: ['BOOM!', 'ZAP!', 'CORRECTED!', 'SUPER!', 'MAGIC!', 'WOW!', 'BAM!', 'AWESOME!']
  },
  fr: {
    headerBadge: "RETOUR EN DIRECT ! 🚀",
    subheading: "✍️ VÉRIFICATION MOT PAR MOT...",
    connectingOverlay: [
      "🧠 Connexion des neurones...",
      "✍️ Taille du crayon...",
      "🎨 Calibrage des couleurs du stylo...",
      "🔥 Chauffage des moteurs de correction...",
      "📖 Feuilletage des vieux dictionnaires...",
      "⚡ Invocation du super tuteur virtuel...",
      "💥 Presque prêt pour la correction magique..."
    ],
    connectingStatus: "CONNEXION MAGIQUE AVEC L'IA DES ENSEIGNANTS...",
    revising: "VÉRIFICATION...",
    magicBadge: "MAGIE EN DIRECT DE LA COULEUR ET DE LA CORRECTION ACADÉMIQUE...",
    footerStatus: "Le rapport d'évaluation avec notes et conseils va s'afficher tout de suite",
    activeModel: "MODÈLE ACTIF",
    subtitle: "STYLE, GRAMMAIRE & ORTHOGRAPHE ⚡",
    alchemyTitle: "⚡ L'ALCHIMIE DES MOTS ✨",
    bursts: ['BOUM !', 'ZAP !', 'CORRIGÉ !', 'SUPER !', 'MAGIQUE !', 'WOW !', 'BANG !', 'GÉNIAL !']
  },
  it: {
    headerBadge: "FEEDBACK IN DIRETTA! 🚀",
    subheading: "✍️ REVISIONE PAROLA PER PAROLA...",
    connectingOverlay: [
      "🧠 Connessione dei neuroni...",
      "✍️ Temperando la matita...",
      "🎨 Calibrando i colori della penna...",
      "🔥 Riscaldando i motori di correzione...",
      "📖 Sfogliando vecchi dizionari...",
      "⚡ Evocando il super correttore virtuale...",
      "💥 Quasi pronti per la correzione magica..."
    ],
    connectingStatus: "CONNESSIONE MAGICA CON L'IA DEI DOCENTI...",
    revising: "REVISIONE...",
    magicBadge: "MAGIA IN DIRETTA DI COLORE E CORREZIONE ACCADEMICA...",
    footerStatus: "Il rapporto di valutazione con voti e consigli sarà caricato a breve",
    activeModel: "MODELLO ATTIVO",
    subtitle: "STILE, GRAMMATICA E ORTOGRAFIA ⚡",
    alchemyTitle: "⚡ L'ALCHIMIA DELLE PAROLE ✨",
    bursts: ['BOOM!', 'ZAP!', 'CORRETTO!', 'SUPER!', 'MAGICO!', 'WOW!', 'PUM!', 'EVVIVA!']
  },
  de: {
    headerBadge: "LIVE-RÜCKMELDUNG! 🚀",
    subheading: "✍️ WORT FÜR WORT PRÜFEN...",
    connectingOverlay: [
      "🧠 Neuronen verbinden...",
      "✍️ Bleistift anspitzen...",
      "🎨 Stiftfarben kalibrieren...",
      "🔥 Korrekturmotoren aufwärmen...",
      "📖 In alten Wörterbüchern blättern...",
      "⚡ Virtuellen Super-Tutor beschwören...",
      "💥 Fast bereit für die magische Korrektur..."
    ],
    connectingStatus: "MAGISCHE VERBINDUNG MIT DER LEHRER-KI...",
    revising: "PRÜFEN...",
    magicBadge: "AKADEMISCHE FARB- UND KORREKTURMAGIE IN ECHTZEIT...",
    footerStatus: "Der Auswertungsbericht mit Noten und Tipps wird in Kürze geladen",
    activeModel: "AKTIVES MODELL",
    subtitle: "STIL, GRAMMATIK & RECHTSCHREIBUNG ⚡",
    alchemyTitle: "⚡ DIE ALCHEMIE DER WORTE ✨",
    bursts: ['BOOM!', 'ZAP!', 'KORRIGIERT!', 'SUPER!', 'MAGISCH!', 'WOW!', 'BÄMM!', 'GENIAL!']
  },
  pt: {
    headerBadge: "FEEDBACK EM DIRETO! 🚀",
    subheading: "✍️ REVISANDO PALAVRA POR PALAVRA...",
    connectingOverlay: [
      "🧠 Conectando neurônios...",
      "✍️ Apontando o lápis...",
      "🎨 Calibrando as cores da caneta...",
      "🔥 Aquecendo motores de correção...",
      "📖 Folheando dicionários antigos...",
      "⚡ Invocando o supercorretor virtual...",
      "💥 Quase prontos para a correção mágica..."
    ],
    connectingStatus: "ESTABELECENDO CONEXÃO MÁGICA COM A IA DOS PROFESSORES...",
    revising: "REVISANDO...",
    magicBadge: "MAGIA EM DIRETO DE COR E CORREÇÃO ACADÊMICA...",
    footerStatus: "O relatório de avaliação com notas e conselhos será carregado em seguida",
    activeModel: "MODELO ATIVO",
    subtitle: "ESTILO, GRAMÁTICA E ORTOGRAFIA ⚡",
    alchemyTitle: "⚡ A ALQUIMIA DAS PALAVRAS ✨",
    bursts: ['BOOM!', 'ZAP!', 'CORRIGIDO!', 'SUPER!', 'MÁGICO!', 'WOW!', 'PUM!', 'INCRÍVEL!']
  },
  pl: {
    headerBadge: "OPINIA NA ŻYWO! 🚀",
    subheading: "✍️ SPRAWDZANIE SŁOWO PO SŁOWIE...",
    connectingOverlay: [
      "🧠 Łączenie neuronów...",
      "✍️ Temperowanie ołówka...",
      "🎨 Kalibracja kolorów pióra...",
      "🔥 Rozgrzewanie silników korekcyjnych...",
      "📖 Przeglądanie starych słowników...",
      "⚡ Przywoływanie wirtualnego super-korektora...",
      "💥 Prawie gotowe do magicznej korekty..."
    ],
    connectingStatus: "NAWIĄZYWANIE MAGICZNEGO POŁĄCZENIA Z AI NAUCZYCIELI...",
    revising: "SPRAWDZANIE...",
    magicBadge: "MAGIA KOLORÓW I KOREKTY AKADEMICKIEJ NA ŻYWO...",
    footerStatus: "Raport z ocenami i wskazówkami zostanie wkrótce załadowany",
    activeModel: "AKTYWNY MODEL",
    subtitle: "STYL, GRAMATYKA I ORTOGRAFIA ⚡",
    alchemyTitle: "⚡ ALCHEMIA SŁÓW ✨",
    bursts: ['BUM!', 'ZAP!', 'POPRAWIONE!', 'SUPER!', 'MAGICZNIE!', 'WOW!', 'TRAFIONY!', 'EKSTRA!']
  },
  nl: {
    headerBadge: "LIVE FEEDBACK! 🚀",
    subheading: "✍️ WOORD VOOR WOORD CONTROLEREN...",
    connectingOverlay: [
      "🧠 Neuronen verbinden...",
      "✍️ Potlood slijpen...",
      "🎨 Penkleuren kalibreren...",
      "🔥 Correctiemotoren opwarmen...",
      "📖 Oude woordenboeken doorbladeren...",
      "⚡ Virtuele super-docent oproepen...",
      "💥 Bijna klaar voor de magische correctie..."
    ],
    connectingStatus: "MAGISCHE VERBINDING MET DE DOCENT-AI MAKEN...",
    revising: "CONTROLEREN...",
    magicBadge: "LIVE ACADEMISCHE KLEUR- & CORRECTIEMAGIE...",
    footerStatus: "Het evaluatierapport met cijfers en tips wordt zo dadelijk geladen",
    activeModel: "ACTIEF MODEL",
    subtitle: "STIJL, GRAMMATICA & SPELLING ⚡",
    alchemyTitle: "⚡ DE ALCHEMIE VAN WOORDEN ✨",
    bursts: ['BOEM!', 'ZAP!', 'GECOORRIGEERD!', 'SUPER!', 'MAGISCH!', 'WOW!', 'KLABAM!', 'GEWELDIG!']
  },
  sv: {
    headerBadge: "LIVE-FEEDBACK! 🚀",
    subheading: "✍️ KONTROLLERAR ORD FÖR ORD...",
    connectingOverlay: [
      "🧠 Kopplar samman neuroner...",
      "✍️ Vässar pennan...",
      "🎨 Kalibrerar pennans färger...",
      "🔥 Värmer upp korrigeringsmotorerna...",
      "📖 Bläddrar i gamla ordböcker...",
      "⚡ Kallar på den virtuella superläraren...",
      "💥 Nästan redo för den magiska rättningen..."
    ],
    connectingStatus: "UPPRÄTTAR MAGISK ANSLUTNING MED LÄRAR-AI...",
    revising: "KONTROLLERAR...",
    magicBadge: "LIVE AKADEMISK FÄRG- OCH RÄTTNINGSMAGI...",
    footerStatus: "Utvärderingsrapporten med betyg och tips laddas inom kort",
    activeModel: "AKTIV MODELL",
    subtitle: "STIL, GRAMMATIK & STAVNING ⚡",
    alchemyTitle: "⚡ ORDENS ALKEMI ✨",
    bursts: ['BOOM!', 'ZAP!', 'RÄTTAT!', 'SUPER!', 'MAGISKT!', 'WOW!', 'PANG!', 'HÄRLIGT!']
  },
  no: {
    headerBadge: "LIVE-TILBAKEMELDING! 🚀",
    subheading: "✍️ SJEKKER ORD FOR ORD...",
    connectingOverlay: [
      "🧠 Kobler sammen nevroner...",
      "✍️ Kvesser blyanten...",
      "🎨 Kalibrerer pennefarger...",
      "🔥 Varmer opp rettemotorene...",
      "📖 Blar i gamle ordbøker...",
      "⚡ Tilkaller den virtuelle super-læreren...",
      "💥 Nesten klar for den magiske rettingen..."
    ],
    connectingStatus: "OPPRETTER MAGISK TILKOBLING MED LÆRER-AI...",
    revising: "SJEKKER...",
    magicBadge: "LIVE AKADEMISK FARGE- OG RETTINGSMAGI...",
    footerStatus: "Evalueringsrapporten med karakterer og tips lastes om kort tid",
    activeModel: "AKTIV MODELL",
    subtitle: "STIL, GRAMMATIKK & STAVING ⚡",
    alchemyTitle: "⚡ ARTIKKEL ALKJEMI ✨",
    bursts: ['BOOM!', 'ZAP!', 'RETTET!', 'SUPER!', 'MAGISK!', 'WOW!', 'PANG!', 'FLOTT!']
  },
  da: {
    headerBadge: "LIVE FEEDBACK! 🚀",
    subheading: "✍️ KONTROLLERAR ORD FOR ORD...",
    connectingOverlay: [
      "🧠 Forbinder neuroner...",
      "✍️ Spidser blyanten...",
      "🎨 Kalibrerer pennefarver...",
      "🔥 Varmer rettemotorerne op...",
      "📖 Bladrer i gamle ordbøger...",
      "⚡ Tilkalder den virtuelle super-lærer...",
      "💥 Næsten klar til magisk rettelse..."
    ],
    connectingStatus: "OPRETTER MAGISK FORBINDELSE TIL LÆRER-AI...",
    revising: "KONTROLLERER...",
    magicBadge: "LIVE AKADEMISK FARGE- & RETTELSESMAGI...",
    footerStatus: "Evalueringsrapporten med karakterer og tips indlæses om kort tid",
    activeModel: "AKTIV MODEL",
    subtitle: "STIL, GRAMMATIK & STAVNING ⚡",
    alchemyTitle: "⚡ ORDETS ALKEMI ✨",
    bursts: ['BOOM!', 'ZAP!', 'RETTET!', 'SUPER!', 'MAGISK!', 'WOW!', 'SMASH!', 'FLOT!']
  },
  uk: {
    headerBadge: "ЖИВИЙ ВІДГУК! 🚀",
    subheading: "✍️ ПЕРЕВІРКА СЛОВО ЗА СЛОВОМ...",
    connectingOverlay: [
      "🧠 З'єднуємо нейрони...",
      "✍️ Гостримо олівець...",
      "🎨 Калібруємо кольори ручки...",
      "🔥 Розігріваємо двигуни перевірки...",
      "📖 Гортаємо стародавні словники...",
      "⚡ Викликаємо віртуального супер-вчителя...",
      "💥 Майже готово до магічного виправлення..."
    ],
    connectingStatus: "ВСТАНОВЛЕННЯ МАГІЧНОГО ЗВ'ЯЗКУ З ШІ-ВЧИТЕЛЕМ...",
    revising: "ПЕРЕВІРКА...",
    magicBadge: "МАГІЯ ЖИВОГО КОЛЬОРУ ТА АКАДЕМІЧНОГО ВИПРАВЛЕННЯ...",
    footerStatus: "Звіт про оцінювання з оцінками та порадами завантажиться незабаром",
    activeModel: "АКТИВНА МОДЕЛЬ",
    subtitle: "СТИЛЬ, ГРАМАТИКА ТА ОРФОГРАФІЯ ⚡",
    alchemyTitle: "⚡ АЛХІМІЯ СЛІВ ✨",
    bursts: ['БУМ!', 'ЗАП!', 'ВИПРАВЛЕНО!', 'СУПЕР!', 'МАГІЯ!', 'УХ ТИ!', 'БАХ!', 'ЧУДОВО!']
  },
  ru: {
    headerBadge: "ЖИВОЙ ОТЗЫВ! 🚀",
    subheading: "✍️ ПРОВЕРКА СЛОВО ЗА СЛОВОМ...",
    connectingOverlay: [
      "🧠 Соединяем нейроны...",
      "✍️ Точим карандаш...",
      "🎨 Настраиваем цвета чернил...",
      "🔥 Разогреваем моторы проверки...",
      "📖 Листаем древние словари...",
      "⚡ Вызываем виртуального супер-учителя...",
      "💥 Почти готово к магическому исправлению..."
    ],
    connectingStatus: "УСТАНОВКА МАГИЧЕСКОЙ СВЯЗИ С ИИ-УЧИТЕЛЕМ...",
    revising: "ПРОВЕРКА...",
    magicBadge: "МАГИЯ ЖИВОГО ЦВЕТА И АКАДЕМИЧЕСКОГО ИСПРАВЛЕНИЯ...",
    footerStatus: "Отчет по оценкам и советам загрузится в ближайшее время",
    activeModel: "АКТИВНАЯ МОДЕЛЬ",
    subtitle: "СТИЛЬ, ГРАММАТИКА И ОРФОГРАФИЯ ⚡",
    alchemyTitle: "⚡ АЛХИМИЯ СЛОВ ✨",
    bursts: ['БУМ!', 'ЗАП!', 'ИСПРАВЛЕНО!', 'СУПЕР!', 'МАГИЯ!', 'ВАУ!', 'БАХ!', 'ОТЛИЧНО!']
  }
};

const getDeterministicOffset = (id: string): number => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 100) / 100;
};

export const LiveCorrectionShow: React.FC<LiveCorrectionShowProps> = ({ streamedText }) => {
  const { language } = useLanguage();
  
  // Resolve localized texts with a fallback to catalog 'en' or 'es' if undefined
  const activeLang: Language = (language && language in localTranslations) ? language : 'es';
  const texts = localTranslations[activeLang];

  const [bursts, setBursts] = useState<Array<{ id: string; x: number; y: number; text: string; color: string }>>([]);
  const [warmupIndex, setWarmupIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setWarmupIndex((prev) => (prev + 1) % texts.connectingOverlay.length);
    }, 450);
    return () => clearInterval(interval);
  }, [texts.connectingOverlay.length]);

  // Track already-exploded tokens so we only play each explosion ONCE per token
  const explodedTokens = useRef<Set<string>>(new Set());

  // Parse tokens on the fly
  const tokens = React.useMemo(() => {
    let correctionSection = '';
    const startIdx = streamedText.indexOf('===CORRECTION===');
    if (startIdx !== -1) {
      const endIdx = streamedText.indexOf('===JSON===');
      if (endIdx !== -1) {
        correctionSection = streamedText.slice(startIdx + '===CORRECTION==='.length, endIdx);
      } else {
        correctionSection = streamedText.slice(startIdx + '===CORRECTION==='.length);
      }
    } else {
      const endIdx = streamedText.indexOf('===JSON===');
      if (endIdx !== -1) {
        correctionSection = streamedText.slice(0, endIdx);
      } else {
        correctionSection = streamedText;
      }
    }

    const parsedTokens: StreamToken[] = [];
    let remaining = correctionSection;
    let index = 0;

    while (remaining.length > 0) {
      remaining = remaining.trimStart();
      if (remaining.length === 0) break;

      // Look for error block starting with [ERROR:
      if (remaining.startsWith('[ERROR:')) {
        const endBracIdx = remaining.indexOf(']');
        if (endBracIdx !== -1) {
          const errorContent = remaining.slice('[ERROR:'.length, endBracIdx);
          const arrowIdx = errorContent.indexOf('->');
          
          if (arrowIdx !== -1) {
            const original = errorContent.slice(0, arrowIdx).trim();
            const corrected = errorContent.slice(arrowIdx + 2).trim();
            parsedTokens.push({
              id: `err-${index}-${original}`,
              type: 'error',
              word: corrected,
              original,
              corrected,
              isIncomplete: false
            });
          } else {
            const original = errorContent.trim();
            parsedTokens.push({
              id: `err-${index}-${original}`,
              type: 'error',
              word: original,
              original,
              isIncomplete: true
            });
          }
          remaining = remaining.slice(endBracIdx + 1);
        } else {
          // Unclosed [ERROR:... block
          const errorContent = remaining.slice('[ERROR:'.length);
          const arrowIdx = errorContent.indexOf('->');
          if (arrowIdx !== -1) {
            const original = errorContent.slice(0, arrowIdx).trim();
            const corrected = errorContent.slice(arrowIdx + 2).trim();
            parsedTokens.push({
              id: `err-${index}-${original}`,
              type: 'error',
              word: corrected || original,
              original,
              corrected: corrected || undefined,
              isIncomplete: true
            });
          } else {
            const original = errorContent.trim();
            parsedTokens.push({
              id: `err-${index}-${original}`,
              type: 'error',
              word: original,
              original,
              isIncomplete: true
            });
          }
          break; 
        }
      } else {
        const nextSpaceIdx = remaining.search(/\s/);
        const nextErrorIdx = remaining.indexOf('[ERROR:');
        
        let wordLength = remaining.length;
        if (nextSpaceIdx !== -1 && nextErrorIdx !== -1) {
          wordLength = Math.min(nextSpaceIdx, nextErrorIdx);
        } else if (nextSpaceIdx !== -1) {
          wordLength = nextSpaceIdx;
        } else if (nextErrorIdx !== -1) {
          wordLength = nextErrorIdx;
        }

        const word = remaining.slice(0, wordLength);
        if (word) {
          parsedTokens.push({
            id: `word-${index}-${word}`,
            type: 'word',
            word
          });
        }
        remaining = remaining.slice(wordLength);
      }
      index++;
    }

    return parsedTokens;
  }, [streamedText]);

  useEffect(() => {
    // Trigger visual bursts for newly resolved complete error tokens
    tokens.forEach((token) => {
      if (token.type === 'error' && !token.isIncomplete && token.corrected && !explodedTokens.current.has(token.id)) {
        explodedTokens.current.add(token.id);
        
        // Trigger a premium cartoon burst
        const randomX = (Math.random() - 0.5) * 160;
        const randomY = -40 - Math.random() * 40;
        
        const text = texts.bursts[Math.floor(Math.random() * texts.bursts.length)];
        const burstColors = ['bg-pop-yellow', 'bg-pop-pink', 'bg-pop-blue', 'bg-pop-green', 'bg-pop-purple'];
        const color = burstColors[Math.floor(Math.random() * burstColors.length)];
        
        const burstId = `burst-${token.id}-${Date.now()}`;
        setBursts(prev => [...prev, { id: burstId, x: randomX, y: randomY, text, color }]);
        
        // Auto remove burst
        setTimeout(() => {
          setBursts(prev => prev.filter(b => b.id !== burstId));
        }, 1200);
      }
    });
  }, [tokens, texts.bursts]);

  // Viewport window of last words to keep "un fil de la frase" looking dynamic and readable
  const displayedTokens = tokens.slice(-8);

  return (
    <div id="live-correction-viewport" className="fixed inset-0 z-50 bg-pop-yellow/15 flex flex-col items-center justify-center overflow-hidden p-3 sm:p-6 md:p-10">
      
      {/* Decorative Floating Stationary Items to set the ultimate classroom vibe */}
      <motion.div 
        animate={{ y: [0, -12, 0], rotate: [0, 10, -10, 0] }}
        transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
        className="absolute top-10 right-10 hidden lg:block bg-pop-green text-pop-dark border-3 border-pop-dark p-3.5 rounded-2xl shadow-neo"
      >
        <PenTool size={28} strokeWidth={3} />
      </motion.div>

      <motion.div 
        animate={{ y: [0, 15, 0], rotate: [12, -8, 12] }}
        transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut" }}
        className="absolute bottom-16 left-10 hidden lg:block bg-pop-pink text-white border-3 border-pop-dark p-3.5 rounded-2xl shadow-neo"
      >
        <Eraser size={28} strokeWidth={3} />
      </motion.div>

      <motion.div 
        animate={{ scale: [1, 1.15, 1], rotate: [0, 360] }}
        transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
        className="absolute top-24 left-16 hidden lg:block bg-pop-yellow text-pop-dark border-3 border-pop-dark p-3.5 rounded-2xl shadow-neo"
      >
        <Star size={24} strokeWidth={3} fill="currentColor" />
      </motion.div>

      <motion.div 
        animate={{ y: [-10, 10, -10] }}
        transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}
        className="absolute bottom-24 right-16 hidden lg:block bg-pop-blue text-white border-3 border-pop-dark p-3.5 rounded-2xl shadow-neo"
      >
        <Lightbulb size={24} strokeWidth={3} className="animate-pulse" />
      </motion.div>

      {/* Book binder card container */}
      <div 
        className="w-full max-w-5xl h-[85vh] md:h-[75vh] bg-[#FFFDF9] border-8 border-pop-dark rounded-[3rem] shadow-[20px_20px_0px_0px_rgba(42,39,37,1)] relative overflow-hidden flex flex-col justify-between p-6 md:p-10 select-none border-t-[12px]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.08) 2px, transparent 2px)
          `,
          backgroundSize: '100% 3.5rem'
        }}
      >
        {/* Metal notebook continuous wire bindings on left side margin */}
        <div className="absolute left-4 top-0 bottom-0 flex flex-col justify-around pointer-events-none w-10 z-20">
          {[...Array(14)].map((_, i) => (
            <div key={i} className="relative flex items-center justify-center">
              {/* Binder loop paper cut indicator */}
              <div className="absolute left-1 w-3 h-3 bg-pop-dark/15 rounded-full" />
              {/* Wire Ring element */}
              <div 
                className="w-8 h-4 bg-gradient-to-r from-gray-400 via-gray-100 to-gray-500 border-[3px] border-pop-dark rounded-full shadow-md transform -rotate-12"
                style={{ marginLeft: '-4px' }}
              />
            </div>
          ))}
        </div>

        {/* Notebook Vertical Margin Line */}
        <div className="absolute left-20 top-0 bottom-0 w-[4px] bg-red-400 opacity-70 pointer-events-none" />

        {/* Header bar designed like a school banner */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b-[5px] border-pop-dark pb-6 ml-16 relative z-10">
          <div className="text-left">
            <h2 className="text-3xl font-black text-pop-dark uppercase tracking-tight flex items-center gap-2">
              <span>{texts.headerBadge.replace(' 🚀', '')}</span>
              <Flame size={28} className="text-pop-pink animate-bounce" fill="currentColor" />
            </h2>
            <p className="text-gray-500 text-sm font-black uppercase tracking-wider mt-0.5">{texts.subtitle}</p>
          </div>
          
          <div className="bg-pop-purple text-white border-3 border-pop-dark px-5 py-2 rounded-2xl font-black text-xs tracking-wider shadow-neo rotate-[1.5deg] uppercase">
            {texts.activeModel}: <span className="text-pop-yellow font-black">GEMINI 2.5 PRO</span>
          </div>
        </div>

        {/* Central dynamic presentation view area */}
        <div className="flex-1 flex flex-col items-center justify-center relative ml-16 py-10 z-10 w-auto">
          <div className="bg-pop-dark text-white border-3 border-pop-dark px-4 py-1.5 rounded-xl text-[10px] font-black tracking-[0.2em] uppercase mb-8 shadow-neo-sm">
            {texts.alchemyTitle}
          </div>

          {/* Typewriter active row container */}
          <div 
            className="w-full min-h-[14rem] flex flex-wrap gap-x-5 gap-y-4 items-center justify-center px-6 relative z-10 py-6"
          >
            {tokens.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center max-w-md space-y-6 animate-pop-in">
                {/* Massive funny rotating sticker */}
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
                  className="w-20 h-20 bg-pop-pink border-4 border-pop-dark rounded-full shadow-neo flex items-center justify-center text-white relative"
                >
                  <Sparkles size={36} className="animate-pulse" />
                  <div className="absolute -bottom-2 -right-2 bg-pop-yellow text-pop-dark border-2 border-pop-dark rounded-md px-1 py-0.5 text-[8px] font-black rotate-12">GO!</div>
                </motion.div>
                
                {/* Dynamic funny scrolling message */}
                <div className="space-y-3">
                  <AnimatePresence mode="wait">
                    <motion.div 
                      key={warmupIndex}
                      initial={{ opacity: 0, scale: 0.8, y: 15 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.8, y: -15 }}
                      transition={{ type: "spring", stiffness: 350, damping: 15 }}
                      className="bg-pop-yellow text-pop-dark border-3 border-pop-dark px-6 py-3 rounded-2xl font-black text-lg md:text-xl shadow-neo rotate-[-1.5deg]"
                    >
                      {texts.connectingOverlay[warmupIndex]}
                    </motion.div>
                  </AnimatePresence>
                  <p className="text-gray-400 text-xs font-black uppercase tracking-widest animate-pulse">
                    {texts.connectingStatus}
                  </p>
                </div>
              </div>
            ) : (
              <AnimatePresence mode="popLayout" initial={false}>
                {displayedTokens.map((token) => {
                  const isError = token.type === 'error';
                  
                  if (isError && token.corrected) {
                    return (
                      <motion.div
                        key={token.id}
                        initial={{ opacity: 0, scale: 0, y: 50 }}
                        animate={{ 
                          opacity: 1, 
                          scale: [1, 1.25, 1],
                          y: [0, -4, 4, 0],
                          rotate: [0, -3, 3, -3, 0]
                        }}
                        exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                        transition={{ 
                          scale: { duration: 0.45 },
                          y: { repeat: Infinity, duration: 2.2, ease: "easeInOut" },
                          rotate: { repeat: Infinity, duration: 2.8, ease: "easeInOut" },
                          default: { type: 'spring', stiffness: 420, damping: 16 }
                        }}
                        className="flex flex-col items-center relative py-1 shrink-0 z-20"
                      >
                        {/* Original faulty word marked with felt-marker cross line */}
                        <span className="text-red-500 text-xs font-black uppercase font-sans tracking-wide line-through decoration-red-600 decoration-[3px] mb-1.5 bg-red-50 px-2 py-0.5 rounded-lg border-2 border-red-200">
                          {token.original}
                        </span>
                        
                        {/* Magnificent corrected comic word bubble */}
                        <motion.span
                          animate={{ 
                            scale: [1, 1.05, 0.98, 1.02, 1],
                            rotate: [-1.5, 1.5, -1.5]
                          }}
                          transition={{ 
                            repeat: Infinity,
                            duration: 3, 
                            ease: "easeInOut"
                          }}
                          className="text-pop-dark text-3xl md:text-5xl font-black font-sans tracking-tight px-4.5 py-2.5 rounded-[1.5rem] bg-pop-green border-4 border-pop-dark shadow-[6px_6px_0px_0px_rgba(42,39,37,1)] relative"
                        >
                          {token.corrected}
                        </motion.span>
                      </motion.div>
                    );
                  }

                  if (isError && token.isIncomplete) {
                    return (
                      <motion.div
                        key={token.id}
                        initial={{ opacity: 0 }}
                        animate={{ 
                          opacity: [0.6, 1, 0.6],
                          scale: [0.96, 1.04, 0.96],
                          rotate: [-2, 2, -2],
                          y: [0, -5, 0]
                        }}
                        transition={{ 
                          repeat: Infinity, 
                          duration: 1.5,
                          ease: "easeInOut"
                        }}
                        className="flex flex-col items-center shrink-0"
                      >
                        <span className="text-pop-purple text-[10px] font-black uppercase tracking-widest mb-1.5 animate-pulse">{texts.revising}</span>
                        <span className="text-pop-pink text-3xl md:text-5xl font-black tracking-tight font-sans italic px-3.5 py-1.5 bg-pop-pink/10 border-3 border-dashed border-pop-pink rounded-2xl">
                          {token.original}...
                        </span>
                      </motion.div>
                    );
                  }

                  // Standard legible neobrutalist typographic word (with continuous lively wave / wiggling movement!)
                  return (
                    <motion.span
                      key={token.id}
                      initial={{ opacity: 0, scale: 0.75, x: 30 }}
                      animate={{ 
                        opacity: 1, 
                        scale: 1, 
                        x: 0,
                        y: [0, -4, 4, 0],
                        rotate: [0, -2, 2, 0]
                      }}
                      exit={{ opacity: 0, scale: 0.5, x: -30, transition: { duration: 0.2 } }}
                      transition={{ 
                        y: { repeat: Infinity, duration: 1.8 + (getDeterministicOffset(token.id) * 0.8), ease: "easeInOut" },
                        rotate: { repeat: Infinity, duration: 2.2 + (getDeterministicOffset(token.id) * 0.8), ease: "easeInOut" },
                        default: { type: 'spring', stiffness: 320, damping: 20 }
                      }}
                      className="text-pop-dark text-3xl md:text-5xl font-black tracking-tight font-sans"
                      style={{
                        textShadow: '2px 2px 0px rgba(255,255,255,1)'
                      }}
                    >
                      {token.word}
                    </motion.span>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* Giant explosive cartoon speech balloons that bounce and fade */}
        <AnimatePresence>
          {bursts.map((burst) => (
            <motion.div
              key={burst.id}
              initial={{ scale: 0.1, rotate: -30, opacity: 0 }}
              animate={{ 
                scale: [0.1, 1.5, 1.3], 
                rotate: [0, -15, 20, 10],
                opacity: 1 
              }}
              exit={{ scale: 0.4, opacity: 0, y: -80 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{
                position: 'absolute',
                top: '55%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                marginTop: burst.y,
                marginLeft: burst.x,
              }}
              className="z-50 pointer-events-none"
            >
              <div 
                className={`${burst.color} text-pop-dark border-4 border-pop-dark px-6 py-3 rounded-2xl font-black text-2xl md:text-4xl shadow-neo uppercase tracking-tighter shrink-0 select-none animate-bounce`}
                style={{
                  fontFamily: '"Space Grotesk", sans-serif',
                  textShadow: '2px 2px 0 #fff'
                }}
              >
                💥 {burst.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Footer info banner */}
        <div className="ml-16 flex flex-col items-center gap-2 relative z-10 mt-auto border-t-[3px] border-dashed border-pop-dark/20 pt-6">
          <div className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-pop-yellow border-3 border-pop-dark text-pop-dark text-xs sm:text-sm font-black shadow-neo rotate-[-1deg] animate-bounce-slow">
            <Sparkles size={18} className="text-pop-dark animate-spin" />
            <span>{texts.magicBadge}</span>
          </div>
          <div className="text-[10px] font-black text-pop-dark/40 tracking-[0.15em] uppercase mt-1">
            {texts.footerStatus}
          </div>
        </div>
      </div>
    </div>
  );
};
