import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { callGeminiStream } from '../services/apiService';
import { LANGUAGE_NAMES } from '../constants/languages';
import { useLanguage } from '../hooks/useLanguage';

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const Chatbot: React.FC = () => {
  const { t, language, user } = useLanguage();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [systemInstruction, setSystemInstruction] = useState('');

  useEffect(() => {
    const langName = LANGUAGE_NAMES[language] || 'English';
    const instruction = `You are a friendly and encouraging writing assistant for a student app called TEXTUP!. Your goal is to help students write better texts (narrative, descriptive, instructive, etc.). Do not write the full text for them, but ask guiding questions, suggest ideas, and help them structure their thoughts. Keep answers short, simple, and suitable for children/students. Respond in ${langName}.`;
    
    setSystemInstruction(instruction);

    // Add initial greeting
    setMessages([
      {
        id: 'init',
        role: 'model',
        text: t('chatbot.intro')
      }
    ]);
  }, [language, t]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const apiMessages = newMessages.map(msg => ({
        role: msg.role === 'model' ? 'model' : 'user',
        parts: [{ text: msg.text }]
      }));
      
      const responseId = (Date.now() + 1).toString();
      
      // Create a placeholder message for the streaming response
      setMessages(prev => [...prev, { id: responseId, role: 'model', text: '' }]);

      await callGeminiStream(
        'gemini-2.5-flash',
        apiMessages,
        systemInstruction,
        (textChunk) => {
            setMessages(prev => prev.map(msg => 
              msg.id === responseId ? { ...msg, text: textChunk } : msg
            ));
        }
      );
    } catch (error) {
      console.error("Error sending message:", error);
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'model', 
        text: t('common.error')
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-2">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-gray-200 text-gray-600' : 'bg-brand text-dark'
            }`}>
              {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
            </div>
            
            <div className={`rounded-2xl px-4 py-2.5 max-w-[80%] text-sm leading-relaxed shadow-sm ${
              msg.role === 'user' 
                ? 'bg-white text-dark rounded-tr-sm' 
                : 'bg-white border-l-4 border-brand text-gray-700 rounded-tl-sm'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex items-start gap-3">
                 <div className="w-8 h-8 rounded-full bg-brand text-dark flex items-center justify-center shrink-0 animate-pulse">
                    <Sparkles size={16} />
                 </div>
                 <div className="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border-l-4 border-brand">
                    <div className="flex gap-1">
                        <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="mt-2 bg-white p-2 rounded-3xl shadow-card border border-gray-100 flex items-center gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t('chatbot.placeholder')}
          className="flex-1 bg-transparent px-4 py-3 outline-none text-dark placeholder-gray-400 font-medium"
          disabled={isLoading}
        />
        <button 
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="w-12 h-12 rounded-full bg-brand text-dark flex items-center justify-center hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
        >
          <Send size={20} className={input.trim() ? 'ml-0.5' : ''} />
        </button>
      </div>
    </div>
  );
};

export default Chatbot;
