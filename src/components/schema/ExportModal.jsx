import React, { useState, useEffect } from 'react';
import { X, Copy, Download, Check, Loader2, Code2 } from 'lucide-react';
import { motion } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ExportModal({ tableId, tableName, uid, onClose }) {
  const [tab,      setTab]      = useState('sql');
  const [sqlCode,  setSqlCode]  = useState('');
  const [nosql,    setNosql]    = useState('');
  const [loading,  setLoading]  = useState(true);
  const [copied,   setCopied]   = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [sqlRes, nosqlRes] = await Promise.all([
          fetch(`${API_URL}/api/export/sql/${tableId}?uid=${uid}`),
          fetch(`${API_URL}/api/export/nosql/${tableId}?uid=${uid}`),
        ]);
        const sqlData   = await sqlRes.json();
        const nosqlData = await nosqlRes.json();
        setSqlCode(sqlData.sql         || '-- generation failed');
        setNosql(nosqlData.mongooseCode || '// generation failed');
      } catch {
        setSqlCode('-- Error connecting to server');
        setNosql('// Error connecting to server');
      } finally {
        setLoading(false);
      }
    })();
  }, [tableId, uid]);

  const currentCode = tab === 'sql' ? sqlCode : nosql;

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext  = tab === 'sql' ? 'sql' : 'nosql';
    window.open(`${API_URL}/api/export/${ext}/${tableId}/download?uid=${uid}`, '_blank');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Code2 size={18} className="text-indigo-600" />
              Export Schema
            </h3>
            <p className="text-sm text-slate-500 mt-0.5">
              Table: <code className="text-indigo-600 font-mono text-xs">{tableName}</code>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-200 text-slate-500 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <div className="flex border-b border-slate-200 bg-white px-6">
          {[
            { id: 'sql',   emoji: '🗄️',  label: 'SQL — CREATE TABLE' },
            { id: 'nosql', emoji: '🍃',  label: 'MongoDB Mongoose' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all ${
                tab === t.id
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* ── Code block ──────────────────────────────────────────────── */}
        <div className="bg-slate-950 min-h-[280px] max-h-[380px] overflow-auto relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                <span className="text-slate-500 text-sm">Generating…</span>
              </div>
            </div>
          ) : (
            <pre className="p-6 text-sm font-mono leading-relaxed whitespace-pre-wrap">
              <code className="text-slate-300">{currentCode}</code>
            </pre>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-400">
            {tab === 'sql'
              ? 'InnoDB / utf8mb4 — MySQL 5.7+'
              : 'Mongoose 7+ / MongoDB compatible'}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 hover:bg-slate-100 text-sm font-medium text-slate-700 transition-all disabled:opacity-50"
            >
              {copied
                ? <Check size={15} className="text-emerald-600" />
                : <Copy size={15} />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleDownload}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-all shadow-sm disabled:opacity-50"
            >
              <Download size={15} />
              Download {tab === 'sql' ? '.sql' : '.js'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
