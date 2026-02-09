
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { SupportedLanguage, TranscriptSegment, FiveWOneH } from "../types";

// Helper để lấy instance Gemini với API Key mới nhất
const getAi = async () => {
  let apiKey = process.env.API_KEY || '';
  
  if (typeof (window as any).aistudio?.hasSelectedApiKey === 'function') {
    const hasKey = await (window as any).aistudio.hasSelectedApiKey();
    if (hasKey) {
       apiKey = (process.env.API_KEY as string) || '';
    }
  }

  if (!apiKey) {
    throw new Error("Missing API_KEY. Vui lòng thiết lập API Key.");
  }

  return new GoogleGenAI({ apiKey });
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
  try {
    const ai = await getAi();
    const langPrompt = getLangPrompt(language);
    const prompt = `Refine the raw transcription into professional ${langPrompt}. Context: ${customVocabulary}. Fix grammar, remove fillers, keep original meaning. Text: "${text}"`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || text;
  } catch (e) {
    console.error(e);
    return text;
  }
};

export const parse5W1HWithGemini = async (
  text: string,
  language: SupportedLanguage
): Promise<FiveWOneH> => {
  if (!text.trim()) return { who: "", what: "", where: "", when: "", why: "", how: "" };
  try {
    const ai = await getAi();
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

    const prompt = `Analyze the provided text and extract 5W1H elements in ${langPrompt}. Text: "${text}"`;

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
    return { who: "Lỗi", what: "Lỗi", where: "Lỗi", when: "Lỗi", why: "Lỗi", how: "Lỗi" };
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
  const ai = await getAi();
  const fullPrompt = `Chỉ dẫn phong cách: ${accentInstruction} ${styleInstruction}\n\nVăn bản: "${text}"`;

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
  const ai = await getAi();
  
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      segments: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            speaker: { type: Type.STRING, description: "Tên hoặc nhãn của người nói (Ví dụ: Người nói 1, Nhân viên...)" },
            timestamp: { type: Type.STRING, description: "Mốc thời gian định dạng MM:SS" },
            text: { type: Type.STRING, description: "Nội dung văn bản được gỡ băng cho đoạn này" }
          },
          required: ["speaker", "timestamp", "text"]
        }
      }
    },
    required: ["segments"]
  };

  const langPrompt = getLangPrompt(language);
  const prompt = `Bạn là một chuyên gia gỡ băng ghi âm chuyên nghiệp cho ngôn ngữ ${langPrompt}. 
  Hãy chuyển đổi file âm thanh đính kèm thành văn bản. 
  Yêu cầu:
  - Phân tách rõ ràng từng người nói nếu có hội thoại.
  - Ghi mốc thời gian [MM:SS] chính xác cho mỗi lượt nói.
  - Chú ý các từ chuyên môn: ${customVocabulary}.
  - Luôn trả về kết quả dưới dạng JSON hợp lệ.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType || 'audio/mpeg', data: base64Audio } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
      }
    });

    const parsed = JSON.parse(response.text || '{"segments":[]}');
    return (parsed.segments || []).map((s: any, i: number) => ({
      id: `file-seg-${Date.now()}-${i}`,
      speaker: s.speaker || "Người nói",
      timestamp: s.timestamp || "00:00",
      text: s.text || ""
    }));
  } catch (error) {
    console.error("Transcription Error:", error);
    throw new Error("Không thể gỡ băng file âm thanh này. Vui lòng kiểm tra lại định dạng hoặc API Key.");
  }
};
