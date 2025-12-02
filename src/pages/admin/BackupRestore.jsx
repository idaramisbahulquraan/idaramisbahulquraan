import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query, doc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase-config';
import logo from '../../../assets/main-logo-1-e1724093314271.png';

const COLLECTIONS = [
  'students',
  'teachers',
  'users',
  'fees',
  'timetables',
  'exams',
  'examResults',
  'attendance',
  'incomeCategories',
  'expenseCategories',
  'incomeTransactions',
  'expenseTransactions'
];

const toCSV = (rows) => {
  if (!rows || rows.length === 0) return '';
  const allKeys = Array.from(rows.reduce((s, r) => { Object.keys(r).forEach(k => s.add(k)); return s; }, new Set()));
  if (!allKeys.includes('uid')) allKeys.unshift('uid');
  const header = allKeys.join(',');
  const escape = (v) => {
    const s = v === undefined || v === null ? '' : String(v);
    return /[,"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const body = rows.map(r => allKeys.map(k => escape(r[k])).join(',')).join('\n');
  return header + '\n' + body;
};

const parseCSV = async (file) => {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  const header = lines[0].split(',').map(h => h.trim());
  const unquote = (s) => s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1).replace(/""/g, '"') : s;
  const rows = lines.slice(1).map(line => {
    const cols = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i+1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === ',' && !inQuotes) {
        cols.push(cur); cur = '';
      } else { cur += ch; }
    }
    cols.push(cur);
    const obj = {};
    header.forEach((h, idx) => obj[h] = unquote(cols[idx] || ''));
    return obj;
  });
  return rows;
};

const download = (filename, content) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const BackupRestore = () => {
  const navigate = useNavigate();
  const [selectedCollection, setSelectedCollection] = useState('');
  const [restoreCollection, setRestoreCollection] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportSelected = async () => {
    if (!selectedCollection) return;
    setExporting(true);
    try {
      const snap = await getDocs(query(collection(db, selectedCollection)));
      const rows = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
      const csv = toCSV(rows);
      download(`${selectedCollection}.csv`, csv);
    } finally {
      setExporting(false);
    }
  };

  const exportAll = async () => {
    setExporting(true);
    try {
      for (const coll of COLLECTIONS) {
        const snap = await getDocs(query(collection(db, coll)));
        const rows = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
        const csv = toCSV(rows);
        download(`${coll}.csv`, csv);
      }
    } finally {
      setExporting(false);
    }
  };

  const handleRestore = async (file) => {
    if (!file || !restoreCollection) return;
    setRestoring(true);
    try {
      const rows = await parseCSV(file);
      for (const r of rows) {
        const id = r.uid && String(r.uid).trim().length ? String(r.uid) : undefined;
        const ref = id ? doc(db, restoreCollection, id) : doc(collection(db, restoreCollection));
        const payload = { ...r, uid: id || ref.id };
        await setDoc(ref, payload);
      }
      alert('Restore completed');
    } catch (e) {
      alert('Restore failed: ' + e.message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <img src={logo} alt="Institution Logo" className="h-10 w-10 object-contain" />
          <div>
            <div className="text-xl font-bold text-gray-800">Idara Misbah ul Quran Mangment System</div>
            <div className="text-sm text-gray-500">Backup & Restore</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => window.print()} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Download PDF</button>
          <button onClick={() => navigate('/dashboard')} className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300">Back</button>
        </div>
      </div>

      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8">
        <h3 className="text-lg font-semibold mb-4">Export</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Collection</label>
            <select value={selectedCollection} onChange={(e)=>setSelectedCollection(e.target.value)} className="shadow border rounded w-full py-2 px-3">
              <option value="">Select Collection</option>
              {COLLECTIONS.map(c => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
          <div className="flex items-end gap-3">
            <button onClick={exportSelected} disabled={!selectedCollection || exporting} className={`px-4 py-2 bg-blue-600 text-white rounded ${exporting ? 'opacity-50 cursor-not-allowed' : ''}`}>{exporting ? 'Exporting...' : 'Export Selected CSV'}</button>
            <button onClick={exportAll} disabled={exporting} className={`px-4 py-2 bg-purple-600 text-white rounded ${exporting ? 'opacity-50 cursor-not-allowed' : ''}`}>{exporting ? 'Exporting...' : 'Export All CSVs'}</button>
          </div>
        </div>
      </div>

      <div className="bg-white shadow-md rounded px-8 pt-6 pb-8">
        <h3 className="text-lg font-semibold mb-4">Restore</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">Target Collection</label>
            <select value={restoreCollection} onChange={(e)=>setRestoreCollection(e.target.value)} className="shadow border rounded w-full py-2 px-3">
              <option value="">Select Collection</option>
              {COLLECTIONS.map(c => (<option key={c} value={c}>{c}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">CSV File</label>
            <input type="file" accept=".csv,text/csv" onChange={(e)=>handleRestore(e.target.files[0])} className="shadow border rounded w-full py-2 px-3" />
          </div>
          <div className="flex items-end">
            <button disabled className={`px-4 py-2 bg-gray-300 text-gray-700 rounded`}>{restoring ? 'Restoring...' : 'Upload starts automatically'}</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BackupRestore;
