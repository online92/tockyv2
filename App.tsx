
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Mic, Trash2, FileText, AlertCircle, 
  Sparkles, Sidebar as SidebarIcon, Tag, LayoutGrid, 
  CheckCircle2, Folder, MicOff, Sun, Moon,
  Search, PlusCircle, X, Edit3, Wand2, Menu,
  Music2, Headphones, LogOut, Key, User, ShieldCheck,
  CreditCard, ExternalLink, ArrowRight, Settings, Lock, Database, Clock
} from 'lucide-react';
import { SupportedLanguage, StoredFile, FiveWOneH, LANGUAGE_OPTIONS, UserProfile, TranscriptSegment } from './types';
import { LanguageSelector } from './components/LanguageSelector';
import { Button } from './components/Button';
import { useLiveTranscription } from './hooks/useLiveTranscription';
import { parse5W1HWithGemini, refineTextWithGemini } from './services/geminiService';
import { AudioStudio } from './components/AudioStudio';
import { GoogleGenAI } from "@google/genai";

const TRANSLATIONS = {
  [SupportedLanguage.VIETNAMESE]: {
    library: "Thư viện",
    newNote: "Ghi chú mới",
    record: "Ghi âm",
    stop: "Dừng",
    aiParse: "Phân tích 5W1H",
    aiRefine: "Tối ưu văn bản",
    placeholder: "Bắt đầu nói hoặc nhập liệu...",
    who: "Ai",
    what: "Việc gì",
    where: "Ở đâu",
    when: "Khi nào",
    why: "Tại sao",
    how: "Như thế nào",
    listening: "Đang nghe...",
    search: "Tìm kiếm...",
    studio: "Audio Studio",
    notes: "Ghi chú",
    logout: "Đăng xuất",
    insecureTitle: "Kết nối không bảo mật",
    insecureDesc: "Trình duyệt chặn Microphone trên HTTP. Hãy sử dụng HTTPS hoặc localhost để ghi âm.",
    tokenUsage: "Lượng Token đã dùng",
    setupRequired: "Yêu cầu thiết lập",
    setupDesc: "Vui lòng cấu hình API Key để kích hoạt các tính năng AI."
  },
  [SupportedLanguage.ENGLISH]: {
    library: "Library",
    newNote: "New Note",
    record: "Record",
    stop: "Stop",
    aiParse: "AI 5W1H",
    aiRefine: "Refine",
    placeholder: "Start speaking or typing...",
    who: "Who",
    what: "What",
    where: "Where",
    when: "When",
    why: "Why",
    how: "How",
    listening: "Listening...",
    search: "Search...",
    studio: "Audio Studio",
    notes: "Notes",
    logout: "Log out",
    insecureTitle: "Insecure Connection",
    insecureDesc: "Browsers block Microphone on HTTP. Please use HTTPS or localhost for recording.",
    tokenUsage: "Tokens Consumed",
    setupRequired: "Setup Required",
    setupDesc: "Please configure your API Key to enable AI features."
  },
  [SupportedLanguage.JAPANESE]: {
    library: "ライブラリ",
    newNote: "新規メモ",
    record: "録音",
    stop: "停止",
    aiParse: "5W1H分析",
    aiRefine: "文章校正",
    placeholder: "入力してください...",
    who: "誰 (Who)",
    what: "内容 (What)",
    where: "場所 (Where)",
    when: "いつ (When)",
    why: "理由 (Why)",
    how: "方法 (How)",
    listening: "聴いています...",
    search: "検索...",
    studio: "スタジオ",
    notes: "ノート",
    logout: "ログアウト",
    insecureTitle: "非セキュアな接続",
    insecureDesc: "ブラウザはHTTPでのマイク使用を制限しています。録音にはHTTPS hoặc localhostを使用してください。",
    tokenUsage: "トークン使用量",
    setupRequired: "セットアップが必要",
    setupDesc: "AI機能を有効にするためにAPIキーを設定してください。"
  }
};

