
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
      try { sessionRef.current.close(); } catch (e) {}
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch (e) {}
      audioContextRef.current = null;
    }
    setIsRecording(false);
    setInterimTranscript('');
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setError(null);

      if (!window.isSecureContext && window.location.hostname !== 'localhost') {
        setError("Microphone yêu cầu HTTPS hoặc localhost. Nếu dùng Synology, hãy kích hoạt HTTPS.");
        return;
      }

      setIsRecording(true);
      
      let apiKey = process.env.API_KEY;
      if (typeof (window as any).aistudio?.hasSelectedApiKey === 'function') {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey && (!apiKey || apiKey === '')) {
          await (window as any).aistudio.openSelectKey();
        }
      }

      if (!apiKey && (!isRecording)) {
        // Fallback check again
        apiKey = (process as any).env?.API_KEY;
      }

      const ai = new GoogleGenAI({ apiKey: apiKey || '' });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(err => {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDismissedError') {
          throw new Error("Bạn đã từ chối quyền truy cập Microphone.");
        }
        throw err;
      });
      
      streamRef.current = stream;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log("Live API connected");
            const source = audioContext.createMediaStreamSource(stream);
            const scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              if (!sessionRef.current) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => {
                try { session.sendRealtimeInput({ media: pcmBlob }); } catch(err) {}
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
                const currentInterim = interimTranscript;
                const updated = (prev.trim() + ' ' + currentInterim.trim()).trim();
                return updated;
              });
              setInterimTranscript('');
            }
          },
          onerror: (e: any) => {
            console.error("Live API Error:", e);
            if (e.message?.includes("Network error") || e.status === 403) {
              setError("Lỗi mạng hoặc API Key không hợp lệ. Hãy kiểm tra kết nối internet và biến môi trường API_KEY.");
            } else {
              setError(e.message || "Lỗi kết nối Live API.");
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
          systemInstruction: `Transcribe speech to ${language} precisely. Do not summarize. Professional stenography mode.`,
        }
      });

      sessionRef.current = sessionPromise;

    } catch (err: any) {
      console.error(err);
      setError(err.message || "Không thể khởi tạo ghi âm.");
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
