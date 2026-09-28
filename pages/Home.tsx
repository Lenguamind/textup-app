import React, { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Book, Layout, CheckCircle, Users, Sparkles, History, ArrowRight, PenTool, Flame, Zap, Search, Mic, FlaskConical, Repeat, Layers, Lock, BookOpen, Swords, Compass, Anchor, Megaphone } from 'lucide-react'; 
import { useLanguage } from '../hooks/useLanguage';

const Home: React.FC = () => {
  const { t, user, isPremiumUser } = useLanguage();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !user.uid) {
      navigate('/');
    }
  }, [user, navigate]);

  if (!user || !user.uid) return null;

  return (
    <div className="flex flex-col gap-6">
      
      {/* Motivational / Streak Header */}
      <div className="flex justify-between items-end mb-2">
         <div className="relative">
             <div className="absolute -top-6 -left-4 w-16 h-16 bg-pop-yellow rounded-full blur-2xl opacity-50"></div>
             <h1 className="text-5xl font-black text-pop-dark tracking-tighter leading-none italic transform -rotate-2">
               TEXTUP<span className="text-pop-green">!</span>
             </h1>
         </div>
         
         {/* Streak Card - Massive & Animated */}
         <div className="relative group">
             <div className="absolute inset-0 bg-pop-dark rounded-2xl translate-x-1 translate-y-1"></div>
             <div className="relative bg-white border-3 border-pop-dark rounded-2xl px-3 py-2 flex flex-col items-center btn-press">
                 <div className="flex items-center gap-1 text-pop-orange animate-pulse-fast">
                    <Flame size={28} fill="currentColor" strokeWidth={3} />
                    <span className="text-2xl font-black">{user?.streak || 0}</span>
                 </div>
                 <span className="text-[10px] font-black text-pop-dark uppercase leading-none bg-pop-yellow px-1 rounded-sm">{t('common.dayStreak').split(' ')[0]}</span>
             </div>
         </div>
      </div>

      {/* Menu Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        
        {/* Correction (Hero Card) */}
        <div className="col-span-2 md:col-span-3 lg:col-span-4">
            <Link 
                to="/ai-correction" 
                className="block relative group"
            >
                <div className="absolute inset-0 bg-pop-dark rounded-3xl translate-x-2 translate-y-2 group-hover:translate-x-3 group-hover:translate-y-3 transition-transform"></div>
                <div className="relative bg-pop-green p-6 rounded-3xl border-3 border-pop-dark flex items-center justify-between overflow-hidden btn-press">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-black to-transparent bg-[length:10px_10px]"></div>

                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-16 h-16 bg-white border-3 border-pop-dark rounded-2xl flex items-center justify-center text-pop-dark shadow-sm transform -rotate-6 group-hover:rotate-6 transition-transform duration-300">
                            <CheckCircle size={32} strokeWidth={3} className="text-pop-green fill-pop-dark" />
                        </div>
                        <div>
                            <h3 className="font-black text-2xl text-pop-dark leading-none">{t('home.menu.correction.title')}</h3>
                            <p className="text-sm text-pop-dark font-bold mt-1 bg-white/30 px-2 py-0.5 rounded-lg inline-block">{t('home.menu.correction.subtitle')}</p>
                        </div>
                    </div>
                    <div className="w-12 h-12 bg-pop-dark rounded-full flex items-center justify-center text-white border-3 border-white group-hover:scale-110 transition-transform relative z-10">
                        <ArrowRight size={24} strokeWidth={4} />
                    </div>
                </div>
            </Link>
        </div>

        {/* Smart Rewrite (Detectiu Ortogràfic) - Yellow */}
         <MenuCard 
          icon={<Search size={28} strokeWidth={3} />}
          title={t('detective.title')}
          bg="bg-pop-yellow"
          rotate="rotate-1"
          path="/smart-rewrite"
        />

        {/* Inspira - Orange */}
        <MenuCard 
          icon={<Compass size={28} strokeWidth={3} />}
          title={t('inspira.title')}
          bg="bg-pop-orange"
          rotate="-rotate-1"
          path="/inspira"
        />

        {/* Imagine - Indigo */}
        <MenuCard 
          icon={<Sparkles size={28} strokeWidth={3} />}
          title={t('imagine.title')}
          bg="bg-indigo-300"
          rotate="rotate-2"
          path="/imagine"
        />

        {/* FlashFix - Orange/Red */}
        <MenuCard 
          icon={<Anchor size={28} strokeWidth={3} />}
          title={t('flashFix.title')}
          bg="bg-pop-orange"
          rotate="rotate-1"
          path="/flash-fix"
        />

        {/* Voice Polisher - Blue */}
        <MenuCard 
          icon={<Megaphone size={28} strokeWidth={3} />}
          title={t('voicePolisher.title')}
          bg="bg-pop-blue"
          rotate="-rotate-2"
          path="/voice-polisher"
        />

        {/* Linguistic Lab - Green */}
        <MenuCard 
          icon={<PenTool size={28} strokeWidth={3} />}
          title={t('lab.title')}
          bg="bg-pop-green"
          rotate="rotate-2"
          path="/lab"
        />

        {/* Raco Creatiu - Pink */}
        <div className="col-span-2 md:col-span-3 lg:col-span-4">
            <Link 
                to="/batalla-lletres" 
                className="block relative group"
            >
                <div className="absolute inset-0 bg-pop-dark rounded-3xl translate-x-2 translate-y-2 group-hover:translate-x-3 group-hover:translate-y-3 transition-transform"></div>
                <div className="relative bg-pop-pink p-5 rounded-3xl border-3 border-pop-dark flex items-center justify-between overflow-hidden btn-press">
                    <div className="flex items-center gap-4 relative z-10">
                        <div className="w-14 h-14 bg-white border-3 border-pop-dark rounded-2xl flex items-center justify-center text-pop-dark shadow-sm transform rotate-3 group-hover:-rotate-3 transition-transform duration-300">
                            <Swords size={28} strokeWidth={3} className="text-pop-pink fill-pop-dark" />
                        </div>
                        <div>
                            <h3 className="font-black text-xl text-pop-dark leading-none">{t('racoCreatiu.title')}</h3>
                            <p className="text-sm text-pop-dark font-bold mt-1 bg-white/30 px-2 py-0.5 rounded-lg inline-block">{t('racoCreatiu.desc')}</p>
                        </div>
                    </div>
                    <div className="w-10 h-10 bg-pop-dark rounded-full flex items-center justify-center text-white border-3 border-white group-hover:scale-110 transition-transform relative z-10">
                        <ArrowRight size={20} strokeWidth={4} />
                    </div>
                </div>
            </Link>
        </div>

      </div>
    </div>
  );
};

