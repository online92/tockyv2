
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Mic, Trash2, FileText, AlertCircle, 
  Sparkles, Sidebar, Tag, LayoutGrid, 
  CheckCircle2, Folder, MicOff, Sun, Moon,
  Search, PlusCircle, X, Edit3, Wand2, Menu,
  Music2, Headphones, LogOut, Key, User, ShieldCheck,
  CreditCard, ExternalLink, ArrowRight
} from 'lucide-react';
import { SupportedLanguage, StoredFile, FiveWOneH, LANGUAGE_OPTIONS, UserProfile } from './types';
import { LanguageSelector } from './components/LanguageSelector';
import { Button } from './components/Button';
import { useLiveTranscription } from './hooks/useLiveTranscription';
import { parse5W1HWithGemini, refineTextWithGemini } from './services/geminiService';
import { AudioStudio } from './components/AudioStudio';

const TRANSLATIONS = {
  [SupportedLanguage.VIETNAMESE]: {
    library: "Thư viện",
    newNote: "Ghi chú mới",
    customVocab: "Ngữ cảnh AI",
    record: "Ghi âm",
    stop: "Dừng",
    aiParse: "Phân tích 5W1H",
    aiRefine: "Tối ưu văn bản",
    missingInfo: "Thiếu dữ liệu",
    placeholder: "Bắt đầu nói hoặc nhập liệu... \n\nDùng ký hiệu để AI bắt dữ liệu:\n@Ai #SựViệc !LúcNào &ỞĐâu ~LàmGì ?TạiSao",
    who: "Ai",
    what: "Việc gì",
    where: "Ở đâu",
    when: "Khi nào",
    why: "Tại sao",
    how: "Như thế nào",
    noFiles: "Trống",
    listening: "Đang nghe...",
    search: "Tìm kiếm...",
    studio: "Audio Studio",
    notes: "Ghi chú",
    usage: "Mức độ sử dụng API",
    logout: "Đăng xuất"
  },
  [SupportedLanguage.ENGLISH]: {
    library: "Library",
    newNote: "New Note",
    customVocab: "AI Context",
    record: "Record",
    stop: "Stop",
    aiParse: "AI 5W1H",
    aiRefine: "Refine",
    missingInfo: "Missing Info",
    placeholder: "Start speaking or typing...",
    who: "Who",
    what: "What",
    where: "Where",
    when: "When",
    why: "Why",
    how: "How",
    noFiles: "Empty",
    listening: "Listening...",
    search: "Search...",
    studio: "Audio Studio",
    notes: "Notes",
    usage: "API Usage",
    logout: "Log out"
  },
  [SupportedLanguage.JAPANESE]: {
    library: "ライブラリ",
    newNote: "新規メモ",
    customVocab: "AIコンテキスト",
    record: "録音",
    stop: "停止",
    aiParse: "5W1H分析",
    aiRefine: "文章校正",
    missingInfo: "未入力",
    placeholder: "入力またはお話しください...",
    who: "誰 (Who)",
    what: "内容 (What)",
    where: "場所 (Where)",
    when: "いつ (When)",
    why: "理由 (Why)",
    how: "方法 (How)",
    noFiles: "データなし",
    listening: "聴いています...",
    search: "検索...",
    studio: "オーディオスタジオ",
    notes: "ノート",
    usage: "API使用量",
    logout: "ログアウト"
  }
};

const AudioWaveform = () => (
  <div className="flex items-center gap-1 h-4 px-1">
    {[1, 2, 3, 4, 5].map((i) => (
      <div 
        key={i} 
        className="w-1 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-bounce" 
        style={{ animationDuration: `${0.3 + i * 0.05}s`, height: `${40 + Math.random() * 60}%` }}
      />
    ))}
  </div>
);

