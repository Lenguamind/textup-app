import React, { useState, ReactNode, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { onAuthStateChanged, signInWithCredential, GoogleAuthProvider, signOut, User as FirebaseUser } from 'firebase/auth';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { auth, googleProvider } from '../lib/firebase';
import firebaseConfig from '../firebase-applet-config.json';
import { LanguageContext } from './LanguageContextObject';
import { Language, Translations } from '../types/language';
import { getByPath } from '../lib/utils';
import { StorageService, StorageKey } from '../services/storageService';
import { billingService } from '../services/billingService';
import { getUserStatus } from '../services/apiService';

const originalSetItem = localStorage.setItem;
localStorage.setItem = function(key: string, value: string) {
    const event = new Event('textUpLocalUpdate');
    (event as any).key = key;
    (event as any).value = value;
    window.dispatchEvent(event);
    originalSetItem.call(localStorage, key, value);
};

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return StorageService.getItem<Language>(StorageKey.LANGUAGE, 'es');
  });

  const [loadedTranslations, setLoadedTranslations] = useState<Record<string, Translations>>({});
  const [loading, setLoading] = useState(true);

  const [user, setUser] = useState<any>(() => {
    return StorageService.getItem<any>(StorageKey.USER, null);
  });

  useEffect(() => {
    const checkOfflinePremium = async () => {
      if (Capacitor.isNativePlatform()) {
        const isPremium = await billingService.isPremiumOffline();
        if (isPremium) {
          setUser((prev: any) => prev ? { ...prev, isPremium: true } : prev);
        }
      } else {
        setUser((prev: any) => prev ? { ...prev, isPremium: false } : prev);
      }
    };
    checkOfflinePremium();
  }, []);

  const syncWithBackend = useCallback(async (userId: string) => {
    try {
        const backendUser = await getUserStatus(userId);
        if (backendUser && (backendUser as any).success) {
            setUser((prev: any) => ({
                ...prev,
                isPremium: !!(backendUser as any).isPremium,
                remainingUses: (backendUser as any).remainingUses
            }));
        }
    } catch (err) {
        console.error("Error syncing with backend:", err);
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setUser((currentPrev: any) => {
          const newUser = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || 'Usuari',
            email: firebaseUser.email || '',
            photoURL: firebaseUser.photoURL || '',
            xp: currentPrev?.xp || 0,
            isPremium: currentPrev?.isPremium || false,
            dailyUsage: currentPrev?.dailyUsage || 0
          };
          localStorage.setItem('textup_user_id', firebaseUser.uid);
          syncWithBackend(firebaseUser.uid);
          return newUser;
        });
      } else {
        console.log("No firebase user");
      }
    });
    return () => unsubscribe();
  }, [syncWithBackend]);

  useEffect(() => {
    if (user?.uid) {
        localStorage.setItem('textup_user_id', user.uid);
        StorageService.setItem(StorageKey.USER, user);
    }
  }, [user]);

  useEffect(() => {
    if (user?.uid) {
        syncWithBackend(user.uid);
    }
  }, [syncWithBackend, user?.uid]);

  useEffect(() => {
    const handlePremiumUpdate = (event: any) => {
      if (event.detail === true) {
        setUser((prev: any) => ({ ...prev, isPremium: true }));
      }
    };
    window.addEventListener('user-premium-updated', handlePremiumUpdate);
    return () => window.removeEventListener('user-premium-updated', handlePremiumUpdate);
  }, []);

  const loadTranslations = useCallback(async (lang: Language) => {
    if (loadedTranslations[lang]) return;
    setLoading(true);
    try {
      let module;
      switch (lang) {
        case 'en': module = await import('../translations/en'); break;
        case 'es': module = await import('../translations/es'); break;
        case 'fr': module = await import('../translations/fr'); break;
        case 'ca': module = await import('../translations/ca'); break;
        case 'it': module = await import('../translations/it'); break;
        case 'de': module = await import('../translations/de'); break;
        case 'pt': module = await import('../translations/pt'); break;
        case 'pl': module = await import('../translations/pl'); break;
        case 'nl': module = await import('../translations/nl'); break;
        case 'sv': module = await import('../translations/sv'); break;
        case 'no': module = await import('../translations/no'); break;
        case 'da': module = await import('../translations/da'); break;
        case 'uk': module = await import('../translations/uk'); break;
        case 'ru': module = await import('../translations/ru'); break;
        default: module = await import('../translations/en'); break;
      }
      const data = (module as any)[lang];
      setLoadedTranslations(prev => ({ ...prev, [lang]: data }));
    } catch (error) {
      console.error(`Failed to load translations for ${lang}`, error);
      if (lang !== 'en') {
        try {
            const enModule = await import('../translations/en');
            setLoadedTranslations(prev => ({ ...prev, en: (enModule as any).en }));
        } catch (e) {
            console.error("Critical: Could not load fallback translations", e);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [loadedTranslations]);

  useEffect(() => {
    loadTranslations(language);
    if (language !== 'en') {
        loadTranslations('en');
    }
  }, [language, loadTranslations]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    StorageService.setItem(StorageKey.LANGUAGE, lang);
  };

  const login = async () => {
      try {
          if (Capacitor.isNativePlatform()) {
              const result = await FirebaseAuthentication.signInWithGoogle();
              if (result.credential?.idToken) {
                const credential = GoogleAuthProvider.credential(result.credential.idToken);
                await signInWithCredential(auth, credential);
              }
          } else {
              const { signInWithPopup } = await import('firebase/auth');
              await signInWithPopup(auth, googleProvider);
          }
      } catch (error: any) {
          console.error("Login error:", error);
          if (Capacitor.isNativePlatform()) {
              if (error.message && error.message.includes('activity is cancelled')) {
                  return;
              }
              alert(`Error Firebase: ${error.message || error.code || 'Desconegut'}.\n\nConsell: Revisa que el google-services.json sigui del teu projecte i tinguis les claus SHA-1 configurades a la consola de Firebase.`);
          }
          throw error;
      }
  };

  const continueAsGuest = () => {
      const newUser = {
          uid: localStorage.getItem('textup_user_id') || ('guest_' + Math.random().toString(36).substring(2, 11)),
          name: 'Convidat',
          xp: 0,
          dailyUsage: 0,
          isPremium: false,
          email: ''
      };
      setUser(newUser);
      StorageService.setItem(StorageKey.USER, newUser);
  };

  const logout = async () => {
      try {
          if (auth.currentUser) {
              await signOut(auth);
          }
      } catch (error) {
          console.error("Logout error:", error);
      } finally {
          setUser(null);
          StorageService.removeItem(StorageKey.USER);
      }
  };

  const updateUser = async (data: any) => {
      setUser((prev: any) => ({ ...prev, ...data }));
  };

  const addXp = (amount: number) => {
      if (user) {
          updateUser({ xp: (user.xp || 0) + amount });
      }
  };

  const t = (path: string) => {
    const value = getByPath(loadedTranslations[language], path);
    if (value !== undefined) return value as unknown as string;
    if (language !== 'en') {
        const fallbackValue = getByPath(loadedTranslations['en'], path);
        if (fallbackValue !== undefined) return fallbackValue as unknown as string;
    }
    return path;
  };

  const isPremiumUser = () => {
      return !!(user?.isPremium);
  };

  const checkUsage = () => {
    if (isPremiumUser()) return true;
    return (user?.dailyUsage || 0) < 9999;
  };

  const incrementUsage = () => {
    if (isPremiumUser()) return;
    updateUser({
        dailyUsage: (user?.dailyUsage || 0) + 1,
        lastUsageTimestamp: Date.now()
    });
  };

  const syncPremiumStatus = async () => {
    if (Capacitor.isNativePlatform()) {
      try {
        await billingService.restore();
        const isPremium = await billingService.isPremiumOffline();
        updateUser({ isPremium });
        return isPremium;
      } catch (err) {
        console.error("Error syncing premium status:", err);
      }
    }
    return user?.isPremium || false;
  };

  return (
    <LanguageContext.Provider value={{
        language,
        setLanguage,
        t,
        user,
        login,
        logout,
        continueAsGuest,
        updateUser,
        addXp,
        checkUsage,
        incrementUsage,
        isAiStudioConnected: false,
        isPremiumUser,
        syncPremiumStatus
    }}>
      {loading && !loadedTranslations[language] ? (
          <div className="fixed inset-0 bg-white flex items-center justify-center z-50">
              <div className="animate-pulse flex flex-col items-center">
                  <div className="w-12 h-12 bg-indigo-500 rounded-full mb-4"></div>
                  <div className="h-4 w-24 bg-gray-200 rounded"></div>
              </div>
          </div>
      ) : children}
    </LanguageContext.Provider>
  );
};
