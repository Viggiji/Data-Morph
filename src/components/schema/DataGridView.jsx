/**
 * DataGridView.jsx
 *
 * An inline-editable spreadsheet grid that renders CSV data.
 * Props:
 *   rawContent  — the raw CSV string (header row + data rows)
 *   tableId     — used to save edits via PUT /api/schema/:tableId/data
 *   uid         — firebase user uid
 *   onSaved     — callback after successful save (receives updated rawContent)
 *   readOnly    — if true, disables editing
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Edit3, Save, X, Plus, Trash2, Download,
  ChevronLeft, ChevronRight, Loader2, Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const PAGE_SIZE = 50;

// ── CSV helpers ───────────────────────────────────────────────────────────────
function parseCSVString(csv) {
  if (!csv) return { headers: [], rows: [] };

  const parseLine = (line) => {
    const result = [];
    let cur = '';
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ''; }
      else { cur += ch; }
    }
    result.push(cur.trim());
    return result;
  };

  const lines = csv.trim().split('\n').filter(l => l.trim());
  if (!lines.length) return { headers: [], rows: [] };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(line => {
    const vals = parseLine(line);
    const row = {};
    headers.forEach((h, i) => { row[h] = vals[i] ?? ''; });
    return row;
  });
  return { headers, rows };
}

function buildCSVString(headers, rows) {
  const escape = (v) => {
    const s = String(v ?? '');
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => escape(r[h])).join(',')),
  ];
  return lines.join('\n');
}

export default function DataGridView({ rawContent, tableId, uid, onSaved, readOnly = false }) {
  const [headers,     setHeaders]     = useState([]);
  const [rows,        setRows]        = useState([]);
  const [editMode,    setEditMode]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [page,        setPage]        = useState(0);
  // focused cell [rowIdx, colIdx]
  const [focusCell,   setFocusCell]   = useState(null);
  const inputRef = useRef(null);

  // Parse CSV whenever rawContent changes
  useEffect(() => {
    const { headers: h, rows: r } = parseCSVString(rawContent);
    setHeaders(h);
    setRows(r);
    setPage(0);
    setEditMode(false);
  }, [rawContent]);

  // Detect unsaved changes by comparing current state to original rawContent
  const hasChanges = useMemo(() => {
    if (!headers.length) return false;
    const currentCSV = buildCSVString(headers, rows);
    return currentCSV !== (rawContent || '');
  }, [headers, rows, rawContent]);

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows   = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Edit a specific cell
  const handleCellChange = useCallback((rowIdx, col, value) => {
    const absIdx = page * PAGE_SIZE + rowIdx;
    setRows(prev => {
      const next = [...prev];
      next[absIdx] = { ...next[absIdx], [col]: value };
      return next;
    });
  }, [page]);

  // Add a blank row (auto-enter edit mode)
  const handleAddRow = () => {
    const blank = {};
    headers.forEach(h => { blank[h] = ''; });
    setRows(prev => [...prev, blank]);
    setEditMode(true);
    // Jump to last page
    const newPage = Math.floor(rows.length / PAGE_SIZE);
    setPage(newPage);
  };

  // Delete a row
  const handleDeleteRow = (rowIdx) => {
    const absIdx = page * PAGE_SIZE + rowIdx;
    setRows(prev => prev.filter((_, i) => i !== absIdx));
  };

  // Save to backend
  const handleSave = async () => {
    if (!tableId || !uid) return;
    setSaving(true);
    setSaveError('');
    try {
      const newCSV = buildCSVString(headers, rows);
      const res = await fetch(`${API_URL}/api/schema/${tableId}/data`, {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ uid, rawContent: newCSV }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Save failed');
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      // Keep edit mode active — user exits via Done button
      onSaved?.(newCSV);
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Discard edits — re-parse original
  const handleDiscard = () => {
    const { headers: h, rows: r } = parseCSVString(rawContent);
    setHeaders(h);
    setRows(r);
    setEditMode(false);
    setSaveError('');
  };

  // Download current CSV
  const handleDownloadCSV = () => {
    const csv  = buildCSVString(headers, rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `data_${tableId || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!headers.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3">
        <div className="text-4xl opacity-30">📂</div>
        <p className="text-sm">No data available for this table.</p>
        <p className="text-xs text-slate-400">Upload CSV data to see it here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-200">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900 flex-shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-semibold text-slate-200">{rows.length.toLocaleString()}</span> rows ·
          <span className="font-semibold text-slate-200">{headers.length}</span> columns
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Download raw CSV */}
          <button
            onClick={handleDownloadCSV}
            title="Download as CSV"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Download size={13} /> CSV
          </button>

          {!readOnly && !editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-300 bg-indigo-900/40 hover:bg-indigo-900/70 border border-indigo-700/50 rounded-lg transition-all"
            >
              <Edit3 size={13} /> Edit
            </button>
          )}

          {/* Persistent save indicator when changes exist outside edit mode */}
          {!readOnly && !editMode && hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-amber-200 bg-amber-800/50 hover:bg-amber-700/60 border border-amber-600/50 rounded-lg transition-all animate-pulse"
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              {saving ? 'Saving…' : 'Unsaved'}
            </button>
          )}

          {editMode && (
            <>
              <button
                onClick={handleAddRow}
                title="Add row"
                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-100 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-700/40 rounded-lg transition-all"
              >
                <Plus size={13} />
              </button>
              <button
                onClick={handleDiscard}
                title="Discard changes"
                className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 border border-slate-700 rounded-lg transition-all"
              >
                <X size={13} />
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !hasChanges}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all disabled:opacity-60"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save
              </button>
              <button
                onClick={() => setEditMode(false)}
                title="Exit edit mode"
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-100 bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-700/40 rounded-lg transition-all"
              >
                <Check size={13} /> Done
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Status messages ───────────────────────────────────────────────── */}
      <AnimatePresence>
        {saveSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-900/50 border-b border-emerald-700/50 text-emerald-300 text-xs font-medium"
          >
            ✓ Changes saved successfully!
          </motion.div>
        )}
        {saveError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 px-4 py-2 bg-red-900/40 border-b border-red-700/50 text-red-300 text-xs font-medium"
          >
            ⚠ {saveError}
            <button onClick={() => setSaveError('')} className="ml-auto"><X size={12} /></button>
          </motion.div>
        )}
        {editMode && !saveError && !saveSuccess && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 px-4 py-1.5 bg-amber-900/30 border-b border-amber-700/30 text-amber-300/80 text-[11px]"
          >
            ✏ Edit mode — click any cell to edit. Press Tab to move between cells.
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Grid ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-separate border-spacing-0 min-w-max">

          {/* Sticky header */}
          <thead className="sticky top-0 z-10">
            <tr>
              {/* Row number */}
              <th className="w-10 bg-slate-900 border-b border-r border-slate-800 px-2 py-2 text-slate-600 font-mono text-[10px] text-right select-none">
                #
              </th>
              {headers.map((h, ci) => (
                <th
                  key={ci}
                  className="bg-slate-900 border-b border-r border-slate-800 px-3 py-2 text-left font-bold text-slate-300 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
              {editMode && (
                <th className="w-8 bg-slate-900 border-b border-slate-800" />
              )}
            </tr>
          </thead>

          <tbody>
            {pageRows.map((row, ri) => {
              const absIdx = page * PAGE_SIZE + ri;
              const isEven = ri % 2 === 0;
              return (
                <tr
                  key={absIdx}
                  className={`group ${isEven ? 'bg-slate-950' : 'bg-slate-900/40'} hover:bg-indigo-950/30 transition-colors`}
                >
                  {/* Row number */}
                  <td className="border-b border-r border-slate-800/60 px-2 py-1.5 text-slate-600 font-mono text-[10px] text-right select-none">
                    {absIdx + 1}
                  </td>

                  {headers.map((h, ci) => (
                    <td
                      key={ci}
                      className="border-b border-r border-slate-800/60 px-0 py-0 max-w-[220px]"
                      onClick={() => editMode && setFocusCell([absIdx, ci])}
                    >
                      {editMode && focusCell?.[0] === absIdx && focusCell?.[1] === ci ? (
                        <input
                          autoFocus
                          ref={inputRef}
                          value={row[h] ?? ''}
                          onChange={e => handleCellChange(ri, h, e.target.value)}
                          onBlur={() => setFocusCell(null)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' || e.key === 'Tab') {
                              e.preventDefault();
                              // Move to next cell
                              const nextCol = (ci + 1) % headers.length;
                              const nextRow = ci + 1 >= headers.length ? absIdx + 1 : absIdx;
                              if (nextRow < rows.length) {
                                setFocusCell([nextRow, nextCol]);
                              } else {
                                setFocusCell(null);
                              }
                            }
                            if (e.key === 'Escape') setFocusCell(null);
                          }}
                          className="w-full h-full px-3 py-1.5 bg-indigo-950 text-indigo-100 outline-none border-2 border-indigo-500 text-xs font-mono"
                        />
                      ) : (
                        <div
                          className={`px-3 py-1.5 truncate font-mono text-xs ${
                            editMode
                              ? 'cursor-text hover:bg-slate-800/50 text-slate-300'
                              : 'text-slate-300'
                          } ${(!row[h] || row[h] === '') ? 'text-slate-600 italic' : ''}`}
                          title={row[h] ?? ''}
                        >
                          {row[h] !== '' && row[h] !== null && row[h] !== undefined
                            ? String(row[h])
                            : <span className="text-slate-700">null</span>}
                        </div>
                      )}
                    </td>
                  ))}

                  {/* Delete row button (edit mode) */}
                  {editMode && (
                    <td className="border-b border-slate-800/60 px-1 py-1 text-center">
                      <button
                        onClick={() => handleDeleteRow(ri)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded text-red-500 hover:bg-red-900/30 transition-all"
                        title="Delete row"
                      >
                        <Trash2 size={11} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-800 bg-slate-900 flex-shrink-0 text-xs text-slate-400">
          <span>
            Rows {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="p-1.5 rounded hover:bg-slate-800 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={13} />
            </button>
            <span className="px-2 font-mono">
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="p-1.5 rounded hover:bg-slate-800 disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
