import React, { useRef } from 'react';
import {
  Database,
  Sparkles,
  Image as ImageIcon,
  ChevronRight,
  Cpu,
  Terminal,
  FileText,
  MessageSquare,
  ArrowRight,
  Zap,
  Shield,
  BarChart3,
} from 'lucide-react';
import { motion } from 'framer-motion';
import useMouseTilt from '../../hooks/useMouseTilt';
import ScrollReveal, { StaggerContainer, StaggerItem } from '../ui/ScrollReveal';
import GlassCard from '../ui/GlassCard';

export default function LandingPage({ onTry }) {
  const mockupRef = useRef(null);
  const tilt = useMouseTilt(mockupRef, 15);

  return (
    <div className="h-full overflow-y-auto dark-scroll relative">
      {/* Animated Background Gradients */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/15 blur-[150px] rounded-full animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-[30%] right-[-15%] w-[500px] h-[500px] bg-cyan-500/10 blur-[130px] rounded-full animate-pulse" style={{ animationDuration: '12s', animationDelay: '2s' }} />
        <div className="absolute bottom-[-10%] left-[30%] w-[400px] h-[400px] bg-purple-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDuration: '10s', animationDelay: '4s' }} />
      </div>

      {/* Subtle grid pattern overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* ===== HERO SECTION ===== */}
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-40 flex flex-col lg:flex-row items-center gap-16 relative z-10">
        
        {/* Left Column: Text & CTA */}
        <div className="flex-1 text-left flex flex-col items-start">
          <ScrollReveal delay={0}>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm font-semibold mb-8">
              <Cpu size={14} />
              <span>Multimodal Data Architecture</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
          </ScrollReveal>
          
          <ScrollReveal delay={0.1}>
            <h1 className="text-5xl lg:text-7xl font-extrabold tracking-tight mb-6 text-white leading-[1.05]">
              Talk to your <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-400 to-purple-400 bg-[length:200%_auto] animate-[borderSpin_6s_linear_infinite]">
                Databases & Images
              </span>
            </h1>
          </ScrollReveal>
          
          <ScrollReveal delay={0.2}>
            <p className="text-lg text-slate-400 mb-10 max-w-xl leading-relaxed">
              Data Morph intelligently ingests, sorts, and queries structured databases and unstructured images using vision models. Skip the SQL. Just ask.
            </p>
          </ScrollReveal>
          
          <ScrollReveal delay={0.3}>
            <div className="flex items-center gap-4">
              <motion.button 
                onClick={onTry}
                whileHover={{ scale: 1.03, boxShadow: '0 0 60px rgba(99,102,241,0.5)' }}
                whileTap={{ scale: 0.97 }}
                className="group relative px-8 py-4 bg-white text-slate-950 rounded-full font-bold text-lg overflow-hidden shadow-[0_0_40px_rgba(99,102,241,0.3)] transition-all"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-100 to-cyan-100 translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300" />
                <span className="relative flex items-center gap-2">
                  Start Morphing Data
                  <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </span>
              </motion.button>
              
              <motion.a
                href="#features"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="px-6 py-4 text-white/70 hover:text-white font-medium rounded-full border border-white/10 hover:border-white/20 transition-all flex items-center gap-2"
              >
                Learn more <ArrowRight size={16} />
              </motion.a>
            </div>
          </ScrollReveal>

          {/* Stats */}
          <ScrollReveal delay={0.5}>
            <div className="flex gap-8 mt-14 pt-8 border-t border-white/10">
              {[
                { num: 'Local', label: 'AI Processing' },
                { num: '100%', label: 'Privacy First' },
                { num: 'Real-time', label: 'Streaming' },
              ].map((stat, i) => (
                <div key={i} className="text-left">
                  <div className="text-xl font-bold text-white">{stat.num}</div>
                  <div className="text-sm text-slate-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </ScrollReveal>
        </div>

        {/* Right Column: 3D Mockup */}
        <ScrollReveal delay={0.3} direction="right">
          <div 
            ref={mockupRef}
            className="flex-1 w-full h-[500px] perspective-container flex items-center justify-center"
          >
            <div 
              className="isometric-base preserve-3d relative w-64 h-64 md:w-80 md:h-80"
              style={{ transform: `rotateX(${60 + tilt.x}deg) rotateZ(${-45 + tilt.y}deg)` }}
            >
              <div className="absolute inset-0 bg-slate-900/80 border border-slate-700 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-center justify-center preserve-3d translate-z-0 backdrop-blur-sm">
                <div className="grid grid-cols-3 gap-2 w-full h-full p-4 opacity-30">
                  {Array.from({length: 9}).map((_, i) => <div key={i} className="bg-indigo-500/20 rounded border border-indigo-500/30" />)}
                </div>
              </div>
              <div className="absolute inset-0 bg-indigo-900/40 border border-indigo-500/50 rounded-2xl flex items-center justify-center preserve-3d backdrop-blur-md" style={{ transform: 'translateZ(60px)' }}>
                <Terminal className="text-indigo-400 w-16 h-16 opacity-80" />
                <div className="absolute -top-2 -left-2 w-4 h-4 bg-indigo-400 rounded-full shadow-[0_0_10px_#818cf8]" />
                <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-indigo-400 rounded-full shadow-[0_0_10px_#818cf8]" />
              </div>
              <div className="absolute inset-4 bg-cyan-900/30 border border-cyan-400/50 rounded-xl flex items-center justify-center preserve-3d backdrop-blur-lg" style={{ transform: 'translateZ(120px)' }}>
                <ImageIcon className="text-cyan-300 w-12 h-12" />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-cyan-400/20 to-transparent w-full h-full animate-[fadeInUp_2s_linear_infinite]" />
              </div>
              <div className="absolute top-10 -right-10 w-8 h-8 bg-white/10 border border-white/20 rounded backdrop-blur-sm flex items-center justify-center" style={{ transform: 'translateZ(160px)' }}><FileText size={14} className="text-white"/></div>
              <div className="absolute -bottom-6 left-10 w-10 h-10 bg-indigo-500/20 border border-indigo-400/40 rounded-full backdrop-blur-sm flex items-center justify-center" style={{ transform: 'translateZ(80px)' }}><Database size={16} className="text-indigo-300"/></div>
            </div>
          </div>
        </ScrollReveal>
      </div>

      {/* ===== FEATURE CARDS ===== */}
      <div id="features" className="max-w-6xl mx-auto px-6 pb-24">
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">Everything You Need</h2>
            <p className="text-slate-400 max-w-lg mx-auto">Powerful tools that work together to transform how you interact with your data.</p>
          </div>
        </ScrollReveal>

        <StaggerContainer className="grid md:grid-cols-3 gap-6" staggerDelay={0.15}>
          {[
            {
              icon: <MessageSquare className="text-indigo-400" size={24} />,
              title: 'Natural Language SQL',
              desc: 'Ask for your data in plain English. Our engine writes and executes the secure queries behind the scenes.',
              gradient: 'from-indigo-500/20 to-indigo-500/5',
              iconBg: 'bg-indigo-500/15',
              borderColor: 'border-indigo-500/20',
            },
            {
              icon: <ImageIcon className="text-cyan-400" size={24} />,
              title: 'Vision to Database',
              desc: 'Drop an invoice or chart. The local Llava model extracts structured JSON and routes it to your tables.',
              gradient: 'from-cyan-500/20 to-cyan-500/5',
              iconBg: 'bg-cyan-500/15',
              borderColor: 'border-cyan-500/20',
            },
            {
              icon: <Database className="text-emerald-400" size={24} />,
              title: 'Dynamic Morphing',
              desc: 'Data automatically reshapes itself to fit your schema, handling missing fields and anomalies smoothly.',
              gradient: 'from-emerald-500/20 to-emerald-500/5',
              iconBg: 'bg-emerald-500/15',
              borderColor: 'border-emerald-500/20',
            },
          ].map((card, i) => (
            <StaggerItem key={i}>
              <GlassCard
                blur={16}
                opacity={0.04}
                borderOpacity={0.08}
                tintColor="255, 255, 255"
                hoverScale
                className="h-full"
                style={{ padding: '32px' }}
              >
                <div className={`w-12 h-12 rounded-xl ${card.iconBg} flex items-center justify-center mb-5 border ${card.borderColor}`}>
                  {card.icon}
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{card.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{card.desc}</p>
              </GlassCard>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>

      {/* ===== HOW IT WORKS ===== */}
      <div className="max-w-5xl mx-auto px-6 pb-24">
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-white mb-4">How It Works</h2>
            <p className="text-slate-400 max-w-lg mx-auto">Three simple steps to transform your data workflow.</p>
          </div>
        </ScrollReveal>

        <StaggerContainer className="grid md:grid-cols-3 gap-8" staggerDelay={0.2}>
          {[
            { step: '01', icon: <MessageSquare size={20} />, title: 'Ask or Upload', desc: 'Type a question in natural language or upload an image containing data.' },
            { step: '02', icon: <Zap size={20} />, title: 'AI Processes', desc: 'Local Ollama models analyze your input, generate SQL, or extract image data.' },
            { step: '03', icon: <BarChart3 size={20} />, title: 'Get Results', desc: 'View clean, structured results streamed in real-time to your dashboard.' },
          ].map((item, i) => (
            <StaggerItem key={i}>
              <div className="relative text-center group">
                <div className="text-6xl font-black text-indigo-500/10 mb-4 group-hover:text-indigo-500/20 transition-colors">{item.step}</div>
                <div className="w-12 h-12 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mx-auto mb-4 group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <h3 className="text-lg font-bold text-white mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            </StaggerItem>
          ))}
        </StaggerContainer>
      </div>

      {/* ===== Bottom CTA ===== */}
      <div className="max-w-3xl mx-auto px-6 pb-24">
        <ScrollReveal>
          <GlassCard blur={20} opacity={0.06} borderOpacity={0.1} style={{ padding: '48px', textAlign: 'center' }}>
            <div className="flex items-center justify-center gap-3 mb-4">
              <Shield size={20} className="text-emerald-400" />
              <span className="text-emerald-400 text-sm font-semibold uppercase tracking-wider">100% Local & Private</span>
            </div>
            <h2 className="text-3xl font-bold text-white mb-4">Ready to Transform Your Data?</h2>
            <p className="text-slate-400 mb-8 max-w-md mx-auto">All processing happens on your machine. Your data never leaves your system.</p>
            <motion.button
              onClick={onTry}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="px-8 py-4 bg-gradient-to-r from-indigo-600 to-cyan-600 text-white rounded-full font-bold text-lg shadow-[0_0_30px_rgba(99,102,241,0.3)] hover:shadow-[0_0_50px_rgba(99,102,241,0.5)] transition-all"
            >
              Get Started Now <ArrowRight size={18} className="inline ml-2" />
            </motion.button>
          </GlassCard>
        </ScrollReveal>
      </div>
    </div>
  );
}
