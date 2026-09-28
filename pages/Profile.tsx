import React, { useState, useEffect, useRef, useMemo } from 'react';
import { History, ChevronRight, User as UserIcon, LogOut, Edit2, Check, X, Trophy, Star, Shield, Zap, Crown, Camera, RefreshCcw } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import PremiumModal from '../components/PremiumModal';

import { calculateUserStats } from '../lib/user';
import { StorageService, StorageKey } from '../services/storageService';

const Profile: React.FC = () => {
  const { t, logout, user, updateUser, syncPremiumStatus } = useLanguage();
  const navigate = useNavigate();

  const [isEditing, setIsEditing] = useState(false);
  const [editedName, setEditedName] = useState(user?.name || '');
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stats = useMemo(() => {
    try {
        const saved = StorageService.getItem<any[]>(StorageKey.CORRECTIONS, []);
        return calculateUserStats(user, saved, t);
    } catch (e) {
        console.error("Error loading stats", e);
    }
    
    return {
        avgScore: 0,
        totalCorrections: 0,
        level: 1,
        levelLabel: t('profile.levels.1'),
        xp: user?.xp || 0,
        nextLevelXp: 500
    };
  }, [user, t]);

  const [prevUser, setPrevUser] = useState(user);
  if (user !== prevUser) {
    setPrevUser(user);
    if (!isEditing) setEditedName(user?.name || '');
  }

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleSaveName = () => {
    if (editedName.trim() && user) {
        updateUser({ name: editedName });
        setIsEditing(false);
    }
  };

  const handleCancelEdit = () => {
    if (user) {
        setEditedName(user.name);
    }
    setIsEditing(false);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
            updateUser({ photo: reader.result as string });
        };
        reader.readAsDataURL(file);
    }
  };

  const xpPercentage = Math.min(100, (stats.xp / stats.nextLevelXp) * 100);

  return (
    <div className="flex flex-col gap-6 pt-4 animate-pop-in">
      
      {/* Avatar / Identity Card */}
      <div className="relative">
          <div className="absolute inset-0 bg-pop-dark rounded-3xl translate-x-2 translate-y-2"></div>
          <div className="bg-white p-6 rounded-3xl border-3 border-pop-dark relative overflow-hidden flex flex-col items-center text-center">
            
            {/* Background Pattern */}
            <div className="absolute top-0 w-full h-24 bg-pop-blue border-b-3 border-pop-dark"></div>
            
            <div className="relative z-10 mt-4 mb-3 group">
                <div className={`w-28 h-28 rounded-full border-4 border-pop-dark flex items-center justify-center text-4xl relative shadow-neo bg-pop-yellow overflow-hidden`}>
                    {user?.photo ? (
                        <img src={user.photo} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        stats.level >= 5 ? <Crown size={48} strokeWidth={3} className="text-pop-dark" /> : <UserIcon size={48} strokeWidth={3} className="text-pop-dark" />
                    )}
                    
                    <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                        <Camera size={32} className="text-white drop-shadow-md" strokeWidth={3} />
                    </button>
                </div>
                
                {/* Visible Camera Button for Mobile/Tap */}
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -left-1 w-10 h-10 bg-pop-blue text-pop-dark rounded-full flex items-center justify-center border-3 border-pop-dark shadow-sm z-20 btn-press"
                >
                    <Camera size={18} strokeWidth={3} />
                </button>

                <div className="absolute -bottom-1 -right-1 w-10 h-10 bg-pop-pink text-white rounded-full flex items-center justify-center text-sm font-black border-3 border-pop-dark transform rotate-12 z-20">
                    {stats.level}
                </div>
                
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleImageUpload}
                />
            </div>

            <div className="relative z-10 w-full">
                {isEditing ? (
                    <div className="flex items-center justify-center gap-2 mb-2">
                        <input 
                            type="text" 
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            className="bg-gray-100 border-3 border-pop-dark rounded-lg px-2 py-1 text-xl font-black text-pop-dark w-40 text-center outline-none"
                            autoFocus
                        />
                        <button onClick={handleSaveName} className="p-1.5 bg-pop-green border-3 border-pop-dark rounded-md"><Check size={16} strokeWidth={4}/></button>
                        <button onClick={handleCancelEdit} className="p-1.5 bg-pop-pink border-3 border-pop-dark rounded-md text-white"><X size={16} strokeWidth={4} /></button>
                    </div>
                ) : (
                    <h2 className="text-2xl font-black text-pop-dark uppercase tracking-tight flex items-center justify-center gap-2 cursor-pointer group" onClick={() => setIsEditing(true)}>
                        {user?.name || t('profile.student')}
                        <Edit2 size={16} className="text-gray-300 group-hover:text-pop-dark" />
                    </h2>
                )}
                <div className="flex items-center justify-center gap-2 mt-1">
                    <div className="inline-block bg-pop-dark text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">
                        {stats.levelLabel}
                    </div>
                    {user?.isPremium && (
                        <div className="inline-block bg-pop-yellow text-pop-dark px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border-2 border-pop-dark flex items-center gap-1">
                            <Crown size={12} strokeWidth={3} /> PREMIUM
                        </div>
                    )}
                </div>
            </div>

            {/* XP Bar */}
            <div className="w-full mt-6">
                <div className="flex justify-between text-xs font-black uppercase text-pop-dark mb-1 px-1">
                    <span>{stats.xp} XP</span>
                    <span>{stats.nextLevelXp} XP</span>
                </div>
                <div className="h-6 bg-gray-200 rounded-full border-3 border-pop-dark overflow-hidden relative">
                    <div 
                        className="h-full bg-pop-green transition-all duration-1000 ease-out border-r-3 border-pop-dark relative"
                        style={{ width: `${xpPercentage}%` }}
                    >
                        {/* Shine on bar */}
                        <div className="absolute top-0 right-0 bottom-0 w-full bg-white/20"></div>
                    </div>
                </div>
            </div>
          </div>
      </div>

      {!user?.isPremium && (
          <div className="relative mt-2 cursor-pointer group btn-press" onClick={() => setShowPremiumModal(true)}>
             <div className="absolute inset-0 bg-pop-dark rounded-2xl translate-x-1.5 translate-y-1.5 transition-transform group-hover:translate-x-2 group-hover:translate-y-2"></div>
             <div className="bg-pop-yellow p-4 rounded-2xl border-3 border-pop-dark flex items-center justify-between relative overflow-hidden">
                <div className="absolute -right-4 -top-4 opacity-20">
                     <Crown size={80} className="text-pop-dark fill-pop-dark" />
                </div>
                <div className="relative z-10 flex items-center gap-3">
                    <div className="bg-white p-2 rounded-full border-2 border-pop-dark shadow-sm">
                        <Crown size={24} className="text-pop-dark fill-pop-yellow" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-black text-pop-dark uppercase text-lg leading-none mb-1">
                            {t('profile.getPremium')}
                        </h3>
                        <p className="text-xs font-bold text-pop-dark/80 uppercase">
                            {t('profile.noLimits')}
                        </p>
                    </div>
                </div>
                <div className="bg-pop-dark text-white px-4 py-2 rounded-full font-black uppercase text-xs shadow-neo-sm relative z-10">
                    GO!
                </div>
             </div>
          </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
          <StatBox label={t('profile.average')} value={stats.avgScore} color="bg-pop-purple" />
          <StatBox label={t('profile.totalTexts')} value={stats.totalCorrections} color="bg-pop-orange" />
      </div>

      {/* Badges Section */}
      <div>
         <div className="bg-pop-dark text-white px-4 py-2 rounded-t-2xl border-x-3 border-t-3 border-pop-dark inline-block font-black uppercase tracking-widest text-xs">
            {t('gamification.badges')}
         </div>
         <div className="bg-white p-4 rounded-b-2xl rounded-tr-2xl border-3 border-pop-dark grid grid-cols-2 gap-3 relative z-0">
             <BadgeCard 
                icon={<Star size={24} strokeWidth={3} />} 
                title={t('gamification.badgeList.firstText.title')} 
                color="bg-pop-yellow text-pop-dark"
                earned={stats.totalCorrections > 0} 
             />
             <BadgeCard 
                icon={<Zap size={24} strokeWidth={3} />} 
                title={t('gamification.badgeList.streak3.title')} 
                color="bg-pop-pink text-white"
                earned={(user?.streak || 0) >= 3} 
             />
             <BadgeCard 
                icon={<Shield size={24} strokeWidth={3} />} 
                title={t('gamification.badgeList.grammarMaster.title')} 
                color="bg-pop-blue text-pop-dark"
                earned={stats.avgScore > 9} 
             />
             <BadgeCard 
                icon={<Trophy size={24} strokeWidth={3} />} 
                title={t('gamification.badgeList.vocabPro.title')} 
                color="bg-pop-purple text-white"
                earned={stats.totalCorrections > 5} 
             />
          </div>
      </div>

      <button 
        onClick={handleLogout}
        className="w-full mt-4 bg-white border-3 border-pop-dark text-pop-dark font-black p-4 rounded-2xl flex items-center justify-center gap-3 transition-all btn-press shadow-neo hover:bg-gray-50 mb-8"
      >
        <LogOut size={20} strokeWidth={3} />
        <span>{t('common.logout')}</span>
      </button>

      <PremiumModal isOpen={showPremiumModal} onClose={() => setShowPremiumModal(false)} />
    </div>
  );
};