function App() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('endo_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [isApiKeyReady, setIsApiKeyReady] = useState(false);
  const [currentLanguage, setCurrentLanguage] = useState<SupportedLanguage>(SupportedLanguage.VIETNAMESE);
  const [activeView, setActiveView] = useState<'notes' | 'studio'>('notes');
  const [showSidebar, setShowSidebar] = useState(window.innerWidth > 1024);
  const [customVocabulary, setCustomVocabulary] = useState('');
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [show5W1H, setShow5W1H] = useState(window.innerWidth > 1440);
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
    // Check if API Key is already selected in the environment
    const checkApiKey = async () => {
      const hasKey = await (window as any).aistudio?.hasSelectedApiKey();
      setIsApiKeyReady(!!hasKey);
    };
    checkApiKey();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1024) setShowSidebar(false);
      if (window.innerWidth < 1280) setShow5W1H(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
      name: "Người dùng Endo",
      email: "user@example.com",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Endo",
      tokenUsed: 12500,
      tokenLimit: 50000
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
      await (window as any).aistudio?.openSelectKey();
      setIsApiKeyReady(true);
    } catch (e) {
      console.error("API Key selection failed", e);
    }
  };

  const currentFile = files.find(f => f.id === currentFileId);

  const manualParsing = useMemo((): FiveWOneH => {
    const textToParse = (transcript + ' ' + interimTranscript);
    const extract = (regex: RegExp) => {
      const match = textToParse.match(regex);
      return match ? match[1].replace(/_/g, ' ').trim() : "";
    };
    return {
      who: extract(/@([^\s]+)/),
      what: extract(/#([^\s]+)/),
      when: extract(/!([^\s]+)/),
      where: extract(/&([^\s]+)/),
      how: extract(/~([^\s]+)/),
      why: extract(/\?([^\s]+)/),
    };
  }, [transcript, interimTranscript]);

  const effective5W1H = useMemo(() => {
    if (currentFile?.parsing5W1H && !isRecording) return currentFile.parsing5W1H;
    return manualParsing;
  }, [currentFile?.parsing5W1H, manualParsing, isRecording]);

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files;
    return files.filter(f => 
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      f.content.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [files, searchQuery]);

  const handleAIParse5W1H = async () => {
    if (!transcript) return;
    setIsProcessing(true);
    try {
      const result = await parse5W1HWithGemini(transcript, currentLanguage);
      updateCurrentFile({ parsing5W1H: result });
      if (window.innerWidth < 1280) setShow5W1H(true);
    } catch (e) {
      console.error(e);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAIRefine = async () => {
    if (!transcript) return;
    setIsRefining(true);
    try {
      const refined = await refineTextWithGemini(transcript, currentLanguage, customVocabulary);
      setTranscript(refined);
      updateCurrentFile({ content: refined });
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefining(false);
    }
  };

  const updateCurrentFile = (updates: Partial<StoredFile>) => {
    if (currentFileId) {
      setFiles(prev => prev.map(f => f.id === currentFileId ? { ...f, ...updates } : f));
    }
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
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const deleteFile = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Xóa bản ghi này?")) {
      setFiles(prev => prev.filter(f => f.id !== id));
      if (currentFileId === id) {
        setCurrentFileId(null);
        setTranscript('');
      }
    }
  };

  // Welcome Screen Overlay
  if (!user || !isApiKeyReady) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-emerald-50 dark:bg-zinc-950 overflow-hidden">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20 dark:opacity-10">
          <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-emerald-400 rounded-full blur-[120px] animate-pulse"></div>
          <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-teal-400 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }}></div>
        </div>

        <div className="w-full max-w-lg bg-white/80 dark:bg-zinc-900/80 backdrop-blur-2xl border border-white dark:border-zinc-800 rounded-[40px] shadow-2xl p-8 sm:p-12 relative overflow-hidden text-center">
          <div className="mb-8 flex justify-center">
            <div className="w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center shadow-emerald-500/40 shadow-2xl rotate-3 transform transition-transform hover:rotate-0">
               <Sparkles className="w-10 h-10 text-white"/>
            </div>
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-black text-emerald-950 dark:text-zinc-50 mb-4 tracking-tight">Chào mừng tới ENDO AI</h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm sm:text-base font-medium mb-12">Ứng dụng tốc ký thông minh hỗ trợ 3 ngôn ngữ và xử lý giọng nói chuyên sâu.</p>

          <div className="space-y-4">
            {!user ? (
              <button 
                onClick={handleLogin}
                className="w-full flex items-center justify-center gap-4 bg-white dark:bg-zinc-800 border-2 border-zinc-100 dark:border-zinc-700 py-4 px-6 rounded-2xl hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-all active:scale-95 shadow-lg group"
              >
                <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-6 h-6" alt="Google"/>
                <span className="font-bold text-zinc-700 dark:text-zinc-200 uppercase tracking-widest text-xs">Tiếp tục với Google</span>
                <ArrowRight className="w-4 h-4 ml-auto text-zinc-300 group-hover:text-emerald-500 transform group-hover:translate-x-1 transition-all"/>
              </button>
            ) : (
              <div className="space-y-6">
                <div className="p-6 bg-emerald-50 dark:bg-emerald-900/20 border-2 border-emerald-100 dark:border-emerald-800 rounded-3xl">
                  <div className="flex items-center gap-4 mb-4">
                    <img src={user.avatar} className="w-12 h-12 rounded-full border-2 border-white dark:border-zinc-800 shadow-md" alt="User"/>
                    <div className="text-left">
                      <p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Đã đăng nhập</p>
                      <p className="font-bold text-zinc-800 dark:text-zinc-100">{user.email}</p>
                    </div>
                  </div>
                  
                  <div className="text-left bg-white/50 dark:bg-zinc-950/40 p-4 rounded-2xl border border-emerald-50 dark:border-emerald-900/50">
                    <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500"/> Thiết lập API Key cá nhân
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed mb-4">
                      Để ứng dụng hoạt động, bạn cần chọn một API Key Gemini từ dự án Google Cloud có trả phí (Paid Project). 
                      <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="text-emerald-600 font-bold flex items-center gap-1 mt-1 hover:underline">
                        Tìm hiểu về thanh toán <ExternalLink className="w-3 h-3"/>
                      </a>
                    </p>
                    
                    <button 
                      onClick={handleSelectApiKey}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase tracking-widest text-xs py-3 rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Key className="w-4 h-4"/> Chọn API Key Gemini
                    </button>
                  </div>
                </div>
                <button onClick={handleLogout} className="text-xs font-black text-zinc-400 uppercase tracking-widest hover:text-red-500 transition-colors">Đổi tài khoản</button>
              </div>
            )}
          </div>

          <div className="mt-12 pt-8 border-t border-zinc-100 dark:border-zinc-800 flex justify-center gap-8">
             <div className="text-center">
                <p className="text-xl font-black text-zinc-800 dark:text-zinc-100">3</p>
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Ngôn ngữ</p>
             </div>
             <div className="text-center">
                <p className="text-xl font-black text-zinc-800 dark:text-zinc-100">TTS</p>
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Giọng đọc 3 miền</p>
             </div>
             <div className="text-center">
                <p className="text-xl font-black text-zinc-800 dark:text-zinc-100">AI</p>
                <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Phân tích 5W1H</p>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-emerald-50 dark:bg-zinc-950 text-emerald-950 dark:text-zinc-100 overflow-hidden font-sans transition-colors duration-500 relative">
      
      {/* Sidebar Overlay for Mobile */}
      {showSidebar && window.innerWidth < 1024 && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm lg:hidden"
          onClick={() => setShowSidebar(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 lg:relative lg:flex flex-col 
        ${showSidebar ? 'translate-x-0 w-[280px] sm:w-[320px]' : '-translate-x-full w-0'} 
        bg-white dark:bg-zinc-900 border-r border-emerald-100 dark:border-zinc-800 transition-all duration-300 shadow-2xl lg:shadow-none overflow-hidden
      `}>
        {/* User Profile Info in Sidebar */}
        <div className="p-4 border-b border-emerald-50 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 shrink-0">
          <div className="flex items-center gap-3 mb-4">
             <img src={user.avatar} className="w-10 h-10 rounded-full border-2 border-white dark:border-zinc-800 shadow-sm" alt="U"/>
             <div className="min-w-0">
                <p className="text-xs font-black text-zinc-800 dark:text-zinc-100 truncate">{user.name}</p>
                <p className="text-[10px] text-zinc-400 truncate">{user.email}</p>
             </div>
             <button onClick={handleLogout} className="ml-auto p-1.5 text-zinc-300 hover:text-red-500 transition-colors" title={t.logout}>
                <LogOut className="w-4 h-4"/>
             </button>
          </div>
          
          <div className="space-y-1.5">
             <div className="flex justify-between text-[9px] font-black text-zinc-400 uppercase tracking-tighter">
                <span>{t.usage}</span>
                <span className="text-emerald-600">{(user.tokenUsed / 1000).toFixed(1)}k / {(user.tokenLimit / 1000).toFixed(1)}k</span>
             </div>
             <div className="h-1.5 w-full bg-emerald-100 dark:bg-zinc-800 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-emerald-500 rounded-full transition-all duration-1000" 
                  style={{ width: `${(user.tokenUsed / user.tokenLimit) * 100}%` }}
                />
             </div>
          </div>
        </div>

        <div className="p-5 border-b border-emerald-100 dark:border-zinc-800 flex items-center justify-between bg-emerald-600 dark:bg-emerald-800 text-white shrink-0 shadow-lg">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-white/20 rounded-lg">
              <Folder className="w-4 h-4"/>
            </div>
            <h2 className="font-bold text-sm tracking-tight">{t.library}</h2>
          </div>
          <button onClick={createNewNote} className="p-2 hover:bg-emerald-500 dark:hover:bg-emerald-700 rounded-xl transition-all active:scale-95 shadow-md">
            <PlusCircle className="w-5 h-5"/>
          </button>
        </div>
        
        <div className="p-4 border-b border-emerald-50 dark:border-zinc-800 bg-emerald-50/30 dark:bg-zinc-950/20 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-emerald-400"/>
            <input 
              type="text" 
              placeholder={t.search}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-zinc-700 focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-zinc-100 shadow-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredFiles.map(f => (
            <div 
              key={f.id} 
              onClick={() => { 
                setCurrentFileId(f.id); 
                setTranscript(f.content); 
                setCurrentLanguage(f.language);
                setActiveView('notes');
                if (window.innerWidth < 1024) setShowSidebar(false);
              }}
              className={`p-3 rounded-xl cursor-pointer transition-all group border-2 ${currentFileId === f.id && activeView === 'notes' ? 'bg-emerald-50 dark:bg-emerald-900/40 border-emerald-400 dark:border-emerald-600 shadow-md scale-[1.02]' : 'hover:bg-emerald-50/50 dark:hover:bg-zinc-800 border-transparent opacity-80'}`}
            >
              <div className="flex justify-between items-start gap-2">
                <span className="text-xs font-bold text-emerald-900 dark:text-zinc-100 truncate flex-1 leading-tight">{f.name}</span>
                <button onClick={(e) => deleteFile(e, f.id)} className="p-1.5 rounded-lg text-zinc-300 dark:text-zinc-600 lg:opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all active:scale-90">
                  <Trash2 className="w-3.5 h-3.5"/>
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <div className={`w-3 h-3 rounded-full ${LANGUAGE_OPTIONS.find(o => o.code === f.language)?.color} opacity-60 shadow-sm`}></div>
                <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest">{new Date(f.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
          {filteredFiles.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-zinc-300 dark:text-zinc-800">
               <FileText className="w-10 h-10 mb-2 opacity-10"/>
               <p className="text-[10px] font-bold uppercase tracking-widest">{t.noFiles}</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-emerald-50/20 dark:bg-zinc-950/40 border-t border-emerald-100 dark:border-zinc-800 shrink-0">
          <label className="text-[9px] font-black text-emerald-700 dark:text-emerald-500 block mb-2 uppercase tracking-widest flex items-center gap-1.5">
            <Sparkles className="w-3 h-3"/> {t.customVocab}
          </label>
          <textarea 
            className="w-full text-[11px] p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-emerald-200 dark:border-zinc-700 focus:ring-2 focus:ring-emerald-500 outline-none min-h-[60px] resize-none dark:text-zinc-100" 
            placeholder="Key terms..." 
            value={customVocabulary} 
            onChange={(e) => setCustomVocabulary(e.target.value)}
          />
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-zinc-950 transition-colors relative">
        <header className="h-16 lg:h-20 border-b border-emerald-100 dark:border-zinc-800 flex items-center justify-between px-4 sm:px-8 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl z-30 sticky top-0">
          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={() => setShowSidebar(!showSidebar)} 
              className="p-2 hover:bg-emerald-50 dark:hover:bg-zinc-800 rounded-xl text-emerald-600 dark:text-emerald-400 transition-all border border-emerald-100 dark:border-zinc-800 active:scale-90 shadow-sm"
            >
              {showSidebar ? <Sidebar className="w-5 h-5"/> : <Menu className="w-5 h-5"/>}
            </button>
            <div className="flex flex-col">
              <h1 className="font-black text-sm sm:text-lg text-emerald-950 dark:text-zinc-100 tracking-tight leading-none flex items-center gap-2 truncate max-w-[120px] sm:max-w-none">
                {activeView === 'studio' ? t.studio : (currentFile?.name || "ENDO AI")}
                {activeView === 'notes' && <Edit3 className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-700 hidden sm:block"/>}
              </h1>
              {isRecording && <div className="flex items-center gap-1.5 text-emerald-500 dark:text-emerald-400 text-[9px] font-black mt-1 uppercase tracking-widest"><AudioWaveform/> {t.listening}</div>}
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <button 
              onClick={() => setIsDarkMode(!isDarkMode)} 
              className="p-2 hover:bg-emerald-50 dark:hover:bg-zinc-800 rounded-xl text-zinc-500 dark:text-emerald-400 transition-all border border-emerald-100 dark:border-zinc-800"
            >
              {isDarkMode ? <Sun className="w-4 h-4"/> : <Moon className="w-4 h-4"/>}
            </button>
            <div className="hidden sm:block h-6 w-px bg-emerald-100 dark:bg-zinc-800"></div>
            
            <div className="flex bg-emerald-50 dark:bg-zinc-800 rounded-xl p-1 gap-1 border border-emerald-100 dark:border-zinc-700">
               <button 
                 onClick={() => setActiveView('notes')}
                 className={`p-2 rounded-lg transition-all ${activeView === 'notes' ? 'bg-white dark:bg-emerald-600 text-emerald-600 dark:text-white shadow-sm' : 'text-zinc-400'}`}
                 title={t.notes}
               >
                 <FileText className="w-4 h-4 sm:w-5 h-5"/>
               </button>
               <button 
                 onClick={() => setActiveView('studio')}
                 className={`p-2 rounded-lg transition-all ${activeView === 'studio' ? 'bg-white dark:bg-emerald-600 text-emerald-600 dark:text-white shadow-sm' : 'text-zinc-400'}`}
                 title={t.studio}
               >
                 <Headphones className="w-4 h-4 sm:w-5 h-5"/>
               </button>
            </div>

            <div className="hidden sm:block h-6 w-px bg-emerald-100 dark:bg-zinc-800"></div>
            <LanguageSelector currentLanguage={currentLanguage} onChange={setCurrentLanguage} disabled={isRecording}/>
            
            {activeView === 'notes' && (
              <button 
                onClick={() => setShow5W1H(!show5W1H)} 
                className={`p-2 rounded-xl transition-all border shadow-sm ${show5W1H ? 'bg-emerald-600 dark:bg-emerald-600 text-white border-emerald-600 shadow-emerald-500/20' : 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-zinc-400 border-emerald-200 dark:border-zinc-700'}`}
              >
                <LayoutGrid className="w-4 h-4 sm:w-5 h-5"/>
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {activeView === 'notes' ? (
            <>
              {/* Main Editor Section */}
              <div className="flex-1 flex flex-col p-3 sm:p-6 lg:p-8 transition-all relative">
                <div className="flex-1 bg-zinc-50 dark:bg-zinc-900/30 rounded-[24px] sm:rounded-[32px] lg:rounded-[40px] border-2 border-emerald-100 dark:border-zinc-800 shadow-inner flex flex-col overflow-hidden relative transition-all group">
                  <textarea 
                    ref={textareaRef}
                    className="flex-1 p-6 sm:p-10 lg:p-12 text-lg sm:text-xl lg:text-2xl leading-relaxed bg-transparent resize-none focus:outline-none font-semibold text-emerald-950 dark:text-zinc-100 placeholder:text-zinc-200 dark:placeholder:text-zinc-800 tracking-tight"
                    placeholder={t.placeholder}
                    value={transcript}
                    onChange={(e) => {
                      setTranscript(e.target.value);
                      updateCurrentFile({ content: e.target.value });
                    }}
                  />
                  
                  {interimTranscript && (
                    <div className="absolute p-6 sm:p-10 lg:p-12 bottom-0 left-0 right-0 pointer-events-none opacity-40 italic text-lg sm:text-xl lg:text-2xl font-bold text-emerald-600 dark:text-emerald-400 animate-pulse bg-gradient-to-t from-zinc-50 dark:from-zinc-900/80 to-transparent">
                      {interimTranscript}...
                    </div>
                  )}

                  {speechError && (
                    <div className="absolute bottom-4 left-4 right-4 sm:bottom-8 sm:left-8 sm:right-8 bg-red-50 dark:bg-red-900/40 border-2 border-red-100 dark:border-red-900 text-red-600 dark:text-red-400 p-4 rounded-2xl flex items-center gap-3 animate-bounce shadow-xl z-10">
                      <AlertCircle className="w-5 h-5 shrink-0"/>
                      <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider">{speechError}</span>
                    </div>
                  )}
                </div>

                <div className="h-24 sm:h-32 mt-4 sm:mt-8 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex gap-2 sm:gap-4 shrink-0">
                    <Button 
                      variant={isRecording ? "danger" : "primary"} 
                      onClick={isRecording ? stopRecording : startRecording}
                      className="px-6 sm:px-10 h-12 sm:h-16 rounded-2xl sm:rounded-3xl shadow-xl dark:shadow-none text-sm sm:text-base font-black tracking-widest uppercase transition-all flex-1 sm:flex-none"
                    >
                      {isRecording ? <><MicOff className="mr-2 w-4 h-4 sm:w-5 h-5"/> {t.stop}</> : <><Mic className="mr-2 w-4 h-4 sm:w-5 h-5"/> {t.record}</>}
                    </Button>
                    
                    <Button 
                       variant="secondary" 
                       onClick={handleAIRefine} 
                       isLoading={isRefining}
                       className="h-12 sm:h-16 px-4 sm:px-6 rounded-2xl sm:rounded-3xl border-2 dark:bg-zinc-900 dark:border-zinc-800 shadow-lg text-[10px] sm:text-xs uppercase font-bold"
                       icon={<Wand2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/>}
                    >
                       <span className="hidden xs:inline">{t.aiRefine}</span>
                    </Button>
                  </div>
                  
                  <Button 
                    variant="primary" 
                    onClick={handleAIParse5W1H} 
                    isLoading={isProcessing} 
                    className="h-12 sm:h-16 px-6 sm:px-8 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 dark:from-emerald-700 dark:to-teal-900 border-none shadow-xl font-black text-xs sm:text-sm tracking-widest uppercase flex-1 sm:flex-none active:scale-[0.98] transition-transform"
                    icon={<Sparkles className="w-4 h-4 sm:w-5 h-5"/>}
                  >
                    {t.aiParse}
                  </Button>
                </div>
              </div>

              {/* 5W1H Panel */}
              {show5W1H && (
                <aside className={`
                  ${window.innerWidth < 1280 ? 'fixed inset-y-0 right-0 z-50 w-full sm:w-[400px]' : 'w-[360px] xl:w-[420px]'}
                  border-l border-emerald-100 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 p-6 sm:p-8 lg:p-10 overflow-y-auto animate-in slide-in-from-right-10 duration-500 shadow-2xl transition-all
                `}>
                  <div className="flex items-center justify-between mb-8">
                    <h3 className="font-black text-emerald-950 dark:text-zinc-100 flex items-center gap-3 text-lg uppercase tracking-tight">
                      <div className="p-2.5 bg-emerald-100 dark:bg-zinc-800 rounded-xl">
                        <Tag className="w-5 h-5 text-emerald-600 dark:text-emerald-400"/>
                      </div>
                      {t.aiParse}
                    </h3>
                    <div className="flex gap-2">
                      {Object.values(effective5W1H).some(v => v === "") && (
                        <span className="flex items-center gap-1.5 px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full text-[9px] font-black uppercase tracking-widest border border-red-100 dark:border-red-900 shrink-0">
                          <AlertCircle className="w-3 h-3"/> {t.missingInfo}
                        </span>
                      )}
                      {window.innerWidth < 1280 && (
                        <button onClick={() => setShow5W1H(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg">
                          <X className="w-5 h-5"/>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {[
                      { key: 'who', label: t.who, icon: '👤', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-100 dark:border-blue-900/50' },
                      { key: 'what', label: t.what, icon: '📋', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', border: 'border-emerald-100 dark:border-emerald-900/50' },
                      { key: 'when', label: t.when, icon: '⏰', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20', border: 'border-purple-100 dark:border-purple-900/50' },
                      { key: 'where', label: t.where, icon: '📍', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-100 dark:border-orange-900/50' },
                      { key: 'why', label: t.why, icon: '🎯', color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-50 dark:bg-pink-900/20', border: 'border-pink-100 dark:border-pink-900/50' },
                      { key: 'how', label: t.how, icon: '⚡', color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/20', border: 'border-cyan-100 dark:border-cyan-900/50' },
                    ].map((field) => {
                      const val = effective5W1H[field.key as keyof FiveWOneH];
                      return (
                        <div 
                          key={field.key} 
                          className={`p-5 rounded-[24px] border-2 transition-all duration-300 transform ${val ? `bg-white dark:bg-zinc-900 ${field.border} shadow-md` : 'bg-zinc-50 dark:bg-zinc-900/20 border-dashed border-zinc-200 dark:border-zinc-800 opacity-60 scale-[0.98]'}`}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${field.bg} ${field.color} shadow-inner`}>
                              {field.icon}
                            </span>
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 dark:text-zinc-600 leading-none">{field.label}</span>
                              {val && <div className="flex items-center gap-1 text-emerald-500 dark:text-emerald-400 text-[9px] font-black mt-1 uppercase">
                                <CheckCircle2 className="w-3 h-3"/> <span>OK</span>
                              </div>}
                            </div>
                          </div>
                          <p className={`text-sm font-bold leading-relaxed ${val ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-300 dark:text-zinc-800 italic'}`}>
                            {val || "---"}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </aside>
              )}
            </>
          ) : (
            <AudioStudio language={currentLanguage} vocabulary={customVocabulary} />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
