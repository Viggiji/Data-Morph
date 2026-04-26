import React, { useState } from 'react';
import { Edit3, Check, X, Download, Database, Key, Link, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const DATA_TYPES = [
  'INT','BIGINT','SMALLINT','TINYINT',
  'DECIMAL(10,2)','FLOAT','DOUBLE',
  'VARCHAR(50)','VARCHAR(100)','VARCHAR(255)',
  'TEXT','LONGTEXT','CHAR(1)',
  'DATE','DATETIME','TIMESTAMP',
  'BOOLEAN','JSON',
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function getRowClass(col) {
  if (col.is_primary === 'YES') return 'border-l-2 border-amber-400 bg-amber-50/60';
  if (col.is_foreign === 'YES') return 'border-l-2 border-blue-400 bg-blue-50/60';
  if (col.is_unique === 'YES')  return 'border-l-2 border-emerald-400 bg-emerald-50/60';
  if (col.confirmed)            return 'border-l-2 border-indigo-200';
  return 'border-l-2 border-transparent';
}

function Badge({ label, title, colorClass }) {
  return (
    <span title={title}
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide ${colorClass}`}>
      {label}
    </span>
  );
}

function UnknownDot() {
  return <span className="text-slate-300 font-mono text-xs select-none">?</span>;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function SchemaView({
  tableName   = '',
  attributes  = [],
  isComplete  = false,
  onExport,
  onUpdate,
}) {
  const [editing,     setEditing]     = useState(false);
  const [editName,    setEditName]    = useState('');
  const [editAttrs,   setEditAttrs]   = useState([]);
  const [saving,      setSaving]      = useState(false);

  // ── Edit handlers ────────────────────────────────────────────────────────
  const startEdit = () => {
    setEditName(tableName);
    setEditAttrs(attributes.map(a => ({ ...a })));
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveEdit = async () => {
    setSaving(true);
    try {
      await onUpdate?.(editName, editAttrs);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const setAttr = (i, field, val) =>
    setEditAttrs(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: val } : a));

  // ── Data to render ───────────────────────────────────────────────────────
  const cols    = editing ? editAttrs : attributes;
  const name    = editing ? editName  : tableName;
  const isEmpty = attributes.length === 0;

  // ── Empty placeholder ────────────────────────────────────────────────────
  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-slate-950 border-l border-slate-800">
        <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center mb-4">
          <Database size={20} className="text-slate-600" />
        </div>
        <p className="text-sm text-slate-500 font-semibold">Schema Preview</p>
        <p className="text-xs text-slate-600 mt-1 leading-relaxed max-w-[160px]">
          columns will appear here as you answer each question
        </p>

        {/* Animated skeleton rows */}
        <div className="mt-6 w-full max-w-[220px] space-y-2">
          {[60, 80, 45, 70].map((w, i) => (
            <div key={i} className="h-7 rounded-md bg-slate-800 animate-pulse"
              style={{ width: `${w}%`, animationDelay: `${i * 150}ms` }} />
          ))}
        </div>
      </div>
    );
  }

  // ── Schema table ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-950 border-l border-slate-800 overflow-hidden">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Database size={13} className="text-indigo-400 flex-shrink-0" />
          {editing ? (
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="text-sm font-mono font-bold text-white bg-slate-800 border border-slate-600 rounded px-2 py-0.5 outline-none focus:border-indigo-500 w-full"
            />
          ) : (
            <span className="text-sm font-mono font-bold text-white truncate">
              {name || 'untitled_table'}
            </span>
          )}
        </div>

        {isComplete && !editing && (
          <button onClick={startEdit}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300 transition-colors flex-shrink-0 ml-2">
            <Edit3 size={11} /> Edit
          </button>
        )}
        {editing && (
          <div className="flex items-center gap-3 flex-shrink-0 ml-2">
            <button onClick={cancelEdit}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-400 transition-colors">
              <X size={11} /> Cancel
            </button>
            <button onClick={saveEdit} disabled={saving}
              className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-semibold transition-colors">
              {saving
                ? <div className="w-3 h-3 border border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
                : <Check size={11} />}
              Save
            </button>
          </div>
        )}
      </div>

      {/* ── Column count ────────────────────────────────────────────────── */}
      <div className="px-4 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 bg-slate-900 flex-shrink-0">
        {cols.length} column{cols.length !== 1 ? 's' : ''}
      </div>

      {/* ── Column Rows ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence initial={false}>
          {cols.map((col, i) => (
            <motion.div
              key={col.column_name || i}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              className={`px-3 py-2.5 border-b border-slate-800/60 transition-colors ${getRowClass(col)}`}
            >
              {/* Row layout: name | type | flags */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Name */}
                <div className="min-w-0 flex-1">
                  {editing ? (
                    <input
                      value={col.column_name}
                      onChange={e => setAttr(i, 'column_name', e.target.value)}
                      className="w-full text-xs font-mono text-white bg-slate-800 border-b border-slate-600 outline-none focus:border-indigo-500 pb-0.5"
                    />
                  ) : (
                    <span className="text-xs font-mono text-slate-200 font-semibold">
                      {col.column_name}
                    </span>
                  )}
                </div>

                {/* Type */}
                <div className="flex-shrink-0">
                  {editing ? (
                    <select
                      value={col.data_type}
                      onChange={e => setAttr(i, 'data_type', e.target.value)}
                      className="text-[10px] font-mono text-slate-200 bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 outline-none focus:border-indigo-500"
                    >
                      {DATA_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : col.data_type === '?' ? (
                    <UnknownDot />
                  ) : (
                    <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/50 border border-cyan-800/50 px-1.5 py-0.5 rounded whitespace-nowrap">
                      {col.data_type}
                    </span>
                  )}
                </div>

                {/* Flags */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {col.is_primary === 'YES'  && <Badge label="PK" title="Primary Key" colorClass="bg-amber-900/80 text-amber-300" />}
                  {col.is_foreign === 'YES'  && <Badge label="FK" title="Foreign Key" colorClass="bg-blue-900/80 text-blue-300" />}
                  {col.is_unique  === 'YES'  && col.is_primary !== 'YES' && (
                    <Badge label="UQ" title="Unique" colorClass="bg-emerald-900/80 text-emerald-300" />
                  )}
                  {col.is_nullable === 'YES' && col.is_primary !== 'YES' && (
                    <Badge label="NULL" title="Nullable" colorClass="bg-slate-700 text-slate-400" />
                  )}
                  {col.is_primary === '?' && <UnknownDot />}
                </div>
              </div>

              {/* Constraint note */}
              {col.constraints && col.constraints !== '?' && (
                <div className="mt-1 text-[10px] text-slate-500 font-mono truncate" title={col.constraints}>
                  CHECK: {col.constraints}
                </div>
              )}
              {col.foreign_ref && (
                <div className="mt-0.5 text-[10px] text-blue-500 font-mono truncate" title={col.foreign_ref}>
                  → {col.foreign_ref}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="px-4 py-2 border-t border-slate-800 bg-slate-900 flex-shrink-0">
        <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
          {[
            { label: '●  PK', color: 'text-amber-500' },
            { label: '●  FK', color: 'text-blue-500' },
            { label: '●  UQ', color: 'text-emerald-500' },
          ].map(l => (
            <span key={l.label} className={`text-[9px] font-bold ${l.color}`}>{l.label}</span>
          ))}
        </div>

        {/* Export buttons only when schema is done */}
        {isComplete && (
          <div className="flex gap-2">
            <button
              onClick={() => onExport?.('sql')}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition-all"
            >
              <Download size={11} />
              SQL
            </button>
            <button
              onClick={() => onExport?.('nosql')}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-lg transition-all"
            >
              <Download size={11} />
              NoSQL
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
