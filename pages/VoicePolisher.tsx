import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, RotateCcw, Sparkles, Copy, Download, Check, AlertCircle, Wand2, MessageSquare } from 'lucide-react';
import { VoiceRecorder } from 'capacitor-voice-recorder';
import { useLanguage } from '../hooks/useLanguage';
import { callGemini } from '../services/apiService';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

const VoicePolisher: React.FC = () => {
  const { t, language, user, isPremiumUser } = useLanguage();
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'results'>('idle');
  const [recordingTime, setRecordingTime] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [results, setResults] = useState<{
    variants: { style: string; text: string }[];
    feedback: string;
  } | null>(null);
  const [selectedStyle, setSelectedStyle] = useState('formal');
  const [isRefining, setIsRefining] = useState(false);
  const [refineQuery, setRefineQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const isCapacitorRecordingRef = useRef<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const styles = [
    { id: 'formal', icon: <MessageSquare size={20} />, label: t('voicePolisher.styles.formal') || 'Formal' },
    { id: 'informal', icon: <MessageSquare size={20} />, label: t('voicePolisher.styles.informal') || 'Informal' },
    { id: 'creative', icon: <Wand2 size={20} />, label: t('voicePolisher.styles.creative') || 'Creatiu' },
  ];

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = async () => {
    setError(null);
    setTranscript('');
    audioChunksRef.current = [];
    isCapacitorRecordingRef.current = false;

    try {
      const isCapacitor = (window as any).Capacitor !== undefined;
      if (isCapacitor) {
        console.log('Detectat entorn Capacitor. Sol·licitant permisos de gravació natius...');
        const hasPermission = await VoiceRecorder.hasAudioRecordingPermission();
        let allowed = hasPermission.value;
        if (!allowed) {
          const reqPerm = await VoiceRecorder.requestAudioRecordingPermission();
          allowed = reqPerm.value;
        }

        if (!allowed) {
          setError(t('voicePolisher.micError') || 'Permís de micròfon denegat.');
          return;
        }

        const result = await VoiceRecorder.startRecording();
        if (result.value) {
          isCapacitorRecordingRef.current = true;
          setStatus('recording');
          setRecordingTime(0);
          timerRef.current = setInterval(() => {
            setRecordingTime((prev) => prev + 1);
          }, 1000);
          return;
        }
      }
    } catch (capErr) {
      console.warn('Capacitor recording failed to initialize, falling back to Web API:', capErr);
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError(t('voicePolisher.micError') || 'El teu navegador no suporta l\'accés al micròfon.');
      return;
    }

    if (typeof MediaRecorder === 'undefined') {
      setError(t('voicePolisher.micError') || 'El teu navegador no suporta la gravació de veu.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const mimeTypes = ['audio/webm', 'audio/mp4', 'audio/aac', 'audio/wav'];
      const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || '';
      
      const mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const finalMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: finalMimeType });
        
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1];
          // ✅ Neteja el base64 del fallback web
          const cleanBase64 = base64Audio.replace(/\s/g, '');
          await processAudioBase64(cleanBase64, finalMimeType);
        };
      };

      mediaRecorder.start();
      setStatus('recording');
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Error accessing microphone:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError(t('voicePolisher.micError') || 'Permís denegat. Activa el micròfon a la configuració.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError(t('voicePolisher.micError') || 'No s\'ha trobat cap micròfon.');
      } else {
        setError(t('voicePolisher.micError') || 'Error inesperat al micròfon. Prova de reiniciar l\'app.');
      }
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (isCapacitorRecordingRef.current) {
      setStatus('processing');
      try {
        const recordingData = await VoiceRecorder.stopRecording();
        if (recordingData && recordingData.value && recordingData.value.recordDataBase64) {
          const base64Audio = recordingData.value.recordDataBase64;
          const mimeType = recordingData.value.mimeType || 'audio/aac';
          // ✅ Neteja el base64 de Capacitor
          const cleanBase64 = base64Audio.replace(/\s/g, '');
          await processAudioBase64(cleanBase64, mimeType);
        } else {
          setError('No s\'ha pogut recuperar la gravació del mòbil o és buida.');
          setStatus('idle');
        }
      } catch (err) {
        console.error('Error stopping Capacitor recording:', err);
        setError('Error en aturar la gravació al mòbil.');
        setStatus('idle');
      }
    } else {
      if (mediaRecorderRef.current && status === 'recording') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
        setStatus('processing');
      } else {
        setStatus('idle');
      }
    }
  };

  const processAudioBase64 = async (base64Audio: string, mimeType: string) => {
    setStatus('processing');
    setError(null);

    // ✅ Neteja final per garantir base64 vàlid (sense espais ni salts de línia)
    const cleanBase64 = base64Audio
      .replace(/\n/g, '')
      .replace(/\r/g, '')
      .replace(/\s/g, '');

    // ✅ Comprovació de depuració
    console.log('Base64 length:', cleanBase64.length);
    if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
      console.error('Base64 invàlid després de netejar!');
      setError('Error: dades d\'àudio corruptes. Torna a gravar.');
      setStatus('idle');
      return;
    }

    try {
      let geminiMimeType = mimeType.split(';')[0];
      if (!geminiMimeType || geminiMimeType === 'audio/mp4') {
        geminiMimeType = 'audio/aac';
      }
      if (geminiMimeType === 'audio/x-matroska') {
        geminiMimeType = 'audio/webm';
      }
      if (geminiMimeType.includes('3gpp') || geminiMimeType.includes('3gp')) {
        geminiMimeType = 'audio/3gpp';
      }

      const prompt = `
        Actua com un expert lingüístic en ${language === 'ca' ? 'Català' : language === 'es' ? 'Espanyol' : 'Anglès'}.
        Primer, transcriu l'àudio exactament com s'ha dit.
        Després, crea 3 variants polides del text: una Formal, una Informal i una Creativa.
        Finalment, dóna un breu consell lingüístic sobre com millorar l'expressió oral.
        
        Respon EXCLUSIVAMENT en format JSON amb aquesta estructura:
        {
          "transcript": "la transcripció original",
          "variants": [
            {"style": "formal", "text": "text polit formal"},
            {"style": "informal", "text": "text polit informal"},
            {"style": "creative", "text": "text polit creatiu"}
          ],
          "feedback": "consell lingüístic breu"
        }
      `;

      try {
        const response = await callGemini(
          'gemini-2.5-flash',
          [
            {
              parts: [
                { text: prompt },
                // ✅ Usa cleanBase64 en lloc de base64Audio
                { inlineData: { mimeType: geminiMimeType, data: cleanBase64 } }
              ]
            }
          ],
          undefined,
          { responseMimeType: 'application/json' }
        );

        const data = response.text || '{}';
        
        try {
          const parsedData = JSON.parse(data);
          if (!parsedData.variants || !Array.isArray(parsedData.variants)) {
            throw new Error("Invalid format");
          }
          setTranscript(parsedData.transcript || '');
          setResults({
            variants: parsedData.variants,
            feedback: parsedData.feedback || ''
          });
          setStatus('results');
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#8B5CF6', '#F59E0B', '#10B981']
          });
        } catch(e) {
          const match = data.match(/```(?:json)?\n([\s\S]*)\n```/);
          if (match) {
            const parsedData = JSON.parse(match[1]);
            setTranscript(parsedData.transcript || '');
            setResults({
              variants: parsedData.variants || [],
              feedback: parsedData.feedback || ''
            });
            setStatus('results');
            confetti({
              particleCount: 100,
              spread: 70,
              origin: { y: 0.6 },
              colors: ['#8B5CF6', '#F59E0B', '#10B981']
            });
          } else {
            throw new Error('Invalid AI response');
          }
        }
      } catch (error: any) {
        console.error('AI Error:', error);
        if (error?.message === 'AI_QUOTA_EXCEEDED') {
          setError(t('errors.quota') || "⏳ Quota diària esgotada al servidor.");
        } else if (error?.message === 'AI_SERVER_OVERLOAD') {
          setError(t('errors.serverOverload') || "⏳ Servidor sobrecarregat. Reintentant...");
        } else {
          setError(t('common.error') || 'S\'ha produït un error');
        }
        setStatus('idle');
      }
    } catch (err) {
      console.error('Processing Error:', err);
      setError(t('common.error') || 'S\'ha produït un error');
      setStatus('idle');
    }
  };

  const handleRefine = async () => {
    if (!refineQuery.trim() || !results) return;
    setIsRefining(true);

    try {
      const prompt = `
        Basant-te en aquesta transcripció: "${transcript}"
        I aquestes variants actuals: ${JSON.stringify(results.variants)}
        L'usuari vol refinar el text així: "${refineQuery}"
        
        Genera una nova variant que segueixi aquesta instrucció.
        Respon EXCLUSIVAMENT amb el text de la nova variant, sense cap altre comentari.
      `;

      const result = await callGemini(
        'gemini-2.5-flash',
        [{ parts: [{ text: prompt }] }]
      );
      const newText = result.text || '';

      setResults({
        ...results,
        variants: [{ style: 'refined', text: newText }, ...results.variants]
      });
      setRefineQuery('');
      confetti({
        particleCount: 50,
        spread: 50,
        origin: { y: 0.8 }
      });
    } catch (err) {
      console.error('Refine Error:', err);
    } finally {
      setIsRefining(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <AnimatePresence mode="wait">
        {status === 'idle' && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center gap-8 text-center"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-pop-purple blur-3xl opacity-20 animate-pulse"></div>
              <div className="w-40 h-40 bg-pop-purple rounded-full border-4 border-pop-dark flex items-center justify-center relative shadow-neo-lg group cursor-pointer btn-press"
                onClick={startRecording}
              >
                <Mic size={64} className="text-white group-hover:scale-110 transition-transform" strokeWidth={3} />
                <div className="absolute -top-2 -right-2 bg-pop-yellow text-pop-dark font-black text-xs px-2 py-1 rounded-lg border-2 border-pop-dark transform rotate-12">
                  {t('voicePolisher.aiPowered')}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-4xl font-black text-pop-dark uppercase italic tracking-tight">
                {t('voicePolisher.title') || 'Com ho diria?'}
              </h2>
              <p className="text-gray-600 font-bold text-lg">
                {t('voicePolisher.desc') || 'Grava la teva veu i la IA la transformarà en un text perfecte.'}
              </p>
            </div>

            {error && (
              <div className="bg-red-100 border-2 border-red-500 text-red-700 p-4 rounded-xl font-bold flex items-center gap-2">
                <AlertCircle size={20} />
                {error}
              </div>
            )}

            <button
              onClick={startRecording}
              className="w-full bg-pop-dark text-white font-black text-xl py-4 rounded-2xl border-3 border-pop-dark shadow-neo btn-press flex items-center justify-center gap-3"
            >
              <Mic size={24} strokeWidth={3} />
              <span>{t('voicePolisher.startBtn') || 'Començar a gravar'}</span>
            </button>
          </motion.div>
        )}

        {status === 'recording' && (
          <motion.div
            key="recording"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex flex-col items-center gap-8 text-center"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-red-500 blur-3xl opacity-20 animate-pulse"></div>
              <div className="absolute inset-0 border-4 border-red-500 rounded-full animate-ping opacity-20"></div>
              <div className="w-48 h-48 bg-red-500 rounded-full border-4 border-pop-dark flex items-center justify-center relative shadow-neo-lg cursor-pointer" onClick={stopRecording}>
                <Square size={64} className="text-white fill-white" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-6xl font-black text-pop-dark font-mono tabular-nums tracking-tighter">
                {formatTime(recordingTime)}
              </h2>
              <p className="text-red-500 font-black uppercase tracking-widest animate-pulse">
                {t('voicePolisher.recording')}
              </p>
            </div>

            <button
              onClick={stopRecording}
              className="w-full bg-white text-red-500 border-3 border-pop-dark font-black text-xl py-4 rounded-2xl shadow-neo btn-press"
            >
              {t('voicePolisher.stopBtn') || 'Aturar gravació'}
            </button>
          </motion.div>
        )}

        {status === 'processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center h-[60vh] gap-6 text-center"
          >
            <div className="relative">
              <div className="absolute inset-0 bg-pop-purple blur-xl opacity-50 animate-pulse"></div>
              <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center relative border-3 border-pop-dark shadow-neo animate-spin-slow">
                <Sparkles size={48} className="text-pop-purple" strokeWidth={3} />
              </div>
            </div>
            <h3 className="text-2xl font-black text-pop-dark uppercase tracking-tight">
              {t('voicePolisher.processing') || 'Polint la teva veu...'}
            </h3>
          </motion.div>
        )}

        {status === 'results' && results && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-6 pb-20"
          >
            {/* Original Transcript */}
            <div className="bg-white p-4 rounded-3xl border-3 border-pop-dark shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-gray-400">
                <Mic size={18} />
                <h4 className="font-black text-xs uppercase tracking-widest">{t('voicePolisher.transcript') || 'Transcripció original'}</h4>
              </div>
              <p className="text-gray-600 italic leading-relaxed">"{transcript}"</p>
            </div>

            {/* Variants */}
            <div className="space-y-4">
              <h3 className="text-xl font-black text-pop-dark uppercase italic px-2">
                {t('voicePolisher.variants') || 'Variants millorades'}
              </h3>
              {results.variants.map((variant, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="relative group"
                >
                  <div className="absolute inset-0 bg-pop-dark rounded-3xl translate-x-1.5 translate-y-1.5"></div>
                  <div className="relative bg-white p-5 rounded-3xl border-3 border-pop-dark flex flex-col gap-3">
                    <div className="flex justify-between items-start">
                      <div className="bg-pop-yellow text-pop-dark px-3 py-1 rounded-lg text-xs font-black uppercase border-2 border-pop-dark">
                        {t(`voicePolisher.styles.${variant.style}`) || variant.style}
                      </div>
                      <button 
                        onClick={() => copyToClipboard(variant.text, idx)}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400 hover:text-pop-dark"
                      >
                        {copiedIndex === idx ? <Check size={18} className="text-pop-green" /> : <Copy size={18} />}
                      </button>
                    </div>
                    <p className="text-lg font-medium text-pop-dark leading-relaxed">
                      {variant.text}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Feedback */}
            <div className="bg-blue-50 p-5 rounded-3xl border-3 border-blue-200 flex gap-4 items-start">
              <div className="bg-blue-500 text-white p-2 rounded-xl border-2 border-pop-dark shrink-0">
                <Sparkles size={24} strokeWidth={3} />
              </div>
              <div>
                <h4 className="font-black text-pop-dark uppercase text-sm mb-1">{t('voicePolisher.feedback') || 'Consells d\'estil'}</h4>
                <p className="text-blue-900 font-medium text-sm leading-relaxed">{results.feedback}</p>
              </div>
            </div>

            {/* Refine Input */}
            <div className="bg-white p-2 rounded-2xl border-3 border-pop-dark shadow-neo flex items-center gap-2 sticky bottom-4 z-20">
              <input
                type="text"
                value={refineQuery}
                onChange={(e) => setRefineQuery(e.target.value)}
                placeholder={t('voicePolisher.refinePlaceholder') || 'Com vols refinar-ho?'}
                className="flex-1 bg-transparent px-3 py-2 outline-none font-bold text-pop-dark placeholder-gray-400"
                onKeyPress={(e) => e.key === 'Enter' && handleRefine()}
              />
              <button
                onClick={handleRefine}
                disabled={!refineQuery.trim() || isRefining}
                className="bg-pop-dark text-white p-3 rounded-xl hover:bg-black transition-colors disabled:opacity-50"
              >
                {isRefining ? <RotateCcw size={20} className="animate-spin" /> : <Play size={20} />}
              </button>
            </div>

            <button
              onClick={() => setStatus('idle')}
              className="text-gray-400 font-bold text-center py-4 hover:text-pop-dark transition-colors"
            >
              {t('voicePolisher.startOver')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoicePolisher;
