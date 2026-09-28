import React, { useState, useRef, useEffect } from "react";
import {
  Zap,
  Camera,
  Upload,
  RefreshCw,
  BookOpen,
  Type,
  Layout,
  Sparkles,
  Microscope,
  GraduationCap,
  Download,
  Share2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { LANGUAGE_NAMES } from "../constants/languages";
import { callGemini } from "../services/apiService";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";
import PremiumModal from "../components/PremiumModal";
import { generatePdf } from "../lib/pdf";
import { parseRobustJson, resizeImage } from "../lib/utils";

type LabState = "input" | "analyzing" | "result";

interface PowerLabResult {
  originalText: string;
  transformedText: string;
  context: {
    detectedType: string;
    registerAdjustment: string;
    coherenceRecommendations: string;
  };
  vocabulary: {
    repeatedWords: string[];
    synonymProposals: { original: string; synonym: string }[];
    genericSubstitutions: { original: string; substitution: string }[];
    lexicalRichness: number;
  };
  structure: {
    sentenceOrderAnalysis: string;
    reorganizationSuggestions: string;
    longParagraphsDetected: boolean;
    connectorImprovements: string;
  };
  style: {
    naturalnessRecommendations: string;
    redundanciesEliminated: string[];
    rhythmSuggestions: string;
    creativeImprovement: string;
  };
  deepAnalysis: {
    morphosyntacticBreakdown: string;
    subjectVerbComplements: string;
    agreementAlerts: string[];
    didacticExplanations: string;
  };
  teacherFeedback: {
    comments: string[];
    globalScore: number;
    personalizedRecommendations: string[];
  };
}

const LinguisticLab: React.FC = () => {
  const { t, language, user, isPremiumUser } = useLanguage();
  const [state, setState] = useState<LabState>("input");
  const [inputText, setInputText] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [result, setResult] = useState<PowerLabResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("context");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Removed forced orientation or premium lock for now as requested
  }, [isPremiumUser]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const originalBase64 = reader.result as string;
        try {
          const optimizedBase64 = await resizeImage(originalBase64);
          setImagePreview(optimizedBase64);
        } catch (e) {
          console.error("Optimization failed", e);
          if (originalBase64.length > 1_500_000) {
              setError(t('errors.imageTooLarge'));
              setImagePreview(null);
              return;
          }
          setImagePreview(originalBase64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAnalyze = async () => {
    if (!isPremiumUser()) {
      setShowPremiumModal(true);
      return;
    }
    if (!inputText.trim() && !imagePreview) return;

    setState("analyzing");
    setIsProcessing(true);
    setError(null);

    try {
      const langName = LANGUAGE_NAMES[language] || "Catalan";

      const prompt = `
        Act as an expert linguistic AI (Racó Creatiu).
        Language: ${langName}

        Task:
        Analyze the provided text (or transcribe and analyze the handwritten text in the image).
        Transform it into an optimized, clear, and rich version.
        
        Return a JSON object with EXACTLY this structure:
        {
          "originalText": "The transcribed text from the image, correcting any obvious OCR/reading errors, or the input text.",
          "transformedText": "A fully optimized, clear, and rich version of the text.",
          "context": {
            "detectedType": "e.g., narrative, formal, academic, conversation",
            "registerAdjustment": "Explanation of how the register was adjusted",
            "coherenceRecommendations": "Recommendations to make it more coherent"
          },
          "vocabulary": {
            "repeatedWords": ["word1", "word2"],
            "synonymProposals": [{"original": "word", "synonym": "better word"}],
            "genericSubstitutions": [{"original": "thing", "substitution": "specific object"}],
            "lexicalRichness": 85
          },
          "structure": {
            "sentenceOrderAnalysis": "Analysis of the sentence order",
            "reorganizationSuggestions": "Suggestions to reorganize ideas",
            "longParagraphsDetected": false,
            "connectorImprovements": "Suggestions for better connectors"
          },
          "style": {
            "naturalnessRecommendations": "How to make it more natural/powerful",
            "redundanciesEliminated": ["redundancy 1"],
            "rhythmSuggestions": "How to vary the rhythm",
            "creativeImprovement": "A creative/literary twist on the text"
          },
          "deepAnalysis": {
            "morphosyntacticBreakdown": "Breakdown of key sentences",
            "subjectVerbComplements": "Identification of S-V-C",
            "agreementAlerts": ["Alert 1"],
            "didacticExplanations": "Didactic explanation for learning"
          },
          "teacherFeedback": {
            "comments": ["Comment 1", "Comment 2"],
            "globalScore": 90,
            "personalizedRecommendations": ["Rec 1", "Rec 2"]
          }
        }

        IMPORTANT: All text values in the JSON MUST be in ${langName}.
      `;

      let contents: any = [];
      if (imagePreview) {
        const base64Data = imagePreview.split(",")[1];
        contents = [
          {
            role: "user",
            parts: [
              { text: prompt },
              { inlineData: { data: base64Data, mimeType: "image/jpeg" } },
            ],
          },
        ];
      } else {
        contents = [
          {
            role: "user",
            parts: [{ text: prompt + "\n\nInput Text:\n" + inputText }],
          },
        ];
      }

      const response = await callGemini(
        "gemini-2.5-flash",
        contents,
        undefined,
        { responseMimeType: "application/json" },
        user?.apiKey
      );

      const rawText = response.text || "{}";
      const data = parseRobustJson(rawText) as PowerLabResult;

      setResult(data);
      setState("result");
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    } catch (error: any) {
      console.error("Analysis failed", error);
      if (error?.message === 'AI_QUOTA_EXCEEDED') {
          setError(t('errors.quota') || "⏳ Quota diària esgotada al servidor.");
      } else if (error?.message === 'AI_SERVER_OVERLOAD') {
          setError(t('errors.serverOverload') || "⏳ Servidor sobrecarregat. Reintentant...");
      } else {
          setError(t("common.error") || "Analysis failed.");
      }
      setState("input");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!result) return;

    const content = `
${t('pdf.originalText')}
${result.originalText}

${t('pdf.optimizedText')}
${result.transformedText}

${t('pdf.teacherFeedback')}
${t('pdf.globalScore')} ${result.teacherFeedback.globalScore}/100
${t('pdf.comments')}
${result.teacherFeedback.comments.map((c) => "- " + c).join("\n")}
${t('pdf.recommendations')}
${result.teacherFeedback.personalizedRecommendations.map((c) => "- " + c).join("\n")}

${t('pdf.detailedAnalysis')}

${t('pdf.contextAdaptation')}
${t('pdf.textType')} ${result.context.detectedType}
${t('pdf.registerAdjustment')} ${result.context.registerAdjustment}
${t('pdf.coherence')} ${result.context.coherenceRecommendations}

${t('pdf.vocabOptimization')}
${t('pdf.lexicalRichness')} ${result.vocabulary.lexicalRichness}/100
${t('pdf.repeatedWords')} ${result.vocabulary.repeatedWords.join(", ")}
${t('pdf.synonymProposals')} ${result.vocabulary.synonymProposals.map((s) => s.original + " -> " + s.synonym).join(", ")}

${t('pdf.structureOrder')}
${t('pdf.sentenceOrderAnalysis')} ${result.structure.sentenceOrderAnalysis}
${t('pdf.reorganization')} ${result.structure.reorganizationSuggestions}
${t('pdf.connectorImprovement')} ${result.structure.connectorImprovements}

${t('pdf.styleExpressivity')}
${t('pdf.naturalness')} ${result.style.naturalnessRecommendations}
${t('pdf.creativeImprovement')} ${result.style.creativeImprovement}

${t('pdf.deepAnalysis')}
${t('pdf.morphosyntax')} ${result.deepAnalysis.morphosyntacticBreakdown}
${t('pdf.didacticExplanations')} ${result.deepAnalysis.didacticExplanations}
    `.trim();

    generatePdf({
      title: t('pdf.linguisticLab') || "Racó Creatiu - Anàlisi",
      author: user?.name,
      content: content,
      filename: "raco-creatiu.pdf",
      labels: {
        authorPrefix: t('pdf.author'),
        generatedOn: t('pdf.generatedOn'),
        pageLabel: t('pdf.page'),
        ofLabel: t('pdf.of') || 'de',
        shareTextPrefix: t('pdf.shareTextPrefix') || 'Informe de',
        shareDialogTitle: t('common.shareReport') || 'Comparteix el PDF'
      }
    });
  };

  const AccordionItem = ({
    id,
    title,
    icon,
    children,
  }: {
    id: string;
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
  }) => {
    const isActive = activeTab === id;
    return (
      <div className="bg-white rounded-2xl border-3 border-pop-dark shadow-sm overflow-hidden mb-4">
        <button
          onClick={() => setActiveTab(isActive ? "" : id)}
          className="w-full p-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-xl border-2 border-pop-dark shadow-neo-sm">
              {icon}
            </div>
            <h3 className="font-black text-pop-dark text-lg">{title}</h3>
          </div>
          {isActive ? (
            <ChevronUp size={24} className="text-pop-dark" />
          ) : (
            <ChevronDown size={24} className="text-pop-dark" />
          )}
        </button>
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="p-5 border-t-3 border-pop-dark">{children}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-pop-bg pb-24">
      {showPremiumModal && (
        <PremiumModal isOpen={showPremiumModal} onClose={() => setShowPremiumModal(false)} />
      )}

      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <header className="mb-8 text-center">
          <div className="inline-flex items-center justify-center gap-3 bg-pop-yellow px-6 py-3 rounded-full border-4 border-pop-dark shadow-neo transform -rotate-2 mb-6">
            <Zap size={32} className="text-pop-dark fill-white" />
            <h1 className="text-3xl md:text-4xl font-black text-pop-dark uppercase italic tracking-tight">
              {t("lab.title")}
            </h1>
          </div>
          <p className="text-lg font-bold text-gray-700 max-w-2xl mx-auto">
            {t("lab.desc")}
          </p>
        </header>

        {state === "input" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 md:p-8 border-4 border-pop-dark shadow-neo"
          >
            <div className="mb-6">
              <label className="block text-sm font-black text-gray-400 uppercase tracking-widest mb-2">
                1. {t('lab.analysisStepsBasic.digitalization')}
              </label>

              {!imagePreview ? (
                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 bg-pop-blue text-white p-8 rounded-2xl border-4 border-pop-dark shadow-neo btn-press flex flex-col items-center justify-center gap-4 group"
                  >
                    <div className="bg-white p-4 rounded-full group-hover:scale-110 transition-transform">
                      <Camera size={40} className="text-pop-blue" />
                    </div>
                    <span className="font-black text-xl">{t('dictat.takePhoto')}</span>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex-1 bg-pop-green text-pop-dark p-8 rounded-2xl border-4 border-pop-dark shadow-neo btn-press flex flex-col items-center justify-center gap-4 group"
                  >
                    <div className="bg-white p-4 rounded-full group-hover:scale-110 transition-transform">
                      <Upload size={40} className="text-pop-green" />
                    </div>
                    <span className="font-black text-xl">{t('dictat.uploadManuscript')}</span>
                  </button>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border-4 border-pop-dark">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-48 object-cover"
                  />
                  <button
                    onClick={() => setImagePreview(null)}
                    className="absolute top-4 right-4 bg-white text-pop-dark p-2 rounded-xl border-2 border-pop-dark shadow-neo-sm hover:bg-red-50"
                  >
                    <RefreshCw size={20} />
                  </button>
                </div>
              )}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-black text-gray-400 uppercase tracking-widest">
                  {t('lab.analysisLabelsBasic.orWrite')}
                </label>
              </div>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={t("lab.inputPlaceholder")}
                className="w-full h-32 p-4 bg-gray-50 border-3 border-pop-dark rounded-2xl font-medium text-pop-dark resize-none focus:ring-4 focus:ring-pop-yellow outline-none transition-all"
              />
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-xl border-2 border-red-200 font-bold">
                {error}
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={(!inputText.trim() && !imagePreview) || isProcessing}
              className="w-full bg-pop-dark text-white font-black text-xl py-5 rounded-2xl border-4 border-black shadow-neo btn-press flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed mb-8"
            >
              <Zap size={28} className="text-pop-yellow fill-pop-yellow" />
              <span>{t('lab.analyzeBtn')}</span>
            </button>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8 pt-8 border-t-4 border-gray-100">
              <div className="bg-pop-blue/10 p-4 rounded-2xl border-2 border-pop-blue">
                <h3 className="font-black text-pop-dark mb-2 flex items-center gap-2">
                  <span>ðŸ“¸</span> 1. {t('lab.analysisStepsBasic.digitalization')}
                </h3>
                <ul className="text-sm text-gray-600 space-y-1 font-medium">
                  <li>• {t('lab.stepDescriptionsBasic.ocr1')}</li>
                  <li>• {t('lab.stepDescriptionsBasic.ocr2')}</li>
                  <li>• {t('lab.stepDescriptionsBasic.ocr3')}</li>
                </ul>
              </div>

              <div className="bg-pop-pinkLight/30 p-4 rounded-2xl border-2 border-pop-pink">
                <h3 className="font-black text-pop-dark mb-2 flex items-center gap-2">
                  <span>🧠</span> 2. {t('lab.analysisStepsBasic.context')}
                </h3>
                <ul className="text-sm text-gray-600 space-y-1 font-medium">
                  <li>
                    • {t('lab.stepDescriptionsBasic.context1')}
                  </li>
                  <li>• {t('lab.stepDescriptionsBasic.context2')}</li>
                  <li>• {t('lab.stepDescriptionsBasic.context3')}</li>
                </ul>
              </div>

              <div className="bg-pop-yellow/20 p-4 rounded-2xl border-2 border-pop-yellow">
                <h3 className="font-black text-pop-dark mb-2 flex items-center gap-2">
                  <span>ðŸ”</span> {t('lab.analysisStepsBasic.vocab')}
                </h3>
                <ul className="text-sm text-gray-600 space-y-1 font-medium">
                  <li>• {t('lab.stepDescriptionsBasic.vocab1')}</li>
                  <li>• {t('lab.stepDescriptionsBasic.vocab2')}</li>
                  <li>• {t('lab.stepDescriptionsBasic.vocab3')}</li>
                </ul>
              </div>

              <div className="bg-pop-green/20 p-4 rounded-2xl border-2 border-pop-green">
                <h3 className="font-black text-pop-dark mb-2 flex items-center gap-2">
                  <span>ðŸ§©</span> {t('lab.analysisStepsBasic.structure')}
                </h3>
                <ul className="text-sm text-gray-600 space-y-1 font-medium">
                  <li>• {t('lab.stepDescriptionsBasic.structure1')}</li>
                  <li>• {t('lab.stepDescriptionsBasic.structure2')}</li>
                  <li>• {t('lab.stepDescriptionsBasic.structure3')}</li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}

        {state === "analyzing" && (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-pop-in">
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-pop-yellow blur-2xl opacity-50 animate-pulse" />
              <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center relative border-4 border-pop-dark shadow-neo animate-spin-slow">
                <Zap size={48} className="text-pop-dark fill-pop-yellow" />
              </div>
            </div>
            <h3 className="text-3xl font-black text-pop-dark uppercase tracking-tight mb-4">
              {t('lab.analyzingSubtitle')}
            </h3>
            <div className="flex gap-2">
              <span
                className="w-3 h-3 bg-pop-blue rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-3 h-3 bg-pop-pink rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-3 h-3 bg-pop-green rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        )}

        {state === "result" && result && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Header Actions */}
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl border-3 border-pop-dark shadow-sm">
              <button
                onClick={() => {
                  setState("input");
                  setResult(null);
                  setImagePreview(null);
                  setInputText("");
                }}
                className="flex items-center gap-2 text-gray-500 font-bold hover:text-pop-dark transition-colors"
              >
                <RefreshCw size={20} />
                <span>{t('lab.newText')}</span>
              </button>
              <div className="flex gap-3">
                <button
                  onClick={handleDownloadPdf}
                  className="flex items-center gap-2 bg-pop-blue text-white px-4 py-2 rounded-xl font-bold border-2 border-pop-dark shadow-neo-sm btn-press"
                >
                  <Download size={18} />
                  <span>{t('lab.download')}</span>
                </button>
              </div>
            </div>

            {/* Original vs Transformed */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-3xl border-4 border-pop-dark shadow-neo relative">
                <div className="absolute -top-4 -left-4 bg-pop-yellow text-pop-dark px-4 py-1 rounded-full border-3 border-pop-dark font-black text-sm uppercase transform -rotate-3">
                  {t('lab.original')}
                </div>
                <p className="text-gray-600 font-medium leading-relaxed mt-2 whitespace-pre-wrap">
                  {result.originalText}
                </p>
              </div>

              <div className="bg-pop-dark p-6 rounded-3xl border-4 border-pop-dark shadow-neo relative text-white">
                <div className="absolute -top-4 -right-4 bg-pop-green text-pop-dark px-4 py-1 rounded-full border-3 border-pop-dark font-black text-sm uppercase transform rotate-3 flex items-center gap-1">
                  <Sparkles size={14} /> {t('lab.optimized')}
                </div>
                <p className="font-medium leading-relaxed mt-2 whitespace-pre-wrap text-lg">
                  {result.transformedText}
                </p>
              </div>
            </div>

            {/* Teacher Feedback Card */}
            <div className="bg-gradient-to-br from-pop-purple to-pop-pink p-1 rounded-3xl shadow-neo">
              <div className="bg-white rounded-[22px] p-6 h-full">
                <div className="flex items-center gap-4 mb-6 border-b-2 border-gray-100 pb-4">
                  <div className="w-16 h-16 bg-pop-purple rounded-full flex items-center justify-center border-3 border-pop-dark shadow-neo-sm">
                    <GraduationCap size={32} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-pop-dark uppercase italic">
                      {t('lab.feedbackTitle')}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm font-bold text-gray-500">
                        {t('lab.score')}:
                      </span>
                      <span className="bg-pop-yellow px-2 py-0.5 rounded-md font-black text-pop-dark border-2 border-pop-dark">
                        {result.teacherFeedback.globalScore}/100
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-black text-pop-purple uppercase text-sm mb-2">
                      {t('lab.comments')}:
                    </h4>
                    <ul className="space-y-2">
                      {result.teacherFeedback.comments.map((comment, i) => (
                        <li
                          key={i}
                          className="flex items-start gap-2 text-gray-700 font-medium"
                        >
                          <span className="text-pop-purple mt-1">•</span>
                          {comment}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-black text-pop-pink uppercase text-sm mb-2">
                      {t('lab.recommendations')}:
                    </h4>
                    <ul className="space-y-2">
                      {result.teacherFeedback.personalizedRecommendations.map(
                        (rec, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 text-gray-700 font-medium"
                          >
                            <span className="text-pop-pink mt-1">→</span>
                            {rec}
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Analysis Accordions */}
            <div className="mt-8">
              <h3 className="text-xl font-black text-gray-400 uppercase tracking-widest mb-4 text-center">
                {t('lab.detailedAnalysis')}
              </h3>

              <AccordionItem
                id="context"
                title={t('lab.analysisSteps.context')}
                icon={<BookOpen className="text-pop-blue" />}
              >
                <div className="space-y-4">
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                    <span className="text-xs font-black text-blue-400 uppercase block mb-1">
                      {t('lab.analysisLabels.contextType')}
                    </span>
                    <p className="font-bold text-blue-900">
                      {result.context.detectedType}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-black text-gray-400 uppercase block mb-1">
                      {t('lab.analysisLabels.contextRegister')}
                    </span>
                    <p className="text-gray-700 font-medium">
                      {result.context.registerAdjustment}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-black text-gray-400 uppercase block mb-1">
                      {t('lab.analysisLabels.contextCoherence')}
                    </span>
                    <p className="text-gray-700 font-medium">
                      {result.context.coherenceRecommendations}
                    </p>
                  </div>
                </div>
              </AccordionItem>

              <AccordionItem
                id="vocab"
                title={t('lab.analysisSteps.vocab')}
                icon={<Type className="text-pop-green" />}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between bg-green-50 p-4 rounded-xl border border-green-100">
                    <span className="font-black text-green-800 uppercase">
                      {t('lab.analysisLabels.vocabRichness')}
                    </span>
                    <div className="w-16 h-16 rounded-full border-4 border-green-500 flex items-center justify-center bg-white font-black text-xl text-green-600 shadow-sm">
                      {result.vocabulary.lexicalRichness}
                    </div>
                  </div>

                  {result.vocabulary.repeatedWords.length > 0 && (
                    <div>
                      <span className="text-xs font-black text-gray-400 uppercase block mb-2">
                        {t('lab.analysisLabels.vocabRepeated')}
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {result.vocabulary.repeatedWords.map((word, i) => (
                          <span
                            key={i}
                            className="bg-red-100 text-red-700 px-3 py-1 rounded-lg font-bold text-sm border border-red-200"
                          >
                            {word}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.vocabulary.synonymProposals.length > 0 && (
                    <div>
                      <span className="text-xs font-black text-gray-400 uppercase block mb-2">
                        {t('lab.analysisLabels.vocabSynonyms')}
                      </span>
                      <div className="space-y-2">
                        {result.vocabulary.synonymProposals.map((prop, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 bg-gray-50 p-2 rounded-lg border border-gray-200"
                          >
                            <span className="text-gray-500 line-through font-medium">
                              {prop.original}
                            </span>
                            <span className="text-gray-400">→</span>
                            <span className="text-green-600 font-bold">
                              {prop.synonym}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </AccordionItem>

              <AccordionItem
                id="structure"
                title={t('lab.analysisSteps.structure')}
                icon={<Layout className="text-pop-orange" />}
              >
                <div className="space-y-4">
                  {result.structure.longParagraphsDetected && (
                    <div className="bg-orange-50 text-orange-800 p-3 rounded-xl border border-orange-200 font-bold flex items-center gap-2">
                      ⚠️ {t('lab.analysisLabels.structureAlert')}
                    </div>
                  )}
                  <div>
                    <span className="text-xs font-black text-gray-400 uppercase block mb-1">
                      {t('lab.analysisLabels.structureOrder')}
                    </span>
                    <p className="text-gray-700 font-medium">
                      {result.structure.sentenceOrderAnalysis}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-black text-gray-400 uppercase block mb-1">
                      {t('lab.analysisLabels.structureReorg')}
                    </span>
                    <p className="text-gray-700 font-medium">
                      {result.structure.reorganizationSuggestions}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-black text-gray-400 uppercase block mb-1">
                      {t('lab.analysisLabels.structureConnectors')}
                    </span>
                    <p className="text-gray-700 font-medium">
                      {result.structure.connectorImprovements}
                    </p>
                  </div>
                </div>
              </AccordionItem>

              <AccordionItem
                id="style"
                title={t('lab.analysisSteps.style')}
                icon={<Sparkles className="text-pop-pink" />}
              >
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-black text-gray-400 uppercase block mb-1">
                      {t('lab.analysisLabels.styleNaturalness')}
                    </span>
                    <p className="text-gray-700 font-medium mb-2">
                      {result.style.naturalnessRecommendations}
                    </p>
                    <p className="text-gray-700 font-medium">
                      {result.style.rhythmSuggestions}
                    </p>
                  </div>

                  {result.style.redundanciesEliminated.length > 0 && (
                    <div>
                      <span className="text-xs font-black text-gray-400 uppercase block mb-2">
                        {t('lab.analysisLabels.styleRedundancies')}
                      </span>
                      <ul className="list-disc pl-5 text-gray-600 font-medium">
                        {result.style.redundanciesEliminated.map((red, i) => (
                          <li key={i}>{red}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-pink-50 p-4 rounded-xl border border-pink-200">
                    <span className="text-xs font-black text-pink-400 uppercase block mb-1">
                      {t('lab.analysisLabels.styleCreative')}
                    </span>
                    <p className="font-medium text-pink-900 italic">
                      "{result.style.creativeImprovement}"
                    </p>
                  </div>
                </div>
              </AccordionItem>

              <AccordionItem
                id="deep"
                title={t('lab.analysisSteps.deep')}
                icon={<Microscope className="text-pop-purple" />}
              >
                <div className="space-y-4">
                  <div>
                    <span className="text-xs font-black text-gray-400 uppercase block mb-1">
                      {t('lab.analysisLabels.deepMorpho')}
                    </span>
                    <p className="text-gray-700 font-medium bg-gray-50 p-3 rounded-lg border border-gray-200 font-mono text-sm">
                      {result.deepAnalysis.morphosyntacticBreakdown}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-black text-gray-400 uppercase block mb-1">
                      {t('lab.analysisLabels.deepSubject')}
                    </span>
                    <p className="text-gray-700 font-medium">
                      {result.deepAnalysis.subjectVerbComplements}
                    </p>
                  </div>

                  {result.deepAnalysis.agreementAlerts.length > 0 && (
                    <div>
                      <span className="text-xs font-black text-red-400 uppercase block mb-2">
                        {t('lab.analysisLabels.deepAgreement')}
                      </span>
                      <ul className="space-y-2">
                        {result.deepAnalysis.agreementAlerts.map((alert, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-2 bg-red-50 p-2 rounded-lg border border-red-100 text-red-700 font-medium text-sm"
                          >
                            ⚠️ {alert}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                    <span className="text-xs font-black text-purple-400 uppercase block mb-1">
                      {t('lab.analysisLabels.deepDidactic')}
                    </span>
                    <p className="font-medium text-purple-900">
                      {result.deepAnalysis.didacticExplanations}
                    </p>
                  </div>
                </div>
              </AccordionItem>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default LinguisticLab;
