import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Database, ChevronRight, LayoutPanelLeft,
  Loader2, AlertTriangle, Send, RotateCcw,
  Table2, AlignLeft,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DataInputScreen from './DataInputScreen';
import SchemaView      from './SchemaView';
import ExportModal     from './ExportModal';
import DataGridView    from './DataGridView';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// ── Step breadcrumb ───────────────────────────────────────────────────────────
const STEPS = ['Provide Data', 'Build Schema', 'Export'];

function StepBar({ current }) {
  return (
    <div className="flex items-center gap-1 px-5 py-3 border-b border-slate-800 bg-slate-950 flex-shrink-0">
      {STEPS.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <React.Fragment key={label}>
            <div className={`flex items-center gap-2 text-xs font-semibold transition-colors ${
              active ? 'text-indigo-400'
              : done  ? 'text-emerald-500'
              : 'text-slate-600'
            }`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                active ? 'border-indigo-500 bg-indigo-900/60 text-indigo-300'
                : done  ? 'border-emerald-500 bg-emerald-900/60 text-emerald-300'
                : 'border-slate-700 text-slate-600'
              }`}>
                {done ? '✓' : i + 1}
              </span>
              {label}
            </div>
            {i < STEPS.length - 1 && (
              <ChevronRight size={12} className="text-slate-700 flex-shrink-0 mx-1" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Markdown renderer (simple, no external deps) ──────────────────────────────
function MarkdownText({ text }) {
  if (!text) return null;

  const renderSegment = (str) => {
    // Bold + code in same pass
    const parts = str.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={i} className="font-bold text-slate-900">{part.slice(2, -2)}</strong>;
      if (part.startsWith('`') && part.endsWith('`'))
        return <code key={i} className="font-mono text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 rounded px-1 py-0.5">{part.slice(1, -1)}</code>;
      return part;
    });
  };

  const lines = text.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '---') {
      result.push(<hr key={i} className="my-2 border-slate-200" />);
    } else if (/^[•*-] /.test(line.trim())) {
      result.push(
        <div key={i} className="flex items-start gap-2 my-0.5">
          <span className="text-indigo-500 mt-0.5 flex-shrink-0">•</span>
          <span>{renderSegment(line.trim().replace(/^[•*-] /, ''))}</span>
        </div>
      );
    } else if (line.trim() === '') {
      result.push(<div key={i} className="h-1.5" />);
    } else {
      result.push(
        <div key={i} className="leading-relaxed">
          {renderSegment(line)}
        </div>
      );
    }
    i++;
  }

  return <div className="text-sm text-slate-800 space-y-0.5">{result}</div>;
}

// ── Bot message bubble ────────────────────────────────────────────────────────
function BotBubble({ text, animate = true }) {
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start w-full"
    >
      <div className="max-w-[88%] px-4 py-3.5 bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md bg-indigo-100 border border-indigo-200 flex items-center justify-center">
            <Database size={12} className="text-indigo-600" />
          </div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Schema Bot</span>
        </div>
        <MarkdownText text={text} />
      </div>
    </motion.div>
  );
}

// ── User message bubble ───────────────────────────────────────────────────────
function UserBubble({ text }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-end w-full"
    >
      <div className="max-w-[80%] px-4 py-3 bg-indigo-600 text-white rounded-2xl rounded-tr-sm text-sm font-medium leading-relaxed">
        {text}
      </div>
    </motion.div>
  );
}

// ── Typing indicator ──────────────────────────────────────────────────────────
function TypingDots() {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
      <div className="px-4 py-3 bg-white border border-slate-200 rounded-2xl rounded-tl-sm flex items-center gap-1.5">
        {[0, 150, 300].map(d => (
          <div key={d} className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"
            style={{ animationDelay: `${d}ms` }} />
        ))}
      </div>
    </motion.div>
  );
}

// ── Completion banner ─────────────────────────────────────────────────────────
function CompletionBanner({ tableName, onExport }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex justify-start w-full"
    >
      <div className="w-full max-w-[88%] px-4 py-4 bg-gradient-to-r from-indigo-50 to-cyan-50 border border-indigo-200 rounded-2xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">🎉</span>
          <span className="font-bold text-slate-900 text-sm">Schema complete!</span>
        </div>
        <p className="text-sm text-slate-600 mb-3">
          Your <code className="font-mono text-indigo-700 text-xs">{tableName}</code> table is ready. Export it or edit columns on the right.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => onExport('sql')}
            className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg transition-all"
          >
            🗄️ Export SQL
          </button>
          <button
            onClick={() => onExport('nosql')}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-all"
          >
            🍃 Export NoSQL
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
export default function SchemaBuilderPanel({ uid, displayName, email, initialTableId, onSchemasShouldRefresh }) {
  // ── State machine ─────────────────────────────────────────────
  const [step,          setStep]          = useState(initialTableId ? 2 : 0); // 0=input 1=building 2=complete
  const [messages,      setMessages]      = useState([]);
  const [sessionId,     setSessionId]     = useState(null);
  const [tableId,       setTableId]       = useState(initialTableId || null);
  const [tableName,     setTableName]     = useState('');
  const [schema,        setSchema]        = useState([]);
  const [rawContent,    setRawContent]    = useState(''); // actual CSV data
  const [isLoading,     setIsLoading]     = useState(false);
  const [inputVal,      setInputVal]      = useState('');
  const [exportModal,   setExportModal]   = useState(null); // null | 'sql' | 'nosql'
  const [showSchemaPanel, setShowSchemaPanel] = useState(true);
  const [rightTab,      setRightTab]     = useState('schema'); // 'schema' | 'data'

  const endRef    = useRef(null);
  const inputRef  = useRef(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);

  // ── Load existing schema (when tableId provided on mount) ──────────────
  useEffect(() => {
    if (!initialTableId) return;
    (async () => {
      setIsLoading(true);
      try {
        const res  = await fetch(`${API_URL}/api/schema/view/${initialTableId}?uid=${uid}`);
        const data = await res.json();
        setTableName(data.table?.table_name || '');
        setSchema(data.attributes || []);
        setRawContent(data.rawContent || '');
        setStep(2);
        setMessages([]);
      } catch (err) {
        console.error('Failed to load schema:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [initialTableId, uid]);

  // ── Start: submit CSV/text ─────────────────────────────────────────────
  const handleDataSubmit = async (rawContent, inputType) => {
    setIsLoading(true);
    setRawContent(rawContent);
    try {
      const res  = await fetch(`${API_URL}/api/schema/builder/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, displayName: displayName || '', email: email || '', rawContent, inputType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Start failed');

      setSessionId(data.sessionId);
      setTableId(data.tableId);
      setSchema(data.currentSchema || []);
      setMessages([{ role: 'bot', text: data.botMessage, id: Date.now() }]);
      setStep(1);

      // If AI extracted and converted text to CSV, update rawContent for DataGrid
      if (data.rawContent) {
        setRawContent(data.rawContent);
      }

      // Focus input after transition
      setTimeout(() => inputRef.current?.focus(), 400);
    } catch (err) {
      console.error('Schema start error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // ── Send message during Q&A ────────────────────────────────────────────
  const handleSend = useCallback(async (e) => {
    e?.preventDefault();
    const msg = inputVal.trim();
    if (!msg || isLoading || !sessionId) return;

    const userId = Date.now();
    setMessages(prev => [...prev, { id: userId, role: 'user', text: msg }]);
    setInputVal('');
    setIsLoading(true);

    try {
      const res  = await fetch(`${API_URL}/api/schema/builder/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: msg, uid }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Message failed');

      setMessages(prev => [...prev, { id: Date.now(), role: 'bot', text: data.botMessage }]);
      setSchema(data.currentSchema || []);
      if (data.tableName) setTableName(data.tableName);

      if (data.isComplete) {
        setStep(2);
        onSchemasShouldRefresh?.(); // tell parent to refresh schemas list
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: Date.now(), role: 'bot', isError: true,
        text: `⚠️ **Error:** ${err.message}`,
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [inputVal, isLoading, sessionId, uid, onSchemasShouldRefresh]);

  // ── Update schema (edit mode in SchemaView) ────────────────────────────
  const handleUpdate = async (newName, newAttrs) => {
    const res = await fetch(`${API_URL}/api/schema/modify/${tableId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid, tableName: newName, attributes: newAttrs }),
    });
    if (!res.ok) throw new Error('Update failed');
    setTableName(newName);
    setSchema(newAttrs);
  };

  // ── Reset to start over ─────────────────────────────────────────────
  const handleReset = () => {
    setStep(0);
    setMessages([]);
    setSessionId(null);
    setTableId(null);
    setTableName('');
    setSchema([]);
    setRawContent('');
    setInputVal('');
    setRightTab('schema');
  };

  // ── Step 0: Input Screen ───────────────────────────────────────────────
  if (step === 0) {
    return (
      <div className="flex flex-col h-full bg-slate-950">
        <StepBar current={0} />
        <div className="flex-1 overflow-hidden">
          <DataInputScreen onStart={handleDataSubmit} isLoading={isLoading} />
        </div>
      </div>
    );
  }

  // ── Steps 1 & 2: Chat + Schema Preview ───────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-950">
      <StepBar current={step === 2 ? 2 : 1} />

      {/* ── Top toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-slate-900 flex-shrink-0">
        <div className="flex items-center gap-2">
          {tableName && (
            <span className="text-xs text-slate-400">
              Table: <code className="font-mono text-indigo-400 font-bold">{tableName}</code>
            </span>
          )}
          {step === 2 && (
            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-900/40 border border-emerald-700/50 px-2 py-0.5 rounded-full">
              ✓ Complete
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Toggle schema side panel */}
          <button
            onClick={() => setShowSchemaPanel(p => !p)}
            title={showSchemaPanel ? 'Hide schema preview' : 'Show schema preview'}
            className={`p-1.5 rounded-lg transition-colors ${showSchemaPanel ? 'text-indigo-400 bg-indigo-900/40' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <LayoutPanelLeft size={14} />
          </button>
          {/* Reset */}
          <button
            onClick={handleReset}
            title="Start over"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* ── 2-column layout: Chat | SchemaView ──────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Chat column */}
        <div className={`flex flex-col ${showSchemaPanel ? 'flex-[3]' : 'flex-1'} transition-all duration-300 min-w-0`}>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 bg-slate-50/5">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                msg.role === 'user'
                  ? <UserBubble key={msg.id} text={msg.text} />
                  : <BotBubble  key={msg.id} text={msg.text} />
              ))}
            </AnimatePresence>

            {/* Typing indicator while waiting */}
            {isLoading && step === 1 && <TypingDots />}

            {/* Completion banner */}
            {step === 2 && !messages.some(m => m.isComplete) && (
              <CompletionBanner tableName={tableName} onExport={setExportModal} />
            )}

            <div ref={endRef} />
          </div>

          {/* Input bar — only visible while building */}
          {step === 1 && (
            <div className="flex-shrink-0 px-4 py-4 border-t border-slate-800 bg-slate-900">
              <form
                onSubmit={handleSend}
                className={`flex items-center gap-2 bg-slate-800 rounded-2xl pl-4 pr-2 py-2 border transition-all ${
                  inputVal ? 'border-indigo-600/50 shadow-[0_0_12px_rgba(99,102,241,0.12)]' : 'border-slate-700'
                }`}
              >
                <input
                  ref={inputRef}
                  value={inputVal}
                  onChange={e => setInputVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleSend(e); }}
                  placeholder={isLoading ? 'Waiting…' : 'Type your answer…'}
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none"
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputVal.trim()}
                  className={`p-2 rounded-xl transition-all ${
                    inputVal.trim() && !isLoading
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                      : 'bg-slate-700 text-slate-600 cursor-not-allowed'
                  }`}
                >
                  {isLoading
                    ? <Loader2 size={16} className="animate-spin" />
                    : <Send size={16} />}
                </button>
              </form>
              <p className="text-center text-[10px] text-slate-600 mt-2">
                Press Enter or click Send to answer
              </p>
            </div>
          )}
        </div>

        {/* Schema Preview / Data Grid column */}
        {showSchemaPanel && (
          <div className="flex-[2] min-w-[220px] max-w-[360px] border-l border-slate-800 flex flex-col overflow-hidden">

            {/* Sub-tabs: Schema | Data */}
            <div className="flex border-b border-slate-800 bg-slate-900 flex-shrink-0">
              {[
                { id: 'schema', icon: <AlignLeft size={11}/>, label: 'Schema' },
                { id: 'data',   icon: <Table2   size={11}/>, label: 'Data'   },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setRightTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold transition-colors ${
                    rightTab === tab.id
                      ? 'text-indigo-400 bg-indigo-900/30 border-b-2 border-indigo-500'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-hidden">
              {rightTab === 'schema' ? (
                <SchemaView
                  tableName={tableName}
                  attributes={schema}
                  isComplete={step === 2}
                  onExport={setExportModal}
                  onUpdate={handleUpdate}
                />
              ) : (
                <DataGridView
                  rawContent={rawContent}
                  tableId={tableId}
                  uid={uid}
                  onSaved={(newCSV) => setRawContent(newCSV)}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Export Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {exportModal && tableId && (
          <ExportModal
            tableId={tableId}
            tableName={tableName}
            uid={uid}
            onClose={() => setExportModal(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
