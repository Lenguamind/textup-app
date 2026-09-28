import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, BarChart2, User, MessageCircle, ArrowLeft, BookOpen, Star, Zap } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { motion, AnimatePresence } from 'motion/react';

const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t, user } = useLanguage();
  const isHome = location.pathname === '/home';
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/');
    }
  }, [user, navigate]);

  useEffect(() => {
    const handleResize = () => {
      // A more robust way to detect virtual keyboard is checking if an input is focused
      // and the window height is significantly smaller than the screen height.
      // However, simple focus check is usually enough for mobile web apps.
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA');
      
      // On desktop/Chromebook, we don't want to hide the nav bar just because an input is focused,
      // unless the screen is actually small (mobile).
      if (isInputFocused && window.innerWidth < 768) {
        setIsKeyboardOpen(true);
      } else {
        setIsKeyboardOpen(false);
      }
    };

    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if ((target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && window.innerWidth < 768) {
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = () => {
      setIsKeyboardOpen(false);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  if (!user) return null;

  const getTitle = () => {
    switch (location.pathname) {
      case '/home': return t('titles.home');
      case '/ai-correction': return t('titles.aiCorrection');
      case '/smart-rewrite': return t('titles.dictation'); // Reusing the key but mapped to Detective Title
      case '/text-types': return t('titles.textTypes');
      case '/review': return t('titles.review');
      case '/profile': return t('titles.profile');
      case '/history': return t('titles.myCorrections');
      case '/chatbot': return t('titles.chatbot');
      case '/process': return t('titles.process');
      case '/raco-creatiu': return t('racoCreatiu.title');
      default: return 'TEXTUP!';
    }
  };

  return (
    <div className="w-full md:max-w-2xl lg:max-w-4xl mx-auto min-h-[100dvh] flex flex-col relative bg-pop-bg sm:border-x-4 sm:border-pop-dark shadow-2xl overflow-hidden">
      
      {/* Header - Chunky & Sticky */}
      <header className="px-5 py-4 flex items-center justify-between sticky top-0 z-50 bg-pop-bg/95 backdrop-blur-sm border-b-4 border-pop-dark transition-all">
        {!isHome ? (
          <button 
            onClick={() => {
              if (window.history.state && window.history.state.idx > 0) {
                navigate(-1);
              } else {
                navigate('/home');
              }
            }} 
            className="w-12 h-12 bg-white border-3 border-pop-dark rounded-xl flex items-center justify-center text-pop-dark shadow-neo btn-press transition-all"
          >
            <ArrowLeft size={24} strokeWidth={3} />
          </button>
        ) : (
          <div className="flex items-center gap-2 bg-pop-yellow border-3 border-pop-dark px-3 py-1.5 rounded-full shadow-neo-sm transform -rotate-2">
             <Star size={20} className="text-pop-dark fill-white" strokeWidth={2.5} />
             <span className="text-base font-black text-pop-dark">{user.xp || 0}</span>
          </div>
        )}
        
        <h1 className="font-display font-black text-xl text-pop-dark tracking-tighter italic transform skew-x-[-10deg]">
          {getTitle()}
        </h1>

        <div className="w-12 h-12 flex items-center justify-center">
          {isHome ? (
             <button 
               onClick={() => navigate('/chatbot')}
               className="w-12 h-12 rounded-full bg-pop-blue text-pop-dark border-3 border-pop-dark shadow-neo flex items-center justify-center btn-press transition-all"
             >
               <MessageCircle size={24} strokeWidth={3} className="text-white fill-pop-dark" />
             </button>
          ) : (
             <div className="w-6" />
          )}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-5 py-6 overflow-y-auto no-scrollbar pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom Navigation - Floating Island */}
      <div 
        className={`fixed left-0 right-0 flex justify-center z-50 px-4 pointer-events-none transition-all duration-300 ${isKeyboardOpen ? 'translate-y-32 opacity-0' : 'translate-y-0 opacity-100'}`}
        style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <nav className="bg-pop-dark rounded-2xl px-6 py-4 shadow-2xl flex items-center gap-6 pointer-events-auto max-w-xs md:max-w-md w-full justify-between transform -rotate-1 border-b-4 border-black">
            <NavLink 
                to="/home" 
                icon={<Home size={26} strokeWidth={3} />} 
                isActive={isHome}
                color="text-pop-green"
            />
            <NavLink 
                to="/text-types" 
                icon={<BookOpen size={26} strokeWidth={3} />} 
                isActive={location.pathname === '/text-types'}
                color="text-pop-yellow"
            />
            <NavLink 
                to="/history" 
                icon={<BarChart2 size={26} strokeWidth={3} />} 
                isActive={location.pathname === '/history'}
                color="text-pop-blue"
            />
            <NavLink 
                to="/profile" 
                icon={<User size={26} strokeWidth={3} />} 
                isActive={location.pathname.includes('/profile')}
                color="text-pop-pink"
            />
        </nav>
      </div>
    </div>
  );
};

interface NavLinkProps {
    to: string;
    icon: React.ReactNode;
    isActive: boolean;
    color: string;
}

const NavLink: React.FC<NavLinkProps> = ({ to, icon, isActive, color }) => (
    <Link 
        to={to} 
        className={`relative transition-all duration-300 ${
            isActive 
            ? `${color} transform scale-125 -translate-y-2` 
            : 'text-gray-500 hover:text-white'
        }`}
    >
        {icon}
        {isActive && (
            <span className={`absolute -bottom-3 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white`}></span>
        )}
    </Link>
);

export default Layout;