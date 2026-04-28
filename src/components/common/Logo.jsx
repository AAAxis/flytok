import React from 'react';
import { Send } from 'lucide-react';

export default function Logo({ size = 'md', showText = true }) {
  const sizes = {
    sm: { icon: 'w-4 h-4', text: 'text-lg', container: 'gap-1.5', ring: 'w-7 h-7' },
    md: { icon: 'w-5 h-5', text: 'text-xl', container: 'gap-2', ring: 'w-9 h-9' },
    lg: { icon: 'w-6 h-6', text: 'text-2xl', container: 'gap-2.5', ring: 'w-11 h-11' },
  };

  const s = sizes[size] || sizes.md;

  return (
    <div className={`flex items-center ${s.container}`}>
      <div className={`${s.ring} rounded-full bg-gradient-to-br from-sky-400 via-blue-500 to-indigo-600 p-[2px] shadow-lg shadow-sky-500/30`}>
        <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center">
          <Send className={`${s.icon} text-sky-400 transform -rotate-45`} />
        </div>
      </div>
      {showText && (
        <div className="flex items-baseline">
          <span className={`${s.text} font-extrabold text-white`}>Fly</span>
          <span className={`${s.text} font-extrabold text-sky-400`}>Tok</span>
        </div>
      )}
    </div>
  );
}