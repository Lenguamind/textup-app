import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Globe } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';

import { LANGUAGE_NAMES } from '../constants/languages';

const Register: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const { t, login, setLanguage, language, user } = useLanguage();
  const navigate = useNavigate();

  React.useEffect(() => {
    if (user && user.uid && !user.uid.startsWith('guest_')) {
      navigate('/home');
    }
  }, [user, navigate]);

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      // Cridar a login() sense arguments desencadena Firebase signInWithPopup a LanguageContext
      await login();
      navigate('/home');
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
          // Firebase internal bug: INTERNAL ASSERTION FAILED: Pending promise was never set
          if (err.message && err.message.includes('Pending promise was never set')) {
              setError(t('common.error') || 'Error intern de Firebase: si us plau, recarrega la pàgina i torna-ho a intentar.');
          } else {
              setError(err.message || 'Error en iniciar sessió amb Google');
          }
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-[#e0f7fa] to-[#e8f5e9] flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">
      <div className="w-full max-w-sm z-10 flex flex-col items-center animate-fade-in">
        
        {/* LOGO */}
        <div className="relative mb-6 transform -rotate-2 group">
            <div className="absolute inset-0 bg-[#0d1627] translate-x-1.5 translate-y-1.5" />
            <h1 className="relative text-4xl sm:text-5xl font-black text-[#0d1627] tracking-tight bg-white px-4 py-1 sm:py-2 border-4 border-[#0d1627]">
                TEXTUP<span className="text-[#3fdc81]">!</span>
            </h1>
        </div>

        {/* MAIN CARD */}
        <div className="w-full bg-white p-6 sm:p-8 rounded-3xl border-2 border-[#0d1627] shadow-[6px_6px_0px_0px_rgba(13,22,39,1)] relative">
            
            {/* LANGUAGE SELECTOR */}
            <div className="mb-6 relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-[#0d1627] transition-colors pointer-events-none">
                    <Globe size={20} />
                </div>
                <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as any)}
                    className="w-full bg-gray-50 border-2 border-gray-200 focus:border-[#0d1627] rounded-xl py-2 pl-11 pr-4 outline-none transition-all text-[#0d1627] font-bold appearance-none cursor-pointer hover:bg-gray-100 focus:bg-white"
                >
                    {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
                        <option key={code} value={code}>
                            {name} ({code.toUpperCase()})
                        </option>
                    ))}
                </select>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" fillRule="evenodd"></path></svg>
                </div>
            </div>

            <h2 className="text-[20px] sm:text-[22px] font-black text-[#0d1627] mb-6 text-center tracking-tight leading-snug">
                {t('auth.loginTitle')}
            </h2>

            {/* OAUTH GOOGLE BUTTON */}
            <div className="space-y-4">
                <button 
                  onClick={handleGoogleLogin}
                  disabled={isLoading}
                  className="w-full bg-white text-[#0d1627] font-black text-[18px] py-4 rounded-xl border-2 border-gray-200 hover:border-[#0d1627] hover:bg-gray-50 flex items-center justify-center gap-3 transition-colors shadow-sm"
                >
                    {isLoading ? (
                        <Loader2 size={24} className="animate-spin text-[#0d1627]" />
                    ) : (
                        <>
                            <svg viewBox="0 0 24 24" className="w-6 h-6" xmlns="http://www.w3.org/2000/svg">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                            </svg>
                            <span>{t('auth.google') || 'Sign in with Google'}</span>
                        </>
                    )}
                </button>

                {error && (
                    <div className="bg-red-50 text-red-500 font-bold border-2 border-red-100 p-3 rounded-xl text-center text-sm items-center justify-center animate-fade-in">
                        {error}
                    </div>
                )}
            </div>
            
            <p className="mt-8 text-center text-xs text-gray-400 font-medium px-4">
              {t('auth.terms')}
            </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
