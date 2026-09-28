import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Sparkles, RefreshCw, Ghost, Download, Image as ImageIcon, Plus, Check, Loader2, Send, Share2, AlertTriangle } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { callGemini } from '../services/apiService';
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { generatePdf, PdfContentItem } from '../lib/pdf';

interface Tag {
  id: string;
  category: 'character' | 'setting' | 'object' | 'theme';
}

const TAGS: Tag[] = [
  { id: 'mystery', category: 'theme' },
  { id: 'adventure', category: 'theme' },
  { id: 'school', category: 'theme' },
  { id: 'fantasy', category: 'theme' },
  { id: 'dragon', category: 'character' },
  { id: 'robot', category: 'character' },
  { id: 'detective', category: 'character' },
  { id: 'princess', category: 'character' },
  { id: 'astronaut', category: 'character' },
  { id: 'cat', category: 'character' },
  { id: 'forest', category: 'setting' },
  { id: 'moon', category: 'setting' },
  { id: 'castle', category: 'setting' },
  { id: 'city', category: 'setting' },
  { id: 'ship', category: 'setting' },
  { id: 'underwater', category: 'setting' },
  { id: 'key', category: 'object' },
  { id: 'map', category: 'object' },
  { id: 'sword', category: 'object' },
  { id: 'potion', category: 'object' },
  { id: 'book', category: 'object' },
  { id: 'chest', category: 'object' },
];

const TIMER_DURATION = 180;

