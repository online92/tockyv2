import React from 'react';
import { SupportedLanguage, LANGUAGE_OPTIONS } from '../types';

interface LanguageSelectorProps {
  currentLanguage: SupportedLanguage;
  onChange: (lang: SupportedLanguage) => void;
  disabled?: boolean;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({ 
  currentLanguage, 
  onChange,
  disabled = false 
}) => {
  return (
    <div className="flex space-x-1.5 bg-emerald-100/50 dark:bg-zinc-800 p-1.5 rounded-2xl border border-emerald-200 dark:border-zinc-700 shadow-inner">
      {LANGUAGE_OPTIONS.map((option) => (
        <button
          key={option.code}
          onClick={() => onChange(option.code)}
          disabled={disabled}
          className={`
            flex items-center px-3 py-2 rounded-xl text-xs font-bold transition-all duration-300
            ${currentLanguage === option.code 
              ? 'bg-white dark:bg-emerald-600 text-emerald-700 dark:text-white shadow-md scale-105' 
              : 'text-emerald-600/70 dark:text-zinc-400 hover:bg-white/50 dark:hover:bg-zinc-700'
            }
            ${disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-95'}
          `}
        >
          <div className={`w-5 h-5 flex items-center justify-center rounded-md mr-2 text-[9px] text-white font-black shadow-sm ${option.color}`}>
            {option.short}
          </div>
          <span className="hidden sm:inline uppercase tracking-widest">{option.label}</span>
        </button>
      ))}
    </div>
  );
};