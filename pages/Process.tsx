import React, { useState } from 'react';
import { Lightbulb, PenLine, Search, CheckCircle2, Share2, ChevronDown, Circle } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';

const Process: React.FC = () => {
  const { t } = useLanguage();

  const steps = [
    { key: 'planning', icon: <Lightbulb size={24} />, color: 'bg-comic-yellow text-comic-yellowText' },
    { key: 'drafting', icon: <PenLine size={24} />, color: 'bg-comic-blue text-comic-blueText' },
    { key: 'revising', icon: <Search size={24} />, color: 'bg-comic-purple text-comic-purpleText' },
    { key: 'editing', icon: <CheckCircle2 size={24} />, color: 'bg-comic-red text-comic-redText' },
    { key: 'publishing', icon: <Share2 size={24} />, color: 'bg-brand text-brand-dark' },
  ];

  return (
    <div className="flex flex-col gap-6 pt-2">
      <div>
        <h2 className="text-3xl font-black text-comic-dark">{t('process.header')}</h2>
        <p className="text-gray-500 font-bold mt-1">{t('process.subHeader')}</p>
      </div>

      <div className="flex flex-col gap-4 relative">
        {/* Connector Line */}
        <div className="absolute left-[26px] top-8 bottom-8 w-[2px] bg-gray-200 border-l-2 border-dashed border-gray-300 z-0" />

        {steps.map((step, index) => (
          <ProcessStep 
            key={step.key}
            index={index + 1}
            stepKey={step.key}
            icon={step.icon}
            color={step.color}
          />
        ))}
      </div>
    </div>
  );
};

interface ProcessStepProps {
  index: number;
  stepKey: string;
  icon: React.ReactNode;
  color: string;
}

const ProcessStep: React.FC<ProcessStepProps> = ({ index, stepKey, icon, color }) => {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  
  // Fetch data dynamically based on key
  const title = t(`process.steps.${stepKey}.title`);
  const desc = t(`process.steps.${stepKey}.desc`);
  const points = t(`process.steps.${stepKey}.points`) as unknown as string[];

  return (
    <div className={`z-10 bg-white rounded-3xl shadow-card border-2 ${isOpen ? 'border-comic-dark shadow-comic-soft' : 'border-transparent hover:border-gray-200'} transition-all overflow-hidden`}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center gap-4 text-left"
      >
        <div className={`w-14 h-14 rounded-2xl ${color} flex items-center justify-center shrink-0 shadow-sm relative border-2 border-current`}>
            {icon}
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-comic-dark text-comic-dark shadow-sm">
                {index}
            </div>
        </div>
        
        <div className="flex-1">
          <h3 className="font-bold text-lg text-comic-dark">{title}</h3>
          {!isOpen && <p className="text-xs text-gray-500 line-clamp-1 font-medium">{desc}</p>}
        </div>

        <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 border-transparent ${isOpen ? 'bg-gray-100 rotate-180 border-gray-200' : 'bg-transparent'}`}>
            <ChevronDown size={20} className="text-gray-400" />
        </div>
      </button>

      {isOpen && (
        <div className="px-5 pb-5 pt-1 animate-fade-in">
           <p className="text-sm text-gray-600 mb-4 font-medium leading-relaxed">
             {desc}
           </p>
           
           <div className="bg-gray-50 rounded-xl p-4 space-y-3 border-2 border-gray-100">
              {points.map((point, idx) => (
                  <div key={idx} className="flex gap-3 items-start">
                      <Circle size={8} className="mt-1.5 text-brand shrink-0" fill="currentColor" />
                      <span className="text-sm text-gray-700 font-medium">{point}</span>
                  </div>
              ))}
           </div>
        </div>
      )}
    </div>
  );
};

export default Process;