const Imagine: React.FC = () => {
  const { t, language, user } = useLanguage();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<string | null>(null);
  const [customTags, setCustomTags] = useState<Record<string, string>>({
    theme: '', character: '', setting: '', object: ''
  });
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [showTags, setShowTags] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [historyImages, setHistoryImages] = useState<string[]>([]);
  const [timeLeft, setTimeLeft] = useState(TIMER_DURATION);
  const [isTimerActive, setIsTimerActive] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [authorName, setAuthorName] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  const toggleTag = (id: string, category: string) => {
    if (category === 'theme') {
      setSelectedTheme(id === selectedTheme ? null : id);
      return;
    }
    if (selectedTags.includes(id)) {
      setSelectedTags(prev => prev.filter(t => t !== id));
    } else {
      const catTags = TAGS.filter(t => t.category === category).map(t => t.id);
      const currentCatTag = selectedTags.find(t => catTags.includes(t));
      if (currentCatTag) {
        setSelectedTags(prev => [...prev.filter(t => t !== currentCatTag), id]);
      } else if (selectedTags.length < 3) {
        setSelectedTags(prev => [...prev, id]);
      }
    }
  };

  const generateImage = useCallback(async (retryCountArg: any = 0) => {
    const retryCount = typeof retryCountArg === 'number' ? retryCountArg : 0;
    
    const hasTheme = selectedTheme || customTags.theme.trim() !== '';
    const hasTags = selectedTags.length > 0 || 
                    customTags.character.trim() !== '' || 
                    customTags.setting.trim() !== '' || 
                    customTags.object.trim() !== '';
    if (!hasTheme || !hasTags) return;
    
    if (retryCount === 0) {
      setIsGenerating(true);
      setError(null);
    }

    try {
      const selectedLabels = selectedTags.map(id => TAGS.find(t => t.id === id)?.id).filter(Boolean);
      const customLabels = [customTags.character, customTags.setting, customTags.object].filter(v => v.trim() !== '');
      const allLabels = [...selectedLabels, ...customLabels].join(', ');
      const themeLabel = selectedTheme ? selectedTheme : customTags.theme;
      const langName = language === 'ca' ? 'Catalan' : language === 'es' ? 'Spanish' : 'English';
      
      let finalPrompt = "";

      if (storyText.trim().length > 20) {
        // Usa el text de l'usuari per generar la propera escena
        const scenePrompt = `You are a creative writing assistant for students aged 8-16.

The student is writing a story with these elements:
- Theme: ${themeLabel}
- Elements: ${allLabels}

THIS IS WHAT THE STUDENT HAS WRITTEN SO FAR:
"${storyText}"

Your task:
1. Read carefully what the student has written
2. Imagine a specific scene that happens NEXT in THEIR story (not a generic scene)
3. The scene should reference their specific characters, places and events
4. Anticipate the story slightly to inspire the student with new ideas

Return ONLY a JSON object (no markdown):
{
  "visualDescription": "A detailed visual description (max 80 words) of the NEXT scene continuing THIS specific story. Must reference the student's characters and narrative.",
  "suggestion": "A short inspiring question or hint in ${langName} to help them continue writing (max 12 words)"
}`;

        const sceneResponse = await callGemini(
          'gemini-2.5-flash',
          [{ parts: [{ text: scenePrompt }] }],
          undefined,
          undefined,
          user?.apiKey
        );
        
        try {
          let cleaned = (sceneResponse.text || '{}').replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
          const result = JSON.parse(cleaned);
          const visualDescription = result.visualDescription || "A mysterious scene continuing the story.";
          setSuggestion(result.suggestion || null);
          
          finalPrompt = `Cinematic photorealistic scene: ${visualDescription}. Style: 8k, cinematic lighting, highly detailed, realistic materials. No cartoons, no illustrations.`;
        } catch (e) {
          console.error("Error parsing scene response", e);
          finalPrompt = `Photorealistic cinematic scene. Theme: ${themeLabel}. Elements: ${allLabels}. Story context: ${storyText.substring(0, 200)}. Style: 8k, cinematic lighting.`;
        }
      } else {
        // Primera imatge ”” usa les etiquetes
        setSuggestion(null);
        finalPrompt = `A hyper-realistic cinematic photograph representing the beginning of a story. Theme: ${themeLabel}. Elements: ${allLabels}. Style: cinematic lighting, 8k resolution, highly detailed, no cartoons, no illustrations.`;
      }

      // Generar imatge amb Pollinations.ai
      const seed = Math.floor(Math.random() * 1000000);
      const encodedPrompt = encodeURIComponent(finalPrompt.substring(0, 500));
      const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;
      
      if (generatedImage) {
        setHistoryImages(prev => [...prev, generatedImage]);
      }
      
      setGeneratedImage(imageUrl);
      setImageLoading(true);
      setShowTags(false);
      setTimeLeft(TIMER_DURATION);
      setIsTimerActive(true);
      setIsGenerating(false);

    } catch (err: any) {
      const errorMessage = err?.message || (typeof err === 'string' ? err : JSON.stringify(err)) || 'Unknown error';
      const errorCode = err?.code || err?.status || '';
      const isQuotaError = errorMessage.toLowerCase().includes('quota') || errorMessage.includes('429') || errorCode === 429 || errorCode === 'RESOURCE_EXHAUSTED';
      const isPermissionError = errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('api key') || errorMessage.toLowerCase().includes('unauthorized') || errorMessage.includes('403') || errorMessage.includes('401') || errorCode === 403 || errorCode === 401 || errorCode === 'PERMISSION_DENIED' || errorCode === 'UNAUTHENTICATED';
      
      console.error(`Image Generation Error (Attempt ${retryCount + 1}):`, err);
      
      if (retryCount < 2 && !isQuotaError && !isPermissionError) {
        const delay = Math.pow(2, retryCount) * 1000;
        setTimeout(() => generateImage(retryCount + 1), delay);
        return;
      }

      if (isQuotaError) setError(t('errors.quota'));
      else if (isPermissionError) setError(t('imagine.apiKeyRequired'));
      else if (errorMessage.includes('xhr error')) setError(t('imagine.networkError'));
      else setError(t('common.error'));
      setIsGenerating(false);
    }
  }, [selectedTags, customTags, selectedTheme, t, generatedImage, storyText, language, user?.apiKey]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && timeLeft > 0 && !isGenerating) {
      interval = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
    } else if (timeLeft === 0 && isTimerActive && !isGenerating) {
      setIsTimerActive(false);
      generateImage(0);
    }
    return () => clearInterval(interval);
  }, [isTimerActive, timeLeft, isGenerating, generateImage]);

  const handleDownload = async () => {
    if (!storyText.trim()) return;
    try {
      const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 20;
      const maxLineWidth = pageWidth - (margin * 2);
      
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');
      doc.setFillColor(124, 58, 237);
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('TEXTUP!', pageWidth / 2, 15, { align: 'center' });
      doc.setFontSize(14);
      doc.text(t('imagine.title') || 'IMAGINA', pageWidth / 2, 25, { align: 'center' });

      const author = authorName || user?.name || '';
      if (author) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(221, 214, 254);
        doc.text(`${t('pdf.author') || 'Autor/a:'} ${author}`, pageWidth / 2, 33, { align: 'center' });
      }
      
      let y = 50;
      doc.setFillColor(254, 240, 138);
      doc.roundedRect(margin, y - 6, pageWidth - (margin * 2), 10, 2, 2, 'F');
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(133, 77, 14);
      doc.text(t('imagine.yourStory') || 'LA TEVA HISTORIA', margin + 3, y + 1);
      y += 10;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      const splitText = doc.splitTextToSize(storyText, maxLineWidth);
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

      const pageCount = (doc.internal as any).getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(124, 58, 237);
        doc.rect(0, pageHeight - 15, pageWidth, 15, 'F');
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(`TEXTUP! - ${t('pdf.generatedOn') || 'Generat el'} ${new Date().toLocaleDateString()} - ${t('pdf.page') || 'Pagina'} ${i}/${pageCount}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
      }

      const finalFilename = `textup_imagina_${Date.now()}.pdf`;
      if (Capacitor.isNativePlatform()) {
        const base64 = doc.output('datauristring').split(',')[1];
        const savedFile = await Filesystem.writeFile({ path: finalFilename, data: base64, directory: Directory.Cache });
        await Share.share({ title: t('pdf.imagine') || 'Imagina', text: t('imagine.yourStoryShare') || 'La meva historia', url: savedFile.uri });
      } else {
        doc.save(finalFilename);
      }
    } catch (error) {
      console.error("Error generating PDF:", error);
    }
  };

  const reset = () => {
    setSelectedTags([]);
    setSelectedTheme(null);
    setCustomTags({ theme: '', character: '', setting: '', object: '' });
    setGeneratedImage(null);
    setStoryText('');
    setSuggestion(null);
    setHistoryImages([]);
    setShowTags(true);
    setError(null);
    setIsTimerActive(false);
    setTimeLeft(TIMER_DURATION);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-full gap-6 px-4 py-6 animate-slide-up pb-24">
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-100 p-2 rounded-xl">
              <Ghost className="text-indigo-600" size={24} />
            </div>
            <h2 className="text-2xl font-black text-gray-900">{t('imagine.title')}</h2>
          </div>
          <div className="w-full sm:w-48 opacity-60 hover:opacity-100 transition-opacity">
            <input type="text" value={authorName} onChange={(e) => setAuthorName(e.target.value)} placeholder={t('aiCorrection.authorPlaceholder')} className="w-full bg-transparent border-none focus:outline-none text-xs font-bold text-gray-600 placeholder:text-gray-400 sm:text-right" />
          </div>
        </div>
        <p className="text-gray-500 font-medium leading-snug">{t('imagine.desc')}</p>
      </div>

      {showTags ? (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-[2.5rem] border-3 border-pop-dark shadow-neo">
            <h3 className="text-lg font-black text-pop-dark uppercase italic mb-4">{t('imagine.selectTags')}</h3>
            <div className="space-y-6">

              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{t('imagine.categories.theme')}</p>
                <div className="flex flex-wrap gap-2">
                  {TAGS.filter(tag => tag.category === 'theme').map(tag => (
                    <button key={tag.id} onClick={() => toggleTag(tag.id, tag.category)}
                      className={`px-4 py-2 rounded-xl border-2 font-black text-xs uppercase transition-all ${selectedTheme === tag.id ? 'bg-pop-yellow text-pop-dark border-pop-dark shadow-neo-sm' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                      + {t(`imagine.tags.${tag.id}`) || tag.id}
                    </button>
                  ))}
                  <input value={customTags.theme} onChange={e => setCustomTags(p => ({...p, theme: e.target.value}))}
                    placeholder={t('imagine.customTag') || '+ Etiqueta lliure'}
                    className={`px-4 py-2 rounded-xl border-2 font-black text-xs uppercase bg-gray-50 text-gray-500 border-dashed border-gray-300 outline-none w-32 ${customTags.theme ? 'border-pop-yellow' : ''}`} />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{t('imagine.categories.character')}</p>
                <div className="flex flex-wrap gap-2">
                  {TAGS.filter(tag => tag.category === 'character').map(tag => (
                    <button key={tag.id} onClick={() => toggleTag(tag.id, tag.category)}
                      className={`px-4 py-2 rounded-xl border-2 font-black text-xs uppercase transition-all ${selectedTags.includes(tag.id) ? 'bg-pop-blue text-white border-pop-dark shadow-neo-sm' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                      + {t(`imagine.tags.${tag.id}`) || tag.id}
                    </button>
                  ))}
                  <input value={customTags.character} onChange={e => setCustomTags(p => ({...p, character: e.target.value}))}
                    placeholder={t('imagine.customTag') || '+ Etiqueta lliure'}
                    className={`px-4 py-2 rounded-xl border-2 font-black text-xs uppercase bg-gray-50 text-gray-500 border-dashed border-gray-300 outline-none w-32 ${customTags.character ? 'border-pop-blue' : ''}`} />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{t('imagine.categories.setting')}</p>
                <div className="flex flex-wrap gap-2">
                  {TAGS.filter(tag => tag.category === 'setting').map(tag => (
                    <button key={tag.id} onClick={() => toggleTag(tag.id, tag.category)}
                      className={`px-4 py-2 rounded-xl border-2 font-black text-xs uppercase transition-all ${selectedTags.includes(tag.id) ? 'bg-pop-green text-pop-dark border-pop-dark shadow-neo-sm' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                      + {t(`imagine.tags.${tag.id}`) || tag.id}
                    </button>
                  ))}
                  <input value={customTags.setting} onChange={e => setCustomTags(p => ({...p, setting: e.target.value}))}
                    placeholder={t('imagine.customTag') || '+ Etiqueta lliure'}
                    className={`px-4 py-2 rounded-xl border-2 font-black text-xs uppercase bg-gray-50 text-gray-500 border-dashed border-gray-300 outline-none w-32 ${customTags.setting ? 'border-pop-green' : ''}`} />
                </div>
              </div>

              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">{t('imagine.categories.object')}</p>
                <div className="flex flex-wrap gap-2">
                  {TAGS.filter(tag => tag.category === 'object').map(tag => (
                    <button key={tag.id} onClick={() => toggleTag(tag.id, tag.category)}
                      className={`px-4 py-2 rounded-xl border-2 font-black text-xs uppercase transition-all ${selectedTags.includes(tag.id) ? 'bg-pop-pink text-white border-pop-dark shadow-neo-sm' : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                      + {t(`imagine.tags.${tag.id}`) || tag.id}
                    </button>
                  ))}
                  <input value={customTags.object} onChange={e => setCustomTags(p => ({...p, object: e.target.value}))}
                    placeholder={t('imagine.customTag') || '+ Etiqueta lliure'}
                    className={`px-4 py-2 rounded-xl border-2 font-black text-xs uppercase bg-gray-50 text-gray-500 border-dashed border-gray-300 outline-none w-32 ${customTags.object ? 'border-pop-pink' : ''}`} />
                </div>
              </div>

            </div>
          </div>

          {error && (
            <div className="bg-red-100 text-red-700 p-4 rounded-2xl font-bold border-3 border-pop-dark flex items-center gap-2">
              <AlertTriangle size={20} />
              <span>{error}</span>
            </div>
          )}

          <button onClick={() => generateImage(0)} disabled={isGenerating || (!selectedTheme && customTags.theme.trim() === '')}
            className="w-full bg-pop-dark text-white font-black text-xl py-4 rounded-2xl border-3 border-pop-dark shadow-neo btn-press flex items-center justify-center gap-3 disabled:opacity-50 disabled:shadow-none">
            {isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles size={24} strokeWidth={3} />}
            <span>{isGenerating ? t('imagine.analyzing') : t('imagine.startBtn')}</span>
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6 flex-grow">

          <div className="flex items-center justify-between bg-pop-yellow/20 px-4 py-2 rounded-xl border-2 border-pop-yellow/50">
            <div className="flex items-center gap-2 text-pop-dark font-black text-sm uppercase italic">
              <RefreshCw size={16} className={isGenerating ? "animate-spin" : ""} />
              <span>{t('imagine.timer')}</span>
            </div>
            <div className="text-pop-dark font-black text-xl tabular-nums">{formatTime(timeLeft)}</div>
          </div>

          <div className="relative rounded-[2.5rem] overflow-hidden border-3 border-pop-dark shadow-neo aspect-square bg-gray-100">
            {generatedImage && (
              <img src={generatedImage} alt="Generated"
                className={`w-full h-full object-cover transition-opacity duration-700 ${imageLoading ? 'opacity-0' : 'opacity-100'}`}
                onLoad={() => setImageLoading(false)}
                referrerPolicy="no-referrer" />
            )}
            {imageLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 backdrop-blur-sm">
                <Loader2 className="animate-spin text-indigo-600" size={48} />
              </div>
            )}
          </div>

          {suggestion && (
            <div className="bg-pop-yellow/20 px-4 py-3 rounded-xl border-2 border-pop-yellow/50 text-pop-dark font-bold text-sm italic">
              💡 {suggestion}
            </div>
          )}

          {error && (
            <div className="bg-red-100 text-red-700 p-4 rounded-2xl font-bold border-3 border-pop-dark flex items-center gap-2">
              <AlertTriangle size={20} />
              <span>{error}</span>
            </div>
          )}

          <div className="relative bg-white p-6 rounded-[2.5rem] border-3 border-pop-dark shadow-neo flex-grow flex flex-col min-h-[200px]">
            <textarea value={storyText} onChange={(e) => setStoryText(e.target.value)}
              className="w-full flex-grow text-lg font-medium text-gray-800 outline-none resize-none placeholder-gray-300 leading-relaxed"
              placeholder={t('imagine.placeholder')} />
            <div className="text-right text-xs text-gray-400 font-bold mt-2">
              {storyText.trim().split(/\s+/).filter(Boolean).length} {t('imagine.words') || 'PARAULES'}
            </div>
          </div>

          <div className="w-full space-y-3">
            <button onClick={handleDownload}
              className="w-full bg-pop-blue text-white font-black text-lg py-4 rounded-2xl border-3 border-pop-dark shadow-neo btn-press flex items-center justify-center gap-3">
              {isMobile ? <Share2 size={24} strokeWidth={3} /> : <Download size={24} strokeWidth={3} />}
              <span>{isMobile ? t('common.shareReport') : t('common.downloadPdf')}</span>
            </button>
          </div>

          <button onClick={reset} className="text-gray-400 hover:text-gray-600 text-sm font-bold flex items-center justify-center gap-2">
            <RefreshCw size={14} /> {t('imagine.reset')}
          </button>
        </div>
      )}
    </div>
  );
};

export default Imagine;
