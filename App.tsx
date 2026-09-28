import React, { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import { LanguageProvider } from './context/LanguageContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { billingService } from './services/billingService';

const Home = lazy(() => import('./pages/Home'));
const AiCorrection = lazy(() => import('./pages/AiCorrection'));
const Review = lazy(() => import('./pages/Review'));
const Register = lazy(() => import('./pages/Register'));
const Profile = lazy(() => import('./pages/Profile'));
const MyCorrections = lazy(() => import('./pages/MyCorrections'));
const CorrectionDetail = lazy(() => import('./pages/CorrectionDetail'));
const Chatbot = lazy(() => import('./pages/Chatbot'));
const Process = lazy(() => import('./pages/Process'));
const SmartRewrite = lazy(() => import('./pages/SmartRewrite'));
const Inspira = lazy(() => import('./pages/Inspira'));
const Imagine = lazy(() => import('./pages/Imagine'));
const RacoCreatiuIndividual = lazy(() => import('./pages/RacoCreatiuIndividual'));
const VoicePolisher = lazy(() => import('./pages/VoicePolisher'));
const BatallaLletres = lazy(() => import('./pages/BatallaLletres'));
const TextTypes = lazy(() => import('./pages/TextTypes'));
const FlashFix = lazy(() => import('./pages/FlashFix'));
const TextDuel = lazy(() => import('./pages/TextDuel'));
const Dictat = lazy(() => import('./pages/Dictat'));

const PageLoader = () => (
  <div className="flex h-screen w-full items-center justify-center bg-indigo-50">
    <div className="flex flex-col items-center gap-4">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent shadow-md"></div>
      <p className="font-medium text-indigo-600 animate-pulse">Carregant...</p>
    </div>
  </div>
);

const ScrollToTop = () => {
  const { pathname } = useLocation();
  React.useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
};

const App: React.FC = () => {
  React.useEffect(() => { billingService.initialize(); }, []);

  return (
    <ErrorBoundary>
      <LanguageProvider>
        <HashRouter>
          <ScrollToTop />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Register />} />
              <Route element={<Layout />}>
                <Route path="/home" element={<Home />} />
                <Route path="/ai-correction" element={<AiCorrection initialMode="free" />} />
                <Route path="/dictat" element={<AiCorrection initialMode="dictation" />} />
                <Route path="/smart-rewrite" element={<SmartRewrite />} />
                <Route path="/inspira" element={<Inspira />} />
                <Route path="/imagine" element={<Imagine />} />
                <Route path="/lab" element={<RacoCreatiuIndividual />} />
                <Route path="/voice-polisher" element={<VoicePolisher />} />
                <Route path="/correction/:id" element={<CorrectionDetail />} />
                <Route path="/text-types" element={<TextTypes />} />
                <Route path="/review" element={<Review />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/history" element={<MyCorrections />} />
                <Route path="/chatbot" element={<Chatbot />} />
                <Route path="/process" element={<Process />} />
                <Route path="/batalla-lletres" element={<BatallaLletres />} />
                <Route path="/text-duel" element={<TextDuel />} />
                <Route path="/flash-fix" element={<FlashFix />} />
              </Route>
            </Routes>
          </Suspense>
        </HashRouter>
      </LanguageProvider>
    </ErrorBoundary>
  );
};

export default App;
