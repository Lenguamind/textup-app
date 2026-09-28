import React, { useState, useEffect } from 'react';
import { Lightbulb, RefreshCw, Sparkles, Download, Share2 } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { callGeminiStream } from '../services/apiService';
import { getSharedPrompt } from '../lib/prompts';
import { generatePdf } from '../lib/pdf';
import { LANGUAGE_NAMES } from '../constants/languages';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';

const Inspira: React.FC = () => {
  const { t, language, user } = useLanguage();
  const [text, setText] = useState('');
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [isAnalyzingIdeas, setIsAnalyzingIdeas] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorName, setAuthorName] = useState('');

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // --- Actions ---
  const analyzeText = async () => {
    if (!text.trim()) return;
    
    setIsAnalyzingIdeas(true);

    try {
      const idioma = LANGUAGE_NAMES[language] || 'English';
      const systemInstruction = getSharedPrompt(idioma, 'inspira', text, 'primària');

      let fullText = '';
      await callGeminiStream(
        'gemini-2.5-flash',
        [{ parts: [{ text }] }],
        systemInstruction,
        (textChunk) => {
          fullText = textChunk;
          const trimmed = fullText.trim();
          if (trimmed.toUpperCase() === 'SILENCI') {
            setSuggestion(null);
          } else {
            setSuggestion(trimmed);
          }
        },
        {
          temperature: 0.7
        }
      );
    } catch (err) {
      console.error(`Analysis Error:`, err);
    } finally {
      setIsAnalyzingIdeas(false);
    }
  };

  useEffect(() => {
    if (text.trim().length < 3) {
      setSuggestion(null);
      return;
    }

    const timer = setTimeout(() => {
      analyzeText();
    }, 300); // Even faster: 0.3 second delay

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const handleDownload = async () => {
    if (!text.trim()) return;
    
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
      doc.text(t('pdf.inspira') || 'INSPIRACIÓ', pageWidth / 2, 25, { align: 'center' });

      const author = authorName || user?.name || '';
      if (author) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(221, 214, 254); // violet-200
        doc.text(`${t('pdf.author') || 'Autor/a:'} ${author}`, pageWidth / 2, 33, { align: 'center' });
      }
      
      let y = 50;

      // Original Text - Yellow theme
      doc.setFillColor(254, 240, 138); // yellow-200
      doc.roundedRect(margin, y - 6, pageWidth - (margin * 2), 10, 2, 2, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(133, 77, 14); // yellow-800
      doc.text(t('inspira.yourText') || 'EL TEU TEXT', margin + 3, y + 1);
      y += 10;

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      
      const splitText = doc.splitTextToSize(text, maxLineWidth);
      
      splitText.forEach((line: string) => {
        if (y > pageHeight - margin - 15) {
          doc.addPage();
          doc.setFillColor(248, 250, 252);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          y = margin + 10;
        }
        doc.text(line, margin, y);
        y += 6;
      });
      
      y += 10;

      if (suggestion) {
        if (y > pageHeight - margin - 20) {
          doc.addPage();
          doc.setFillColor(248, 250, 252);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          y = margin + 10;
        }

        // Suggestion - Green theme
        doc.setFillColor(220, 252, 231); // green-100
        doc.roundedRect(margin, y - 6, pageWidth - (margin * 2), 10, 2, 2, 'F');
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(22, 101, 52); // green-800
        doc.text(t('inspira.suggestionTitle') || 'IDEES I INSPIRACIÓ', margin + 3, y + 1);
        y += 10;

        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        
        // Remove emojis from suggestion for PDF
        const cleanSuggestion = suggestion.replace(/^(🎭|🎨|🎬|❤️|🕵️)\s*/, '');
        const splitSuggestion = doc.splitTextToSize(cleanSuggestion, maxLineWidth);
        
        splitSuggestion.forEach((line: string) => {
          if (y > pageHeight - margin - 15) {
            doc.addPage();
            doc.setFillColor(248, 250, 252);
            doc.rect(0, 0, pageWidth, pageHeight, 'F');
            y = margin + 10;
          }
          doc.text(line, margin, y);
          y += 6;
        });
      }

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

      const finalFilename = `textup_inspira_${Date.now()}.pdf`;

      if (Capacitor.isNativePlatform()) {
        try {
          const base64 = doc.output('datauristring').split(',')[1];
          const savedFile = await Filesystem.writeFile({
            path: finalFilename,
            data: base64,
            directory: Directory.Cache
          });

          await Share.share({
            title: t('pdf.inspira') || 'Inspiració',
            text: t('inspira.shareText') || `Informe d'inspiració`,
            url: savedFile.uri,
            dialogTitle: t('common.shareReport') || 'Comparteix el PDF'
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
                title: t('pdf.inspira') || 'Inspiració',
                text: t('inspira.shareText') || `Informe d'inspiració`,
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
    }
  };

  const reset = () => {
    setText('');
    setSuggestion(null);
    setIsAnalyzingIdeas(false);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto pb-20 px-4">
      <div className="animate-slide-up flex flex-col min-h-[80vh] justify-center py-8">
        
        {/* Header & Reset */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
          <div className="flex items-center gap-2">
            <Sparkles className="text-yellow-500" size={24} />
            <h2 className="text-2xl font-black text-gray-900">{t('inspira.title')}</h2>
          </div>
          <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex-1 sm:w-48 opacity-60 hover:opacity-100 transition-opacity">
              <input 
                  type="text" 
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder={t('aiCorrection.authorPlaceholder') || 'Nom de l\'autor...'}
                  className="w-full bg-transparent border-none focus:outline-none text-xs font-bold text-gray-600 placeholder:text-gray-400 text-right"
              />
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleDownload}
                disabled={!text.trim()}
                className="text-pop-blue hover:text-blue-700 transition-colors bg-white p-2 rounded-xl border-2 border-gray-200 disabled:opacity-30"
                title={isMobile ? t('common.shareReport') : t('common.downloadPdf')}
              >
                {isMobile ? <Share2 size={20} /> : <Download size={20} />}
              </button>
              <button 
                onClick={reset}
                className="text-gray-400 hover:text-gray-600 transition-colors bg-white p-2 rounded-xl border-2 border-gray-200"
                title="Clear text"
              >
                <RefreshCw size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* CENTER: Writing Box */}
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-[2rem] blur opacity-25 group-focus-within:opacity-50 transition duration-1000 group-focus-within:duration-200"></div>
          <div className="relative bg-white rounded-[2rem] p-6 shadow-xl border-3 border-pop-dark">
            <textarea
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setError(null);
              }}
              className="w-full h-80 resize-none focus:outline-none text-xl leading-relaxed text-gray-700 placeholder-gray-300 font-medium"
              placeholder={t('inspira.placeholder')}
              autoFocus
            />
            
            {/* Status Indicators & Word Count */}
            <div className="absolute bottom-4 right-6 flex items-center gap-4">
              <div className="text-xs font-bold text-gray-400 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100">
                {text.trim() ? text.trim().split(/\s+/).filter(w => w.length > 0).length : 0} {t('common.words') || 'paraules'}
              </div>
              {isAnalyzingIdeas && <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>}
            </div>
          </div>
        </div>

        {/* BOTTOM: Ideas (Inspiration) */}
        <div className="min-h-[100px] mt-6">
          {isAnalyzingIdeas ? (
            <div className="w-full bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
              <Lightbulb className="text-gray-400" size={20} />
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>
          ) : suggestion ? (
            <div className="w-full bg-blue-50 border-3 border-blue-200 rounded-2xl p-5 shadow-sm animate-fade-in">
              <div className="flex items-start gap-4">
                <div className="bg-blue-500 text-white p-2 rounded-xl shrink-0 shadow-sm">
                  {suggestion.match(/^(🎭|🎨|🎬|❤️|🕵️)/) ? (
                    <span className="text-lg leading-none">{suggestion.match(/^(🎭|🎨|🎬|❤️|🕵️)/)![1]}</span>
                  ) : (
                    <Lightbulb size={20} />
                  )}
                </div>
                <div>
                  <h4 className="text-xs font-black text-blue-400 uppercase tracking-wider mb-1">
                    {t('inspira.suggestionTitle')}
                  </h4>
                  <p className="text-lg font-black text-blue-900 leading-tight">
                    "{suggestion.replace(/^(🎭|🎨|🎬|❤️|🕵️)\s*/, '')}"
                  </p>
                </div>
              </div>
            </div>
          ) : text.length > 0 && (
            <div className="text-center text-gray-400 italic text-sm py-4">
              {t('inspira.continueWriting')}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-100 text-red-700 p-4 rounded-2xl font-bold text-center border-3 border-pop-dark shadow-neo">
            {error}
          </div>
        )}
      </div>
    </div>
  );
};

export default Inspira;