function App() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('endo_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isApiKeyReady, setIsApiKeyReady] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(SupportedLanguage.VIETNAMESE);
  const [activeView, setActiveView] = useState<'notes' | 'studio'>('notes');
  const [showSidebar, setShowSidebar] = useState(false);
  const [show5W1H, setShow5W1H] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [customVocabulary, setCustomVocabulary] = useState('');
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
  const [searchQuery, setSearchQuery] = useState('');
  
  const t = TRANSLATIONS[currentLanguage];
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const {
    isRecording,
    transcript,
    interimTranscript,
    startRecording,
    stopRecording,
    setTranscript,
    error: speechError
  } = useLiveTranscription(currentLanguage);

  useEffect(() => {
    const checkApiKey = async () => {
      // Ưu tiên kiểm tra window.aistudio trước (môi trường NAS/Cloud thường dùng cái này)
      if (typeof (window as any).aistudio?.hasSelectedApiKey === 'function') {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (hasKey) {
          setIsApiKeyReady(true);
          return;
        }
      }
      
      // Kiểm tra biến môi trường build-time
      if (process.env.API_KEY && process.env.API_KEY !== '') {
        setIsApiKeyReady(true);
      }
    };
    checkApiKey();
    if (window.innerWidth >= 1024) setShowSidebar(true);
  }, []);

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

  useEffect(() => {
    const saved = localStorage.getItem('endo_files_v1');
    if (saved) setFiles(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('endo_files_v1', JSON.stringify(files));
  }, [files]);

  const handleLogin = () => {
    const mockUser: UserProfile = {
      name: "User",
      email: "user@endo.ai",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Endo",
      tokenUsed: 24500, // Ví dụ thực tế
      tokenLimit: 500000
    };
    setUser(mockUser);
    localStorage.setItem('endo_user', JSON.stringify(mockUser));
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('endo_user');
  };

  const handleSelectApiKey = async () => {
    try {
      if (typeof (window as any).aistudio?.openSelectKey === 'function') {
        await (window as any).aistudio.openSelectKey();
        setIsApiKeyReady(true);
      } else {
        alert("Tính năng chọn Key tự động chỉ khả dụng trên môi trường AI Studio. Nếu bạn dùng Portainer, hãy đảm bảo gán biến môi trường API_KEY lúc build.");
      }
    } catch (e) {
      console.error("API Key selection failed", e);
    }
  };

  const currentFile = files.find(f => f.id === currentFileId);

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    return files.filter(f => 
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      f.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [files, searchQuery]);

  const updateCurrentFile = (updates: Partial<StoredFile>) => {
    if (!currentFileId) return;
    setFiles(prev => prev.map(f => f.id === currentFileId ? { ...f, ...updates } : f));
  };

  const createNewNote = () => {
    const newFile: StoredFile = {
      id: crypto.randomUUID(),
      name: `Ghi chú ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      createdAt: Date.now(),
      language: currentLanguage,
      type: 'live',
      content: '',
    };
    setFiles(prev => [newFile, ...prev]);
    setCurrentFileId(newFile.id);
    setTranscript('');
    setActiveView('notes');
    if (window.innerWidth < 1024) setShowSidebar(false);
  };

  const handleRefine = async () => {
    const textToRefine = transcript || currentFile?.content || '';
    if (!textToRefine) return;
    setIsAiProcessing(true);
    try {
      const refined = await refineTextWithGemini(textToRefine, currentLanguage, customVocabulary);
      if (refined) {
        if (isRecording || transcript) setTranscript(refined);
        else updateCurrentFile({ content: refined });
      }
    } catch (e) {
      console.error("Refine error:", e);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleParse5W1H = async () => {
    const textToParse = transcript || currentFile?.content || '';
    if (!textToParse) return;
    setIsAiProcessing(true);
    try {
      const result = await parse5W1HWithGemini(textToParse, currentLanguage);
      updateCurrentFile({ parsing5W1H: result });
      setShow5W1H(true);
    } catch (e) {
      console.error("Parse 5W1H error:", e);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const onSttComplete = (segments: TranscriptSegment[]) => {
    const fullText = segments.map(s => `[${s.timestamp}] ${s.speaker}: ${s.text}`).join('\n');
    const newFile: StoredFile = {
      id: crypto.randomUUID(),
      name: `Gỡ băng ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      createdAt: Date.now(),
      language: currentLanguage,
      type: 'upload',
      content: fullText,
      segments: segments
    };
    setFiles(prev => [newFile, ...prev]);
    setCurrentFileId(newFile.id);
    setActiveView('notes');
  };

  // MÀN HÌNH CHẶN: Nếu chưa đăng nhập HOẶC chưa có API Key
  if (!user || !isApiKeyReady) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-emerald-50 dark:bg-zinc-950 overflow-hidden">
        {/* Abstract backgrounds */}
        <div className="absolute top-0 -left-20 w-80 h-80 bg-emerald-400/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-0 -right-20 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl"></div>

        <div className="w-full max-w-lg bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border border-emerald-100 dark:border-zinc-800 rounded-[40px] shadow-2xl p-10 text-center relative z-10">
          <div className="mb-10 flex justify-center">
            <div className="w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-emerald-500/40 transform rotate-6">
               <Sparkles className="w-10 h-10 text-white"/>
            </div>
          </div>
          
          <h1 className="text-4xl font-black text-emerald-950 dark:text-zinc-50 mb-3 tracking-tighter italic">ENDO AI</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-12">Tốc ký thông minh cho NAS Synology & Docker</p>

          <div className="space-y-6">
            {!user ? (
              <Button onClick={handleLogin} className="w-full h-16 rounded-2xl text-lg shadow-xl" icon={<User className="w-6 h-6"/>}>
                Đăng nhập ngay
              </Button>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="p-8 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-3xl text-left">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-800 rounded-xl">
                      <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400"/>
                    </div>
                    <p className="text-sm font-black text-emerald-950 dark:text-zinc-100 uppercase tracking-widest">
                      {t.setupRequired}
                    </p>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-8 leading-relaxed">
                    Hệ thống chưa tìm thấy API Key trong cấu hình. Vui lòng thiết lập để bắt đầu sử dụng các tính năng gỡ băng và phân tích 5W1H.
                  </p>
                  <Button onClick={handleSelectApiKey} className="w-full h-14 rounded-xl shadow-lg" variant="primary" icon={<Key className="w-5 h-5"/>}>
                    Thiết lập API Key Gemini
                  </Button>
                </div>
                <button onClick={handleLogout} className="text-xs font-bold text-zinc-400 hover:text-red-500 transition-colors uppercase tracking-widest">Sử dụng tài khoản khác</button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const tokenPercent = Math.min(100, (user.tokenUsed / user.tokenLimit) * 100);

  return (
    <div className="flex h-screen bg-white dark:bg-zinc-950 text-emerald-950 dark:text-zinc-100 overflow-hidden relative">
      
      {/* Mobile Sidebar Overlay */}
      {showSidebar && window.innerWidth < 1024 && (
        <div 
          className="fixed inset-0 bg-zinc-950/60 backdrop-blur-sm z-[60] animate-in fade-in" 
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-[70] w-72 bg-emerald-50 dark:bg-zinc-900 border-r border-emerald-100 dark:border-zinc-800 transform transition-transform duration-300 lg:relative lg:translate-x-0
        ${showSidebar ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full p-4">
          <div className="flex items-center justify-between mb-8 px-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg">
                <Sparkles className="w-4 h-4 text-white"/>
              </div>
              <span className="font-black text-lg tracking-tighter italic">ENDO AI</span>
            </div>
            <button onClick={() => setShowSidebar(false)} className="lg:hidden p-2 text-zinc-400"><X className="w-5 h-5"/></button>
          </div>

          <Button onClick={createNewNote} className="w-full mb-6 rounded-xl shadow-md active:scale-95" icon={<PlusCircle className="w-4 h-4"/>}>
            {t.newNote}
          </Button>

          <nav className="space-y-1 mb-6 shrink-0">
            <button 
              onClick={() => { setActiveView('notes'); if(window.innerWidth < 1024) setShowSidebar(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeView === 'notes' ? 'bg-emerald-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-emerald-100 dark:hover:bg-zinc-800'}`}
            >
              <FileText className="w-4 h-4"/> {t.notes}
            </button>
            <button 
              onClick={() => { setActiveView('studio'); if(window.innerWidth < 1024) setShowSidebar(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeView === 'studio' ? 'bg-emerald-600 text-white shadow-lg' : 'text-zinc-500 hover:bg-emerald-100 dark:hover:bg-zinc-800'}`}
            >
              <Headphones className="w-4 h-4"/> {t.studio}
            </button>
          </nav>

          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar mb-4">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest px-4 mb-2">{t.library}</p>
            {filteredFiles.map(file => (
              <button 
                key={file.id}
                onClick={() => { setCurrentFileId(file.id); if(window.innerWidth < 1024) setShowSidebar(false); }}
                className={`w-full text-left p-3 rounded-xl group transition-all border ${currentFileId === file.id ? 'bg-white dark:bg-zinc-800 border-emerald-200 dark:border-zinc-700 shadow-sm' : 'border-transparent hover:bg-white/50 dark:hover:bg-zinc-800/50'}`}
              >
                <p className={`text-xs font-bold truncate ${currentFileId === file.id ? 'text-emerald-700 dark:text-white' : 'text-zinc-500'}`}>{file.name}</p>
                <div className="flex items-center gap-2 mt-1">
                   <p className="text-[9px] text-zinc-400">{new Date(file.createdAt).toLocaleDateString()}</p>
                   {file.type === 'upload' && <Tag className="w-2 h-2 text-emerald-500"/>}
                </div>
              </button>
            ))}
          </div>

          {/* Token Usage Section */}
          <div className="bg-white/40 dark:bg-zinc-800/40 rounded-2xl p-4 mb-4 border border-emerald-100/50 dark:border-zinc-800 shadow-inner shrink-0">
             <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-1">
                   <Database className="w-3 h-3"/> {t.tokenUsage}
                </span>
                <span className={`text-[10px] font-bold ${tokenPercent > 90 ? 'text-red-500' : 'text-emerald-600'}`}>{Math.round(tokenPercent)}%</span>
             </div>
             <div className="w-full h-1.5 bg-emerald-100 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-1000 ease-out ${tokenPercent > 90 ? 'bg-red-500' : 'bg-emerald-500'}`} 
                  style={{ width: `${tokenPercent}%` }}
                />
             </div>
             <div className="flex justify-between mt-2">
               <p className="text-[9px] text-zinc-400">{user.tokenUsed.toLocaleString()}</p>
               <p className="text-[9px] text-zinc-400">Hạn mức: {user.tokenLimit.toLocaleString()}</p>
             </div>
          </div>

          <div className="pt-4 border-t border-emerald-100 dark:border-zinc-800 shrink-0">
            <div className="flex items-center gap-3 px-2">
              <img src={user.avatar} className="w-8 h-8 rounded-full border border-emerald-200" alt="Avatar"/>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold truncate">{user.name}</p>
                <button onClick={handleLogout} className="text-[9px] font-black text-red-400 uppercase hover:text-red-500">{t.logout}</button>
              </div>
              <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 text-zinc-400 hover:text-emerald-600 transition-colors">
                {isDarkMode ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950">
        {/* Header */}
        <header className="h-16 border-b border-emerald-50 dark:border-zinc-900 flex items-center justify-between px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setShowSidebar(true)} className="lg:hidden p-2 text-zinc-500 hover:bg-emerald-50 rounded-lg">
              <Menu className="w-5 h-5"/>
            </button>
            <LanguageSelector currentLanguage={currentLanguage} onChange={setCurrentLanguage} />
          </div>
          <div className="flex items-center gap-2">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400"/>
              <input 
                type="text" 
                placeholder={t.search} 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 bg-emerald-50 dark:bg-zinc-900 border-none rounded-xl text-xs w-48 focus:ring-2 focus:ring-emerald-500 transition-all outline-none"
              />
            </div>
            {activeView === 'notes' && (
               <button onClick={() => setShow5W1H(!show5W1H)} className={`p-2 rounded-xl transition-all ${show5W1H ? 'bg-emerald-100 text-emerald-600' : 'text-zinc-400 hover:bg-emerald-50'}`}>
                 <LayoutGrid className="w-5 h-5"/>
               </button>
            )}
          </div>
        </header>

        {activeView === 'notes' ? (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 flex flex-col p-4 sm:p-8 overflow-y-auto custom-scrollbar">
              <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col">
                <input 
                  type="text"
                  value={currentFile?.name || ''}
                  onChange={(e) => updateCurrentFile({ name: e.target.value })}
                  placeholder="Tiêu đề ghi chú..."
                  className="text-2xl sm:text-4xl font-black mb-6 bg-transparent border-none focus:ring-0 placeholder:text-zinc-100 dark:placeholder:text-zinc-800 outline-none"
                />
                
                <div className="flex-1 relative group mb-8">
                  {currentFile?.segments ? (
                    <div className="space-y-4">
                       {currentFile.segments.map(seg => (
                         <div key={seg.id} className="p-5 bg-emerald-50/20 dark:bg-zinc-900/40 rounded-3xl border border-emerald-100/50 dark:border-zinc-800 hover:border-emerald-300 transition-all group">
                            <div className="flex items-center justify-between mb-3">
                               <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest flex items-center gap-2">
                                 <User className="w-3.5 h-3.5"/> {seg.speaker}
                               </span>
                               <span className="text-[10px] font-bold text-zinc-400 flex items-center gap-1.5 bg-white dark:bg-zinc-800 px-2 py-1 rounded-lg">
                                 <Clock className="w-3 h-3"/> {seg.timestamp}
                               </span>
                            </div>
                            <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed text-base">{seg.text}</p>
                         </div>
                       ))}
                    </div>
                  ) : (
                    <textarea 
                      ref={textareaRef}
                      value={transcript || currentFile?.content || ''}
                      onChange={(e) => {
                        setTranscript(e.target.value);
                        updateCurrentFile({ content: e.target.value });
                      }}
                      placeholder={t.placeholder}
                      className="w-full h-full min-h-[300px] resize-none bg-transparent border-none focus:ring-0 text-base sm:text-lg leading-relaxed text-zinc-600 dark:text-zinc-300 outline-none"
                    />
                  )}
                  
                  {interimTranscript && (
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-emerald-50/80 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-zinc-800 animate-pulse shadow-sm">
                      <p className="text-emerald-700 dark:text-emerald-300 text-sm italic">{interimTranscript}</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 sticky bottom-4 shrink-0 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl p-3 rounded-[32px] border border-emerald-100/50 dark:border-zinc-800/50 shadow-2xl">
                  <Button 
                    variant={isRecording ? 'danger' : 'primary'}
                    onClick={isRecording ? stopRecording : startRecording}
                    className="rounded-[24px] px-10 h-16 shadow-lg shadow-emerald-500/20 active:scale-95 flex-1 sm:flex-none"
                    icon={isRecording ? <MicOff className="w-6 h-6 animate-pulse"/> : <Mic className="w-6 h-6"/>}
                  >
                    {isRecording ? t.stop : t.record}
                  </Button>
                  <Button variant="secondary" className="h-16 rounded-[24px]" onClick={handleRefine} isLoading={isAiProcessing} icon={<Wand2 className="w-5 h-5"/>}>{t.aiRefine}</Button>
                  <Button variant="secondary" className="h-16 rounded-[24px]" onClick={handleParse5W1H} isLoading={isAiProcessing} icon={<Sparkles className="w-5 h-5"/>}>{t.aiParse}</Button>
                </div>
                {speechError && (
                   <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl flex items-start gap-3">
                     <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5"/>
                     <div className="text-xs text-red-600 dark:text-red-400 font-bold leading-relaxed">
                        {speechError}
                        {speechError.includes("API_KEY") && (
                           <button onClick={handleSelectApiKey} className="mt-2 text-emerald-600 dark:text-emerald-400 underline block font-black uppercase">Click để thiết lập lại API Key</button>
                        )}
                     </div>
                   </div>
                )}
              </div>
            </div>

            {show5W1H && (
              <aside className="w-80 border-l border-emerald-50 dark:border-zinc-900 p-6 overflow-y-auto hidden xl:block custom-scrollbar bg-white dark:bg-zinc-950 animate-in slide-in-from-right duration-300">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="font-black text-xs uppercase tracking-widest text-emerald-600 flex items-center gap-2">Phân tích 5W1H</h3>
                  <button onClick={() => setShow5W1H(false)} className="text-zinc-300 hover:text-emerald-600 transition-colors"><X className="w-4 h-4"/></button>
                </div>
                <div className="space-y-6">
                  {['who', 'what', 'where', 'when', 'why', 'how'].map((key) => (
                    <div key={key} className="space-y-2">
                      <label className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{t[key as keyof typeof t]}</label>
                      <div className="p-4 bg-emerald-50/50 dark:bg-zinc-900 rounded-2xl border border-emerald-100 dark:border-zinc-800 text-sm min-h-[44px] shadow-inner text-zinc-600 dark:text-zinc-400 leading-relaxed">
                        {currentFile?.parsing5W1H?.[key as keyof FiveWOneH] || <span className="text-zinc-300 italic">Chưa có dữ liệu</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </aside>
            )}
          </div>
        ) : (
          <AudioStudio language={currentLanguage} vocabulary={customVocabulary} onSttComplete={onSttComplete} />
        )}
      </main>
    </div>
  );
}

export default App;