const StatBox: React.FC<{ label: string, value: string | number, color: string }> = ({ label, value, color }) => (
    <div className={`relative group`}>
        <div className="absolute inset-0 bg-pop-dark rounded-2xl translate-x-1 translate-y-1"></div>
        <div className={`${color} p-4 rounded-2xl border-3 border-pop-dark text-center relative btn-press`}>
            <span className="text-4xl font-black text-white drop-shadow-md block mb-1">
                {value}
            </span>
            <span className="text-[10px] text-white/90 font-bold uppercase tracking-widest bg-black/20 px-2 py-0.5 rounded-md">{label}</span>
        </div>
    </div>
);

const BadgeCard: React.FC<{ icon: React.ReactNode, title: string, color: string, earned: boolean }> = ({ icon, title, color, earned }) => (
    <div className={`p-3 rounded-xl border-3 flex flex-col items-center text-center gap-2 transition-all ${
        earned 
        ? 'bg-gray-50 border-pop-dark opacity-100' 
        : 'bg-gray-100 border-gray-300 opacity-40 grayscale'
    }`}>
        <div className={`w-12 h-12 rounded-full flex items-center justify-center border-3 border-pop-dark shadow-sm ${earned ? color : 'bg-gray-300'}`}>
            {icon}
        </div>
        <h4 className="font-bold text-xs uppercase leading-tight text-pop-dark">{title}</h4>
    </div>
);

export default Profile;
