
import { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { SupportedLanguage } from '../types';

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function createBlob(data: Float32Array) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

export const useLiveTranscription = (language: SupportedLanguage) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopRecording = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    setIsRecording(false);
    setInterimTranscript('');
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setIsRecording(true);
      setError(null);
      
      // Check for API Key selection right before connecting
      const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
      if (!hasKey) {
        await (window as any).aistudio?.openSelectKey();
      }

      // Re-initialize with potentially new process.env.API_KEY
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = audioContext.createMediaStreamSource(stream);
            const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => {
                session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContext.destination);
          },
          onmessage: async (message) => {
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              setInterimTranscript(prev => prev + text);
            }
            if (message.serverContent?.turnComplete) {
              setTranscript(prev => {
                const updated = (prev.trim() + ' ' + interimTranscript.trim()).trim();
                return updated;
              });
              setInterimTranscript('');
            }
          },
          onerror: (e) => {
            console.error("Live API Error:", e);
            if (e.message?.includes("Requested entity was not found")) {
              setError("API Key không hợp lệ hoặc đã hết hạn.");
            } else {
              setError("Lỗi kết nối AI Live API");
            }
            stopRecording();
          },
          onclose: () => {
            setIsRecording(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          systemInstruction: `Bạn là một trợ lý tốc ký chuyên nghiệp. Hãy chuyển đổi giọng nói sang văn bản ${language} một cách chính xác. Bỏ qua các từ đệm, tiếng ồn, giữ đúng ngữ nghĩa trang trọng.`,
        }
      });

      sessionRef.current = sessionPromise;

    } catch (err) {
      console.error(err);
      setError("Cần quyền truy cập Microphone.");
      setIsRecording(false);
    }
  }, [language, stopRecording, interimTranscript]);

  return {
    isRecording,
    transcript,
    interimTranscript,
    startRecording,
    stopRecording,
    setTranscript,
    error
  };
};
