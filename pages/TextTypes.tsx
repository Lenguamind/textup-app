import React, { useState } from 'react';
import { ChevronDown, BookOpen, PenTool, List, Info, MessageCircle, Quote, Download } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { generatePdf } from '../lib/pdf';

const TextTypes: React.FC = () => {
  const { t, user } = useLanguage();

  return (
    <div className="flex flex-col gap-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-dark">{t('textTypes.header')}</h2>
          <p className="text-gray-500 font-medium mt-1">{t('textTypes.subHeader')}</p>
        </div>
      </div>

      <div className="space-y-4">
        <TypeCard 
          icon={<BookOpen className="text-blue-600" />}
          bg="bg-blue-100"
          title={t('textTypes.narrative.title')}
          subtitle={t('textTypes.narrative.subtitle')}
          description={t('textTypes.narrative.desc')}
          structure={t('textTypes.narrative.struct')}
          example={t('textTypes.narrative.ex')}
          user={user}
        />
        
        <TypeCard 
          icon={<PenTool className="text-purple-600" />}
          bg="bg-purple-100"
          title={t('textTypes.descriptive.title')}
          subtitle={t('textTypes.descriptive.subtitle')}
          description={t('textTypes.descriptive.desc')}
          structure={t('textTypes.descriptive.struct')}
          example={t('textTypes.descriptive.ex')}
          user={user}
        />

        <TypeCard 
          icon={<List className="text-orange-600" />}
          bg="bg-orange-100"
          title={t('textTypes.instructive.title')}
          subtitle={t('textTypes.instructive.subtitle')}
          description={t('textTypes.instructive.desc')}
          structure={t('textTypes.instructive.struct')}
          example={t('textTypes.instructive.ex')}
          user={user}
        />

        <TypeCard 
          icon={<Info className="text-teal-600" />}
          bg="bg-teal-100"
          title={t('textTypes.informative.title')}
          subtitle={t('textTypes.informative.subtitle')}
          description={t('textTypes.informative.desc')}
          structure={t('textTypes.informative.struct')}
          example={t('textTypes.informative.ex')}
          user={user}
        />

        <TypeCard 
          icon={<MessageCircle className="text-pink-600" />}
          bg="bg-pink-100"
          title={t('textTypes.opinion.title')}
          subtitle={t('textTypes.opinion.subtitle')}
          description={t('textTypes.opinion.desc')}
          structure={t('textTypes.opinion.struct')}
          example={t('textTypes.opinion.ex')}
          user={user}
        />
      </div>
    </div>
  );
};

interface TypeCardProps {
  icon: React.ReactNode;
  bg: string;
  title: string;
  subtitle: string;
  description: string;
  structure: string;
  example: string;
  user: any;
}

const TypeCard: React.FC<TypeCardProps> = ({ icon, bg, title, subtitle, description, structure, example, user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLanguage();

  return (
    <div className={`rounded-3xl transition-all duration-300 overflow-hidden border-2 ${isOpen ? 'bg-white border-gray-100 shadow-soft' : 'bg-white border-transparent shadow-card'}`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full ${bg} flex items-center justify-center shrink-0`}>
            {icon}
          </div>
          <div>
            <h3 className="font-bold text-lg text-dark">{title}</h3>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">{subtitle}</p>
          </div>
        </div>
        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isOpen ? 'bg-gray-100 rotate-180' : 'bg-transparent'}`}>
            <ChevronDown size={20} className="text-gray-400" />
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-1 space-y-4">
            <div className="h-[1px] bg-gray-100 w-full mb-4"></div>
            
            <div className="flex gap-3">
                <div className="mt-1 text-brand-dark"><Info size={16} /></div>
                <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">{t('textTypes.labels.function')}</h4>
                    <p className="text-sm text-gray-600 leading-relaxed">{description}</p>
                </div>
            </div>

            <div className="flex gap-3">
                <div className="mt-1 text-brand-dark"><List size={16} /></div>
                <div>
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1">{t('textTypes.labels.structure')}</h4>
                    <p className="text-sm text-gray-600 font-medium">{structure}</p>
                </div>
            </div>

            <div className={`mt-2 p-4 rounded-xl ${bg.replace('100', '50')} border ${bg.replace('bg-', 'border-').replace('100', '200')}`}>
                <div className="flex items-center gap-2 mb-2 opacity-60">
                    <Quote size={14} />
                    <span className="text-[10px] font-bold uppercase">{t('textTypes.labels.example')}</span>
                </div>
                <p className="text-sm italic font-medium text-gray-700">"{example}"</p>
            </div>

            <button 
                onClick={async (e) => {
                    e.stopPropagation();
                    const content = [
                      { type: 'title' as const, text: title },
                      { type: 'author' as const, text: user?.name || '' },
                      { type: 'subtitle' as const, text: subtitle },
                      { type: 'subtitle' as const, text: t('textTypes.labels.function') },
                      { type: 'text' as const, text: description },
                      { type: 'subtitle' as const, text: t('textTypes.labels.structure') },
                      { type: 'text' as const, text: structure },
                      { type: 'subtitle' as const, text: t('textTypes.labels.example') },
                      { type: 'text' as const, text: `"${example}"` }
                    ];

                    await generatePdf({
                      title: title,
                      author: user?.name || '',
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
                className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-xl border-2 border-gray-200 text-gray-500 font-bold text-xs hover:bg-gray-50 hover:border-gray-300 transition-all"
            >
                <Download size={14} />
                <span>{t('common.downloadPdf')}</span>
            </button>
        </div>
      )}
    </div>
  );
};

export default TextTypes;
