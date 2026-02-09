
import React, { useState, useRef, useEffect } from 'react';
import { 
  Headphones, FileAudio, Play, Pause, Volume2,
  Download, Upload, Send, Trash2, 
  Settings2, Music, User, Clock, 
  FileText, Copy, Sparkles, CheckCircle, VolumeX,
  Type as TypeIcon, Smile, X, FastForward, Gauge, MapPin, FileType
} from 'lucide-react';
import { Button } from './Button';
import { SupportedLanguage, TTS_VOICES, TranscriptSegment, SPEECH_STYLES, VIETNAMESE_ACCENTS } from '../types';
import { generateSpeechWithGemini, transcribeAudioFile } from '../services/geminiService';

interface AudioStudioProps {
  language: SupportedLanguage;
  vocabulary: string;
  onSttComplete?: (segments: TranscriptSegment[]) => void;
}

export const AudioStudio: React.FC<AudioStudioProps> = ({ language, vocabulary, onSttComplete }) => {
  const [activeTab, setActiveTab] = useState<'tts' | 'stt'>('tts');
  
  // TTS State
  const [ttsText, setTtsText] = useState('');
  const [selectedVoice, setSelectedVoice] = useState(TTS_VOICES[0].id);
  const [selectedStyle, setSelectedStyle] = useState(SPEECH_STYLES[0].id);
  const [selectedAccent, setSelectedAccent] = useState(VIETNAMESE_ACCENTS[0].id);
  const [downloadFormat, setDownloadFormat] = useState<'wav' | 'mp3'>('wav');
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isGeneratingTts, setIsGeneratingTts] = useState(false);
  const [generatedAudioBlob, setGeneratedAudioBlob] = useState<Blob | null>(null);
  const [previewingVoiceId, setPreviewingVoiceId] = useState<string | null>(null);

  // STT State
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mainAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (mainAudioRef.current) {
      mainAudioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed, generatedAudioBlob]);

  const createWavBlob = (base64Pcm: string): Blob => {
    const binaryString = atob(base64Pcm);
    const pcmData = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      pcmData[i] = binaryString.charCodeAt(i);
    }

    const sampleRate = 24000;
    const numChannels = 1;
    const bitsPerSample = 16;
    const header = new ArrayBuffer(44);
    const view = new DataView(header);

    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + pcmData.length, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, pcmData.length, true);

    return new Blob([header, pcmData], { type: 'audio/wav' });
  };

  const handleGenerateTTS = async (textToGen: string = ttsText, voiceId: string = selectedVoice, isPreview: boolean = false) => {
    if (!textToGen.trim()) return;
    if (!isPreview) setIsGeneratingTts(true);
    else setPreviewingVoiceId(voiceId);

    const style = SPEECH_STYLES.find(s => s.id === selectedStyle);
    const accent = VIETNAMESE_ACCENTS.find(a => a.id === selectedAccent);
    
    const styleInstruction = style?.instruction || '';
    const accentInstruction = language === SupportedLanguage.VIETNAMESE ? (accent?.instruction || '') : '';

    try {
      const base64 = await generateSpeechWithGemini(textToGen, voiceId, styleInstruction, accentInstruction, language);
      const wavBlob = createWavBlob(base64);
      
      if (isPreview) {
        const audio = new Audio(URL.createObjectURL(wavBlob));
        audio.playbackRate = playbackSpeed;
        audio.onended = () => setPreviewingVoiceId(null);
        audio.play();
      } else {
        setGeneratedAudioBlob(wavBlob);
      }
    } catch (error) {
      console.error(error);
      alert("Lỗi khi tạo giọng nói. Kiểm tra API Key.");
      setPreviewingVoiceId(null);
    } finally {
      if (!isPreview) setIsGeneratingTts(false);
    }
  };

  const handlePreviewVoice = (voiceId: string) => {
    const previewText = "Chào bạn, đây là mẫu giọng nói của hệ thống ENDO AI.";
    handleGenerateTTS(previewText, voiceId, true);
  };

  const handleDownloadTTS = () => {
    if (!generatedAudioBlob) return;
    const url = URL.createObjectURL(generatedAudioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `endo-speech-${Date.now()}.${downloadFormat}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsTranscribing(true);
    setUploadProgress(10);
    
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        setUploadProgress(40);
        
        try {
          const segments = await transcribeAudioFile(base64, file.type, language, vocabulary);
          setUploadProgress(100);
          if (onSttComplete) onSttComplete(segments);
        } catch (err) {
          console.error(err);
          alert("Lỗi khi gỡ băng. Kiểm tra định dạng file và API Key.");
        }
      };
    } catch (error) {
      console.error(error);
      alert("Lỗi khi đọc file.");
    } finally {
      setIsTranscribing(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-white dark:bg-zinc-950 p-3 sm:p-6">
      <div className="flex justify-center mb-6 shrink-0 px-2">
        <div className="bg-emerald-50 dark:bg-zinc-900 p-1 rounded-2xl flex gap-1 shadow-inner border border-emerald-100 dark:border-zinc-800 w-full max-w-sm">
          <button 
            onClick={() => setActiveTab('tts')} 
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'tts' ? 'bg-white dark:bg-emerald-600 text-emerald-700 dark:text-white shadow-md' : 'text-zinc-400 hover:text-emerald-600'}`}
          >
            <Headphones className="w-4 h-4"/><span className="inline">TTS</span>
          </button>
          <button 
            onClick={() => setActiveTab('stt')} 
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${activeTab === 'stt' ? 'bg-white dark:bg-emerald-600 text-emerald-700 dark:text-white shadow-md' : 'text-zinc-400 hover:text-emerald-600'}`}
          >
            <FileAudio className="w-4 h-4"/><span className="inline">STT</span>
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-4">
        {activeTab === 'tts' ? (
          <>
            <div className="flex-1 flex flex-col gap-4 min-h-0">
              <div className="flex-1 bg-emerald-50/30 dark:bg-zinc-900/40 rounded-[24px] border-2 border-emerald-100 dark:border-zinc-800 p-4 sm:p-6 flex flex-col shadow-inner">
                <textarea 
                  className="flex-1 bg-transparent resize-none focus:outline-none text-base sm:text-lg font-medium text-emerald-950 dark:text-zinc-100"
                  placeholder="Nhập nội dung... "
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                />
                <div className="flex justify-between items-center mt-3 pt-3 border-t border-emerald-100/50">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{ttsText.length} ký tự</span>
                  <button onClick={() => setTtsText('')} className="p-2 text-zinc-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                </div>
              </div>
              <Button 
                className="h-14 sm:h-16 rounded-[20px] text-sm sm:text-base font-black uppercase tracking-widest shadow-lg active:scale-95" 
                isLoading={isGeneratingTts} 
                onClick={() => handleGenerateTTS()} 
                icon={<Sparkles className="w-5 h-5"/>}
              >
                Tạo Giọng Đọc
              </Button>
            </div>

            <div className="w-full lg:w-[350px] xl:w-[400px] flex flex-col gap-4 overflow-y-auto pr-1 pb-4 custom-scrollbar">
              <div className="bg-white dark:bg-zinc-900 rounded-[24px] border border-emerald-100 dark:border-zinc-800 p-5 sm:p-6 shadow-xl space-y-6">
                <h3 className="text-xs font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2"><Settings2 className="w-4 h-4"/> Tùy chỉnh</h3>
                
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block flex items-center justify-between">
                    <span className="flex items-center gap-2"><Gauge className="w-3 h-3"/> Tốc độ: {playbackSpeed.toFixed(1)}x</span>
                  </label>
                  <input type="range" min="0.5" max="2.0" step="0.1" value={playbackSpeed} onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))} className="w-full h-2 bg-emerald-100 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-600 touch-none"/>
                </div>

                {language === SupportedLanguage.VIETNAMESE && (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block flex items-center gap-2"><MapPin className="w-3 h-3"/> Giọng vùng miền</label>
                    <div className="grid grid-cols-3 gap-2">
                      {VIETNAMESE_ACCENTS.map(acc => (
                        <button key={acc.id} onClick={() => setSelectedAccent(acc.id)} className={`px-1 py-3 rounded-xl text-[9px] font-bold uppercase transition-all border-2 text-center ${selectedAccent === acc.id ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400 border-zinc-100 dark:border-zinc-800'}`}>{acc.label}</button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block flex items-center gap-2"><Smile className="w-3 h-3"/> Phong cách</label>
                  <div className="grid grid-cols-2 gap-2">
                    {SPEECH_STYLES.map(style => (
                      <button key={style.id} onClick={() => setSelectedStyle(style.id)} className={`px-2 py-3 rounded-xl text-[9px] font-bold uppercase transition-all border-2 ${selectedStyle === style.id ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-400 border-zinc-100 dark:border-zinc-800'}`}>{style.label}</button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block flex items-center gap-2"><User className="w-3 h-3"/> Giọng nhân vật</label>
                  <div className="grid grid-cols-1 gap-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                    {TTS_VOICES.map(voice => (
                      <div key={voice.id} className={`p-3 rounded-xl border-2 flex items-center justify-between transition-all ${selectedVoice === voice.id ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-zinc-100 dark:border-zinc-800'}`}>
                        <button onClick={() => setSelectedVoice(voice.id)} className="flex items-center gap-3 flex-1 text-left min-w-0">
                          <div className={`p-2 rounded-lg shrink-0 ${voice.gender === 'male' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}><User className="w-3.5 h-3.5"/></div>
                          <div className="truncate"><p className="text-[11px] font-bold truncate">{voice.name}</p></div>
                        </button>
                        <button onClick={() => handlePreviewVoice(voice.id)} disabled={previewingVoiceId !== null} className={`p-2 rounded-full active:scale-90 transition-all ${previewingVoiceId === voice.id ? 'bg-emerald-500 text-white' : 'text-zinc-400 hover:text-emerald-600'}`}>
                          {previewingVoiceId === voice.id ? <Volume2 className="w-4 h-4 animate-pulse"/> : <Play className="w-4 h-4"/>}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {generatedAudioBlob && (
                <div className="bg-emerald-600 rounded-[24px] p-5 text-white shadow-2xl animate-in zoom-in-95 sticky bottom-0 z-10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-black uppercase text-[10px] tracking-widest">Bản thu hoàn tất</span>
                    <button onClick={() => setGeneratedAudioBlob(null)} className="p-1"><X className="w-4 h-4"/></button>
                  </div>
                  <audio ref={mainAudioRef} key={generatedAudioBlob ? URL.createObjectURL(generatedAudioBlob) : 'empty'} controls className="w-full h-10 mb-4 brightness-90 filter invert" src={generatedAudioBlob ? URL.createObjectURL(generatedAudioBlob) : undefined}/>
                  <Button variant="secondary" className="w-full rounded-xl bg-white/20 border-white/30 text-white hover:bg-white/30 active:scale-95 py-3" onClick={handleDownloadTTS} icon={<Download className="w-4 h-4"/>}>Tải về .{downloadFormat}</Button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            <div onClick={() => !isTranscribing && fileInputRef.current?.click()} className={`flex-1 rounded-[32px] border-4 border-dashed transition-all flex flex-col items-center justify-center cursor-pointer p-6 sm:p-8 text-center ${isTranscribing ? 'border-emerald-400 bg-emerald-50 dark:bg-zinc-900/20' : 'border-emerald-100 dark:border-zinc-800 hover:bg-emerald-50/50'}`}>
              <input type="file" ref={fileInputRef} className="hidden" accept="audio/*" onChange={handleFileUpload} disabled={isTranscribing}/>
              {isTranscribing ? (
                <div className="space-y-4">
                  <div className="w-20 h-20 mx-auto rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"/>
                  <p className="font-black uppercase text-sm tracking-widest text-emerald-600">Đang gỡ băng {uploadProgress}%</p>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-emerald-100 dark:bg-zinc-800 rounded-3xl flex items-center justify-center mb-6 shadow-inner"><Upload className="w-8 h-8 text-emerald-600"/></div>
                  <h3 className="text-lg font-black text-emerald-950 dark:text-zinc-100 mb-2">Tải file âm thanh</h3>
                  <p className="text-xs text-zinc-400 mb-6 max-w-xs mx-auto leading-relaxed">Hệ thống sẽ tự động gỡ băng sang văn bản và lưu vào thư viện ghi chú.</p>
                  <Button variant="primary" className="rounded-2xl px-8 h-12 shadow-lg active:scale-95">Chọn File</Button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
