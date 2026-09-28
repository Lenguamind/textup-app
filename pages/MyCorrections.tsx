import React, { useMemo } from 'react';
import { FileText, Calendar, Star, ChevronRight, TrendingUp, Download, Share2 } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useNavigate } from 'react-router-dom';
import { generatePdf } from '../lib/pdf';
import { StorageService, StorageKey } from '../services/storageService';

const MyCorrections: React.FC = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [corrections, setCorrections] = React.useState<any[]>([]);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    const saved = StorageService.getItem<any[]>(StorageKey.CORRECTIONS, []);
    setCorrections(saved);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const chartData = useMemo(() => {
    if (corrections.length < 2) return null;
    
    // Sort oldest first for the chart
    const sortedData = [...corrections]
        .filter(c => c.score !== undefined)
        .reverse()
        .slice(-7); // Last 7 items max to keep it readable

    return sortedData.map(c => ({
        id: c.id,
        score: c.mode === 'detective' ? c.score / 10 : c.score, // Normalize to 0-10 for chart scaling
        displayScore: c.score,
        mode: c.mode,
        date: c.date.split(',')[0] // Simple date
    }));
  }, [corrections]);

  return (
    <div className="flex flex-col gap-4 pt-2">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center px-1 gap-4">
        <h2 className="text-xl font-black text-pop-dark italic">{t('titles.myCorrections')}</h2>
        
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <button 
                onClick={async () => {
                    const content: { type: 'title'|'subtitle'|'text'; text: string }[] = [
                      { type: 'title', text: t('pdf.historyTitle') || "TEXTUP! - History / Historial" }
                    ];

                    corrections.forEach((item, i) => {
                      content.push({ type: 'subtitle', text: `${i + 1}. ${item.title || t('common.untitled') || 'Untitled / Sense títol'}` });
                      content.push({ type: 'text', text: `${t('pdf.date') || 'Date:'} ${item.date} | ${t('pdf.globalScore') || 'Score:'} ${item.score}${item.mode === 'detective' ? '%' : ''}` });
                      if (item.author) {
                        content.push({ type: 'text', text: `${t('pdf.author') || 'Author:'} ${item.author}` });
                      }
                    });

                    await generatePdf({
                      title: t('pdf.historyTitle') || "TEXTUP! - History / Historial",
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
                }}
                className="flex items-center justify-center gap-2 px-3 py-2 bg-white border-2 border-pop-dark rounded-xl text-xs font-black hover:bg-gray-50 transition-all w-full sm:w-auto"
            >
                {isMobile ? <Share2 size={16} /> : <Download size={16} />}
                <span>{isMobile ? t('common.shareReport') : t('common.downloadPdf')}</span>
            </button>
        </div>
      </div>

      {/* Chart Section */}
      {chartData && chartData.length > 1 && (
        <div className="bg-white p-5 rounded-3xl shadow-card border border-gray-50 mb-2 animate-slide-up">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-brand-light text-brand-dark flex items-center justify-center">
                    <TrendingUp size={18} />
                </div>
                <div>
                    <h3 className="font-bold text-dark text-sm">{t('myCorrections.chartTitle')}</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">{t('myCorrections.chartDesc')}</p>
                </div>
            </div>
            
            <EvolutionChart data={chartData} />
        </div>
      )}

      {/* List Section */}
      {corrections.map((item) => (
        <div 
            key={item.id} 
            onClick={() => navigate(`/correction/${item.id}`)}
            className="bg-white p-4 rounded-2xl shadow-card border border-gray-50 flex items-center justify-between animate-slide-up cursor-pointer hover:shadow-md hover:border-gray-100 transition-all active:scale-[0.98] group"
        >
          <div className="flex items-center gap-4 overflow-hidden">
            <div className="w-12 h-12 rounded-xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
              <FileText size={24} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-dark truncate pr-2">{item.title}</h3>
              <div className="flex items-center gap-2 text-gray-400 mt-1">
                <Calendar size={12} className="shrink-0" />
                <span className="text-xs font-medium shrink-0">{item.date}</span>
                {item.author && (
                    <>
                        <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0"></span>
                        <span className="text-xs font-medium text-gray-500 truncate max-w-[100px] italic">{item.author}</span>
                    </>
                )}
                {item.level && (
                    <>
                        <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0"></span>
                        <span 
                            className="text-[10px] uppercase font-bold bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 shrink-0"
                            title={t(`aiCorrection.educationLevels.${item.level}`) || item.level}
                        >
                            {(t(`aiCorrection.educationLevels.${item.level}`) || item.level).charAt(0)}
                        </span>
                    </>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 shrink-0">
             <div className="flex flex-col items-end">
                <div className="flex gap-1 text-yellow-400">
                    <Star size={14} fill="currentColor" />
                </div>
                <span className="text-lg font-black text-dark">{item.score}{item.mode === 'detective' ? '%' : ''}</span>
             </div>
             <ChevronRight size={20} className="text-gray-300 group-hover:text-brand-dark transition-colors" />
          </div>
        </div>
      ))}

      {corrections.length === 0 && (
         <div className="text-center py-10 text-gray-400 flex flex-col items-center gap-4">
             <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center text-gray-300">
                <FileText size={32} />
             </div>
             <p>{t('myCorrections.empty')}</p>
         </div>
      )}
    </div>
  );
};

// Simple SVG Chart Component
const EvolutionChart: React.FC<{ data: { score: number, displayScore: number, date: string }[] }> = ({ data }) => {
    const width = 300;
    const height = 120;
    const padding = 20;
    
    // Scale functions
    const xScale = (index: number) => padding + (index * (width - padding * 2) / (data.length - 1));
    const yScale = (score: number) => height - padding - ((score / 10) * (height - padding * 2));

    // Generate path points
    const points = data.map((d, i) => `${xScale(i)},${yScale(d.score)}`).join(' ');
    
    // Generate area path (closed at bottom)
    const areaPath = `${points} ${xScale(data.length - 1)},${height} ${xScale(0)},${height}`;

    return (
        <div className="w-full overflow-hidden">
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                {/* Defs for Gradient */}
                <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#25f478" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#25f478" stopOpacity="0" />
                    </linearGradient>
                </defs>

                {/* Grid Lines (Background) */}
                <line x1={padding} y1={yScale(0)} x2={width - padding} y2={yScale(0)} stroke="#f3f4f6" strokeWidth="1" />
                <line x1={padding} y1={yScale(5)} x2={width - padding} y2={yScale(5)} stroke="#f3f4f6" strokeWidth="1" strokeDasharray="4 4" />
                <line x1={padding} y1={yScale(10)} x2={width - padding} y2={yScale(10)} stroke="#f3f4f6" strokeWidth="1" strokeDasharray="4 4" />

                {/* Area Fill */}
                <path d={`M${areaPath} Z`} fill="url(#chartGradient)" />

                {/* Line Stroke */}
                <polyline 
                    points={points} 
                    fill="none" 
                    stroke="#25f478" 
                    strokeWidth="3" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                />

                {/* Data Points */}
                {data.map((d, i) => (
                    <g key={i}>
                        <circle 
                            cx={xScale(i)} 
                            cy={yScale(d.score)} 
                            r="4" 
                            fill="white" 
                            stroke="#00cf56" 
                            strokeWidth="2" 
                        />
                        {/* Score Label (Only show for first, last, or significant peaks if needed, simpler to show all for small datasets) */}
                        <text 
                            x={xScale(i)} 
                            y={yScale(d.score) - 10} 
                            textAnchor="middle" 
                            fontSize="10" 
                            fontWeight="bold" 
                            fill="#0f172a"
                        >
                            {d.displayScore}
                        </text>
                    </g>
                ))}
            </svg>
        </div>
    );
}

export default MyCorrections;
