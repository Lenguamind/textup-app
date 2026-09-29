import React, { useState } from 'react';
import { Crown, Check, X, ShieldCheck, Star, Loader2, RotateCcw } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { billingService, ProductId } from '../services/billingService';
import { Capacitor } from '@capacitor/core';

interface PremiumModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PremiumModal: React.FC<PremiumModalProps> = ({ isOpen, onClose }) => {
  const { t, updateUser, user } = useLanguage();
  const [showSuccess, setShowSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('annual');
  const [error, setError] = useState<string | null>(null);
  const [dynamicPrices, setDynamicPrices] = useState({ monthly: '4.99€', annual: '39.99€' });

  const loadPrices = React.useCallback(async () => {
    try {
      if (!Capacitor.isNativePlatform()) return;
      
      const monProd = billingService.getProduct(ProductId.MONTHLY);
      const annProd = billingService.getProduct(ProductId.YEARLY);
      
      const prices = { ...dynamicPrices };
      if (monProd?.price) prices.monthly = monProd.price;
      if (annProd?.price) prices.annual = annProd.price;
      
      setDynamicPrices(prices);
    } catch (err) {
      console.error("Error loading prices:", err);
    }
  }, [dynamicPrices]);

  React.useEffect(() => {
    if (isOpen && Capacitor.isNativePlatform()) {
      loadPrices();
    }
  }, [isOpen, loadPrices]);

  if (!isOpen) return null;

  const handleRestore = async () => {
    setIsProcessing(true);
    try {
      await billingService.restore();
      // El servei ja s'encarrega d'actualitzar via backend si troba una compra activa
      setTimeout(() => {
        setIsProcessing(false);
        // Si l'usuari ara és premium, tanquem
        if (user?.isPremium) onClose();
      }, 2000);
    } catch (e) {
      setIsProcessing(false);
    }
  };

  const handleUpgrade = async () => {
    setError(null);
    setIsProcessing(true);

    try {
      const prodId = selectedPlan === 'annual' ? ProductId.YEARLY : ProductId.MONTHLY;
      
      if (Capacitor.isNativePlatform()) {
        await billingService.purchase(prodId);
        // La finalització de la compra s'atén al BillingService.when('approved')
        setIsProcessing(false);
        return;
      }

      // Mode WEB / Simulation
      const result = await billingService.purchase(prodId);
      
      if (result && (result as any).status === 'web_mode') {
        setError("Per provar la passarel·la de pagament real, has d'utilitzar l'App al mòbil.");
        setIsProcessing(false);
      } else {
        setIsProcessing(false);
      }

    } catch (err: any) {
      console.error("Purchase error:", err);
      setError(err.message || "Error processing purchase");
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in overflow-y-auto">
      <div className="bg-white w-full max-w-md rounded-3xl border-4 border-pop-dark shadow-neo overflow-hidden relative my-auto">
        
        {showSuccess ? (
          <div className="p-12 flex flex-col items-center justify-center text-center h-[500px] animate-pop-in">
            <div className="w-24 h-24 bg-pop-yellow rounded-full border-4 border-pop-dark flex items-center justify-center mb-6 shadow-neo-sm">
              <Star size={48} className="text-pop-dark fill-white animate-spin-slow" />
            </div>
            <h2 className="text-3xl font-black text-pop-dark uppercase tracking-tight mb-2">
              {t('premium.success') || "Premium! 🌟"}
            </h2>
            <p className="text-gray-600 font-bold text-lg">
              {t('premium.successDesc') || "Premium active!"}
            </p>
          </div>
        ) : (
          <>
            {/* Close Button */}
            <button 
              onClick={!isProcessing ? onClose : undefined}
              className={`absolute top-4 right-4 bg-white/50 p-2 rounded-full hover:bg-white transition-colors z-20 ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <X size={24} className="text-pop-dark" strokeWidth={3} />
            </button>

            {/* Header */}
            <div className="bg-pop-yellow p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
                <div className="relative z-10">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-pop-dark shadow-sm">
                        <Crown size={40} className="text-pop-dark fill-pop-yellow" strokeWidth={2.5} />
                    </div>
                    <h2 className="text-3xl font-black text-pop-dark uppercase tracking-tight leading-none">TEXTUP! <span className="text-white text-stroke-sm">Premium</span></h2>
                    <p className="font-bold text-pop-dark/80 mt-2 uppercase tracking-wide text-sm">
                        {t('premium.unlockPower')}
                    </p>
                </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
                <div className="space-y-3">
                    <FeatureItem text={t('premium.feat1')} highlight />
                    <FeatureItem text={t('premium.feat2')} />
                    <FeatureItem text={t('premium.feat3')} />
                    <FeatureItem text={t('premium.feat4')} />
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                    {/* Plan Mensual */}
                    <div 
                        onClick={() => !isProcessing && setSelectedPlan('monthly')}
                        className={`p-3 rounded-xl border-3 text-center cursor-pointer relative transition-all ${
                            selectedPlan === 'monthly' 
                            ? 'bg-pop-dark border-pop-dark text-white shadow-neo-sm transform -translate-y-1' 
                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                    >
                        <span className="font-bold text-xs uppercase tracking-widest block mb-1">
                            {t('premium.monthly')}
                        </span>
                        <div className="flex items-center justify-center gap-1">
                            <span className="text-2xl font-black">{dynamicPrices.monthly}</span>
                        </div>
                        <span className="text-xs opacity-75 font-medium">{t('premium.month')}</span>
                    </div>

                    {/* Plan Anual - Màxim Valor */}
                    <div 
                        onClick={() => !isProcessing && setSelectedPlan('annual')}
                        className={`p-3 rounded-xl border-3 text-center cursor-pointer relative transition-all ${
                            selectedPlan === 'annual' 
                            ? 'bg-pop-green text-white border-pop-dark shadow-neo transform -translate-y-1' 
                            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                    >
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-pop-yellow text-pop-dark text-[10px] whitespace-nowrap font-black px-2 py-0.5 rounded-full border-2 border-pop-dark">
                            {t('premium.save')}
                        </div>
                        <span className="font-bold text-xs uppercase tracking-widest block mb-1">
                            {t('premium.yearly')}
                        </span>
                        <div className="flex items-center justify-center gap-1">
                            <span className="text-2xl font-black text-pop-dark">{dynamicPrices.annual}</span>
                        </div>
                        <span className="text-xs text-pop-dark font-black">{t('premium.year')}</span>
                    </div>
                </div>

                {error && (
                    <p className="text-red-500 text-xs font-bold text-center uppercase mb-2">
                        {error}
                    </p>
                )}

                {Capacitor.isNativePlatform() ? (
                    <>
                        <button 
                            onClick={handleUpgrade}
                            disabled={isProcessing}
                            className={`w-full text-white font-black text-xl py-4 rounded-2xl border-3 border-pop-dark shadow-neo btn-press flex items-center justify-center gap-2 group transition-colors ${
                                isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-pop-dark hover:bg-gray-900'
                            }`}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="animate-spin" />
                                    <span>{t('premium.processing')}</span>
                                </>
                            ) : (
                                <>
                                    <ShieldCheck className="text-pop-yellow group-hover:scale-110 transition-transform fill-current" />
                                    <span>{t('premium.subscribe')}</span>
                                </>
                            )}
                        </button>
                        
                        <p className="text-[10px] text-gray-400 text-center uppercase tracking-wider font-bold px-4 leading-tight mb-2">
                            {t('premium.cancelInfo')}
                        </p>

                        <button 
                            onClick={handleRestore}
                            disabled={isProcessing}
                            className="w-full flex items-center justify-center gap-2 py-2 text-gray-500 hover:text-pop-dark transition-colors"
                        >
                            <RotateCcw size={14} className={isProcessing ? 'animate-spin' : ''} />
                            <span className="text-[10px] font-black uppercase tracking-widest">{t('premium.restore') || "Restaurar compres"}</span>
                        </button>
                    </>
                ) : (
                    <div className="w-full bg-gray-100 text-gray-500 font-bold text-center py-4 rounded-2xl border-2 border-gray-200">
                        La subscripció a l'app premium s'ha de realitzar des de l'aplicació oficial d'Android/iOS.
                    </div>
                )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const FeatureItem: React.FC<{ text: string, highlight?: boolean }> = ({ text, highlight }) => (
  <div className="flex items-start gap-3">
    <div className={`shrink-0 mt-0.5 rounded-full p-1 ${highlight ? 'bg-pop-yellow text-pop-dark' : 'bg-green-100 text-green-600'}`}>
      <Check size={16} strokeWidth={4} />
    </div>
    <span className={`font-bold ${highlight ? 'text-pop-dark' : 'text-gray-600'}`}>{text}</span>
  </div>
);

export default PremiumModal;

