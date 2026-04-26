import React, { useState, useRef } from 'react';
import { Upload, FileText, ArrowRight, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const EXAMPLE_CSV = `id,name,email,age,salary,department
1,Alice,alice@company.com,28,75000,Engineering
2,Bob,bob@company.com,35,90000,Marketing
3,Carol,carol@company.com,31,82000,Design`;

const EXAMPLE_TEXT = `Here are my employee records:

John Smith, Engineering department, salary 75000, started Jan 15 2023, currently active
Jane Doe, Marketing team, salary 68000, started March 22 2022, active
Bob Wilson, Design department, salary 92000, started Nov 8 2021, no longer active
Carol Lee, Engineering, salary 81000, started July 3 2023, active
Dave Brown, Sales department, salary 71000, started Feb 14 2022, currently active`;

export default function DataInputScreen({ onStart, isLoading }) {
  const [rawContent, setRawContent]   = useState('');
  const [inputType,  setInputType]    = useState('CSV');
  const [error,      setError]        = useState('');
  const fileRef = useRef(null);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawContent(ev.target.result || '');
      setInputType('CSV');
      setError('');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSubmit = () => {
    const trimmed = rawContent.trim();
    if (!trimmed) {
      setError(inputType === 'CSV'
        ? 'Please paste your CSV data or upload a file.'
        : 'Please describe your data or paste it in any format.');
      return;
    }
    if (inputType === 'CSV') {
      const lines = trimmed.split('\n').filter(l => l.trim());
      if (lines.length < 2) {
        setError('Need at least one header row and one data row.');
        return;
      }
      if (lines[0].split(',').length < 2) {
        setError('Need at least 2 columns. Make sure values are comma-separated.');
        return;
      }
    }
    if (inputType === 'TEXT' && trimmed.length < 10) {
      setError('Please provide a bit more detail so the AI can extract your data.');
      return;
    }
    setError('');
    onStart(trimmed, inputType);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col h-full items-center justify-center p-6 bg-gradient-to-b from-slate-50 to-white"
    >
      <div className="w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-6">
          <motion.div
            initial={{ scale: 0, rotate: -20 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 14 }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-500/30"
          >
            <Sparkles size={28} className="text-white" />
          </motion.div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2">Schema Builder</h2>
          <p className="text-slate-500 text-sm leading-relaxed max-w-sm mx-auto">
            Paste CSV data or describe your data in plain English — AI will structure it. Then 7 smart questions build your schema.
          </p>
        </div>

        {/* Input Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Type Tabs */}
          <div className="flex border-b border-slate-200">
            {[
              { id: 'CSV',  label: '📋 CSV Data' },
              { id: 'TEXT', label: '💬 Plain Text' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setInputType(tab.id); setError(''); }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  inputType === tab.id
                    ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-600'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Textarea */}
          <div className="p-4">
            <textarea
              value={rawContent}
              onChange={(e) => { setRawContent(e.target.value); setError(''); }}
              placeholder={
                inputType === 'CSV'
                  ? 'id,name,email,age\n1,John,john@example.com,30\n2,Jane,jane@example.com,25'
                  : 'Paste your data in any format — the AI will figure out the columns and structure it.\n\nExample: "John Smith, Engineering, 75000 / Jane Doe, Marketing, 68000..."'
              }
              className="w-full min-h-[180px] font-mono text-sm text-slate-800 placeholder-slate-300 bg-transparent border-none outline-none resize-none leading-relaxed"
              spellCheck={false}
            />
            {error && (
              <div className="flex items-center gap-2 mt-1 text-red-600 text-xs">
                <AlertCircle size={13} />
                {error}
              </div>
            )}
          </div>

          {/* Action row */}
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 gap-2">
            <div className="flex items-center gap-2">
              <input
                type="file"
                ref={fileRef}
                accept=".csv,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-xs text-slate-600 font-medium transition-all"
              >
                <Upload size={13} />
                Upload .csv
              </button>
              <button
                onClick={() => { setRawContent(inputType === 'CSV' ? EXAMPLE_CSV : EXAMPLE_TEXT); setError(''); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-white text-xs text-slate-600 font-medium transition-all"
              >
                <FileText size={13} />
                Load Example
              </button>
            </div>

            <button
              onClick={handleSubmit}
              disabled={isLoading || !rawContent.trim()}
              className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              {isLoading
                ? <Loader2 size={15} className="animate-spin" />
                : <ArrowRight size={15} />}
              Start Building
            </button>
          </div>
        </div>

        {/* Feature hints */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { icon: '🎯', title: '7 Questions',      desc: 'Guided step-by-step' },
            { icon: '⚡', title: 'Auto Types',       desc: 'Smart type inference' },
            { icon: '📥', title: 'SQL + NoSQL',      desc: 'Export both formats' },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + i * 0.08 }}
              className="bg-white rounded-xl p-3 border border-slate-200 text-center"
            >
              <div className="text-xl mb-1">{item.icon}</div>
              <div className="text-xs font-bold text-slate-700">{item.title}</div>
              <div className="text-[11px] text-slate-400 mt-0.5">{item.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
