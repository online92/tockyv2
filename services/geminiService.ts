
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SupportedLanguage, TranscriptSegment, FiveWOneH } from "../types";

// Helper to get fresh AI instance with current API key
const getAi = () => {
  // Ưu tiên lấy key người dùng nhập, nếu không có thì dùng env (trống)
  const userKey = localStorage.getItem('endo_gemini_api_key');
  if (!userKey && !process.env.API_KEY) {
    throw new Error("Vui lòng nhập API Key trong phần Cài đặt/Đăng nhập.");
  }
  return new GoogleGenAI({ apiKey: userKey || process.env.API_KEY || "" });
};

const preProcessText = (text: string, language: SupportedLanguage): string => {
  if (language !== SupportedLanguage.VIETNAMESE) return text;
  const units = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
  return text.replace(/\d/g, (match) => units[parseInt(match)] + " ");
};

const getLangPrompt = (lang: SupportedLanguage) => {
  switch (lang) {
    case SupportedLanguage.VIETNAMESE: return "Vietnamese";
    case SupportedLanguage.JAPANESE: return "Japanese";
    default: return "English";
  }
};

export const refineTextWithGemini = async (
  text: string,
  language: SupportedLanguage,
  customVocabulary: string
): Promise<string> => {
  if (!text.trim()) return "";
  const ai = getAi();
  const langPrompt = getLangPrompt(language);
  const prompt = `Refine the raw transcription into professional ${langPrompt}. Context: ${customVocabulary}. Fix grammar, remove fillers. Text: "${text}"`;
  
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
  });
  return response.text || "";
};

export const parse5W1HWithGemini = async (
  text: string,
  language: SupportedLanguage
): Promise<FiveWOneH> => {
  if (!text.trim()) return { who: "", what: "", where: "", when: "", why: "", how: "" };
  const ai = getAi();
  const langPrompt = getLangPrompt(language);

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      who: { type: Type.STRING },
      what: { type: Type.STRING },
      where: { type: Type.STRING },
      when: { type: Type.STRING },
      why: { type: Type.STRING },
      how: { type: Type.STRING },
    },
    required: ["who", "what", "where", "when", "why", "how"]
  };

  const prompt = `Analyze the following text and extract 5W1H information in ${langPrompt}. If an element is missing, return an empty string. Text: "${text}"`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });
    return JSON.parse(response.text || "{}") as FiveWOneH;
  } catch (error) {
    console.error("Gemini 5W1H Error:", error);
    throw error;
  }
};

export const generateSpeechWithGemini = async (
  text: string,
  voiceName: string = 'Kore',
  styleInstruction: string = '',
  accentInstruction: string = '',
  language: SupportedLanguage = SupportedLanguage.VIETNAMESE
): Promise<string> => {
  if (!text.trim()) return "";
  const ai = getAi();
  const processedText = preProcessText(text, language);
  const fullPrompt = `Chỉ dẫn giọng đọc: ${accentInstruction} ${styleInstruction}\n\nVăn bản: "${processedText}"`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: fullPrompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio || "";
};

export const transcribeAudioFile = async (
  base64Audio: string,
  mimeType: string,
  language: SupportedLanguage,
  customVocabulary: string
): Promise<TranscriptSegment[]> => {
  const ai = getAi();
  const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        speaker: { type: Type.STRING },
        timestamp: { type: Type.STRING },
        text: { type: Type.STRING }
      },
      required: ["speaker", "timestamp", "text"]
    }
  };

  const langPrompt = getLangPrompt(language);
  const prompt = `Transcribe this audio precisely in ${langPrompt}. 
  Identify different speakers as "Speaker 1", "Speaker 2", etc. 
  Include timestamps in [MM:SS] format. 
  Context/Special terms: ${customVocabulary}`;

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: {
      parts: [
        { inlineData: { mimeType, data: base64Audio } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: responseSchema,
    }
  });

  const segments = JSON.parse(response.text || "[]");
  return segments.map((s: any, idx: number) => ({
    id: `seg-${Date.now()}-${idx}`,
    speaker: s.speaker || "Speaker",
    timestamp: s.timestamp || "00:00",
    text: s.text || ""
  }));
};
