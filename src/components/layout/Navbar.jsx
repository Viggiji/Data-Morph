import React from 'react';
import { Database, Sparkles, User, LogOut } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';

export default function Navbar({ view, onNavigate }) {
  const { user, logout } = useAuth();

  const handleSignOut = async () => {
    try {
      await logout();
      onNavigate('landing');
    } catch (err) {
      console.error('Sign out failed:', err);
    }
  };

  const isLanding = view === 'landing' || view === 'login' || view === 'signup';

  return (
    <nav className={`h-16 border-b sticky top-0 z-50 flex items-center justify-between px-6 lg:px-10 backdrop-blur-xl transition-all duration-500
      ${isLanding ? 'border-white/[0.06] bg-slate-950/70' : 'border-slate-200/80 bg-white/70'}
    `}>
      {/* Logo */}
      <motion.div
        className="flex items-center gap-3 cursor-pointer group"
        onClick={() => onNavigate('landing')}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/30 group-hover:rotate-12 group-hover:scale-110 transition-all duration-300">
          <Database size={16} strokeWidth={2.5} />
        </div>
        <span className={`font-bold text-xl tracking-tight ${isLanding ? 'text-white' : 'text-slate-900'}`}>
          Data<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-cyan-500">Morph</span>
        </span>
      </motion.div>

      {isLanding ? (
        <div className="flex items-center gap-3">
          {/* PillNav-style TRYING button */}
          <motion.button
            onClick={() => onNavigate('trying')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative px-5 py-2.5 rounded-full font-semibold overflow-hidden group"
            style={{
              background: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.25)',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/0 to-indigo-500/20 group-hover:from-indigo-500/10 group-hover:to-indigo-500/30 transition-all duration-500" />
            <span className="relative text-indigo-300 group-hover:text-indigo-200 flex items-center gap-2 text-sm">
              <Sparkles size={14} className="animate-pulse" /> TRYING
            </span>
          </motion.button>

          <div className="hidden sm:flex items-center gap-3 border-l border-white/10 pl-3">
            <motion.button
              onClick={() => onNavigate('login')}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="text-sm font-medium text-slate-300 hover:text-white transition-colors px-3 py-2"
            >
              Log in
            </motion.button>
            <motion.button
              onClick={() => onNavigate('signup')}
              whileHover={{ scale: 1.05, boxShadow: '0 0 20px rgba(255,255,255,0.2)' }}
              whileTap={{ scale: 0.95 }}
              className="px-5 py-2 rounded-full bg-white text-slate-950 text-sm font-bold hover:bg-slate-100 transition-all shadow-[0_0_15px_rgba(255,255,255,0.15)]"
            >
              Sign up
            </motion.button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          {/* User pill with glass effect */}
          <div
            className="hidden sm:flex items-center gap-2.5 px-4 py-2 rounded-full border transition-all"
            style={{
              background: 'rgba(241, 245, 249, 0.8)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
            }}
          >
            {user?.photoURL ? (
              <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full ring-2 ring-indigo-200" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center">
                <User size={12} className="text-indigo-600" />
              </div>
            )}
            <span className="text-sm font-semibold text-slate-700">{user?.displayName || user?.email || 'Guest'}</span>
          </div>
          <motion.button
            onClick={handleSignOut}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="text-sm font-medium text-slate-400 hover:text-red-500 transition-colors flex items-center gap-1.5"
          >
            <LogOut size={14} /> Sign out
          </motion.button>
        </div>
      )}
    </nav>
  );
}
