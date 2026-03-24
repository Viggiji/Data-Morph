import React, { useState, useCallback } from 'react';
import { useAuth } from './contexts/AuthContext';
import Navbar from './components/layout/Navbar';
import LandingPage from './components/landing/LandingPage';
import LoginPage from './components/auth/LoginPage';
import SignupPage from './components/auth/SignupPage';
import ChatDashboard from './components/chat/ChatDashboard';

export default function App() {
  const { user, loading } = useAuth();
  const [view, setView] = useState('landing');
  const [sparks, setSparks] = useState([]);

  // Click Spark Effect Handler
  const handleGlobalClick = useCallback((e) => {
    if (e.target.closest('button') || e.target.closest('input') || e.target.closest('textarea')) return;

    const newSparks = Array.from({ length: 6 }).map((_, i) => ({
      id: Date.now() + i,
      x: e.clientX,
      y: e.clientY,
      angle: (Math.PI * 2 * i) / 6 + (Math.random() * 0.5),
      speed: 40 + Math.random() * 40,
    }));

    setSparks((prev) => [...prev, ...newSparks]);
    setTimeout(() => {
      setSparks((prev) => prev.filter((s) => !newSparks.find((ns) => ns.id === s.id)));
    }, 600);
  }, []);

  // Navigation handler
  const handleNavigate = (destination) => {
    if (destination === 'trying') {
      // "TRYING" button — go directly to chat as guest (original behavior)
      setView('chat');
      return;
    }
    // If user is already logged in and tries to go to login/signup, redirect to chat
    if (user && (destination === 'login' || destination === 'signup')) {
      setView('chat');
      return;
    }
    setView(destination);
  };

  // Determine which page is the dark-themed background
  const isDark = view === 'landing' || view === 'login' || view === 'signup';

  // Show loading spinner while Firebase checks auth state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      onClick={handleGlobalClick}
      className={`min-h-screen font-sans transition-colors duration-500 overflow-hidden relative
        ${isDark ? 'bg-slate-950 text-slate-50' : 'bg-slate-50 text-slate-900'}
      `}
    >
      {/* Global Advanced CSS */}
      <style>{`
        /* Smooth Entrances */
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-up { animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        
        /* Border Glow Animation */
        @keyframes borderSpin { 100% { transform: rotate(360deg); } }
        .glow-card-wrapper { position: relative; border-radius: 1.5rem; overflow: hidden; padding: 1px; }
        .glow-card-wrapper::before {
          content: ''; position: absolute; top: -50%; left: -50%; width: 200%; height: 200%;
          background: conic-gradient(transparent, transparent, transparent, #6366f1, #06b6d4, transparent);
          animation: borderSpin 4s linear infinite;
        }
        .glow-card-inner { background: #020617; border-radius: 1.5rem; position: relative; z-index: 10; height: 100%; }
        
        /* 3D Isometric Styles */
        .perspective-container { perspective: 1200px; transform-style: preserve-3d; }
        .preserve-3d { transform-style: preserve-3d; }
        .isometric-base { transform: rotateX(60deg) rotateZ(-45deg); transition: transform 0.2s ease-out; }
        
        /* Sparks */
        @keyframes sparkOut { 
          0% { opacity: 1; transform: scale(1) translate(0, 0); } 
          100% { opacity: 0; transform: scale(0) translate(var(--tx), var(--ty)); } 
        }
        .spark { animation: sparkOut 0.6s ease-out forwards; }
        
        /* Scrollbar */
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark-scroll::-webkit-scrollbar-thumb { background: #334155; }
      `}</style>

      {/* Render Click Sparks */}
      {sparks.map((spark) => (
        <div
          key={spark.id}
          className="spark absolute w-1.5 h-1.5 bg-cyan-400 rounded-full pointer-events-none z-[100]"
          style={{
            left: spark.x,
            top: spark.y,
            '--tx': `${Math.cos(spark.angle) * spark.speed}px`,
            '--ty': `${Math.sin(spark.angle) * spark.speed}px`,
            boxShadow: '0 0 10px 2px rgba(34, 211, 238, 0.5)',
          }}
        />
      ))}

      {/* Top Navigation */}
      <Navbar view={view} onNavigate={handleNavigate} />

      {/* Main Content Router */}
      <main className="h-[calc(100vh-64px)]">
        {view === 'landing' && <LandingPage onTry={() => handleNavigate('trying')} />}
        {view === 'login' && <LoginPage onNavigate={handleNavigate} />}
        {view === 'signup' && <SignupPage onNavigate={handleNavigate} />}
        {view === 'chat' && <ChatDashboard />}
      </main>
    </div>
  );
}