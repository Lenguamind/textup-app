import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { generateModernCorrectionPdf } from '../lib/pdf';
import { Target, AlignLeft, Link as LinkIcon, CheckCircle2, BookOpen, Layout, Sun, Lightbulb, Edit3, ArrowDown, Trash2, Calendar, Sparkles, ChevronDown, Download, Quote, Share2, Eye, PenTool, Eraser } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import * as Diff from 'diff';
const { diffWords } = Diff;
import { StorageService, StorageKey } from '../services/storageService';

const CorrectionDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [correction, setCorrection] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const saved = StorageService.getItem<any[]>(StorageKey.CORRECTIONS, []);
    if (id) {
      const found = saved.find((c: any) => c.id.toString() === id);
      if (found) {
        setCorrection(found);
      } else {
        navigate('/history');
      }
    }
  }, [id, navigate]);

  const handleDelete = () => {
    if (confirm(t('common.deleteConfirm'))) {
        const saved = StorageService.getItem<any[]>(StorageKey.CORRECTIONS, []);
        const updated = saved.filter((c: any) => c.id.toString() !== id);
        StorageService.setItem(StorageKey.CORRECTIONS, updated);
        navigate('/history');
    }
  };

  // Helper function to get criteria data for PDF
  const getCriteriaDetailsForPdf = (mode: string, level: string, t: any) => {
    const allFreeCriteriaData = [
        { key: 'adequacy', titleKey: 'aiCorrection.cards.adequacy.title', descKey: 'aiCorrection.cards.adequacy.desc' },
        { key: 'coherence_cohesion', titleKey: 'aiCorrection.cards.coherence_cohesion.title', descKey: 'aiCorrection.cards.coherence_cohesion.desc' },
        { key: 'coherence', titleKey: 'aiCorrection.cards.coherence.title', descKey: 'aiCorrection.cards.coherence.desc' },
        { key: 'cohesion', titleKey: 'aiCorrection.cards.cohesion.title', descKey: 'aiCorrection.cards.cohesion.desc' },
        { key: 'orthography', titleKey: 'aiCorrection.cards.orthography.title', descKey: 'aiCorrection.cards.orthography.desc' },
        { key: 'grammar', titleKey: 'aiCorrection.cards.grammar.title', descKey: 'aiCorrection.cards.grammar.desc' },
        { key: 'lexicon', titleKey: 'aiCorrection.cards.lexicon.title', descKey: 'aiCorrection.cards.lexicon.desc' },
        { key: 'presentation', titleKey: 'aiCorrection.cards.presentation.title', descKey: 'aiCorrection.cards.presentation.desc' },
        { key: 'clarity', titleKey: 'aiCorrection.cards.clarity.title', descKey: 'aiCorrection.cards.clarity.desc' },
        { key: 'creativity', titleKey: 'aiCorrection.cards.creativity.title', descKey: 'aiCorrection.cards.creativity.desc' }
    ];

    const allDictationCriteriaData = [
        { key: 'legibility', titleKey: 'aiCorrection.cards.legibility.title', descKey: 'aiCorrection.cards.legibility.desc' },
        { key: 'strokes', titleKey: 'aiCorrection.cards.strokes.title', descKey: 'aiCorrection.cards.strokes.desc' },
        { key: 'spacing', titleKey: 'aiCorrection.cards.spacing.title', descKey: 'aiCorrection.cards.spacing.desc' },
        { key: 'cleanliness', titleKey: 'aiCorrection.cards.cleanliness.title', descKey: 'aiCorrection.cards.cleanliness.desc' },
    ];

    if (mode === 'detective') {
        return [
            { 
                key: 'accuracy', 
                title: t('detective.accuracy') || 'Precisió', 
                description: t('detective.accuracyDesc') || 'Percentatge d\'encerts en la detecció d\'errors.', 
                maxScore: 100 
            }
        ];
    }

    if (mode === 'free') {
        const relevantKeys = level === 'primary' 
            ? ['adequacy', 'coherence', 'lexicon', 'grammar', 'presentation'] 
            : allFreeCriteriaData.map(c => c.key);
        return allFreeCriteriaData
            .filter(c => relevantKeys.includes(c.key))
            .map(c => ({
                key: c.key,
                title: t(c.titleKey),
                description: t(c.descKey),
                maxScore: level === 'primary' ? 2 : 10
            }));
    } else { // dictation mode
        return allDictationCriteriaData
            .map(c => ({
                key: c.key,
                title: t(c.titleKey),
                description: t(c.descKey),
                maxScore: 10 // Dictation scores are 0-10
            }));
    }
  };

  const handleDownload = async () => { 
    if (!correction) return;
    
    try {
        const correctedText = correction.corrected || correction.original || '';
        const improvedText = correction.improved || '';

        await generateModernCorrectionPdf({
          correctedText,
          improvedText,
          scores: correction.fullScores,
          globalScore: correction.score,
          author: correction.author || undefined,
          feedback: correction.feedback,
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

  const useCountUp = (end: number = 0, duration: number = 2000) => {
    const [count, setCount] = useState(0);
    const safeEnd = end || 0;

    useEffect(() => {
      let startTime: number;
      const animate = (currentTime: number) => {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        setCount(Number((ease * safeEnd).toFixed(1)));
        if (progress < 1) requestAnimationFrame(animate);
      };
      if (safeEnd > 0) requestAnimationFrame(animate);
    }, [safeEnd, duration]);

    return count;
  };

  if (!correction) return null;

  const freeCriteriaData = correction.fullScores && ('coherence_cohesion' in correction.fullScores || 'presentation' in correction.fullScores)
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

  const isDetective = correction.mode === 'detective';
  const isPrimary = correction.level === 'primary';
  const isDictation = correction.mode === 'dictation';
  
  let displayCriteria = [];
  if (isDictation) {
    displayCriteria = dictationCriteriaData;
  } else if (!isDetective) {
    // Only show free criteria metrics. Filter out anything not supported.
    // Also, if 'adequacy' and 'presentation' are in old texts, maybe we should not show them based on user request.
    displayCriteria = freeCriteriaData;
  }
    
  const maxScore = isDictation ? 10 : (isPrimary ? 2 : 10);

  return (
    <div className="flex flex-col gap-6 animate-slide-up pb-10">
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-2xl font-bold text-center border-3 border-pop-dark shadow-neo">
          {error}
        </div>
      )}
      
      {/* Header Info */}
      <div className="flex items-center justify-between">
         <div className="flex items-center gap-2 text-gray-400 bg-white border-3 border-pop-dark px-3 py-1 rounded-xl">
            <Calendar size={14} />
            <span className="text-xs font-black">{correction.date}</span>
         </div>
         <button onClick={handleDelete} className="text-gray-400 hover:text-red-500 p-2 transition-colors bg-white border-3 border-pop-dark hover:border-red-400 rounded-xl btn-press">
            <Trash2 size={20} strokeWidth={3} />
         </button>
      </div>



      {/* Analysis Results */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-pop-dark"></span>
                {t('aiCorrection.results')}
            </h3>
            <div className="bg-pop-blue text-pop-dark px-3 py-1 rounded-lg font-black text-sm border-2 border-pop-dark transform rotate-2">
                Global: {correction.score}/10
            </div>
        </div>
        
        <div className="grid gap-3">
            {displayCriteria.map((item, idx) => {
                const score = correction.fullScores[item.key] || 0;
                let badge = null;
                if (item.key === 'orthography' && correction.spellingMistakes !== undefined) {
                     badge = `${correction.spellingMistakes} ${t('aiCorrection.mistakes')}`;
                }

                return (
                    <ScoreCard 
                        key={item.key}
                        icon={<item.icon size={20} strokeWidth={3} />}
                        title={item.key === 'accuracy' ? (t('detective.accuracy') || 'Precisió') : t(`aiCorrection.cards.${item.key}.title`)}
                        score={score}
                        description={item.key === 'accuracy' ? (t('detective.accuracyDesc') || 'Percentatge d\'encerts.') : t(`aiCorrection.cards.${item.key}.desc`)}
                        color={item.color}
                        bg={item.bg}
                        delay={idx * 0.05}
                        badge={badge}
                        maxScore={maxScore}
                    />
                );
            })}
        </div>
      </div>

      {/* Texts Section - Collapsible */}
      <div className="space-y-4 pt-4 border-t-2 border-dashed border-gray-300">

        {correction.feedback && (
             <CollapsibleCard 
                title={t('aiCorrection.feedback')} 
                icon={<Quote size={18} strokeWidth={3} />}
                defaultOpen={true}
                borderColor="border-pop-blue"
                titleColor="text-pop-dark"
                iconColor="text-pop-blue"
            >
                <p className="text-pop-dark font-medium italic text-lg leading-relaxed">
                    "{correction.feedback}"
                </p>
            </CollapsibleCard>
        )}
        
        {/* Original (Corrected) Text */}
        <CollapsibleCard 
            title={t('aiCorrection.originalCorrected')} 
            icon={<Edit3 size={18} strokeWidth={3} />}
            defaultOpen={false}
            borderColor="border-pop-dark"
            titleColor="text-gray-400"
            iconColor="text-gray-400"
        >
            <DiffViewer original={correction.original} corrected={correction.corrected || correction.original} />
        </CollapsibleCard>

        {/* Improved Text */}
        <CollapsibleCard 
            title={t('aiCorrection.improved')} 
            icon={<Sparkles size={16} strokeWidth={3} />}
            defaultOpen={false}
            borderColor="border-pop-dark"
            titleColor="text-pop-dark"
            iconColor="text-pop-dark"
            badge={t('aiCorrection.improvedBadge')}
        >
            <p className="text-pop-dark text-sm leading-relaxed font-bold whitespace-pre-wrap">
                {correction.improved}
            </p>
        </CollapsibleCard>

      </div>
      
       <button 
        onClick={handleDownload} 
        className="w-full bg-white text-pop-dark font-black text-lg py-4 rounded-2xl border-3 border-pop-dark shadow-sm flex items-center justify-center gap-2 transition-all hover:bg-gray-50 active:scale-[0.98]"
       >
        {isMobile ? <Share2 size={22} strokeWidth={3} /> : <Download size={22} strokeWidth={3} />}
        <span>{isMobile ? t('common.shareReport') : t('common.downloadPdf')}</span>
       </button>
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
                <button 
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full flex items-center justify-between p-5 text-left bg-white z-10 relative"
                >
                    <div className={`flex items-center gap-2 ${iconColor}`}>
                        {icon}
                        <h4 className={`font-black uppercase text-sm ${titleColor}`}>{title}</h4>
                        {badge && (
                            <span className="bg-pop-green text-pop-dark text-[10px] font-black px-2 py-0.5 rounded-md uppercase border-2 border-pop-dark ml-2">
                                {badge}
                            </span>
                        )}
                    </div>
                    <div className={`w-8 h-8 rounded-full border-2 border-pop-dark flex items-center justify-center transition-transform duration-300 ${isOpen ? 'bg-pop-dark text-white rotate-180' : 'bg-white text-pop-dark'}`}>
                        <ChevronDown size={20} strokeWidth={3} />
                    </div>
                </button>
                
                <div 
                    className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                >
                    <div className="p-5 pt-0 border-t-2 border-dashed border-gray-100 mt-2">
                        <div className="bg-gray-50 p-4 rounded-2xl border-2 border-gray-100 mt-4">
                            {children}
                        </div>
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
  
  // Calculate percentage based on maxScore
  const percentage = Math.min(100, (score / maxScore) * 100);

  return (
    <div 
        className="relative group animate-slide-up"
        style={{ animationDelay: `${delay}s` }}
    >
      <div className="absolute inset-0 bg-pop-dark rounded-2xl translate-x-1 translate-y-1"></div>
      <div className="relative bg-white p-4 rounded-2xl border-3 border-pop-dark flex flex-col gap-3 btn-press">
          <div className="flex justify-between items-start">
            <div className="flex gap-3">
              <div className={`w-10 h-10 rounded-xl ${bg} ${color} border-2 border-pop-dark flex items-center justify-center shrink-0 shadow-sm`}>{icon}</div>
              <div>
                  <div className="flex items-center gap-2">
                     <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">{title}</h4>
                     {badge && (
                         <span className="bg-red-100 text-red-500 border-2 border-red-200 text-[9px] font-black uppercase px-1.5 rounded mb-1">
                             {badge}
                         </span>
                     )}
                  </div>
                  <p className="text-sm text-pop-dark leading-snug font-bold line-clamp-2">{description}</p>
              </div>
            </div>
            <div className="text-right shrink-0 min-w-[30px]">
                 <span className={`text-xl font-black ${color.replace('text-white', 'text-pop-dark')}`}>{score}</span>
                 <span className="text-[10px] text-gray-400 font-bold block -mt-1">/{maxScore}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden p-0.5 border-2 border-pop-dark">
                <div 
                    className={`h-full rounded-full ${bg} border-r-2 border-pop-dark transition-all duration-1000 ease-out`} 
                    style={{ width: `${percentage}%` }}
                ></div>
            </div>
          </div>
      </div>
    </div>
  );
};

const DiffViewer: React.FC<{ original: string, corrected: string }> = ({ original, corrected }) => {
    // Only compute diff if we have both texts, otherwise show corrected
    if (!original || !corrected) return <p className="text-pop-dark font-mono text-sm leading-relaxed font-bold">{corrected || original}</p>;

    let diff;
    try {
        diff = diffWords(original, corrected);
    } catch (e) {
        // Fallback if diff fails
        return <p className="text-pop-dark font-mono text-sm leading-relaxed font-bold">{corrected}</p>;
    }

    return (
        <p className="text-pop-dark font-mono text-sm leading-relaxed whitespace-pre-wrap">
            {diff.map((part, i) => {
                if (part.removed) {
                    return (
                        <span key={i} className="text-red-500 line-through decoration-2 mr-1">
                            {part.value}
                        </span>
                    );
                }
                
                if (part.added) {
                    return (
                        <span key={i} className="text-green-600 font-bold bg-green-100 px-1 rounded mr-1">
                            {part.value}
                        </span>
                    );
                }
                
                return <span key={i} className="font-medium text-gray-700">{part.value}</span>;
            })}
        </p>
    );
};

export default CorrectionDetail;
