import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { callGemini } from '../services/apiService';
import { db, auth } from '../lib/firebase';
import { 
  collection, doc, setDoc, updateDoc, onSnapshot, 
  serverTimestamp, getDoc, arrayUnion, arrayRemove,
  Timestamp, increment
} from 'firebase/firestore';
import { 
  Users, Sparkles, Send, RotateCcw, ArrowRight, 
  Trophy, MessageSquare, BookText, Camera, ScanLine, 
  Loader2, Timer, UserPlus, Play, LogOut, ChevronRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { resizeImage } from '../lib/utils';
import { getFirestore, getDocFromServer } from 'firebase/firestore';

// --- Types ---

interface Player {
  id: string;
  name: string;
  score: number;
  isReady: boolean;
  avatar?: string;
}

interface StoryTurn {
  text: string;
  authorId: string;
  authorName: string;
  scores: {
    creativity: number;
    coherence: number;
    grammar: number;
    agility: number;
  };
  feedback: string;
  timestamp: any;
}

interface BattleRoom {
  id: string;
  ownerId: string;
  status: 'waiting' | 'starting' | 'playing' | 'ended';
  players: Player[];
  story: StoryTurn[];
  currentTurnIndex: number;
  currentRound: number;
  maxRounds: number;
  initialPrompt: string;
  timerStart: any;
  lastFeedback: string;
  title: string;
  draftText?: string;
}

type AppState = 'initial' | 'lobby' | 'playing' | 'results';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

const BatallaLletres: React.FC = () => {
  const { t, addXp, language, userProfile } = useLanguage();
  const navigate = useNavigate();

  const [appState, setAppState] = useState<AppState>('initial');
  const [room, setRoom] = useState<BattleRoom | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [playerName, setPlayerName] = useState(userProfile?.name || '');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [writingText, setWritingText] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [isOCRing, setIsOCRing] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timerIntervalRef = useRef<any>(null);
  const currentUserId = useMemo(() => {
    const existingId = auth.currentUser?.uid || localStorage.getItem('textup_user_id');
    if (existingId) return existingId;
    const newGuestId = `guest_${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem('textup_user_id', newGuestId);
    return newGuestId;
  }, []);

  const handleFirestoreError = useCallback((error: unknown, operationType: OperationType, path: string | null) => {
    const errString = error instanceof Error ? error.message : String(error);
    // Don't throw for background sync errors to avoid UI flickering
    if (path?.includes('draftText')) {
      console.warn('Sync warning:', errString);
      return;
    }
    const errInfo: FirestoreErrorInfo = {
      error: errString,
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData?.map(provider => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || []
      },
      operationType,
      path
    }
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setError(t('common.error') || 'Error de connexió');
  }, [t]);

  // --- Firebase Connectivity Test ---
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();
  }, []);

  // --- Real-time Sync ---
  useEffect(() => {
    if (roomCode && appState !== 'initial') {
      const unsub = onSnapshot(doc(db, 'battles', roomCode), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as BattleRoom;
          setRoom(data);
          
          if (data.status === 'playing' && appState !== 'playing') {
             setAppState('playing');
          } else if (data.status === 'ended' && appState !== 'results') {
             setAppState('results');
          } else if (data.status === 'waiting' && appState !== 'lobby') {
             setAppState('lobby');
          }
        } else {
          setError("La sala no existeix.");
          setAppState('initial');
        }
      }, (err) => {
          handleFirestoreError(err, OperationType.GET, `battles/${roomCode}`);
      });
      return () => unsub();
    }
  }, [roomCode, appState, handleFirestoreError]);

  // --- Sync draft to Firestore (Debounced) ---
  useEffect(() => {
    if (appState === 'playing' && room) {
      const currentPlayer = room.players[room.currentTurnIndex];
      const isMyTurn = currentPlayer?.id === currentUserId;

      if (isMyTurn && writingText !== room.draftText) {
        const timeout = setTimeout(async () => {
          setIsSyncing(true);
          try {
            await updateDoc(doc(db, 'battles', roomCode), {
              draftText: writingText
            });
          } catch (e) {
            handleFirestoreError(e, OperationType.UPDATE, `battles/${roomCode}`);
          } finally {
            setIsSyncing(false);
          }
        }, 500); // 500ms debounce
        return () => clearTimeout(timeout);
      }
    }
  }, [writingText, room?.currentTurnIndex, roomCode, currentUserId, appState, handleFirestoreError, room]);

  const handleSubmitTurn = useCallback(async () => {
    if (!room || room.status !== 'playing' || loading) return;
    const currentPlayer = room.players[room.currentTurnIndex];
    if (currentPlayer.id !== currentUserId) return;

    setLoading(true);
    try {
      // Use local writingText as the definitive source for the turn
      const textToEval = writingText.trim() || room.draftText || '...';
      
      let evalData;
      try {
        // AI Evaluation
        const lastFragment = room.story.length > 0 ? room.story[room.story.length - 1].text : room.initialPrompt;
        const wordCount = textToEval.split(/\s+/).filter(w => w.length > 0).length;

        const evaluationPrompt = `Analitza aquest fragment d'una història col·laborativa en català.
        Fragment anterior: "${lastFragment}"
        Nova aportació: "${textToEval}"
        Recompte real de paraules: ${wordCount}
        
        Avalua de 0 a 10:
        1. Creativitat
        2. Coherència (segueix la història?)
        3. Ortografia
        4. Agilitat (puntuació basada en l'esforç d'escriure ${wordCount} paraules en 30 segons).
        
        Dona un breu feedback de 1 frase on mencionis el recompte de paraules (${wordCount}).
        Respon NOMÉS amb JSON:
        {"creativity": number, "coherence": number, "grammar": number, "agility": number, "feedback": "string"}`;

        const aiRes = await callGemini(
          'gemini-2.0-flash',
          [{ parts: [{ text: evaluationPrompt }] }],
          undefined,
          { responseMimeType: 'application/json' }
        );
        
        evalData = JSON.parse(aiRes.text || '{"creativity":0, "coherence":0, "grammar":0, "agility":0, "feedback": "No s\'ha rebut text."}');
      } catch (aiErr) {
         console.warn("AI Quota or Error, using fallback:", aiErr);
         const wordCount = textToEval.split(/\s+/).filter(w => w.length > 0).length;
         // Fallback scores if AI is exhausted or fails
         evalData = {
           creativity: textToEval.length > 50 ? 8 : 5,
           coherence: 7,
           grammar: 8,
           agility: Math.min(10, Math.floor(wordCount / 3)),
           feedback: `Has escrit ${wordCount} paraules! L'IA està descansant, però la teva història continua.`
         };
      }
      
      const turnScore = Math.round((evalData.creativity + evalData.coherence + evalData.grammar + (evalData.agility || 0)) * 1.25);

      const newTurn: StoryTurn = {
        text: textToEval,
        authorId: currentUserId,
        authorName: playerName,
        scores: {
          creativity: evalData.creativity,
          coherence: evalData.coherence,
          grammar: evalData.grammar,
          agility: evalData.agility || 0
        },
        feedback: evalData.feedback,
        timestamp: new Date()
      };

      const nextTurnIndex = (room.currentTurnIndex + 1) % room.players.length;
      let nextRound = room.currentRound;
      let nextStatus: BattleRoom['status'] = 'playing';

      if (nextTurnIndex === 0) {
        nextRound += 1;
        if (nextRound > room.maxRounds) {
          nextStatus = 'ended';
        }
      }

      // Update player score
      const updatedPlayers = room.players.map(p => 
        p.id === currentUserId ? { ...p, score: p.score + turnScore } : p
      );

      await updateDoc(doc(db, 'battles', room.id), {
        story: arrayUnion(newTurn),
        players: updatedPlayers,
        currentTurnIndex: nextTurnIndex,
        currentRound: nextRound,
        status: nextStatus,
        timerStart: serverTimestamp(),
        lastFeedback: evalData.feedback,
        draftText: '' // Clear for next turn
      });

      setWritingText('');
      addXp(turnScore);
    } catch (err) {
       console.error("Submission error:", err);
       setError("Error enviant el torn.");
    } finally {
      setLoading(false);
    }
  }, [room, currentUserId, writingText, playerName, addXp, loading]);

  // --- Timer Logic ---
  useEffect(() => {
    if (appState === 'playing' && room) {
      const currentPlayer = room.players[room.currentTurnIndex];
      const isMyTurn = currentPlayer?.id === currentUserId;

      if (room.timerStart) {
        const startTime = (room.timerStart as Timestamp).toMillis();
        const updateTimer = () => {
          const now = Date.now();
          const elapsed = Math.floor((now - startTime) / 1000);
          const remaining = Math.max(0, 30 - elapsed);
          setTimeLeft(remaining);

          if (remaining === 0 && isMyTurn && room.status === 'playing') {
             handleSubmitTurn();
          }
        };

        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
      }
    }
  }, [appState, room, currentUserId, handleSubmitTurn]);

  // --- Actions ---

  const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      setError(t('auth.error'));
      return;
    }
    setLoading(true);
    const code = generateRoomCode();
    const newRoom: BattleRoom = {
      id: code,
      ownerId: currentUserId,
      status: 'waiting',
      players: [{ id: currentUserId, name: playerName, score: 0, isReady: true }],
      story: [],
      currentTurnIndex: 0,
      currentRound: 1,
      maxRounds: 3,
      initialPrompt: '',
      timerStart: null,
      lastFeedback: '',
      title: 'Batalla de Lletres',
      draftText: ''
    };

    try {
      await setDoc(doc(db, 'battles', code), newRoom);
      setRoomCode(code);
      setAppState('lobby');
    } catch (err) {
      setError("Error creant la sala.");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinRoom = async (code: string) => {
    if (!playerName.trim()) {
      setError(t('auth.error'));
      return;
    }
    setLoading(true);
    try {
      const roomRef = doc(db, 'battles', code.toUpperCase());
      const snap = await getDoc(roomRef);
      if (snap.exists()) {
        const data = snap.data() as BattleRoom;
        if (data.status !== 'waiting') {
          setError("La partida ja ha començat.");
          return;
        }
        if (data.players.length >= 10) {
          setError("La sala està plena.");
          return;
        }

        const playerExists = data.players.find(p => p.id === currentUserId);
        if (!playerExists) {
          await updateDoc(roomRef, {
            players: arrayUnion({ id: currentUserId, name: playerName, score: 0, isReady: false })
          });
        }
        setRoomCode(code.toUpperCase());
        setAppState('lobby');
      } else {
        setError("Codi de sala no vàlid.");
      }
    } catch (err) {
      setError("Error unint-se a la sala.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleReady = async () => {
    if (!room) return;
    const updatedPlayers = room.players.map(p => 
      p.id === currentUserId ? { ...p, isReady: !p.isReady } : p
    );
    await updateDoc(doc(db, 'battles', room.id), { players: updatedPlayers });
  };

  const handleStartGame = async () => {
    if (!room) return;
    setLoading(true);
    setError(null);
    try {
      let initialText = "La nit era fosca, i de sobte, el rellotge de la plaça va començar a girar cap enrere...";
      
      try {
        // Generate initial prompt with AI
        const promptRes = await callGemini(
          'gemini-2.0-flash',
          [{ parts: [{ text: "Genera una frase inicial intrigant per a una història en català. Curta (10-20 paraules)." }] }]
        );
        if (promptRes.text) initialText = promptRes.text;
      } catch (aiErr) {
        console.warn("AI Start Prompt fallback used:", aiErr);
      }

      await updateDoc(doc(db, 'battles', room.id), {
        status: 'playing',
        initialPrompt: initialText,
        timerStart: serverTimestamp(),
        currentTurnIndex: 0,
        draftText: ''
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `battles/${room.id}`);
    } finally {
      setLoading(false);
    }
  };


  const handleLeave = async () => {
    if (roomCode) {
      // Optional: remove from players list or just go back
      setRoomCode('');
      setAppState('initial');
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const originalBase64 = reader.result as string;
        try {
          const optimizedBase64 = await resizeImage(originalBase64);
          performOCR(optimizedBase64);
        } catch (e) {
          performOCR(originalBase64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const performOCR = async (imageSrc: string) => {
    setIsOCRing(true);
    try {
      const response = await callGemini(
        'gemini-2.0-flash',
        [
          {
            parts: [
              { text: `OCR transcription (Catalan). Just the handwritten text, no commentary.` },
              { inlineData: { data: imageSrc.split(',')[1], mimeType: 'image/jpeg' } }
            ]
          }
        ]
      );
      const text = (response.text || '').trim();
      if (text) setWritingText(prev => prev + (prev ? ' ' : '') + text);
    } catch (err) {
      console.error('OCR Error:', err);
    } finally {
      setIsOCRing(false);
    }
  };

  // --- Sub-Views ---

  if (appState === 'initial') {
    return (
      <div className="max-w-2xl mx-auto space-y-8 animate-slide-up pb-12 px-4">
        <div className="text-center space-y-4">
          <div className="w-24 h-24 bg-pop-yellow rounded-full border-4 border-pop-dark flex items-center justify-center mx-auto shadow-neo rotate-3">
            <Sparkles size={48} className="text-pop-dark" />
          </div>
          <h2 className="text-4xl font-black text-pop-dark uppercase italic tracking-tight">{t('racoCreatiu.title')}</h2>
          <p className="text-xl font-bold text-gray-500">{t('racoCreatiu.subtitle')}</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border-4 border-pop-dark shadow-neo space-y-8">
          <div className="space-y-4">
            <label className="text-lg font-black text-pop-dark uppercase italic ml-2">COM ET DIUS?</label>
            <input 
              type="text" 
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Escull un nick..."
              className="w-full p-6 bg-indigo-50 border-4 border-pop-dark rounded-3xl text-xl font-bold shadow-neo-sm focus:outline-none focus:ring-4 focus:ring-pop-blue/20"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button 
              onClick={handleCreateRoom}
              disabled={loading}
              className="bg-pop-blue text-white font-black text-xl py-6 rounded-3xl border-4 border-pop-dark shadow-neo flex items-center justify-center gap-3 hover:bg-blue-500 transition-colors btn-press"
            >
              {loading ? <Loader2 className="animate-spin" /> : <Play size={28} />}
              {t('racoCreatiu.startBtn')}
            </button>
            <div className="relative group">
              <input 
                type="text" 
                placeholder="Introduir codi..."
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                className="w-full p-6 bg-white border-4 border-pop-dark rounded-3xl text-xl font-bold shadow-neo-sm pr-16"
              />
              <button 
                onClick={() => handleJoinRoom(roomCode)}
                disabled={loading || !roomCode}
                className="absolute right-3 top-3 bottom-3 aspect-square bg-pop-green rounded-2xl border-3 border-pop-dark flex items-center justify-center hover:bg-green-400 transition-colors btn-press disabled:opacity-50"
              >
                 <ArrowRight size={24} />
              </button>
            </div>
          </div>
          
          <div className="p-6 bg-gray-50 rounded-3xl border-3 border-dashed border-gray-200">
             <p className="text-gray-500 font-bold italic text-center text-sm">
                {t('racoCreatiu.instructions')}
             </p>
          </div>
        </div>
        {error && (
            <div className="bg-red-100 text-red-700 p-4 rounded-2xl font-bold text-center border-3 border-pop-dark shadow-neo">
                {error}
            </div>
        )}
      </div>
    );
  }

  if (appState === 'lobby' && room) {
    const isOwner = room.ownerId === currentUserId;
    const allReady = room.players.every(p => p.isReady);
    const myPlayerReady = room.players.find(p => p.id === currentUserId)?.isReady;

    return (
      <div className="max-w-xl mx-auto space-y-8 animate-slide-up pb-12 px-4">
        <div className="bg-white p-8 rounded-[2.5rem] border-4 border-pop-dark shadow-neo space-y-8 relative">
          <button onClick={handleLeave} className="absolute -top-4 -right-4 w-12 h-12 bg-pop-pink rounded-full border-4 border-pop-dark flex items-center justify-center shadow-neo btn-press">
            <LogOut size={24} className="text-white" />
          </button>

          <div className="text-center space-y-2">
            <span className="text-sm font-black text-pop-dark uppercase italic bg-pop-yellow px-4 py-1 rounded-full border-2 border-pop-dark">SALA D'ESPERA</span>
            <div className="flex flex-col items-center gap-2 pt-4">
                <p className="text-gray-500 font-bold uppercase text-xs tracking-widest">{t('racoCreatiu.lobby.shareCode')}</p>
                <h2 className="text-5xl font-black text-pop-dark tracking-tighter">{room.id}</h2>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-2 text-pop-dark font-black uppercase italic italic text-xl">
               <Users size={24} />
               {t('racoCreatiu.lobby.players')} ({room.players.length}/10)
            </div>
            <div className="grid grid-cols-1 gap-3">
              {room.players.map((p, idx) => (
                <div key={p.id} className={`flex items-center justify-between p-4 rounded-2xl border-3 border-pop-dark shadow-neo-sm ${p.id === currentUserId ? 'bg-pop-blue/10 border-pop-blue' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white border-2 border-pop-dark rounded-full flex items-center justify-center font-black text-pop-dark">
                        {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-pop-dark">{p.name} {p.id === room.ownerId && '👑'}</span>
                  </div>
                  <div className={`px-4 py-1 rounded-full border-2 border-pop-dark text-xs font-black uppercase ${p.isReady ? 'bg-pop-green text-pop-dark' : 'bg-pop-pink text-white'}`}>
                    {p.isReady ? 'READY' : 'WAITING'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 flex flex-col gap-4">
            <button 
                onClick={handleToggleReady}
                className={`w-full font-black text-2xl py-6 rounded-3xl border-4 border-pop-dark shadow-neo transition-all btn-press ${myPlayerReady ? 'bg-white text-pop-dark' : 'bg-pop-green text-pop-dark'}`}
            >
                {myPlayerReady ? 'CANCEL·LAR' : 'ESTIC A PUNT!'}
            </button>

            {isOwner && (
                <button 
                    onClick={handleStartGame}
                    disabled={!allReady || room.players.length < 1}
                    className="w-full bg-pop-pink text-white font-black text-2xl py-6 rounded-3xl border-4 border-pop-dark shadow-neo disabled:opacity-30 disabled:grayscale btn-press"
                >
                    {t('racoCreatiu.lobby.startNow')}
                </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (appState === 'playing' && room) {
    const isOwner = room.ownerId === currentUserId;
    const currentPlayer = room.players[room.currentTurnIndex];
    const isMyTurn = currentPlayer?.id === currentUserId;
    const lastStory = room.story.length > 0 ? room.story[room.story.length - 1] : null;

    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-slide-up pb-12 px-4">
        {/* Header Board */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
           {/* Leaderboard */}
           <div className="md:col-span-1 bg-white p-6 rounded-3xl border-4 border-pop-dark shadow-neo">
              <div className="flex items-center gap-2 mb-4">
                  <Trophy size={20} className="text-pop-yellow" />
                  <h3 className="font-black text-sm uppercase italic text-pop-dark">{t('racoCreatiu.rank.title')}</h3>
              </div>
              <div className="space-y-3">
                 {[...room.players].sort((a, b) => b.score - a.score).map((p, idx) => (
                    <div key={p.id} className={`flex items-center justify-between font-bold text-sm ${p.id === currentUserId ? 'text-pop-blue scale-105' : 'text-gray-600'}`}>
                       <div className="flex items-center gap-2">
                          <span className="w-5 text-gray-400">#{(idx+1)}</span>
                          <span className="truncate max-w-[100px]">{p.name} {p.id === currentUserId && '(Tu)'}</span>
                       </div>
                       <span className="tabular-nums font-black text-pop-dark">{p.score}</span>
                    </div>
                 ))}
              </div>
           </div>

           {/* Main Game Info */}
           <div className="md:col-span-2 space-y-4">
              <div className="bg-pop-dark text-white p-6 rounded-3xl shadow-neo border-4 border-pop-dark relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-20 rotate-12">
                    <BookText size={100} />
                 </div>
                 <div className="relative z-10 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-black uppercase text-pop-yellow tracking-widest">RONDA {room.currentRound}/{room.maxRounds}</span>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full border-2 border-white/20 ${timeLeft < 10 ? 'bg-pop-pink text-white animate-pulse' : 'bg-white/10 text-white'}`}>
                           <Timer size={16} />
                           <span className="font-black tabular-nums">{timeLeft}s</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                        <p className="text-sm font-bold opacity-80 uppercase tracking-tighter">
                          {isMyTurn ? "ÉS EL TEU TORN!" : `TORN DE: ${currentPlayer?.name}`}
                        </p>
                    </div>
                 </div>
              </div>

              {/* Feed/History - Single Source of Truth */}
              <div className="bg-white p-8 rounded-3xl border-4 border-pop-dark shadow-neo min-h-[450px] overflow-hidden relative">
                 <div className="absolute top-4 right-4 flex items-center gap-2">
                    {isSyncing && <div className="w-2 h-2 bg-pop-blue rounded-full animate-ping" />}
                    <span className="text-[10px] font-black uppercase text-gray-300">LIVE STORY</span>
                 </div>

                 <div className="prose prose-lg max-w-none font-bold text-pop-dark leading-relaxed">
                     <span className="text-gray-400 italic">{room.initialPrompt} </span>
                     {room.story.map((turn, i) => (
                        <span key={i} className={`mr-1 ${turn.authorId === currentUserId ? 'text-pop-blue' : 'text-pop-dark'}`}>
                           {turn.text}{' '}
                        </span>
                     ))}
                     
                     {isMyTurn ? (
                       <span className="relative inline-block w-full mt-2 group">
                          {/* We don't show the text outside while typing to avoid duplication */}
                         <textarea 
                             value={writingText}
                             onChange={(e) => setWritingText(e.target.value)}
                             placeholder={t('racoCreatiu.placeholder')}
                             className={`w-full bg-indigo-50/50 border-b-6 border-pop-blue p-4 rounded-t-2xl text-xl font-black text-pop-blue focus:outline-none placeholder:text-blue-200 resize-none min-h-[140px] shadow-inner transition-opacity ${loading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}
                             autoFocus
                             disabled={loading}
                          />
                          <div className="mt-4 flex justify-between items-center bg-white p-2 rounded-xl">
                             <div className="flex gap-2">
                                <button 
                                   onClick={() => fileInputRef.current?.click()}
                                   disabled={isOCRing}
                                   className="bg-pop-yellow text-pop-dark border-2 border-pop-dark p-2 rounded-lg shadow-neo-sm btn-press"
                                   title="Pujar foto del teu text"
                                >
                                  {isOCRing ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                                </button>
                                <input type="file" accept="image/*" capture="environment" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                             </div>
                             <button 
                                onClick={handleSubmitTurn}
                                disabled={loading || !writingText.trim()}
                                className="bg-pop-green text-pop-dark font-black px-10 py-4 rounded-2xl border-4 border-pop-dark shadow-neo flex items-center gap-3 hover:bg-green-400 transition-colors btn-press disabled:opacity-50"
                             >
                                {loading ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                                {t('racoCreatiu.analyzeBtn')}
                             </button>
                          </div>
                       </span>
                     ) : (
                       <span className="inline-block mt-2">
                          <span className="text-pop-pink animate-pulse bg-pop-pink/5 px-2 rounded-md italic border-b-2 border-pop-pink/30">
                             {room.draftText || '...'}
                          </span>
                          <span className="w-2 h-6 bg-pop-pink inline-block animate-bounce ml-1 align-middle" />
                       </span>
                     )}
                 </div>

                 {room.lastFeedback && !isMyTurn && (
                    <div className="mt-12 bg-gray-50 p-6 rounded-2xl border-3 border-dashed border-pop-dark/10 animate-slide-up">
                       <div className="flex items-center gap-2 mb-2">
                          <MessageSquare size={14} className="text-pop-pink" />
                          <p className="text-[10px] font-black text-gray-400 uppercase">Feedback de la IA per l'últim torn</p>
                       </div>
                       <p className="text-pop-dark font-bold italic leading-relaxed">"{room.lastFeedback}"</p>
                    </div>
                 )}
              </div>
           </div>
        </div>

        {!isMyTurn && (
          <div className="bg-white p-6 rounded-3xl border-4 border-pop-dark shadow-neo text-center flex items-center justify-center gap-6">
             <div className="w-12 h-12 bg-pop-pink rounded-full border-3 border-pop-dark flex items-center justify-center animate-pulse">
                <Users size={24} className="text-white" />
             </div>
             <p className="text-xl font-black text-pop-dark uppercase italic tracking-tighter">
                ESPERANT L'APORTACIÓ DE <span className="text-pop-blue">{currentPlayer?.name}</span>
             </p>
          </div>
        )}
      </div>
    );
  }

  if (appState === 'results' && room) {
    const winner = [...room.players].sort((a, b) => b.score - a.score)[0];
    const isWinner = winner.id === currentUserId;

    return (
      <div className="max-w-2xl mx-auto space-y-8 animate-slide-up pb-12 px-4">
        <div className="text-center space-y-4">
           <div className={`w-32 h-32 ${isWinner ? 'bg-pop-yellow' : 'bg-white'} rounded-full border-8 border-pop-dark flex items-center justify-center mx-auto shadow-neo relative`}>
              <Trophy size={64} className="text-pop-dark" />
              {isWinner && <div className="absolute -top-4 -right-4 bg-pop-pink text-white px-4 py-1 rounded-full border-3 border-pop-dark font-black rotate-12">GUANYADOR!</div>}
           </div>
           <h2 className="text-4xl font-black text-pop-dark uppercase italic tracking-tight">{t('racoCreatiu.rank.winner')}</h2>
           <p className="text-3xl font-black text-pop-blue uppercase">{winner.name}</p>
        </div>

        <div className="bg-white p-8 rounded-[2.5rem] border-4 border-pop-dark shadow-neo space-y-8">
           <div className="space-y-4">
              <h3 className="text-xl font-black text-pop-dark uppercase italic border-b-4 border-pop-dark inline-block tracking-tighter">HISTÒRIA FINAL</h3>
              <div className="bg-indigo-50 p-8 rounded-3xl border-3 border-pop-dark italic leading-relaxed text-pop-dark font-bold text-lg max-h-[400px] overflow-y-auto">
                 <p className="opacity-40 mb-4">{room.initialPrompt}</p>
                 {room.story.map((s, i) => (
                    <span key={i} className="inline mr-1">{s.text} </span>
                 ))}
              </div>
           </div>

           <div className="grid grid-cols-1 gap-3">
              <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest">{t('racoCreatiu.rank.title')}</h3>
              {room.players.sort((a,b) => b.score - a.score).map((p, idx) => (
                 <div key={p.id} className="flex justify-between items-center p-4 bg-white border-2 border-pop-dark rounded-xl">
                    <span className="font-bold">{(idx+1)}. {p.name}</span>
                    <span className="font-black text-pop-blue">{p.score} XP</span>
                 </div>
              ))}
           </div>

           <div className="flex gap-4">
              <button 
                 onClick={() => navigate('/home')}
                 className="flex-1 bg-white text-pop-dark font-black text-xl py-6 rounded-3xl border-4 border-pop-dark shadow-neo btn-press"
              >
                 {t('nav.home')}
              </button>
              <button 
                onClick={() => setAppState('initial')}
                className="flex-1 bg-pop-blue text-white font-black text-xl py-6 rounded-3xl border-4 border-pop-dark shadow-neo btn-press"
              >
                {t('racoCreatiu.tryAgain')}
              </button>
           </div>
        </div>
      </div>
    );
  }

  return null;
};

export default BatallaLletres;
