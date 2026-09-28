import React, { useState, useRef, useEffect } from 'react';
import { Camera, Search, AlertTriangle, Check, Lightbulb, Book, X, Trophy, ArrowRight, RotateCcw, ScanLine, Sparkles, MessageCircle, Download, Share2, Quote } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { callGemini } from '../services/apiService';
import { LANGUAGE_NAMES } from '../constants/languages';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import confetti from 'canvas-confetti';
import { generatePdf } from '../lib/pdf';
import { getQuotesByLanguage } from '../constants/quotes';
import { StorageService, StorageKey } from '../services/storageService';

type GameState = 'intro' | 'scanning' | 'analyzing' | 'playing' | 'solved';

interface WordSegment {
  id: number;
  text: string;
  isMistake: boolean;
  correction?: string;
  type?: 'barbarism' | 'accent' | 'grammar' | 'spelling' | 'other';
  hint?: string;
  rule?: string;
  solved?: boolean;
}

import PremiumModal from '../components/PremiumModal';


const SmartRewrite: React.FC = () => {
  const { t, language, addXp, user, checkUsage, incrementUsage } = useLanguage();
  const quotes = getQuotesByLanguage(language);
  const navigate = useNavigate();
  const [state, setState] = useState<GameState>('intro');
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [segments, setSegments] = useState<WordSegment[]>([]);
  const [selectedMistake, setSelectedMistake] = useState<WordSegment | null>(null);
  const [userInput, setUserInput] = useState('');
  const [feedbackMsg, setFeedbackMsg] = useState<'success' | 'error' | null>(null);
  
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [mistakesFound, setMistakesFound] = useState(0);
  const [mistakesSolved, setMistakesSolved] = useState(0);
  const [authorName, setAuthorName] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0);
  const [error, setError] = useState<React.ReactNode | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === 'analyzing') {
      setCurrentQuoteIndex(Math.floor(Math.random() * quotes.length));
      interval = setInterval(() => {
        setCurrentQuoteIndex(prev => (prev + 1) % quotes.length);
      }, 4000);
    }
    return () => clearInterval(interval);
  }, [state, quotes.length]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === 'analyzing') {
      setAnalysisProgress(0);
      // Target ~60 seconds to reach 95%
      interval = setInterval(() => {
        setAnalysisProgress(prev => {
          if (prev < 95) return prev + 1;
          return prev;
        });
      }, 600);
    }
    return () => clearInterval(interval);
  }, [state]);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // --- Actions ---

  const triggerCamera = () => {
    fileInputRef.current?.click();
  };

  // --- Utilities ---

  const resizeImage = (base64Str: string, maxSize = 1600): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
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
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
    });
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const originalBase64 = reader.result as string;
        setImageSrc(originalBase64); // Show original immediately
        setState('analyzing');
        setError(null);
        
        // Optimize before sending to AI
        try {
            const optimizedBase64 = await resizeImage(originalBase64);
            performAnalysis(optimizedBase64);
        } catch (e) {
            console.error("Optimization failed, using original", e);
            if (originalBase64.length > 1_500_000) {
               setError(t('errors.imageTooLarge'));
               setState('intro');
               return;
            }
            performAnalysis(originalBase64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

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
          const fixedCommas = cleaned.replace(/}\s*{/g, '},{');
          try {
            return JSON.parse(fixedCommas);
          } catch (e3) {
            try {
              return JSON.parse(fixedCommas + ']}');
            } catch (e4) {
              try {
                return JSON.parse(fixedCommas + '}');
              } catch (e5) {
                throw new Error("Invalid JSON");
              }
            }
          }
        }
      }
      throw new Error("Invalid JSON");
    }
  };

  const performAnalysis = async (base64Image: string) => {
    try {
      let prompt = '';
      const langName = LANGUAGE_NAMES[language] || 'Catalan';

      prompt = `
        Act as a world-class spelling bee judge, forensic text analyst, and expert linguist in ${langName}. 
        Analyze the handwritten text in the image with extreme precision.
        
        CONTEXT: This is a "Spot the Mistake" game for students. The text contains INTENTIONAL errors.
        YOUR MISSION: Identify EVERY SINGLE spelling, grammar, punctuation, or accentuation error. 
        DO NOT MISS ANYTHING. Even a missing accent or a wrong capitalization is a mistake.
        
        CRITICAL Instructions:
        1. Transcribe the text EXACTLY as written in the image. DO NOT AUTO-CORRECT. If it says "extraya", write "extraya".
        2. Analyze word by word, character by character.
        3. If a word is misspelled, has a missing/wrong accent, or wrong capitalization, set "isMistake": true.
        4. Pay special attention to:
           - Accents (e.g., "pàgina" vs "pagina")
           - Capitalization (e.g., names, start of sentences)
           - Punctuation (e.g., missing dots, commas)
           - Common phonetic errors (e.g., "b" vs "v", "g" vs "j", "h" usage)
        5. CRITICAL: YOU MUST RETURN THE ENTIRE TEXT. To avoid JSON size errors, GROUP consecutive correct words (including spaces and punctuation) into a single segment with "isMistake": false. Mistakes should be in their own individual segment with "isMistake": true. DO NOT RETURN ONLY THE MISTAKES. The entire text must be exactly reconstructable by joining the "text" of the segments in order.
        6. IMPORTANT: The "hint" and "rule" fields MUST be written in ${langName}.
        7. SOCRATIC METHOD: The "hint" field MUST be a Socratic question that makes the student think about the solution instead of giving it away. (e.g., "How do we write the plural of this word?" or "Does this word need a silent letter?").
        
        Return JSON: 
        { "segments": [{ "text": "word_or_phrase", "isMistake": boolean, "correction": "correction", "type": "type", "hint": "socratic_question_in_${langName}", "rule": "brief_explanation_in_${langName}" }] }
        
        Error types ("type"): 'spelling', 'grammar', 'punctuation', 'accentuation', 'other'.
      `;

      const evaluationSchema = {
          type: "OBJECT",
          properties: {
              segments: {
                  type: "ARRAY",
                  items: {
                      type: "OBJECT",
                      properties: {
                          text: { type: "STRING" },
                          isMistake: { type: "BOOLEAN" },
                          correction: { type: "STRING" },
                          type: { type: "STRING" },
                          hint: { type: "STRING" },
                          rule: { type: "STRING" }
                      },
                      required: ["text", "isMistake"]
                  }
              }
          },
          required: ["segments"]
      };

      const response = await callGemini(
        'gemini-2.5-pro',
        [
          {
            parts: [
              { text: prompt },
              { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/jpeg' } }
            ]
          }
        ],
        undefined,
        { responseMimeType: 'application/json', responseSchema: evaluationSchema as any },
        user?.apiKey
      );

      let rawText = response.text || '{}';
      if (rawText.startsWith('```json')) {
        rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      } else if (rawText.startsWith('```')) {
        rawText = rawText.replace(/```/g, '').trim();
      }
      let result;
      
      try {
          result = parseRobustJson(rawText);
      } catch (e) {
          console.error("JSON Parse Error after all fix attempts", e);
          throw new Error("Invalid JSON from AI");
      }

      // Post-processing to catch common errors the AI might miss
      const commonErrors: Record<string, { correction: string, type: string, hint: string }> = {
          "extraya": { correction: "estranya", type: "barbarism", hint: "S'escriu amb 'ny' o amb 'y'?" },
          "escritori": { correction: "escriptori", type: "barbarism", hint: "Estàs segur que no li falta cap lletra abans de la 't'?" },
          "baca": { correction: "vaca", type: "spelling", hint: "L'animal que fa 'muuu' s'escriu amb 'b' o amb 'v'?" },
          "haber": { correction: "haver", type: "spelling", hint: "Aquest infinitiu s'escriu amb 'b' o amb 'v'?" },
          "barcu": { correction: "vaixell", type: "barbarism", hint: "Com diem 'barco' correctament en català?" },
          "bussón": { correction: "bústia", type: "barbarism", hint: "On deixem les cartes en català?" },
          "busson": { correction: "bústia", type: "barbarism", hint: "On deixem les cartes en català?" },
          "buçon": { correction: "bústia", type: "barbarism", hint: "On deixem les cartes en català?" },
          "buçón": { correction: "bústia", type: "barbarism", hint: "On deixem les cartes en català?" },
          "haver-hi": { correction: "haver-hi", type: "grammar", hint: "Com s'escriu correctament aquesta forma del verb haver?" },
          "as": { correction: "has", type: "spelling", hint: "Aquesta forma del verb haver porta alguna lletra muda al davant?" },
          "a": { correction: "ha", type: "spelling", hint: "Aquesta forma del verb haver porta alguna lletra muda al davant?" },
          "an": { correction: "han", type: "spelling", hint: "Aquesta forma del verb haver porta alguna lletra muda al davant?" },
          "hem": { correction: "hem", type: "spelling", hint: "Aquesta forma del verb haver porta alguna lletra muda al davant?" },
          "heu": { correction: "heu", type: "spelling", hint: "Aquesta forma del verb haver porta alguna lletra muda al davant?" },
          "i": { correction: "hi", type: "spelling", hint: "Quan parlem de llocs, aquesta lletra sol anar acompanyada d'una altra muda..." },
          "llum": { correction: "llum", type: "spelling", hint: "Recorda que en català 'llum' pot ser masculí o femení segons el sentit." }
      };

      if (result.segments) {
        const processedSegments = result.segments.map((s: any, idx: number) => {
            const lowerText = s.text.toLowerCase().replace(/[.,!?;:]/g, '').trim();
            
            // Force error detection for known cases
            if (commonErrors[lowerText]) {
                return {
                    ...s,
                    id: idx,
                    solved: false,
                    isMistake: true,
                    correction: commonErrors[lowerText].correction,
                    type: commonErrors[lowerText].type as any,
                    hint: commonErrors[lowerText].hint
                };
            }
            return { ...s, id: idx, solved: false };
        });
        
        setAnalysisProgress(100);
        setTimeout(() => {
          setSegments(processedSegments);
          setMistakesFound(processedSegments.filter((s: any) => s.isMistake).length);
          setState('playing');
          incrementUsage();
        }, 600);
      } else {
        console.error("No segments returned", result);
        setError(t('common.error') || "No s'ha pogut llegir el text correctament. Torna-ho a provar.");
        setState('intro');
      }

    } catch (error: any) {
      console.error("AI Error", error);
      if (error?.message === 'AI_QUOTA_EXCEEDED') {
          setError(t('errors.quota'));
      } else if (error?.message === 'AI_SERVER_OVERLOAD') {
          setError(t('errors.serverOverload'));
      } else {
          setError(t('common.error'));
      }
      setState('intro');
    }
  };

  const handleMistakeClick = (segment: WordSegment) => {
    if (!segment.isMistake || segment.solved) return;
    setSelectedMistake(segment);
    setUserInput('');
    setFeedbackMsg(null);
  };

  const checkCorrection = () => {
    if (!selectedMistake) return;

    // Robust normalization: remove all non-alphanumeric characters (keep accents for now, but maybe strip them if needed?)
    // Actually, for spelling games, accents matter! So we should keep letters/numbers but remove punctuation/spaces.
    const normalize = (str: string) => str.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

    const normalizedInput = normalize(userInput);
    const normalizedCorrection = normalize(selectedMistake.correction || '');

    if (normalizedInput === normalizedCorrection) {
      // Correct!
      setFeedbackMsg('success');
      
      // Update score and streak
      const newStreak = streak + 1;
      setStreak(newStreak);
      setScore(score + 10 + (newStreak > 2 ? 5 : 0)); // Bonus for streak
      
      if (newStreak === 3) {
         confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 }
         });
      }

      // Update segment state
      setSegments(prev => prev.map(s => s.id === selectedMistake.id ? { ...s, solved: true, text: s.correction || s.text } : s));
      setMistakesSolved(prev => prev + 1);

      setTimeout(() => {
        setSelectedMistake(null);
        if (mistakesSolved + 1 >= mistakesFound) {
           handleGameWin();
        }
      }, 800); // Faster transition (was 1500)

    } else {
      // Incorrect
      setFeedbackMsg('error');
      setStreak(0);
    }
  };

  const handleGameWin = () => {
      setState('solved');
      addXp(score + 50);
      confetti({
        particleCount: 200,
        spread: 100,
        origin: { y: 0.6 }
      });
  };

  const handleFinish = () => {
      navigate('/home');
  }

  const handleSave = () => {
    const originalText = segments.map(s => s.text).join('');
    const correctedText = segments.map(s => s.isMistake ? s.correction : s.text).join('');
    
    const newCorrection = {
      id: Date.now(),
      title: "Detectiu: " + originalText.slice(0, 20) + (originalText.length > 20 ? "..." : ""),
      date: new Date().toLocaleDateString(),
      score: mistakesFound > 0 ? Math.round((mistakesSolved / mistakesFound) * 10 * 10) / 10 : 10,
      original: originalText,
      corrected: correctedText,
      improved: correctedText,
      spellingMistakes: mistakesFound,
      level: 'detective',
      author: authorName || user?.name || '',
      fullScores: {
          accuracy: mistakesFound > 0 ? Math.round((mistakesSolved / mistakesFound) * 10) : 10
      },
      mode: 'detective',
      feedback: t('detective.caseSolved')
    };

    const saved = StorageService.getItem<any[]>(StorageKey.CORRECTIONS, []);
    StorageService.setItem(StorageKey.CORRECTIONS, [newCorrection, ...saved]);
    alert(t('common.saved') || "Guardat correctament!");
  };

  const handleDownloadReport = async () => {
    try {
      const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxLineWidth = pageWidth - (margin * 2);
      // Background color
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // Header Banner
      doc.setFillColor(124, 58, 237); // violet-600
      doc.rect(0, 0, pageWidth, 40, 'F');

      // Header Logo Textup!
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('TEXTUP!', pageWidth / 2, 15, { align: 'center' });

      // Header Text
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(t('pdf.detectiveReport') || 'INFORME DEL DETECTIU', pageWidth / 2, 25, { align: 'center' });

      const author = authorName || user?.name || '';
      if (author) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(221, 214, 254); // violet-200
        doc.text(`${t('pdf.author') || 'Autor/a:'} ${author}`, pageWidth / 2, 33, { align: 'center' });
      }
      
      let y = 50;

      // Draw text with underlined mistakes - Yellow theme
      doc.setFillColor(254, 240, 138); // yellow-200
      doc.roundedRect(margin, y - 6, pageWidth - (margin * 2), 10, 2, 2, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(133, 77, 14); // yellow-800
      doc.text(t('pdf.detectiveEvidence') || 'EVIDÈNCIA (Text Original)', margin + 3, y + 1);
      y += 10;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      
      let currentX = margin;
      const lineHeight = 6;
      
      segments.forEach(seg => {
        const words = seg.text.split(/(\s+)/);
        words.forEach(word => {
          if (!word) return;
          const wordWidth = doc.getTextWidth(word);
          if (currentX + wordWidth > pageWidth - margin) {
            currentX = margin;
            y += lineHeight;
            if (y > pageHeight - margin - 15) {
              doc.addPage();
              doc.setFillColor(248, 250, 252);
              doc.rect(0, 0, pageWidth, pageHeight, 'F');
              y = margin + 10;
            }
          }
          
          if (seg.isMistake) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(220, 38, 38); // red-600
            doc.text(word, currentX, y);
            // Underline
            doc.setDrawColor(220, 38, 38);
            doc.setLineWidth(0.5);
            doc.line(currentX, y + 1, currentX + wordWidth, y + 1);
            doc.setFont('helvetica', 'normal');
          } else {
            doc.setTextColor(51, 65, 85);
            doc.text(word, currentX, y);
          }
          currentX += wordWidth;
        });
      });
      
      y += 15;
      if (y > pageHeight - margin - 20) {
        doc.addPage();
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 0, pageWidth, pageHeight, 'F');
        y = margin + 10;
      }

      // Draw clues - Green theme
      doc.setFillColor(220, 252, 231); // green-100
      doc.roundedRect(margin, y - 6, pageWidth - (margin * 2), 10, 2, 2, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(22, 101, 52); // green-800
      doc.text(t('pdf.detectiveClues') || 'ERRORS I PISTES', margin + 3, y + 1);
      y += 8;

      const mistakes = segments.filter(s => s.isMistake);
      mistakes.forEach((mistake, index) => {
        const incorrectWord = mistake.text;
        const hintText = mistake.hint || mistake.rule || t('pdf.detectiveNoClue');
        
        // Calculate widths for side-by-side layout
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        const wordWidth = doc.getTextWidth(incorrectWord);
        
        // Left column (mistake only) takes up to 40mm or actual width
        const leftColWidth = Math.max(40, wordWidth + 5);
        const rightColWidth = (pageWidth - margin * 2) - leftColWidth - 15; // 15mm padding
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const splitHint = doc.splitTextToSize(`${t('pdf.detectiveClueLabel') || 'Pista:'} ${hintText}`, rightColWidth);
        
        const boxHeight = Math.max(12, (splitHint.length * 5) + 6);

        if (y + boxHeight > pageHeight - margin - 15) {
          doc.addPage();
          doc.setFillColor(248, 250, 252);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          y = margin + 10;
        }
        
        // Draw clue box
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(203, 213, 225); // slate-300
        doc.setLineWidth(0.5);
        doc.roundedRect(margin, y, pageWidth - (margin * 2), boxHeight, 3, 3, 'FD');

        // Vertical center alignment for single line items
        const textY = y + (boxHeight / 2) + 1.5;

        // Incorrect word (Red)
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(239, 68, 68); // red-500
        doc.text(incorrectWord, margin + 5, textY);

        // Hint (Slate) - Right column
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(71, 85, 105); // slate-600
        
        // If hint is multiple lines, adjust Y to center the block
        const hintStartY = y + (boxHeight - (splitHint.length * 5)) / 2 + 3.5;
        doc.text(splitHint, margin + 5 + leftColWidth + 5, hintStartY);

        y += boxHeight + 4;
      });

      // Footer
      const pageCount = (doc.internal as any).getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(124, 58, 237); // violet-600
        doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(`TEXTUP! - ${t('pdf.generatedOn') || 'Generat el'} ${new Date().toLocaleDateString()} - ${t('pdf.page') || 'Pàgina'} ${i}/${pageCount}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
      }

      const finalFilename = `textup_detectiu_${Date.now()}.pdf`;

      if (Capacitor.isNativePlatform()) {
        try {
          const base64 = doc.output('datauristring').split(',')[1];
          const savedFile = await Filesystem.writeFile({
            path: finalFilename,
            data: base64,
            directory: Directory.Cache
          });

          await Share.share({
            title: 'Informe del Detectiu',
            text: `Informe de correcció ortogràfica`,
            url: savedFile.uri,
            dialogTitle: t('common.shareReport') || 'Share PDF'
          });
          return;
        } catch (err) {
          console.error('Error sharing PDF natively:', err);
        }
      } else {
        // Try sharing on mobile if supported
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        
        if (isMobile && navigator.share && navigator.canShare) {
          try {
            const blob = doc.output('blob');
            const file = new File([blob], finalFilename, { type: 'application/pdf' });
            
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                files: [file],
                title: 'Informe del Detectiu',
                text: `Informe de correcció ortogràfica`,
              });
              return;
            }
          } catch (err: any) {
            console.error('Error sharing PDF', err);
            if (err.name === 'AbortError') {
              return;
            }
          }
        }
      }

      doc.save(finalFilename);
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert(t('common.error') || `Could not generate PDF: ${(error as Error).message || 'Unknown error'}`);
    }
  };

  // --- Views ---

  if (state === 'intro') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-8 text-center animate-slide-up px-4">
        <PremiumModal isOpen={showPremiumModal} onClose={() => setShowPremiumModal(false)} />
        {error && (
            <div className="w-full max-w-md bg-red-100 text-red-700 p-4 rounded-2xl font-bold text-center border-3 border-pop-dark shadow-neo mb-4">
              {error}
            </div>
        )}
        <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
        
        <div className="relative cursor-pointer group" onClick={triggerCamera}>
             <div className="absolute inset-0 bg-pop-dark rounded-full translate-x-3 translate-y-3 group-hover:translate-x-4 group-hover:translate-y-4 transition-transform"></div>
             <div className="relative w-48 h-48 bg-pop-yellow rounded-full border-4 border-pop-dark flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[repeating-conic-gradient(#fef9c3_0_20deg,transparent_20deg_40deg)] opacity-30 animate-spin-slow"></div>
                <Search size={80} strokeWidth={3} className="text-pop-dark relative z-10" />
             </div>
        </div>

        <div className="space-y-4 max-w-xs">
           <h2 className="text-4xl font-black text-pop-dark uppercase italic tracking-tight leading-none">
             {t('detective.title')}
           </h2>
           <p className="text-gray-600 font-bold text-lg leading-tight">
             {t('detective.desc')}
           </p>
        </div>

        <button onClick={triggerCamera} className="w-full max-w-xs bg-pop-dark text-white font-black text-xl py-4 rounded-2xl border-3 border-pop-dark shadow-neo btn-press flex items-center justify-center gap-3">
           <Camera size={24} strokeWidth={3} />
           <span>{t('detective.startBtn')}</span>
        </button>
      </div>
    );
  }

  if (state === 'analyzing') {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 text-center animate-pop-in px-6">
             <div className="relative">
                <div className="absolute inset-0 bg-pop-yellow blur-xl opacity-50 animate-pulse"></div>
                <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center relative border-3 border-pop-dark shadow-neo animate-spin-slow">
                    <Search size={48} className="text-pop-dark" strokeWidth={3} />
                </div>
            </div>
            
            <div className="w-full max-w-xs space-y-4">
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-pop-dark uppercase tracking-tight">{t('detective.analyzing')}</h3>
                <p className="text-gray-500 font-bold animate-pulse">
                  {t('detective.analyzingSubtitle')}
                </p>
              </div>
              
              {/* Progress Bar */}
              <div className="relative h-6 bg-gray-100 rounded-full border-3 border-pop-dark overflow-hidden shadow-neo-sm">
                <div 
                  className="absolute inset-y-0 left-0 bg-pop-yellow transition-all duration-500 ease-out"
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
                  ”” {quotes[currentQuoteIndex].author}
                </p>
              </div>
            </div>
        </div>
      );
  }

  if (state === 'playing') {
      return (
          <div className="flex flex-col h-full gap-4 pb-20 animate-fade-in">
              {/* Header Stats */}
              <div className="flex items-center justify-between bg-white p-3 rounded-2xl border-3 border-pop-dark shadow-sm">
                  <div className="flex items-center gap-2">
                      <div className="bg-pop-yellow p-2 rounded-lg border-2 border-pop-dark">
                          <Trophy size={20} className="text-pop-dark" strokeWidth={3} />
                      </div>
                      <div>
                          <p className="text-[10px] font-black uppercase text-gray-400">{t('detective.score')}</p>
                          <p className="text-xl font-black text-pop-dark leading-none">{score}</p>
                      </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                      <div className="text-right">
                          <p className="text-[10px] font-black uppercase text-gray-400">{t('detective.cases')}</p>
                          <p className="text-sm font-black text-pop-dark leading-none">{mistakesSolved} / {mistakesFound}</p>
                      </div>
                      <div className="w-10 h-10 rounded-full border-3 border-pop-dark flex items-center justify-center bg-gray-100 overflow-hidden relative">
                           <div className="absolute bottom-0 left-0 right-0 bg-pop-green transition-all duration-500" style={{ height: `${mistakesFound > 0 ? (mistakesSolved / mistakesFound) * 100 : 0}%` }}></div>
                           <span className="relative z-10 text-xs font-black">{mistakesFound > 0 ? Math.round((mistakesSolved / mistakesFound) * 100) : 0}%</span>
                      </div>
                  </div>
              </div>

              <div className="px-2 opacity-60 hover:opacity-100 transition-opacity">
                  <input 
                      type="text" 
                      value={authorName} 
                      onChange={(e) => setAuthorName(e.target.value)} 
                      placeholder={t('aiCorrection.authorPlaceholder')} 
                      className="w-full bg-transparent border-none focus:outline-none text-xs font-bold text-gray-400 placeholder:text-gray-200"
                  />
              </div>
              
              {/* Text Area */}
              <div className="flex-1 bg-white rounded-3xl border-3 border-pop-dark p-6 shadow-neo relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-4 bg-gray-100 border-b-2 border-dashed border-gray-300"></div>
                   {mistakesFound === 0 ? (
                       <div className="flex-1 flex flex-col items-center justify-center text-center p-4 animate-fade-in">
                           <div className="bg-pop-green/20 p-4 rounded-full mb-4">
                               <Check size={48} className="text-pop-green" strokeWidth={3} />
                           </div>
                           <h3 className="text-xl font-black text-pop-dark uppercase mb-2">{t('detective.noMistakesTitle')}</h3>
                           <p className="text-gray-600 font-medium mb-6">{t('detective.noMistakesDesc')}</p>
                           <button 
                                onClick={() => setState('intro')}
                                className="bg-pop-dark text-white px-6 py-3 rounded-xl font-bold shadow-sm hover:scale-105 transition-transform flex items-center gap-2"
                           >
                               <RotateCcw size={18} />
                               <span>{t('common.tryAgain')}</span>
                           </button>
                       </div>
                   ) : (
                       <div className="flex flex-wrap gap-x-1.5 gap-y-3 leading-relaxed text-xl font-medium mt-2 overflow-y-auto">
                       {segments.map((seg) => (
                           <span 
                                key={seg.id}
                                onClick={() => handleMistakeClick(seg)}
                                className={`
                                    relative px-1 rounded-md transition-all duration-300 cursor-default
                                    ${seg.isMistake && !seg.solved ? 'cursor-pointer animate-pulse-fast hover:scale-110' : ''}
                                    ${seg.isMistake && !seg.solved ? 'bg-pop-pink/20 text-pop-pink decoration-wavy underline decoration-2 decoration-pop-pink' : 'text-pop-dark'}
                                    ${seg.solved ? 'text-pop-green font-bold bg-pop-green/10' : ''}
                                `}
                           >
                               {seg.text}
                               {seg.isMistake && !seg.solved && (
                                   <span className="absolute -top-3 -right-2 text-[10px]">??</span>
                               )}
                           </span>
                       ))}
                       </div>
                   )}
              </div>

              <button 
                onClick={handleDownloadReport}
                className="w-full bg-white text-pop-dark font-black text-lg py-3 rounded-2xl border-3 border-pop-dark shadow-sm flex items-center justify-center gap-2 transition-all hover:bg-gray-50 active:scale-[0.98] mb-4"
              >
                {isMobile ? <Share2 size={20} strokeWidth={3} /> : <Download size={20} strokeWidth={3} />}
                <span>{isMobile ? t('common.shareReport') : t('common.downloadPdf')}</span>
              </button>

              {/* Interaction Area (Bubble) */}
              {selectedMistake && (
                  <div className="fixed inset-x-0 bottom-0 z-50 p-4 animate-slide-up">
                      <div className="relative">
                          {/* Comic Bubble Tail */}
                          <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-6 h-6 bg-white border-l-3 border-t-3 border-pop-dark transform rotate-45 z-0"></div>
                          
                          <div className="relative bg-white rounded-3xl border-3 border-pop-dark p-5 shadow-neo-lg z-10 flex flex-col gap-4">
                              <div className="flex justify-between items-start">
                                  <div className="flex items-center gap-3">
                                      <div className="w-12 h-12 bg-pop-blue rounded-full border-3 border-pop-dark flex items-center justify-center shrink-0">
                                          <MessageCircle size={24} className="text-white" strokeWidth={3} />
                                      </div>
                                      <div>
                                          <span className="bg-pop-purple text-white text-[10px] font-black uppercase px-2 py-0.5 rounded-full border-2 border-pop-dark">
                                              {t(`detective.types.${selectedMistake.type || 'other'}`)}
                                          </span>
                                          <p className="font-bold text-pop-dark mt-1 leading-tight">{selectedMistake.hint || selectedMistake.rule || t('pdf.detectiveNoClue')}</p>
                                      </div>
                                  </div>
                                  <button onClick={() => setSelectedMistake(null)} className="text-gray-400 hover:text-pop-dark">
                                      <X size={24} strokeWidth={3} />
                                  </button>
                              </div>

                              {feedbackMsg !== 'success' && (
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        value={userInput}
                                        onChange={(e) => setUserInput(e.target.value)}
                                        placeholder={t('detective.inputPlaceholder')}
                                        className={`flex-1 bg-gray-50 border-3 ${feedbackMsg === 'error' ? 'border-pop-pink bg-pink-50' : 'border-gray-200'} rounded-xl px-4 py-3 font-bold text-pop-dark outline-none focus:border-pop-blue transition-all`}
                                        autoFocus
                                    />
                                    <button 
                                        onClick={checkCorrection}
                                        className="bg-pop-dark text-white p-3 rounded-xl border-3 border-pop-dark shadow-sm active:translate-y-1 active:shadow-none transition-all"
                                    >
                                        <ArrowRight size={24} strokeWidth={3} />
                                    </button>
                                </div>
                              )}

                              {feedbackMsg === 'error' && (
                                  <div className="flex items-center gap-2 text-pop-pink font-black text-xs uppercase animate-shake">
                                      <AlertTriangle size={14} />
                                      <span>{t('detective.tryAgain')}</span>
                                  </div>
                              )}
                              
                              {feedbackMsg === 'success' && (
                                  <div className="bg-pop-green/20 p-3 rounded-xl border-2 border-pop-green flex items-center gap-3 animate-pop-in">
                                      <div className="bg-pop-green p-1 rounded-full text-white">
                                          <Check size={16} strokeWidth={4} />
                                      </div>
                                      <div>
                                          <p className="font-black text-pop-dark text-sm uppercase">{t('detective.correct')}</p>
                                          {selectedMistake.rule && <p className="text-xs text-pop-dark leading-tight mt-0.5">{selectedMistake.rule}</p>}
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              )}

              {/* Streak Indicator */}
              {streak > 1 && (
                  <div className="fixed top-20 right-4 z-40 animate-pop-in">
                      <div className="bg-pop-orange text-white font-black px-3 py-1 rounded-full border-3 border-pop-dark shadow-neo transform rotate-6 flex items-center gap-1">
                          <Sparkles size={16} fill="white" />
                          <span>{streak} {t('detective.streak')}!</span>
                      </div>
                  </div>
              )}
          </div>
      );
  }

  if (state === 'solved') {
      return (
          <div className="flex flex-col items-center justify-center min-h-[80vh] gap-6 text-center animate-slide-up px-6">
              <div className="relative">
                  <div className="absolute inset-0 bg-pop-green blur-2xl opacity-50 animate-pulse"></div>
                  <div className="w-32 h-32 bg-white rounded-full border-4 border-pop-dark flex items-center justify-center relative shadow-neo-lg mb-4">
                      <Trophy size={64} className="text-pop-yellow fill-pop-yellow" strokeWidth={3} />
                  </div>
              </div>
              
              <h2 className="text-4xl font-black text-pop-dark uppercase italic tracking-tight">{t('detective.caseSolved')}</h2>
              <p className="text-gray-600 font-bold text-lg">{t('detective.solvedDesc')}</p>
              
              <div className="bg-white p-6 rounded-3xl border-3 border-pop-dark shadow-neo w-full max-w-sm mt-4">
                   <p className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">{t('detective.finalScore')}</p>
                   <p className="text-6xl font-black text-pop-dark">{score}</p>
                   <div className="flex justify-center gap-1 mt-4">
                       <Sparkles size={24} className="text-pop-yellow fill-pop-yellow animate-bounce" style={{ animationDelay: '0ms' }} />
                       <Sparkles size={24} className="text-pop-yellow fill-pop-yellow animate-bounce" style={{ animationDelay: '200ms' }} />
                       <Sparkles size={24} className="text-pop-yellow fill-pop-yellow animate-bounce" style={{ animationDelay: '400ms' }} />
                   </div>
              </div>

              {/* Show the evaluation table / Mistakes */}
              <div className="w-full max-w-sm bg-white p-5 rounded-3xl border-3 border-pop-dark shadow-neo text-left max-h-64 overflow-y-auto mt-2">
                   <h3 className="text-lg font-black text-pop-dark uppercase tracking-tight mb-4 border-b-2 border-gray-100 pb-2">{t('pdf.detectiveEvidence') || 'Evidències Trobades'}</h3>
                   <div className="flex flex-col gap-3">
                       {segments.filter(s => s.isMistake).map((m, i) => (
                           <div key={i} className="flex flex-col border border-gray-100 p-3 rounded-xl bg-gray-50">
                               <div className="flex justify-between items-center mb-1">
                                    <span className="font-black text-pop-pink line-through text-lg">{m.text}</span>
                                    <span className="font-black text-pop-green text-lg">{m.correction}</span>
                               </div>
                               <p className="text-xs font-bold text-gray-500 uppercase tracking-widest bg-gray-200 inline-block px-2 py-0.5 rounded-md self-start mb-1">{t(`detective.types.${m.type || 'other'}`)}</p>
                               <p className="text-sm font-bold text-pop-dark mt-1 leading-tight">{m.rule}</p>
                           </div>
                       ))}
                       {segments.filter(s => s.isMistake).length === 0 && (
                           <p className="text-sm text-gray-500 italic text-center">{t('detective.noMistakesDesc') || 'Sense errors trobats.'}</p>
                       )}
                   </div>
              </div>

              <div className="flex flex-col gap-3 w-full max-w-sm mt-4">
                <button onClick={handleSave} className="w-full bg-pop-green text-pop-dark font-black text-xl py-4 rounded-2xl border-3 border-pop-dark shadow-neo btn-press flex items-center justify-center gap-2">
                    <Check size={24} strokeWidth={3} />
                    <span>{t('aiCorrection.saveBtn') || "Guardar"}</span>
                </button>
                <button onClick={handleFinish} className="w-full bg-pop-dark text-white font-black text-xl py-4 rounded-2xl border-3 border-pop-dark shadow-neo btn-press">
                    {t('detective.finish')}
                </button>
              </div>
          </div>
      );
  }

  return null;
};

export default SmartRewrite;
