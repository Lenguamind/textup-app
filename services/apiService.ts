import { Capacitor } from '@capacitor/core';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../lib/firebase';
const functions = getFunctions(app, 'us-central1');
const GEMINI_MODEL = 'gemini-2.5-flash';
export const callGemini = async (
    model?: string,
    contents: any[],
    systemInstruction?: string,
    extraConfig?: any,
    _apiKey?: string,
    forceJson: boolean = false
) => {
    let userId = localStorage.getItem('textup_user_id');
    if (!userId) {
        userId = 'user_' + Math.random().toString(36).substring(2, 11);
        localStorage.setItem('textup_user_id', userId);
    }
    const parts = contents[0]?.parts || [];
    const textPart = parts.find((p: any) => p.text);
    const imagePart = parts.find((p: any) => p.inlineData);
    let prompt = textPart?.text || '';
    if (forceJson) {
        prompt = prompt + '\n\nCRITICAL: Respond ONLY with valid JSON. No markdown, no explanations outside JSON. Start with { and end with }.';
    }
    const fullPrompt = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
    const generateFn = httpsCallable(functions, 'generate');
    try {
        const result = await generateFn({
            userId,
            prompt: fullPrompt,
            image: imagePart?.inlineData?.data || null,
            mimeType: imagePart?.inlineData?.mimeType || null,
            model: model || GEMINI_MODEL,
            config: extraConfig
        });
        const data = result.data as any;
        if (!data.success) {
            if (data.error === 'QUOTA_EXCEEDED') throw new Error('AI_QUOTA_EXCEEDED');
            throw new Error(data.error || 'Error al servidor');
        }
        return { text: data.text };
    } catch (err: any) {
        if (
            err?.code === 'functions/resource-exhausted' ||
            err?.message?.includes('superat') ||
            err?.message?.includes('QUOTA') ||
            err?.message?.includes('quota') ||
            err?.message?.includes('429')
        ) {
            throw new Error('AI_QUOTA_EXCEEDED');
        }
        throw err;
    }
};
export const callGeminiStream = async (
    model: string,
    contents: any[],
    systemInstruction?: string,
    onUpdate?: (text: string) => void,
    extraConfig?: any
) => {
    try {
        const response = await callGemini(model, contents, systemInstruction, extraConfig);
        if (onUpdate && response.text) {
            onUpdate(response.text);
        }
        return response.text;
    } catch (error: any) {
        console.error("Gemini Error:", error);
        throw error;
    }
};
export const verifyAndroidPurchase = async (purchaseToken: string, productId: string) => {
    const userId = localStorage.getItem('textup_user_id');
    const validateFn = httpsCallable(functions, 'validateSubscription');
    const result = await validateFn({ userId, purchaseToken, productId });
    return result.data;
};

export const verifyApplePurchase = async (transactionId: string, productId: string) => {
    const userId = localStorage.getItem('textup_user_id');
    const validateFn = httpsCallable(functions, 'validateSubscription');
    const result = await validateFn({ userId, transactionId, productId, platform: 'ios' });
    return result.data;
};export const getUserStatus = async (uid?: string) => {
    const userId = uid || localStorage.getItem('textup_user_id');
    if (!userId) return null;
    const getUserStatusFn = httpsCallable(functions, 'getUserStatus');
    const result = await getUserStatusFn({ userId });
    return result.data;
};