interface MenuCardProps {
  icon: React.ReactNode;
  title: string;
  bg: string;
  rotate: string;
  path: string;
  isLocked?: boolean;
}

const MenuCard: React.FC<MenuCardProps> = ({ icon, title, bg, rotate, path, isLocked }) => {
  return (
    <Link 
        to={path} 
        className={`block relative group h-full ${rotate}`}
    >
      <div className="absolute inset-0 bg-pop-dark rounded-3xl translate-x-1.5 translate-y-1.5"></div>
      <div className={`${bg} h-full p-4 rounded-3xl border-3 border-pop-dark flex flex-col gap-3 relative btn-press justify-between overflow-hidden`}>
        {/* Shine effect */}
        <div className="absolute -top-10 -right-10 w-20 h-20 bg-white/20 rounded-full blur-xl"></div>
        
        {isLocked && (
            <div className="absolute top-2 right-2 bg-pop-dark text-white p-1 rounded-full z-20">
                <Lock size={14} strokeWidth={3} />
            </div>
        )}

        <div className="w-12 h-12 bg-white rounded-xl border-3 border-pop-dark flex items-center justify-center shrink-0 shadow-sm text-pop-dark relative z-10">
            {icon}
        </div>
        <h3 className="font-black text-lg text-pop-dark leading-none tracking-tight relative z-10">{title}</h3>
      </div>
    </Link>
  );
};

export default Home;