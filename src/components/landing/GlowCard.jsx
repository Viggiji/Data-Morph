import React from 'react';

export default function GlowCard({ icon, title, desc, delay }) {
  return (
    <div className="glow-card-wrapper opacity-0 animate-fade-up group" style={{ animationDelay: delay }}>
      <div className="glow-card-inner p-8 transition-transform group-hover:scale-[0.98] duration-300">
        <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-6 shadow-inner">
          {icon}
        </div>
        <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
        <p className="text-slate-400 leading-relaxed text-sm">{desc}</p>
      </div>
    </div>
  );
}
