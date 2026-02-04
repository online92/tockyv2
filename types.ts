
export enum SupportedLanguage {
  VIETNAMESE = 'vi-VN',
  ENGLISH = 'en-US',
  JAPANESE = 'ja-JP'
}

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  short: string;
  color: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: SupportedLanguage.VIETNAMESE, label: 'Tiếng Việt', short: 'VN', color: 'bg-red-500' },
  { code: SupportedLanguage.ENGLISH, label: 'English', short: 'EN', color: 'bg-blue-600' },
  { code: SupportedLanguage.JAPANESE, label: '日本語', short: 'JP', color: 'bg-red-600' },
];

export interface UserProfile {
  name: string;
  email: string;
  avatar: string;
  tokenUsed: number;
  tokenLimit: number;
}

export interface FiveWOneH {
  who: string;
  what: string;
  where: string;
  when: string;
  why: string;
  how: string;
}

export interface TranscriptSegment {
  id: string;
  speaker: string;
  timestamp: string;
  text: string;
}

export interface StoredFile {
  id: string;
  name: string;
  createdAt: number;
  language: SupportedLanguage;
  type: 'live' | 'upload' | 'tts';
  content: string;
  parsing5W1H?: FiveWOneH;
  audioUrl?: string;
}

export interface TTSVoice {
  id: string;
  name: string;
  gender: 'male' | 'female';
  style: string;
}

export const TTS_VOICES: TTSVoice[] = [
  { id: 'Kore', name: 'Nữ (Trầm ấm)', gender: 'female', style: 'Warm' },
  { id: 'Puck', name: 'Nam (Nhẹ nhàng)', gender: 'male', style: 'Soft' },
  { id: 'Charon', name: 'Nam (Chuyên nghiệp)', gender: 'male', style: 'Professional' },
  { id: 'Fenrir', name: 'Nam (Mạnh mẽ)', gender: 'male', style: 'Bold' },
  { id: 'Zephyr', name: 'Nữ (Trong trẻo)', gender: 'female', style: 'Clear' },
];

export interface SpeechAccent {
  id: string;
  label: string;
  instruction: string;
}

export const VIETNAMESE_ACCENTS: SpeechAccent[] = [
  { id: 'north', label: 'Miền Bắc', instruction: 'Hãy đọc bằng giọng Hà Nội (miền Bắc) chuẩn, rõ ràng.' },
  { id: 'central', label: 'Miền Trung', instruction: 'Hãy đọc bằng giọng miền Trung (Huế/Đà Nẵng) truyền cảm.' },
  { id: 'south', label: 'Miền Nam', instruction: 'Hãy đọc bằng giọng Sài Gòn (miền Nam) ngọt ngào, tự nhiên.' },
];

export interface SpeechStyle {
  id: string;
  label: string;
  instruction: string;
}

export const SPEECH_STYLES: SpeechStyle[] = [
  { id: 'natural', label: 'Tự nhiên', instruction: 'Nói một cách tự nhiên, truyền cảm, ngắt nghỉ đúng chỗ như người thật đang trò chuyện.' },
  { id: 'formal', label: 'Trang trọng', instruction: 'Nói với giọng điệu trang trọng, rõ ràng, phong thái chuyên nghiệp như biên tập viên truyền hình.' },
  { id: 'story', label: 'Kể chuyện', instruction: 'Nói chậm rãi, giàu cảm xúc, có ngữ điệu thăng trầm như đang kể một câu chuyện lôi cuốn.' },
  { id: 'cheerful', label: 'Vui vẻ', instruction: 'Nói với tông giọng cao, hào hứng, năng lượng và tươi vui.' },
];
