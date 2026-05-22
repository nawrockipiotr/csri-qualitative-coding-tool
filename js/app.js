// ─── Qualitative Coding Tool v0.1 — App Logic ───

const TOOL_VERSION = 'v0.1';

// Fallback helpers — normally defined in export.js, but guard against load-order issues
if (typeof escapeHtml === 'undefined') {
  window.escapeHtml = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
if (typeof csvEsc === 'undefined') {
  window.csvEsc = s => s && (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : (s || '');
}
if (typeof downloadFile === 'undefined') {
  window.downloadFile = (content, filename, mime) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };
}

// Safe confirm — falls back to true if window.confirm is blocked (sandboxed iframe)
function safeConfirm(msg) {
  try { return window.confirm(msg); }
  catch (e) { return true; }
}

// ─── Info toggles (hero) ───
function toggleInfo(panelId) {
  const panel = document.getElementById(panelId);
  const btn = document.querySelector(`[onclick="toggleInfo('${panelId}')"]`);
  const isOpen = panel.classList.toggle('open');
  if (btn) { btn.classList.toggle('active', isOpen); btn.setAttribute('aria-expanded', isOpen); }
  document.querySelectorAll('.info-panel').forEach(p => { if (p.id !== panelId) p.classList.remove('open'); });
  document.querySelectorAll('.info-toggle-btn').forEach(b => {
    if (b !== btn) { b.classList.remove('active'); b.setAttribute('aria-expanded', 'false'); }
  });
}

// ─── Dark mode ───
function toggleDarkMode() {
  const isDark = document.documentElement.classList.toggle('dark-mode');
  localStorage.setItem('coding_tool_dark_mode', isDark ? '1' : '0');
  const btn = document.getElementById('darkToggle');
  if (btn) btn.innerHTML = isDark ? '<i data-lucide="sun" class="icon-sm"></i> Light' : '<i data-lucide="moon" class="icon-sm"></i> Dark';
  lucide.createIcons({ nameAttr: 'data-lucide', node: btn });
}
(function initDarkMode() {
  if (localStorage.getItem('coding_tool_dark_mode') === '1') {
    document.documentElement.classList.add('dark-mode');
    const btn = document.getElementById('darkToggle');
    if (btn) btn.innerHTML = '<i data-lucide="sun" class="icon-sm"></i> Light';
  }
})();

// ─── State ───
let currentProvider = 'anthropic';
let abortController = null;

let state = {
  configured: false,
  sourceType: null,
  codingMode: 'inductive',
  guidedMode: false,
  codingLang: 'pl',
  coderId: '',
  thresholdN: 20,
  batchSize: 10,
  researchQuestion: '',
  framework: '',
  segments: [],
  currentIdx: 0,
  codedRecords: [],
  codebook: {},
  themes: {},
  dimensions: {},
  _themeAuditTrail: null,
  _abductionStats: null,
  _driftWarnings: [],
  _dimensionGroundings: {},
  memos: {},        // { segmentId: 'memo text' }
  projectMemo: '',  // project-level analytical memo
};

// ─── Undo stack ───
const undoStack = [];
const UNDO_MAX = 20;

function pushUndo(label) {
  undoStack.push({
    label,
    currentIdx: state.currentIdx,
    codedRecords: JSON.parse(JSON.stringify(state.codedRecords)),
    codebook: JSON.parse(JSON.stringify(state.codebook)),
    themes: JSON.parse(JSON.stringify(state.themes)),
    dimensions: JSON.parse(JSON.stringify(state.dimensions)),
    memos: JSON.parse(JSON.stringify(state.memos)),
  });
  if (undoStack.length > UNDO_MAX) undoStack.shift();
}

function undo() {
  if (!undoStack.length) { showStatus(t('undo_empty')); return; }
  const snap = undoStack.pop();
  state.currentIdx = snap.currentIdx;
  state.codedRecords = snap.codedRecords;
  state.codebook = snap.codebook;
  state.themes = snap.themes;
  state.dimensions = snap.dimensions;
  if (snap.memos) state.memos = snap.memos;
  saveSession();
  showStatus(t('undo_done'));
  if (currentView === 'coding') renderCodingView();
  else if (currentView === 'codebook') renderCodebookView();
  else if (currentView === 'visualization') renderVisualizationView();
}

// ─── Keyboard shortcuts ───
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
  // Ctrl+Z — undo in coding, codebook, visualization
  if (e.key === 'z' && (e.ctrlKey || e.metaKey) && ['coding', 'codebook', 'visualization'].includes(currentView)) {
    e.preventDefault(); undo(); return;
  }
  // Arrow keys — only in coding view
  if (currentView !== 'coding') return;
  if (e.key === 'ArrowLeft') { e.preventDefault(); prevSegment(); }
  if (e.key === 'ArrowRight') { e.preventDefault(); nextSegment(); }
});

// ─── Provider config (same as Transcript Tool) ───
const providerConfig = {
  anthropic: {
    label: 'Anthropic API Key', placeholder: 'sk-ant-...', storageKey: 'coding_tool_api_key_anthropic',
    model: 'claude-haiku-4-5-20251001', modelHQ: 'claude-sonnet-4-6',
    hint: 'Default: Claude Haiku (fast, cheap). Higher quality: Claude Sonnet (better coding accuracy, ~10× more expensive).'
  },
  openai: {
    label: 'OpenAI API Key', placeholder: 'sk-...', storageKey: 'coding_tool_api_key_openai',
    model: 'gpt-4o-mini', modelHQ: 'gpt-4o',
    hint: 'Default: GPT-4o mini (fast, cheap). Higher quality: GPT-4o (~15× more expensive).'
  },
  google: {
    label: 'Google AI API Key', placeholder: 'AIza...', storageKey: 'coding_tool_api_key_google',
    model: 'gemini-2.0-flash', modelHQ: 'gemini-2.5-pro-preview-05-06',
    hint: 'Default: Gemini Flash (fast, cheap). Higher quality: Gemini Pro (~10× more expensive).'
  },
  local: {
    label: 'API Key (optional)', placeholder: 'leave empty if not required', storageKey: 'coding_tool_api_key_local',
    model: '', modelHQ: '',
    hint: 'Local model via OpenAI-compatible API. Data stays on your machine.'
  }
};

function setProvider(provider) {
  currentProvider = provider;
  document.querySelectorAll('.provider-tab').forEach(b => b.classList.toggle('active', b.dataset.provider === provider));
  const cfg = providerConfig[provider];
  document.getElementById('apiKeyLabel').textContent = cfg.label;
  const inp = document.getElementById('apiKey');
  inp.placeholder = cfg.placeholder;
  document.getElementById('modelHint').innerHTML = t('hint_' + provider);
  document.getElementById('localFields').style.display = provider === 'local' ? '' : 'none';
  const hqLabel = document.getElementById('highQuality')?.closest('.quality-check');
  if (hqLabel) hqLabel.style.display = provider === 'local' ? 'none' : '';

  const saved = localStorage.getItem(cfg.storageKey);
  if (saved) { inp.value = saved; document.getElementById('saveKey').checked = true; }
  else { inp.value = ''; document.getElementById('saveKey').checked = false; }

  if (provider === 'local') {
    const se = localStorage.getItem('coding_tool_local_endpoint');
    const sm = localStorage.getItem('coding_tool_local_model');
    if (se) document.getElementById('localEndpoint').value = se;
    if (sm) document.getElementById('localModel').value = sm;
  }
}

function getModel() {
  if (currentProvider === 'local') return document.getElementById('localModel')?.value?.trim() || 'default';
  return document.getElementById('highQuality').checked
    ? providerConfig[currentProvider].modelHQ
    : providerConfig[currentProvider].model;
}

// ─── API Key persistence ───
(function loadSavedKey() {
  const cfg = providerConfig[currentProvider];
  const saved = localStorage.getItem(cfg.storageKey);
  if (saved) {
    document.getElementById('apiKey').value = saved;
    document.getElementById('saveKey').checked = true;
  }
})();

function onSaveKeyChange() {
  const cfg = providerConfig[currentProvider];
  if (document.getElementById('saveKey').checked) {
    localStorage.setItem(cfg.storageKey, document.getElementById('apiKey').value);
    if (currentProvider === 'local') {
      localStorage.setItem('coding_tool_local_endpoint', document.getElementById('localEndpoint')?.value || '');
      localStorage.setItem('coding_tool_local_model', document.getElementById('localModel')?.value || '');
    }
  } else {
    localStorage.removeItem(cfg.storageKey);
  }
}

document.getElementById('apiKey')?.addEventListener('input', () => {
  if (document.getElementById('saveKey').checked) onSaveKeyChange();
});
document.getElementById('saveKey')?.addEventListener('change', onSaveKeyChange);

// ─── Navigation ───
let currentView = 'setup';

function showView(view) {
  currentView = view;
  document.querySelectorAll('.view-panel').forEach(p => p.style.display = 'none');
  document.getElementById('view-' + view).style.display = 'block';
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  if (view === 'coding') renderCodingView();
  if (view === 'codebook') renderCodebookView();
  if (view === 'visualization') renderVisualizationView();
  if (view === 'export') renderExportView();
}

// ─── Setup / Import ───
function parseImportData() {
  const raw = document.getElementById('importText').value.trim();
  if (!raw) return;

  let segments = [];

  // Try JSON
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      if (parsed[0].segment_id && parsed[0].text_primary) {
        segments = parsed;
        showStatus(`${t('parse_transcript')} ${segments.length} ${t('parse_segments')}`);
      } else {
        segments = parsed.map((item, i) => ({
          segment_id: `S${String(i + 1).padStart(4, '0')}`,
          text_primary: item.text || item.content || JSON.stringify(item),
          author: item.author || item.speaker || ''
        }));
        showStatus(`${t('parse_json')} ${segments.length} ${t('parse_segments')}`);
      }
    }
  } catch (e) { /* not JSON */ }

  // Plain text — segment by speaker turns or paragraphs
  if (!segments.length) {
    const lines = raw.split('\n').filter(l => l.trim());
    const hasSpeakers = lines.slice(0, 10).some(l => l.indexOf(':') > 0 && l.indexOf(':') < 30);

    if (hasSpeakers) {
      let speaker = '', text = [], id = 0;
      for (const line of lines) {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0 && colonIdx < 30) {
          if (text.length) {
            id++;
            segments.push({ segment_id: `S${String(id).padStart(4, '0')}`, text_primary: text.join(' '), author: speaker });
          }
          speaker = line.substring(0, colonIdx).trim();
          text = [line.substring(colonIdx + 1).trim()].filter(Boolean);
        } else {
          text.push(line.trim());
        }
      }
      if (text.length) { id++; segments.push({ segment_id: `S${String(id).padStart(4, '0')}`, text_primary: text.join(' '), author: speaker }); }
      showStatus(`${t('parse_turns')} ${segments.length} ${t('parse_segments')}`);
    } else {
      const paras = raw.split(/\n\s*\n/).filter(p => p.trim());
      const items = paras.length >= 3 ? paras : lines;
      segments = items.map((p, i) => ({
        segment_id: `S${String(i + 1).padStart(4, '0')}`,
        text_primary: p.trim(),
        author: ''
      }));
      showStatus(`${t('parse_paragraphs')} ${segments.length} ${t('parse_segments')}`);
    }
  }

  // If session already has coded data, route through merge dialog
  if (state.segments.length && state.codedRecords.length) {
    pendingFiles = [{ filename: 'paste', segments }];
    renderFileList();
    showMergeDialog();
    return;
  }

  state.segments = segments;
  renderPreview();
}

function renderPreview() {
  const el = document.getElementById('previewArea');
  if (!state.segments.length) { el.innerHTML = ''; return; }

  // ─── Pre-analysis briefing ───
  const segs = state.segments;
  const n = segs.length;
  const avgLen = Math.round(segs.reduce((s, seg) => s + seg.text_primary.length, 0) / n);
  const authors = new Set(segs.map(s => s.author).filter(Boolean));
  const files = new Set(segs.map(s => s.source_file).filter(Boolean));

  // Suggest coding mode
  const hasFramework = (document.getElementById('framework')?.value || '').trim().length > 0;
  let suggestedMode, suggestedModeKey;
  if (n > 200) {
    suggestedMode = 'auto'; suggestedModeKey = 'briefing_suggest_auto';
  } else if (hasFramework) {
    suggestedMode = 'assisted'; suggestedModeKey = 'briefing_suggest_assisted';
  } else {
    suggestedMode = 'inductive'; suggestedModeKey = 'briefing_suggest_inductive';
  }

  // Suggest batch size
  let suggestedBatch = 10;
  if (n > 100) suggestedBatch = 15;
  if (n > 300) suggestedBatch = 20;

  const briefingHtml = `<div class="briefing-panel">
    <div class="briefing-title"><i data-lucide="bar-chart-3" class="icon-sm"></i> ${t('briefing_title')}</div>
    <div class="briefing-stats">
      <span class="briefing-stat">${t('briefing_segments')}: <strong>${n}</strong></span>
      <span class="briefing-stat">${t('briefing_avg_len')}: <strong>${avgLen} ${t('briefing_chars')}</strong></span>
      ${authors.size ? `<span class="briefing-stat">${t('briefing_authors')}: <strong>${authors.size}</strong></span>` : ''}
      ${files.size > 1 ? `<span class="briefing-stat">${t('briefing_files')}: <strong>${files.size}</strong></span>` : ''}
    </div>
    <div class="briefing-suggestions">
      <div class="briefing-suggest">${t(suggestedModeKey)}</div>
      <div class="briefing-suggest">${t('briefing_suggest_batch').replace('{n}', suggestedBatch)}</div>
      ${avgLen < 50 ? `<div class="briefing-warn">${t('briefing_warn_short')}</div>` : ''}
      ${avgLen > 2000 ? `<div class="briefing-warn">${t('briefing_warn_long')}</div>` : ''}
    </div>
  </div>`;

  // ─── Segment preview ───
  const preview = segs.slice(0, 5).map(s => {
    const speaker = s.author ? `<strong>${escapeHtml(s.author)}:</strong> ` : '';
    const raw = s.text_primary.length > 200 ? s.text_primary.substring(0, 200) + '...' : s.text_primary;
    const text = escapeHtml(raw);
    const fileBadge = s.source_file ? ` <span class="file-ext" style="margin-left:0.3rem">${escapeHtml(s.source_file)}</span>` : '';
    return `<div class="preview-segment"><span class="seg-id">${s.segment_id}</span>${fileBadge} ${speaker}${text}</div>`;
  }).join('');

  el.innerHTML = briefingHtml + `<div class="preview-header">${t('parse_preview')} (${Math.min(5, n)} ${t('parse_of')} ${n}):</div>${preview}`;
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

// ─── File drag & drop ───
let pendingFiles = []; // { name, ext, segments[] }

(function initDropZone() {
  const dz = document.getElementById('dropZone');
  const fi = document.getElementById('fileInput');
  if (!dz || !fi) return;

  dz.addEventListener('click', () => fi.click());
  dz.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click(); } });

  dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', e => {
    e.preventDefault();
    dz.classList.remove('drag-over');
    handleFiles(e.dataTransfer.files);
  });

  fi.addEventListener('change', () => { if (fi.files.length) handleFiles(fi.files); fi.value = ''; });
})();

async function handleFiles(fileList) {
  const files = Array.from(fileList);
  const supported = files.filter(f => /\.(txt|json|csv|docx)$/i.test(f.name));
  if (!supported.length) { showError(t('drop_unsupported')); return; }

  showStatus(`${t('drop_processing')} ${supported.length} ${supported.length === 1 ? t('drop_file') : t('drop_files')}...`);

  for (const file of supported) {
    try {
      const ext = file.name.split('.').pop().toLowerCase();
      let segments = [];

      if (ext === 'json') {
        const text = await file.text();
        segments = parseJSONContent(text, file.name);
      } else if (ext === 'txt') {
        const text = await file.text();
        segments = parseTXTContent(text, file.name);
      } else if (ext === 'csv') {
        const text = await file.text();
        segments = parseCSVContent(text, file.name);
      } else if (ext === 'docx') {
        segments = await parseDOCXContent(file);
      }

      if (segments.length) {
        pendingFiles.push({ name: file.name, ext, segments });
      } else {
        showError(`${file.name}: ${currentLang === 'pl' ? 'Plik pusty lub nie znaleziono segmentów.' : 'File empty or no segments found.'}`);
      }
    } catch (err) {
      console.error(`Error parsing ${file.name}:`, err);
      showError(`${file.name}: ${err.message}`);
    }
  }

  renderFileList();

  // Check if we should show merge dialog or just apply
  if (state.segments.length > 0 && pendingFiles.length > 0) {
    showMergeDialog();
  } else {
    applyPendingFiles('replace');
  }
}

function parseJSONContent(text, filename) {
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed) || !parsed.length) return [];

  if (parsed[0].segment_id && parsed[0].text_primary) {
    // Native format — add source_file
    return parsed.map(s => ({ ...s, source_file: filename }));
  }
  // Generic JSON array
  return parsed.map((item, i) => ({
    segment_id: `${filePrefix(filename)}${String(i + 1).padStart(4, '0')}`,
    text_primary: item.text || item.content || JSON.stringify(item),
    author: item.author || item.speaker || '',
    source_file: filename
  }));
}

function parseTXTContent(text, filename) {
  const lines = text.split('\n').filter(l => l.trim());
  if (!lines.length) return [];

  const hasSpeakers = lines.slice(0, 10).some(l => l.indexOf(':') > 0 && l.indexOf(':') < 30);
  const prefix = filePrefix(filename);
  const segments = [];

  if (hasSpeakers) {
    let speaker = '', buf = [], id = 0;
    for (const line of lines) {
      const ci = line.indexOf(':');
      if (ci > 0 && ci < 30) {
        if (buf.length) { id++; segments.push({ segment_id: `${prefix}${String(id).padStart(4, '0')}`, text_primary: buf.join(' '), author: speaker, source_file: filename }); }
        speaker = line.substring(0, ci).trim();
        buf = [line.substring(ci + 1).trim()].filter(Boolean);
      } else { buf.push(line.trim()); }
    }
    if (buf.length) { id++; segments.push({ segment_id: `${prefix}${String(id).padStart(4, '0')}`, text_primary: buf.join(' '), author: speaker, source_file: filename }); }
  } else {
    const paras = text.split(/\n\s*\n/).filter(p => p.trim());
    const items = paras.length >= 3 ? paras : lines;
    items.forEach((p, i) => {
      segments.push({ segment_id: `${prefix}${String(i + 1).padStart(4, '0')}`, text_primary: p.trim(), author: '', source_file: filename });
    });
  }
  return segments;
}

function parseCSVContent(text, filename) {
  const lines = text.replace(/^﻿/, '').split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  // Auto-detect delimiter: count commas vs semicolons in header
  const headerLine = lines[0];
  const commaCount = (headerLine.match(/,/g) || []).length;
  const semiCount = (headerLine.match(/;/g) || []).length;
  const delimiter = semiCount > commaCount ? ';' : ',';

  const header = parseCSVRow(lines[0], delimiter).map(h => h.toLowerCase().trim());
  const textCol = header.findIndex(h => ['text', 'text_primary', 'content', 'tekst', 'treść'].includes(h));
  const idCol = header.findIndex(h => ['segment_id', 'id', 'nr'].includes(h));
  const authorCol = header.findIndex(h => ['author', 'speaker', 'autor', 'rozmówca'].includes(h));

  if (textCol === -1) return []; // no text column found

  const prefix = filePrefix(filename);
  return lines.slice(1).map((line, i) => {
    const cols = parseCSVRow(line, delimiter);
    return {
      segment_id: idCol >= 0 && cols[idCol] ? cols[idCol] : `${prefix}${String(i + 1).padStart(4, '0')}`,
      text_primary: cols[textCol] || '',
      author: authorCol >= 0 ? (cols[authorCol] || '') : '',
      source_file: filename
    };
  }).filter(s => s.text_primary.trim());
}

function parseCSVRow(line, delimiter = ',') {
  const result = [];
  let current = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else current += ch;
    } else {
      if (ch === '"') inQuotes = true;
      else if (ch === delimiter) { result.push(current); current = ''; }
      else current += ch;
    }
  }
  result.push(current);
  return result;
}

async function parseDOCXContent(file) {
  if (typeof mammoth === 'undefined') { showError('mammoth.js not loaded'); return []; }
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  const text = result.value;
  return parseTXTContent(text, file.name);
}

function filePrefix(filename) {
  // E.g. "interview_01.txt" → "I01_"
  const base = filename.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9]/g, '').substring(0, 6).toUpperCase();
  return base ? `${base}_` : 'S';
}

function renderFileList() {
  const el = document.getElementById('fileList');
  if (!pendingFiles.length) { el.style.display = 'none'; return; }
  el.style.display = 'flex';
  el.innerHTML = pendingFiles.map((f, i) => `
    <span class="file-badge">
      <span class="file-ext">${f.ext}</span>
      ${escapeHtml(f.name)} (${f.segments.length})
      <span class="file-remove" onclick="removePendingFile(${i})" title="${t('drop_remove')}">×</span>
    </span>
  `).join('');
}

function removePendingFile(idx) {
  pendingFiles.splice(idx, 1);
  renderFileList();
  if (!pendingFiles.length) {
    document.getElementById('mergeDialog')?.remove();
  }
}

function showMergeDialog() {
  // Remove existing dialog
  document.getElementById('mergeDialog')?.remove();

  const totalNew = pendingFiles.reduce((s, f) => s + f.segments.length, 0);
  const div = document.createElement('div');
  div.id = 'mergeDialog';
  div.className = 'merge-dialog';
  div.innerHTML = `
    <div class="merge-dialog-title">${t('merge_title')}</div>
    <div class="merge-dialog-info">${t('merge_info').replace('{existing}', state.segments.length).replace('{new}', totalNew)}</div>
    <div class="merge-dialog-btns">
      <button class="action-btn" onclick="applyPendingFiles('merge')">${t('merge_add')}</button>
      <button class="action-btn secondary" onclick="applyPendingFiles('replace')">${t('merge_replace')}</button>
      <button class="action-btn secondary" onclick="cancelMerge()">${t('merge_cancel')}</button>
    </div>
  `;
  document.getElementById('previewArea').before(div);
}

function cancelMerge() {
  pendingFiles = [];
  renderFileList();
  document.getElementById('mergeDialog')?.remove();
}

function applyPendingFiles(mode) {
  if (!pendingFiles.length) return;

  const newSegments = pendingFiles.flatMap(f => f.segments);

  if (mode === 'merge') {
    // Ensure unique segment IDs
    const existingIds = new Set(state.segments.map(s => s.segment_id));
    for (const seg of newSegments) {
      if (existingIds.has(seg.segment_id)) {
        let suffix = 2;
        while (existingIds.has(`${seg.segment_id}_${suffix}`)) suffix++;
        seg.segment_id = `${seg.segment_id}_${suffix}`;
      }
      existingIds.add(seg.segment_id);
    }
    state.segments = state.segments.concat(newSegments);
    showStatus(`${t('merge_done')} +${newSegments.length} → ${state.segments.length} ${t('parse_segments')}`);
  } else {
    state.segments = newSegments;
    // Clear coded data on replace
    state.codedRecords = [];
    state.codebook = {};
    state.themes = {};
    state.dimensions = {};
    state.currentIdx = 0;
    state._themeAuditTrail = null;
    state._abductionStats = null;
    state._driftWarnings = [];
    state._dimensionGroundings = {};
    state.memos = {};
    showStatus(`${t('drop_loaded')} ${newSegments.length} ${t('parse_segments')} (${pendingFiles.length} ${pendingFiles.length === 1 ? t('drop_file') : t('drop_files')})`);
  }

  pendingFiles = [];
  renderFileList();
  document.getElementById('mergeDialog')?.remove();
  renderPreview();
}

function confirmSetup() {
  if (!state.segments.length) { showError(t('err_no_data')); return; }
  const coderId = document.getElementById('coderId').value.trim();
  if (!coderId) { showError(t('err_no_coder')); return; }

  const mode = document.querySelector('input[name="codingMode"]:checked')?.value || 'inductive';
  const aiModes = ['counter_proposal', 'assisted', 'auto'];
  if (aiModes.includes(mode)) {
    const key = document.getElementById('apiKey')?.value?.trim();
    if (!key && currentProvider !== 'local') {
      showError(t('err_no_api_key'));
      return;
    }
  }

  state.coderId = coderId;
  state.codingMode = mode;
  state.guidedMode = document.getElementById('guidedMode').checked;
  state.codingLang = document.getElementById('codingLang').value;
  state.thresholdN = parseInt(document.getElementById('thresholdN').value) || 20;
  state.batchSize = parseInt(document.getElementById('batchSize')?.value) || 10;
  state.researchQuestion = document.getElementById('researchQuestion')?.value || '';
  state.framework = document.getElementById('framework')?.value || '';
  state.sourceType = document.getElementById('sourceType').value;
  state.configured = true;
  state.currentIdx = 0;

  saveSession();
  showView('coding');
}

// ─── Coding view ───
function renderCodingView() {
  const panel = document.getElementById('view-coding');
  if (!state.configured) {
    panel.innerHTML = `<div class="empty-state">${t('empty_setup')}</div>`;
    return;
  }

  const seg = state.segments[state.currentIdx];
  if (!seg) return;

  const coded = state.codedRecords.length;
  const total = state.segments.length;
  const pct = Math.round(coded / total * 100);
  const alreadyCoded = state.codedRecords.find(r => r.segment_id === seg.segment_id);

  let guidedHtml = '';
  if (state.guidedMode && coded === 0 && state.currentIdx === 0) {
    guidedHtml = `<div class="guided-box">
      <div class="guided-title"><i data-lucide="info" class="icon-sm"></i> ${t('guided_first_title')}</div>
      <p>${t('guided_first_p1')}</p>
      <p>${t('guided_first_p2')}</p>
    </div>`;
  }

  // Guided: every 10
  if (state.guidedMode && coded > 0 && coded % 10 === 0) {
    const ratio = Object.keys(state.codebook).length / coded;
    let ratioMsg = t('guided_ratio_ok');
    let ratioClass = 'guided-ok';
    if (ratio > 0.8) { ratioMsg = t('guided_ratio_high'); ratioClass = 'guided-warn'; }
    else if (ratio < 0.3) { ratioMsg = t('guided_ratio_low'); ratioClass = 'guided-warn'; }

    const topCodes = Object.entries(state.codebook).sort((a, b) => b[1].frequency - a[1].frequency).slice(0, 5);
    guidedHtml += `<div class="guided-box ${ratioClass}">
      <div class="guided-title">${t('guided_summary')} ${coded} ${t('guided_fragments')}</div>
      <p>${ratioMsg} (${Object.keys(state.codebook).length} / ${coded})</p>
      ${topCodes.length ? `<p><strong>${t('guided_top')}</strong> ` + topCodes.map(([c, i]) => `<code>${c}</code> (${i.frequency}×)`).join(', ') + '</p>' : ''}
    </div>`;
  }

  // Theme generation hint after threshold
  if (coded >= state.thresholdN && !Object.keys(state.themes).length && coded % state.thresholdN === 0) {
    guidedHtml += `<div class="guided-box guided-info">
      <div class="guided-title"><i data-lucide="sparkles" class="icon-sm"></i> ${t('hint_themes_ready')}</div>
      <p>${t('hint_themes_desc')}</p>
      <button class="action-btn small" onclick="showView('codebook')">${t('hint_go_codebook')}</button>
    </div>`;
  }

  // Auto mode has its own full-page UI
  if (state.codingMode === 'auto') {
    renderAutoView(panel);
    return;
  }

  // Build mode-specific UI
  let modeHtml = '';
  if (state.codingMode === 'inductive') {
    modeHtml = renderInductiveUI(seg);
  } else if (state.codingMode === 'counter_proposal') {
    modeHtml = renderCounterUI(seg);
  } else {
    modeHtml = renderAssistedUI(seg);
  }

  panel.innerHTML = `
    <div class="coding-progress">
      <div class="progress-bar-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
      <div class="progress-text">${t('coding_coded')} ${coded}/${total} (${pct}%)</div>
    </div>
    <div class="coding-nav">
      <button class="nav-btn-sm" onclick="prevSegment()" ${state.currentIdx === 0 ? 'disabled' : ''}>${t('coding_prev')}</button>
      <span class="seg-counter">${state.currentIdx + 1} / ${total}</span>
      <button class="nav-btn-sm" onclick="nextSegment()" ${state.currentIdx >= total - 1 ? 'disabled' : ''}>${t('coding_next')}</button>
      ${alreadyCoded ? `<span class="coded-badge">${t('coding_already')}</span>` : ''}
      ${coded > 0 ? `<span class="coding-export-btns">
        <button class="nav-btn-sm" onclick="exportCSV()" title="${t('export_csv')}"><i data-lucide="table" class="icon-sm"></i></button>
        <button class="nav-btn-sm" onclick="exportJSON()" title="${t('export_json')}"><i data-lucide="braces" class="icon-sm"></i></button>
      </span>` : ''}
    </div>
    ${guidedHtml}
    <div class="segment-display">
      <div class="segment-meta">
        <span class="seg-id">${seg.segment_id}</span>
        ${seg.author ? `<span class="seg-author">${escapeHtml(seg.author)}</span>` : ''}
        ${seg.source_file ? `<span class="file-ext" style="margin-left:0.3rem">${escapeHtml(seg.source_file)}</span>` : ''}
        ${alreadyCoded ? (() => {
          const c = alreadyCoded.first_order_code;
          const color = state.codebook[c]?.color || '';
          return `<span class="coding-stripe" ${color ? `style="border-left:3px solid ${color}"` : ''}><code>${escapeHtml(c)}</code></span>`;
        })() : ''}
      </div>
      <div class="segment-text" id="segmentTextEl">${escapeHtml(seg.text_primary)}</div>
      <div class="segment-actions-row">
        <button class="action-btn small secondary" onclick="saveInVivoCode()" title="${t('invivo_tooltip')}"><i data-lucide="quote" class="icon-sm"></i> ${t('invivo_btn')}</button>
      </div>
      <div class="segment-memo-wrap">
        <textarea class="segment-memo" id="segMemo" placeholder="${t('memo_segment_placeholder')}" onchange="updateSegmentMemo('${seg.segment_id.replace(/'/g, "\\'")}', this.value)">${escapeHtml(state.memos[seg.segment_id] || '')}</textarea>
      </div>
    </div>
    ${modeHtml}
    <div class="recent-codes" id="recentCodes"></div>
  `;
  lucide.createIcons();
  renderRecentCodes();
}

function renderInductiveUI(seg) {
  const codes = Object.keys(state.codebook).sort();
  const datalist = codes.map(c => `<option value="${escapeHtml(c)}">`).join('');
  return `
    <div class="coding-input-area">
      <label>${t('coding_assign')}</label>
      <input type="text" id="codeInput" list="codeList" placeholder="${t('coding_code_placeholder')}"
             onkeydown="if(event.key==='Enter')saveInductiveCode()">
      <datalist id="codeList">${datalist}</datalist>
      <div class="code-type-row">
        <label><input type="radio" name="codeType" value="descriptive" checked> ${t('coding_type_desc')}</label>
        <label><input type="radio" name="codeType" value="in_vivo"> ${t('coding_type_vivo')}</label>
        <label><input type="radio" name="codeType" value="process"> ${t('coding_type_proc')}</label>
      </div>
      <input type="text" id="codeNotes" placeholder="${t('coding_note')}">
      <button class="action-btn" onclick="saveInductiveCode()">${t('coding_save')}</button>
    </div>`;
}

function renderCounterUI(seg) {
  const codes = Object.keys(state.codebook).sort();
  const datalist = codes.map(c => `<option value="${escapeHtml(c)}">`).join('');
  return `
    <div class="coding-input-area">
      <label>${t('coding_assign_counter')}</label>
      <input type="text" id="codeInput" list="codeList" placeholder="${t('coding_code_placeholder')}"
             onkeydown="if(event.key==='Enter')getCounterProposal()">
      <datalist id="codeList">${datalist}</datalist>
      <div class="code-type-row">
        <label><input type="radio" name="codeType" value="descriptive" checked> ${t('coding_type_desc')}</label>
        <label><input type="radio" name="codeType" value="in_vivo"> ${t('coding_type_vivo')}</label>
        <label><input type="radio" name="codeType" value="process"> ${t('coding_type_proc')}</label>
      </div>
      <button class="action-btn" onclick="getCounterProposal()">${t('coding_submit_counter')}</button>
      <div id="counterResult"></div>
    </div>`;
}

function renderAssistedUI(seg) {
  return `
    <div class="coding-input-area">
      <div id="assistedResult"><button class="action-btn" onclick="getAssistedProposal()">${t('coding_gen_assisted')}</button></div>
    </div>`;
}

// ─── Inductive save ───
function saveInductiveCode() {
  const code = document.getElementById('codeInput')?.value.trim();
  if (!code) return;
  const codeType = document.querySelector('input[name="codeType"]:checked')?.value || 'descriptive';
  const notes = document.getElementById('codeNotes')?.value || '';
  const seg = state.segments[state.currentIdx];

  const record = {
    segment_id: seg.segment_id,
    source_type: state.sourceType,
    source_file: seg.source_file || '',
    text_primary: seg.text_primary,
    author: seg.author || '',
    first_order_code: code,
    code_type: codeType,
    coding_mode: 'inductive',
    researcher_code: code,
    tool_proposal: null,
    final_decision: 'researcher',
    cycle: 1,
    coder_id: state.coderId,
    guided_mode: state.guidedMode,
    timestamp_coded: new Date().toISOString(),
    notes: notes
  };

  pushUndo('inductive');
  saveRecord(record);
  if (state.currentIdx < state.segments.length - 1) state.currentIdx++;
  renderCodingView();
}

// ─── Counter-proposal ───
async function getCounterProposal() {
  const code = document.getElementById('codeInput')?.value.trim();
  if (!code) return;
  const apiKey = document.getElementById('apiKey').value;
  if (currentProvider !== 'local' && !apiKey) { showError(t('coding_no_api')); return; }

  const seg = state.segments[state.currentIdx];
  const resultEl = document.getElementById('counterResult');
  resultEl.innerHTML = `<div class="api-spinner-wrap"><span class="api-spinner"></span> ${t('coding_gen_counter')}</div>`;

  try {
    abortController = new AbortController();
    const existingCodes = Object.keys(state.codebook);
    const systemPrompt = getCounterProposalPrompt(state.codingLang, state.researchQuestion, existingCodes);
    const context = buildContextWindow(state.segments, state.currentIdx);
    const userPrompt = `Fragment: ${seg.text_primary}\nKod badacza: ${code}${context}`;
    const response = await callAIWithRetry(apiKey, systemPrompt, userPrompt);

    // Parse response
    let proposedCode = '';
    let justification = '';
    for (const line of response.split('\n')) {
      if (line.toUpperCase().startsWith('CODE:') || line.toUpperCase().startsWith('KOD:'))
        proposedCode = line.split(':').slice(1).join(':').trim();
      if (line.toUpperCase().startsWith('JUSTIFICATION:') || line.toUpperCase().startsWith('UZASADNIENIE:'))
        justification = line.split(':').slice(1).join(':').trim();
    }

    resultEl.innerHTML = `
      <div class="counter-comparison">
        <div class="counter-col"><div class="counter-label">${t('coding_your_code')}</div><div class="counter-code">${escapeHtml(code)}</div></div>
        <div class="counter-col"><div class="counter-label">${t('coding_ai_proposal')}</div><div class="counter-code">${escapeHtml(proposedCode || response)}</div>
          ${justification ? `<div class="counter-reason">${escapeHtml(justification)}</div>` : ''}</div>
      </div>
      <div class="decision-row">
        <label><input type="radio" name="decision" value="researcher" checked> ${t('coding_decision_mine')}</label>
        <label><input type="radio" name="decision" value="tool"> ${t('coding_decision_ai')}</label>
        <label><input type="radio" name="decision" value="modified"> ${t('coding_decision_new')}</label>
        <input type="text" id="modifiedCode" placeholder="${t('coding_modified_placeholder')}" style="display:none">
      </div>
      <input type="text" id="codeNotes" placeholder="${t('coding_note')}">
      <button class="action-btn" id="counterSaveBtn">${t('coding_save_decision')}</button>
    `;

    // Bind save via closure (avoids XSS from inline onclick with user data)
    document.getElementById('counterSaveBtn').addEventListener('click', () => {
      saveCounterDecision(code, proposedCode || '');
    });

    // Show modified input when selected
    document.querySelectorAll('input[name="decision"]').forEach(r => {
      r.addEventListener('change', () => {
        document.getElementById('modifiedCode').style.display = r.value === 'modified' ? '' : 'none';
      });
    });

  } catch (err) {
    resultEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
  }
}

function saveCounterDecision(researcherCode, toolProposal) {
  const decision = document.querySelector('input[name="decision"]:checked')?.value || 'researcher';
  let finalCode = researcherCode;
  if (decision === 'tool') finalCode = toolProposal;
  if (decision === 'modified') finalCode = document.getElementById('modifiedCode')?.value.trim() || researcherCode;
  const codeType = document.querySelector('input[name="codeType"]:checked')?.value || 'descriptive';
  const notes = document.getElementById('codeNotes')?.value || '';
  const seg = state.segments[state.currentIdx];

  const record = {
    segment_id: seg.segment_id,
    source_type: state.sourceType,
    source_file: seg.source_file || '',
    text_primary: seg.text_primary,
    author: seg.author || '',
    first_order_code: finalCode,
    code_type: codeType,
    coding_mode: 'counter_proposal',
    researcher_code: researcherCode,
    tool_proposal: toolProposal,
    final_decision: decision,
    cycle: 1,
    coder_id: state.coderId,
    guided_mode: state.guidedMode,
    timestamp_coded: new Date().toISOString(),
    notes: notes
  };

  pushUndo('counter');
  saveRecord(record);
  if (state.currentIdx < state.segments.length - 1) state.currentIdx++;
  renderCodingView();
}

// ─── Assisted mode ───
async function getAssistedProposal() {
  const apiKey = document.getElementById('apiKey').value;
  if (currentProvider !== 'local' && !apiKey) { showError(t('coding_no_api')); return; }

  const seg = state.segments[state.currentIdx];
  const resultEl = document.getElementById('assistedResult');
  resultEl.innerHTML = `<div class="api-spinner-wrap"><span class="api-spinner"></span> ${t('coding_gen_proposal')}</div>`;

  try {
    abortController = new AbortController();
    const existingCodes = Object.keys(state.codebook);
    const systemPrompt = getAssistedProposalPrompt(state.codingLang, state.researchQuestion, state.framework, existingCodes);
    const context = buildContextWindow(state.segments, state.currentIdx);
    const response = await callAIWithRetry(apiKey, systemPrompt, `Fragment: ${seg.text_primary}${context}`);

    let proposedCode = '', proposedType = 'descriptive', justification = '';
    for (const line of response.split('\n')) {
      if (line.toUpperCase().startsWith('CODE:') || line.toUpperCase().startsWith('KOD:'))
        proposedCode = line.split(':').slice(1).join(':').trim();
      if (line.toUpperCase().startsWith('TYPE:') || line.toUpperCase().startsWith('TYP:')) {
        const tp = line.split(':').slice(1).join(':').trim().toLowerCase();
        if (['descriptive', 'in_vivo', 'process'].includes(tp)) proposedType = tp;
      }
      if (line.toUpperCase().startsWith('JUSTIFICATION:') || line.toUpperCase().startsWith('UZASADNIENIE:'))
        justification = line.split(':').slice(1).join(':').trim();
    }

    resultEl.innerHTML = `
      <div class="assisted-proposal">
        <div class="counter-label">${t('coding_ai_proposal')}</div>
        <div class="counter-code">${escapeHtml(proposedCode || response)}</div>
        ${justification ? `<div class="counter-reason">${escapeHtml(justification)}</div>` : ''}
      </div>
      <div class="decision-row">
        <label><input type="radio" name="aDecision" value="tool" checked> ${t('coding_decision_accept')}</label>
        <label><input type="radio" name="aDecision" value="modified"> ${t('coding_decision_modify')}</label>
        <label><input type="radio" name="aDecision" value="researcher"> ${t('coding_decision_reject')}</label>
      </div>
      <input type="text" id="altCode" placeholder="${t('coding_alt_placeholder')}" style="display:none">
      <input type="text" id="codeNotes" placeholder="${t('coding_note')}">
      <button class="action-btn" id="assistedSaveBtn">${t('coding_save_short')}</button>
    `;

    document.getElementById('assistedSaveBtn').addEventListener('click', () => {
      saveAssistedDecision(proposedCode || '', proposedType);
    });

    document.querySelectorAll('input[name="aDecision"]').forEach(r => {
      r.addEventListener('change', () => {
        document.getElementById('altCode').style.display = (r.value !== 'tool') ? '' : 'none';
      });
    });

  } catch (err) {
    resultEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
  }
}

function saveAssistedDecision(proposedCode, proposedType) {
  const decision = document.querySelector('input[name="aDecision"]:checked')?.value || 'tool';
  let finalCode = proposedCode;
  if (decision !== 'tool') finalCode = document.getElementById('altCode')?.value.trim() || proposedCode;
  const notes = document.getElementById('codeNotes')?.value || '';
  const seg = state.segments[state.currentIdx];

  const record = {
    segment_id: seg.segment_id,
    source_type: state.sourceType,
    source_file: seg.source_file || '',
    text_primary: seg.text_primary,
    author: seg.author || '',
    first_order_code: finalCode,
    code_type: proposedType,
    coding_mode: 'assisted',
    researcher_code: decision === 'researcher' ? finalCode : null,
    tool_proposal: proposedCode,
    final_decision: decision,
    cycle: 1,
    coder_id: state.coderId,
    guided_mode: state.guidedMode,
    timestamp_coded: new Date().toISOString(),
    notes: notes
  };

  pushUndo('assisted');
  saveRecord(record);
  if (state.currentIdx < state.segments.length - 1) state.currentIdx++;
  renderCodingView();
}

// ─── Auto mode ───
let autoCancelled = false;
let autoRunning = false;

function renderAutoView(panel) {
  const coded = state.codedRecords.length;
  const total = state.segments.length;
  const pct = Math.round(coded / total * 100);
  const codedIds = new Set(state.codedRecords.map(r => r.segment_id));
  const uncoded = state.segments.filter(s => !codedIds.has(s.segment_id));

  let content = '';

  // Cost estimate helper
  const costEstimate = (n) => {
    if (currentProvider === 'local') return '';
    const tokensPerSeg = 800;
    const totalTokens = n * tokensPerSeg;
    const prices = { anthropic: 0.001, openai: 0.00015, google: 0.0001 };
    const cost = (totalTokens / 1000 * (prices[currentProvider] || 0.001)).toFixed(2);
    return `<div class="cost-estimate">${t('auto_cost_estimate')}: ~$${cost} (${n} ${t('auto_cost_segments')}${tokensPerSeg} ${t('auto_cost_tokens')})</div>`;
  };

  if (coded === 0 && !autoRunning) {
    // Not started yet — show start button
    content = `
      <div class="auto-start-panel">
        ${costEstimate(total)}
        <button class="action-btn" onclick="runAutoCoding()">${t('auto_start')} (${total} ${t('parse_segments')})</button>
      </div>`;
  } else if (autoRunning) {
    // Currently running — show spinner
    content = `
      <div class="auto-start-panel">
        <div class="api-spinner-wrap"><span class="api-spinner"></span> ${t('auto_progress')}</div>
      </div>`;
  } else if (uncoded.length > 0) {
    // Partially done — offer to continue
    content = `
      <div class="auto-start-panel">
        <p>${t('auto_done').replace('.', '')} — ${coded}/${total} (${pct}%).</p>
        ${costEstimate(uncoded.length)}
        <button class="action-btn" onclick="runAutoCoding()">${t('auto_start')} (${uncoded.length} ${t('parse_segments')})</button>
      </div>`;
    content += renderAutoReview();
  } else {
    // All coded
    content = `<div class="status-msg">${t('auto_done')} ${coded}/${total}</div>`;
    content += renderAutoReview();
  }

  panel.innerHTML = `
    <div class="coding-progress">
      <div class="progress-bar-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
      <div class="progress-text">${t('coding_coded')} ${coded}/${total} (${pct}%)</div>
    </div>
    <div id="autoStatus"></div>
    ${content}
  `;
  lucide.createIcons();
}

function cancelAuto() {
  autoCancelled = true;
  if (abortController) abortController.abort();
  autoRunning = false;
  saveSession();
  renderCodingView();
}

function updateAutoProgress() {
  const coded = state.codedRecords.length;
  const total = state.segments.length;
  const pct = total ? Math.round(coded / total * 100) : 0;
  const bar = document.querySelector('.coding-progress .progress-bar');
  const txt = document.querySelector('.coding-progress .progress-text');
  if (bar) bar.style.width = pct + '%';
  if (txt) txt.textContent = `${t('coding_coded')} ${coded}/${total} (${pct}%)`;
}

async function runAutoCoding() {
  const apiKey = document.getElementById('apiKey').value;
  if (currentProvider !== 'local' && !apiKey) { showError(t('coding_no_api')); autoRunning = false; return; }

  autoCancelled = false;
  autoRunning = true;
  pushUndo('auto_batch');
  const codedIdSet = new Set(state.codedRecords.map(r => r.segment_id));
  const uncoded = state.segments.filter(s => !codedIdSet.has(s.segment_id));
  if (!uncoded.length) { autoRunning = false; renderCodingView(); return; }

  let statusEl = document.getElementById('autoStatus');
  const panel = document.getElementById('view-coding');

  // Show progress UI with cancel button
  statusEl.innerHTML = `
    <div class="auto-progress-bar">
      <div class="api-spinner-wrap"><span class="api-spinner"></span> <span id="autoProgressText">${t('auto_progress')} 0/${uncoded.length}</span></div>
      <button class="action-btn secondary" onclick="cancelAuto()">${t('auto_cancel')}</button>
    </div>`;

  for (let i = 0; i < uncoded.length; i++) {
    if (autoCancelled) break;

    const seg = uncoded[i];
    const progText = document.getElementById('autoProgressText');
    if (progText) progText.textContent = `${t('auto_segment')} ${i + 1}/${uncoded.length} — ${seg.segment_id}`;

    try {
      abortController = new AbortController();
      const existingCodes = Object.keys(state.codebook);
      const systemPrompt = getAutoCodePrompt(state.codingLang, state.researchQuestion, state.framework, existingCodes);
      // Find original index in full segments array for context window
      const origIdx = state.segments.findIndex(s => s.segment_id === seg.segment_id);
      const context = buildContextWindow(state.segments, origIdx);
      const response = await callAIWithRetry(apiKey, systemPrompt, `Fragment: ${seg.text_primary}${context}`);

      let proposedCode = '', proposedType = 'descriptive', justification = '';
      for (const line of response.split('\n')) {
        if (line.toUpperCase().startsWith('CODE:') || line.toUpperCase().startsWith('KOD:'))
          proposedCode = line.split(':').slice(1).join(':').trim();
        if (line.toUpperCase().startsWith('TYPE:') || line.toUpperCase().startsWith('TYP:')) {
          const tp = line.split(':').slice(1).join(':').trim().toLowerCase();
          if (['descriptive', 'in_vivo', 'process'].includes(tp)) proposedType = tp;
        }
        if (line.toUpperCase().startsWith('JUSTIFICATION:') || line.toUpperCase().startsWith('UZASADNIENIE:'))
          justification = line.split(':').slice(1).join(':').trim();
      }

      if (!proposedCode) proposedCode = response.trim().split('\n')[0];

      const record = {
        segment_id: seg.segment_id,
        source_type: state.sourceType,
        source_file: seg.source_file || '',
        text_primary: seg.text_primary,
        author: seg.author || '',
        first_order_code: proposedCode,
        code_type: proposedType,
        coding_mode: 'auto',
        researcher_code: null,
        tool_proposal: proposedCode,
        final_decision: 'tool',
        cycle: 1,
        coder_id: state.coderId,
        guided_mode: false,
        timestamp_coded: new Date().toISOString(),
        notes: justification
      };

      saveRecord(record, true);
      updateAutoProgress();
      const batchN = state.batchSize || 10;
      if ((i + 1) % batchN === 0) {
        saveSession();
        // Batch drift check every N segments
        if (!autoCancelled) await runBatchDriftCheck(apiKey, i);
      }
    } catch (err) {
      if (err.name === 'AbortError' || autoCancelled) break;
      console.error(`Auto-coding error on ${seg.segment_id}:`, err.message);
      // Skip this segment and continue
    }
  }
  saveSession(); // final persist

  if (autoCancelled) { autoRunning = false; renderCodingView(); return; }

  // Saturation check before theme generation
  const satWarning = checkSaturation();
  if (satWarning) {
    statusEl = document.getElementById('autoStatus');
    if (statusEl) statusEl.innerHTML += `<div class="guided-box guided-warn" style="margin:0.5rem 0">
      <div class="guided-title"><i data-lucide="alert-triangle" class="icon-sm"></i> ${t('sat_warning_title')}</div>
      <p>${satWarning}</p>
    </div>`;
  }

  // Clear themes/dimensions before regenerating (safe here — coding phase is done)
  state.themes = {};
  state.dimensions = {};
  state._themeAuditTrail = null;
  state._abductionStats = null;
  state._dimensionGroundings = {};

  // Phase 2: Generate themes (multi-pass: generate → critique → revise)
  await autoGenerateThemes(apiKey);
  if (autoCancelled) { autoRunning = false; renderCodingView(); return; }

  // Phase 3: Abduction loop — re-examine codes in light of themes
  await runAbductionLoop(apiKey);
  if (autoCancelled) { autoRunning = false; renderCodingView(); return; }

  // Phase 4: Generate dimensions (theoretically grounded)
  await autoGenerateDimensions(apiKey);

  // Phase 5: Show results — switch to visualization
  autoRunning = false;
  saveSession();
  showView('visualization');
}

// ─── Batch drift check (constant comparison) ───
async function runBatchDriftCheck(apiKey, batchEndIdx) {
  const batchN = state.batchSize || 10;
  const batch = state.codedRecords.slice(-batchN);
  if (batch.length < 5) return; // too few for meaningful comparison

  const statusEl = document.getElementById('autoStatus');
  const prevHtml = statusEl ? statusEl.innerHTML : '';

  try {
    abortController = new AbortController();
    const batchDesc = batch.map(r => `[${r.segment_id}] (code: ${r.first_order_code}): ${r.text_primary.substring(0, 150)}`).join('\n');
    const systemPrompt = getBatchDriftCheckPrompt(state.codingLang);
    const response = await callAIWithRetry(apiKey, systemPrompt, batchDesc, 3, { temperature: 0 });

    // Parse drift results and store as warnings
    if (!response.toUpperCase().includes('CONSISTENT:')) {
      const drifts = [];
      const lines = response.split('\n');
      let currentDrift = null;
      for (const line of lines) {
        if (line.toUpperCase().startsWith('DRIFT:')) {
          if (currentDrift) drifts.push(currentDrift);
          currentDrift = { line: line, type: '', suggestion: '' };
        } else if (line.toUpperCase().startsWith('TYPE:') && currentDrift) {
          currentDrift.type = line.split(':').slice(1).join(':').trim();
        } else if (line.toUpperCase().startsWith('SUGGESTION:') && currentDrift) {
          currentDrift.suggestion = line.split(':').slice(1).join(':').trim();
        }
      }
      if (currentDrift) drifts.push(currentDrift);
      if (drifts.length) {
        if (!state._driftWarnings) state._driftWarnings = [];
        state._driftWarnings.push({ batch: batchEndIdx, drifts, full: response });
        console.log(`Drift check (batch ending at ${batchEndIdx}): ${drifts.length} issues found`);
      }
    }
  } catch (err) {
    console.error('Drift check error:', err.message);
  }
  // Restore previous status display
  if (statusEl) statusEl.innerHTML = prevHtml;
}

// ─── Saturation check ───
function checkSaturation() {
  const records = state.codedRecords;
  if (records.length < 20) return null;

  const last10 = records.slice(-10);
  const beforeLast10 = new Set(records.slice(0, -10).map(r => r.first_order_code));
  const newCodesInLast10 = last10.filter(r => !beforeLast10.has(r.first_order_code)).length;

  if (newCodesInLast10 > 1) {
    return t('sat_warning_text').replace('{n}', newCodesInLast10);
  }
  return null;
}

// ─── Shared dimension parser ───
function toSentenceCase(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
    .replace(/ — /g, ' — '); // preserve em-dash spacing
}

function parseDimensionsResponse(response) {
  const newDims = {};
  const groundings = {};
  const lines = response.split('\n');
  let currentDim = '';
  let currentTheory = '', currentAuthor = '', currentGrounding = '';
  let collectingThemes = false;
  let pendingThemes = [];
  const allThemeNames = Object.keys(state.themes);

  function matchTheme(raw) {
    const t = raw.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
    if (!t) return null;
    if (state.themes[t]) return t;
    // Try fuzzy: theme name is a prefix or substring
    return allThemeNames.find(k => k.toLowerCase() === t.toLowerCase())
      || allThemeNames.find(k => t.toLowerCase().startsWith(k.toLowerCase()))
      || allThemeNames.find(k => k.toLowerCase().startsWith(t.toLowerCase()))
      || null;
  }

  function flushThemes() {
    if (currentDim && pendingThemes.length) {
      const matched = pendingThemes.map(matchTheme).filter(Boolean);
      // Deduplicate
      const unique = [...new Set(matched)];
      if (unique.length) newDims[currentDim] = unique;
    }
    pendingThemes = [];
    collectingThemes = false;
  }

  for (const rawLine of lines) {
    // Strip Markdown formatting: ##, **, *, ---, etc.
    const line = rawLine.replace(/^#{1,6}\s+/, '').replace(/\*\*/g, '').replace(/^\s*---+\s*$/, '').trim();
    if (!line) continue;

    const upper = line.toUpperCase();

    if (upper.startsWith('DIMENSION:') || upper.startsWith('WYMIAR:')) {
      flushThemes();
      // Save previous dimension groundings
      if (currentDim && newDims[currentDim]) {
        groundings[currentDim] = { theory: currentTheory, author: currentAuthor, text: currentGrounding };
      }
      currentDim = toSentenceCase(line.split(':').slice(1).join(':').trim());
      currentTheory = ''; currentAuthor = ''; currentGrounding = '';
    } else if ((upper.startsWith('THEMES:') || upper.startsWith('TEMATY:')) && currentDim) {
      flushThemes();
      collectingThemes = true;
      // Themes may be on same line (comma-separated) or on following lines (bullet list)
      const sameLine = line.split(':').slice(1).join(':').trim();
      if (sameLine) {
        // Could be comma-separated or single theme
        sameLine.split(',').forEach(t => { if (t.trim()) pendingThemes.push(t.trim()); });
      }
    } else if ((upper.startsWith('THEORY:') || upper.startsWith('TEORIA:')) && currentDim) {
      flushThemes();
      currentTheory = line.split(':').slice(1).join(':').trim();
    } else if ((upper.startsWith('AUTHOR:') || upper.startsWith('AUTOR:')) && currentDim) {
      flushThemes();
      currentAuthor = line.split(':').slice(1).join(':').trim();
    } else if ((upper.startsWith('GROUNDING:') || upper.startsWith('UZASADNIENIE:')) && currentDim) {
      flushThemes();
      currentGrounding = line.split(':').slice(1).join(':').trim();
    } else if (collectingThemes && currentDim && /^[-•*]\s|^\d+\.\s/.test(line)) {
      // Bullet or numbered list item — collect as theme
      pendingThemes.push(line);
    } else if (collectingThemes && currentDim) {
      // Non-bullet line while collecting — might be continuation or end
      // If it looks like a theme name (contains a known theme), add it
      if (matchTheme(line)) pendingThemes.push(line);
      else { flushThemes(); }
    }
  }
  // Flush remaining
  flushThemes();
  // Save last dimension groundings
  if (currentDim && newDims[currentDim]) {
    groundings[currentDim] = { theory: currentTheory, author: currentAuthor, text: currentGrounding };
  }
  // Validate: flag missing theory/author with placeholder
  for (const dim of Object.keys(newDims)) {
    if (!groundings[dim]) groundings[dim] = { theory: '', author: '', text: '' };
    const g = groundings[dim];
    if (!g.theory) g.theory = currentLang === 'pl' ? '⚠ uzupełnij teorię' : '⚠ add theory';
    if (!g.author) g.author = currentLang === 'pl' ? '⚠ uzupełnij autorów' : '⚠ add authors';
    if (!g.text) g.text = currentLang === 'pl' ? '⚠ uzupełnij uzasadnienie' : '⚠ add grounding';
  }
  // Apply to state
  state.dimensions = newDims;
  state._dimensionGroundings = groundings;
  return newDims;
}

// ─── Multi-pass theme generation ───
function parseThemesResponse(response) {
  const themes = {};
  const lines = response.split('\n');
  let currentTheme = '';
  let collectingCodes = false;
  let pendingCodes = [];
  const allCodeNames = Object.keys(state.codebook);

  function matchCode(raw) {
    const c = raw.replace(/^[-•*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
    if (!c) return null;
    if (state.codebook[c]) return c;
    return allCodeNames.find(k => k.toLowerCase() === c.toLowerCase())
      || allCodeNames.find(k => c.toLowerCase().startsWith(k.toLowerCase()))
      || allCodeNames.find(k => k.toLowerCase().startsWith(c.toLowerCase()))
      || null;
  }

  function flushCodes() {
    if (currentTheme && pendingCodes.length) {
      const matched = pendingCodes.map(matchCode).filter(Boolean);
      const unique = [...new Set(matched)];
      if (unique.length) themes[currentTheme] = unique;
    }
    pendingCodes = [];
    collectingCodes = false;
  }

  for (const rawLine of lines) {
    const line = rawLine.replace(/^#{1,6}\s+/, '').replace(/\*\*/g, '').replace(/^\s*---+\s*$/, '').trim();
    if (!line) continue;
    const upper = line.toUpperCase();

    if (upper.startsWith('THEME:') || upper.startsWith('TEMAT:')) {
      flushCodes();
      currentTheme = toSentenceCase(line.split(':').slice(1).join(':').trim());
    } else if ((upper.startsWith('CODES:') || upper.startsWith('KODY:')) && currentTheme) {
      flushCodes();
      collectingCodes = true;
      const sameLine = line.split(':').slice(1).join(':').trim();
      if (sameLine) {
        sameLine.split(',').forEach(c => { if (c.trim()) pendingCodes.push(c.trim()); });
      }
    } else if (collectingCodes && currentTheme && /^[-•*]\s|^\d+\.\s/.test(line)) {
      pendingCodes.push(line);
    } else if (collectingCodes && currentTheme) {
      if (matchCode(line)) pendingCodes.push(line);
      else flushCodes();
    }
  }
  flushCodes();
  return themes;
}

async function autoGenerateThemes(apiKey) {
  const statusEl = document.getElementById('autoStatus');
  const codes = Object.entries(state.codebook).filter(([, v]) => v.frequency > 0).sort((a, b) => b[1].frequency - a[1].frequency);
  if (!codes.length) return;

  // Pass 1: Generate initial themes
  if (statusEl) statusEl.innerHTML = `
    <div class="auto-progress-bar">
      <div class="api-spinner-wrap"><span class="api-spinner"></span> <span>${t('auto_themes_pass1')}</span></div>
      <button class="action-btn secondary" onclick="cancelAuto()">${t('auto_cancel')}</button>
    </div>`;

  try {
    abortController = new AbortController();
    const systemPrompt = getAutoThemesPrompt(state.codingLang, state.researchQuestion, codes);
    const pass1Response = await callAIWithRetry(apiKey, systemPrompt, `Generate second-order themes from these ${codes.length} first-order codes.`, 3, { temperature: 0 });
    const pass1Themes = parseThemesResponse(pass1Response);

    if (!Object.keys(pass1Themes).length) { console.error('Pass 1: no themes generated'); return; }
    if (autoCancelled) return;

    // Pass 2: Critique
    if (statusEl) statusEl.innerHTML = `
      <div class="auto-progress-bar">
        <div class="api-spinner-wrap"><span class="api-spinner"></span> <span>${t('auto_themes_pass2')}</span></div>
        <button class="action-btn secondary" onclick="cancelAuto()">${t('auto_cancel')}</button>
      </div>`;

    abortController = new AbortController();
    const critiquePrompt = getThemeCritiquePrompt(state.codingLang, state.researchQuestion, pass1Themes, codes);
    const critiqueResponse = await callAIWithRetry(apiKey, critiquePrompt, `Critique the proposed theme structure.`, 3, { temperature: 0 });

    if (autoCancelled) return;

    // If critique says PASS — use pass1 themes
    if (critiqueResponse.toUpperCase().includes('PASS:')) {
      state.themes = pass1Themes;
      state._themeAuditTrail = { pass1: pass1Themes, critique: 'PASS', pass3: null };
      return;
    }

    // Pass 3: Revise based on critique
    if (statusEl) statusEl.innerHTML = `
      <div class="auto-progress-bar">
        <div class="api-spinner-wrap"><span class="api-spinner"></span> <span>${t('auto_themes_pass3')}</span></div>
        <button class="action-btn secondary" onclick="cancelAuto()">${t('auto_cancel')}</button>
      </div>`;

    abortController = new AbortController();
    const revisionPrompt = getThemeRevisionPrompt(state.codingLang, state.researchQuestion, pass1Themes, critiqueResponse, codes);
    const pass3Response = await callAIWithRetry(apiKey, revisionPrompt, `Revise themes based on the critique.`, 3, { temperature: 0 });
    const pass3Themes = parseThemesResponse(pass3Response);

    // Use revised themes if valid, otherwise fall back to pass1
    state.themes = Object.keys(pass3Themes).length ? pass3Themes : pass1Themes;
    state._themeAuditTrail = { pass1: pass1Themes, critique: critiqueResponse, pass3: pass3Themes };

  } catch (err) {
    console.error('Auto themes error:', err.message);
  }
}

// ─── Abduction loop — re-coding after themes ───
async function runAbductionLoop(apiKey) {
  if (!Object.keys(state.themes).length) return;

  const statusEl = document.getElementById('autoStatus');
  const records = state.codedRecords;
  let recoded = 0, orphans = 0;

  for (let i = 0; i < records.length; i++) {
    if (autoCancelled) break;

    const r = records[i];
    if (statusEl) statusEl.innerHTML = `
      <div class="auto-progress-bar">
        <div class="api-spinner-wrap"><span class="api-spinner"></span> <span>${t('auto_abduction_progress')} ${i + 1}/${records.length}</span></div>
        <button class="action-btn secondary" onclick="cancelAuto()">${t('auto_cancel')}</button>
      </div>`;

    try {
      abortController = new AbortController();
      const systemPrompt = getAbductionCheckPrompt(state.codingLang, state.researchQuestion, state.themes);
      const origIdx = state.segments.findIndex(s => s.segment_id === r.segment_id);
      const context = buildContextWindow(state.segments, origIdx);
      const userMsg = `Segment: ${r.segment_id}\nCurrent code: ${r.first_order_code} (${r.code_type})\nText: ${r.text_primary}${context}`;
      const response = await callAIWithRetry(apiKey, systemPrompt, userMsg, 3, { temperature: 0 });

      // Parse verdict
      let verdict = 'KEEP', newCode = '', newType = '', reason = '';
      for (const line of response.split('\n')) {
        if (line.toUpperCase().startsWith('VERDICT:'))
          verdict = line.split(':').slice(1).join(':').trim().toUpperCase();
        if (line.toUpperCase().startsWith('NEW_CODE:'))
          newCode = line.split(':').slice(1).join(':').trim();
        if (line.toUpperCase().startsWith('NEW_TYPE:')) {
          const tp = line.split(':').slice(1).join(':').trim().toLowerCase();
          if (['descriptive', 'in_vivo', 'process'].includes(tp)) newType = tp;
        }
        if (line.toUpperCase().startsWith('REASON:'))
          reason = line.split(':').slice(1).join(':').trim();
      }

      if (verdict === 'RECODE' && newCode) {
        const oldCode = r.first_order_code;
        r.first_order_code = newCode;
        if (newType) r.code_type = newType;
        r.cycle = (r.cycle || 1) + 1;
        r.notes = (r.notes || '') + ` [abduction: ${oldCode} → ${newCode}: ${reason}]`;

        // Update frequencies
        if (oldCode !== newCode) {
          if (state.codebook[oldCode]) {
            state.codebook[oldCode].frequency--;
            if (state.codebook[oldCode].frequency <= 0) delete state.codebook[oldCode];
          }
          registerCode(newCode, newType || r.code_type);
        }
        recoded++;
      } else if (verdict === 'ORPHAN') {
        r.notes = (r.notes || '') + ` [abduction: ORPHAN — ${reason}]`;
        orphans++;
      }

      // Batch persist
      if ((i + 1) % 10 === 0) saveSession();
    } catch (err) {
      if (err.name === 'AbortError' || autoCancelled) break;
      console.error(`Abduction error on ${r.segment_id}:`, err.message);
    }
  }

  saveSession();
  state._abductionStats = { recoded, orphans, total: records.length };
  console.log(`Abduction loop: ${recoded} recoded, ${orphans} orphans out of ${records.length}`);
}

// ─── Theoretically grounded dimensions ───
async function autoGenerateDimensions(apiKey) {
  if (!Object.keys(state.themes).length) return;

  const statusEl = document.getElementById('autoStatus');
  if (statusEl) statusEl.innerHTML = `
    <div class="auto-progress-bar">
      <div class="api-spinner-wrap"><span class="api-spinner"></span> <span>${t('auto_dims_progress')}</span></div>
      <button class="action-btn secondary" onclick="cancelAuto()">${t('auto_cancel')}</button>
    </div>`;

  try {
    abortController = new AbortController();
    const systemPrompt = getAutoDimensionsPrompt(state.codingLang, state.researchQuestion, state.themes, state.framework);
    const response = await callAIWithRetry(apiKey, systemPrompt, `Generate aggregate dimensions from these ${Object.keys(state.themes).length} themes.`, 3, { temperature: 0 });

    parseDimensionsResponse(response);
  } catch (err) {
    console.error('Auto dimensions error:', err.message);
  }
}

let autoReviewPage = 0;
const AUTO_REVIEW_PAGE_SIZE = 20;

function renderAutoReview() {
  const records = state.codedRecords.filter(r => r.coding_mode === 'auto');
  if (!records.length) return '';

  const totalPages = Math.ceil(records.length / AUTO_REVIEW_PAGE_SIZE);
  if (autoReviewPage >= totalPages) autoReviewPage = totalPages - 1;
  const start = autoReviewPage * AUTO_REVIEW_PAGE_SIZE;
  const pageRecords = records.slice(start, start + AUTO_REVIEW_PAGE_SIZE);

  const rows = pageRecords.map((r) => {
    const textPreview = r.text_primary.length > 120 ? r.text_primary.substring(0, 120) + '...' : r.text_primary;
    return `<tr>
      <td class="seg-id">${r.segment_id}</td>
      <td>${escapeHtml(textPreview)}</td>
      <td><code>${escapeHtml(r.first_order_code)}</code></td>
      <td>${r.code_type}</td>
      <td class="auto-notes">${escapeHtml(r.notes || '')}</td>
      <td><button class="action-btn small" onclick="editAutoCode('${r.segment_id.replace(/'/g, "\\'")}', event)">${t('auto_edit')}</button></td>
    </tr>`;
  }).join('');

  const pagination = totalPages > 1 ? `
    <div class="coding-nav" style="margin-top:0.5rem">
      <button class="nav-btn-sm" onclick="autoReviewPage--;renderCodingView()" ${autoReviewPage === 0 ? 'disabled' : ''}>←</button>
      <span class="seg-counter">${autoReviewPage + 1} / ${totalPages}</span>
      <button class="nav-btn-sm" onclick="autoReviewPage++;renderCodingView()" ${autoReviewPage >= totalPages - 1 ? 'disabled' : ''}>→</button>
    </div>` : '';

  return `
    <div class="auto-review">
      <h3>${t('auto_review_title')} (${records.length})</h3>
      <table class="auto-review-table">
        <thead><tr><th>ID</th><th>${t('auto_col_text')}</th><th>${t('auto_col_code')}</th><th>${t('auto_col_type')}</th><th>${t('auto_col_justification')}</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      ${pagination}
    </div>`;
}

function editAutoCode(segId, evt) {
  const record = state.codedRecords.find(r => r.segment_id === segId);
  if (!record) return;

  const row = evt.target.closest('tr');
  const codeCell = row.cells[2];
  const typeCell = row.cells[3];
  const btnCell = row.cells[5];
  const oldCode = record.first_order_code;
  const oldType = record.code_type;

  codeCell.innerHTML = `<input type="text" class="auto-edit-input" id="editCode_${segId}" value="${escapeHtml(oldCode)}">`;
  typeCell.innerHTML = `<select id="editType_${segId}">
    <option value="descriptive" ${oldType === 'descriptive' ? 'selected' : ''}>descriptive</option>
    <option value="in_vivo" ${oldType === 'in_vivo' ? 'selected' : ''}>in_vivo</option>
    <option value="process" ${oldType === 'process' ? 'selected' : ''}>process</option>
  </select>`;
  const safeSegId = segId.replace(/'/g, "\\'");
  btnCell.innerHTML = `
    <button class="action-btn small" onclick="saveAutoEdit('${safeSegId}')">${t('auto_save_edit')}</button>
    <button class="action-btn small secondary" onclick="renderCodingView()">${t('auto_cancel_edit')}</button>`;
}

function saveAutoEdit(segId) {
  const newCode = document.getElementById(`editCode_${segId}`)?.value.trim();
  const newType = document.getElementById(`editType_${segId}`)?.value || 'descriptive';
  if (!newCode) return;

  const record = state.codedRecords.find(r => r.segment_id === segId);
  if (!record) return;

  pushUndo('saveAutoEdit');
  const oldCode = record.first_order_code;
  record.first_order_code = newCode;
  record.code_type = newType;
  record.final_decision = 'modified';

  // Update frequencies
  if (oldCode !== newCode) {
    if (state.codebook[oldCode]) {
      state.codebook[oldCode].frequency--;
      if (state.codebook[oldCode].frequency <= 0) delete state.codebook[oldCode];
    }
    registerCode(newCode, newType);
  }
  saveSession();
  renderCodingView();
}

// ─── Record management ───
function saveRecord(record, skipPersist) {
  // Remove previous coding of same segment (re-code)
  const prev = state.codedRecords.find(r => r.segment_id === record.segment_id);
  if (prev) {
    // Decrement old code frequency
    if (state.codebook[prev.first_order_code]) {
      state.codebook[prev.first_order_code].frequency--;
      if (state.codebook[prev.first_order_code].frequency <= 0) delete state.codebook[prev.first_order_code];
    }
    state.codedRecords = state.codedRecords.filter(r => r.segment_id !== record.segment_id);
  }
  state.codedRecords.push(record);
  registerCode(record.first_order_code, record.code_type);
  if (!skipPersist) saveSession();
}

function registerCode(code, type) {
  if (state.codebook[code]) {
    state.codebook[code].frequency++;
  } else {
    state.codebook[code] = { definition: '', type: type || 'descriptive', frequency: 1, created: new Date().toISOString(), color: '', memo: '', summary: '' };
  }
}

function recalcAllFrequencies() {
  for (const code of Object.keys(state.codebook)) state.codebook[code].frequency = 0;
  for (const r of state.codedRecords) {
    if (state.codebook[r.first_order_code]) state.codebook[r.first_order_code].frequency++;
  }
  // Remove codes with zero frequency
  for (const [code, info] of Object.entries(state.codebook)) {
    if (info.frequency === 0) delete state.codebook[code];
  }
}

function prevSegment() { if (state.currentIdx > 0) { state.currentIdx--; renderCodingView(); } }
function nextSegment() { if (state.currentIdx < state.segments.length - 1) { state.currentIdx++; renderCodingView(); } }

function renderRecentCodes() {
  const el = document.getElementById('recentCodes');
  if (!el) return;
  const recent = state.codedRecords.slice(-5).reverse();
  if (!recent.length) return;
  el.innerHTML = `<div class="recent-title">${t('coding_recent')}</div>` +
    recent.map(r => `<span class="recent-item">${escapeHtml(r.segment_id)}: <code>${escapeHtml(r.first_order_code)}</code></span>`).join('');
}

// ─── In-vivo coding ───
function saveInVivoCode() {
  const sel = window.getSelection();
  const text = sel ? sel.toString().trim() : '';
  if (!text || text.length < 2) { showError(t('invivo_select_first')); return; }
  if (text.length > 80) { showError(t('invivo_too_long')); return; }

  const seg = state.segments[state.currentIdx];
  const code = text;
  const record = {
    segment_id: seg.segment_id, source_type: state.sourceType, source_file: seg.source_file || '',
    text_primary: seg.text_primary, author: seg.author || '', first_order_code: code, code_type: 'in_vivo',
    coding_mode: state.codingMode === 'auto' ? 'auto' : 'inductive', researcher_code: code, tool_proposal: null,
    final_decision: 'researcher', cycle: 1, coder_id: state.coderId, guided_mode: state.guidedMode,
    timestamp_coded: new Date().toISOString(), notes: `[in-vivo: "${text}"]`
  };
  pushUndo('in_vivo');
  saveRecord(record);
  sel.removeAllRanges();
  if (state.currentIdx < state.segments.length - 1) state.currentIdx++;
  renderCodingView();
}

// ─── Segment memos ───
function updateSegmentMemo(segId, text) {
  if (text.trim()) { state.memos[segId] = text.trim(); }
  else { delete state.memos[segId]; }
  saveSession();
}

// ─── Code metadata updates ───
function updateCodeColor(code, color) {
  if (state.codebook[code]) { state.codebook[code].color = color; saveSession(); }
}

function updateCodeMemo(code, text) {
  if (state.codebook[code]) { state.codebook[code].memo = text; saveSession(); }
}

function updateCodeSummary(code, text) {
  if (state.codebook[code]) { state.codebook[code].summary = text; saveSession(); }
}

// ─── Ask AI about code ───
async function askAIAboutCode(code) {
  const apiKey = document.getElementById('apiKey').value;
  if (currentProvider !== 'local' && !apiKey) { showError(t('coding_no_api')); return; }

  const segments = state.codedRecords.filter(r => r.first_order_code === code);
  if (!segments.length) return;

  const el = document.getElementById('askAIResult_' + CSS.escape(code));
  if (!el) return;
  el.innerHTML = `<div class="api-spinner-wrap"><span class="api-spinner"></span> ${t('ask_ai_loading')}</div>`;

  try {
    abortController = new AbortController();
    const segTexts = segments.slice(0, 30).map((r, i) => `[${r.segment_id}] ${r.text_primary.substring(0, 300)}`).join('\n');
    const systemPrompt = getAskCodePrompt(state.codingLang, state.researchQuestion, code);
    const response = await callAIWithRetry(apiKey, systemPrompt, segTexts, 3, { temperature: 0 });
    el.innerHTML = `<div class="ask-ai-response">${escapeHtml(response)}</div>`;
  } catch (err) {
    el.innerHTML = `<div class="error-msg">${err.message}</div>`;
  }
}

// ─── Codebook view ───
function renderCodebookView() {
  const panel = document.getElementById('view-codebook');
  const codes = Object.entries(state.codebook).sort((a, b) => b[1].frequency - a[1].frequency);
  const singletons = codes.filter(([, v]) => v.frequency === 1).length;

  // Build themes UI
  const allCodes = codes.map(([c]) => c);
  const assignedCodes = new Set(Object.values(state.themes).flat());
  const unassignedCodes = allCodes.filter(c => !assignedCodes.has(c));

  let themeRows = '';
  for (const [name, tCodes] of Object.entries(state.themes)) {
    themeRows += `<div class="theme-card">
      <div class="theme-header">
        <strong>${escapeHtml(name)}</strong>
        <button class="theme-remove-btn" onclick="removeTheme('${name.replace(/'/g, "\\'")}')" title="×">×</button>
      </div>
      <div class="theme-codes">${tCodes.map(c => `<span class="theme-code-tag">${escapeHtml(c)} <button class="tag-remove" onclick="removeCodeFromTheme('${name.replace(/'/g, "\\'")}','${c.replace(/'/g, "\\'")}')" title="×">×</button></span>`).join('')}</div>
      <select class="theme-add-code" onchange="addCodeToTheme('${name.replace(/'/g, "\\'")}', this.value); this.value='';">
        <option value="">${t('theme_add_code')}</option>
        ${unassignedCodes.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}
      </select>
    </div>`;
  }

  // Build dimensions UI
  const assignedThemes = new Set(Object.values(state.dimensions).flat());
  const unassignedThemes = Object.keys(state.themes).filter(t2 => !assignedThemes.has(t2));

  let dimRows = '';
  for (const [name, dThemes] of Object.entries(state.dimensions)) {
    dimRows += `<div class="theme-card dim-card">
      <div class="theme-header">
        <strong>${escapeHtml(name)}</strong>
        <button class="theme-remove-btn" onclick="removeDimension('${name.replace(/'/g, "\\'")}')" title="×">×</button>
      </div>
      <div class="theme-codes">${dThemes.map(th => `<span class="theme-code-tag dim-tag">${escapeHtml(th)} <button class="tag-remove" onclick="removeThemeFromDimension('${name.replace(/'/g, "\\'")}','${th.replace(/'/g, "\\'")}')" title="×">×</button></span>`).join('')}</div>
      <select class="theme-add-code" onchange="addThemeToDimension('${name.replace(/'/g, "\\'")}', this.value); this.value='';">
        <option value="">${t('dim_add_theme')}</option>
        ${unassignedThemes.map(th => `<option value="${escapeHtml(th)}">${escapeHtml(th)}</option>`).join('')}
      </select>
    </div>`;
  }

  panel.innerHTML = `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-num">${codes.length}</div><div class="stat-label">${t('codebook_codes')}</div></div>
      <div class="stat-card"><div class="stat-num">${singletons}</div><div class="stat-label">${t('codebook_singletons')}</div></div>
      <div class="stat-card"><div class="stat-num">${Object.keys(state.themes).length}</div><div class="stat-label">${t('codebook_themes')}</div></div>
      <div class="stat-card"><div class="stat-num">${Object.keys(state.dimensions).length}</div><div class="stat-label">${t('codebook_dims')}</div></div>
    </div>
    <h3>${t('codebook_list')}</h3>
    <div class="undo-bar">
      <button class="undo-btn" onclick="undo()" ${!undoStack.length ? 'disabled' : ''}>${t('undo_btn')} (Ctrl+Z)</button>
      <button class="undo-btn" onclick="exportCodebook()">${t('codebook_export_btn')}</button>
    </div>
    <input type="text" class="codebook-filter" id="codebookFilter" placeholder="${t('codebook_filter_placeholder')}" oninput="filterCodebook(this.value)">
    <div class="code-table-wrap"><table class="code-table" id="codeTable">
      <thead><tr><th></th><th>${t('codebook_code')}</th><th>${t('codebook_type')}</th><th>${t('codebook_freq')}</th><th>${t('codebook_def')}</th><th></th></tr></thead>
      <tbody>${codes.map(([code, info]) => {
        const safeCode = code.replace(/'/g, "\\'");
        const codeColor = info.color || '';
        const hasMemo = !!(info.memo || info.summary);
        return `
        <tr data-code="${escapeHtml(code.toLowerCase())}">
          <td><input type="color" class="code-color-pick" value="${codeColor || '#6b7280'}" onchange="updateCodeColor('${safeCode}', this.value)" title="${t('code_color')}"></td>
          <td><code ${codeColor ? `style="border-left:3px solid ${codeColor};padding-left:4px"` : ''}>${escapeHtml(code)}</code></td>
          <td>${info.type}</td>
          <td>${info.frequency}</td>
          <td><input type="text" class="def-input" value="${escapeHtml(info.definition || '')}" onchange="updateDefinition('${safeCode}', this.value)"></td>
          <td><button class="link-btn small" onclick="toggleCodeDetail('${safeCode}')" title="${t('code_detail')}">${hasMemo ? '📝' : '⋯'}</button>
              <button class="link-btn small" onclick="askAIAboutCode('${safeCode}')" title="${t('ask_ai_btn')}">🤖</button></td>
        </tr>
        <tr class="code-detail-row" id="codeDetail_${CSS.escape(code)}" style="display:none" data-code="${escapeHtml(code.toLowerCase())}">
          <td colspan="6">
            <div class="code-detail-grid">
              <div><label>${t('code_memo')}</label><textarea class="code-memo-input" onchange="updateCodeMemo('${safeCode}', this.value)" placeholder="${t('code_memo_placeholder')}">${escapeHtml(info.memo || '')}</textarea></div>
              <div><label>${t('code_summary')}</label><textarea class="code-memo-input" onchange="updateCodeSummary('${safeCode}', this.value)" placeholder="${t('code_summary_placeholder')}">${escapeHtml(info.summary || '')}</textarea></div>
            </div>
            <div id="askAIResult_${CSS.escape(code)}"></div>
          </td>
        </tr>`;
      }).join('')}
      </tbody>
    </table></div>
    <button class="action-btn secondary" onclick="suggestConsolidation()">${t('codebook_consolidate')}</button>
    <div id="consolidationResult"></div>

    <h3>${t('codebook_themes_title')}</h3>
    <div class="theme-manager">
      ${themeRows || `<div class="empty-hint">${t('theme_empty')}</div>`}
      <div class="theme-create-row">
        <input type="text" id="newThemeName" placeholder="${t('theme_name_placeholder')}" onkeydown="if(event.key==='Enter')createTheme()">
        <button class="action-btn secondary" onclick="createTheme()">${t('theme_create')}</button>
        <button class="action-btn" onclick="generateThemesAI()" ${codes.length < 3 ? 'disabled title="' + t('gen_themes_min') + '"' : ''}><i data-lucide="sparkles" class="icon-sm"></i> ${t('gen_themes_btn')}</button>
      </div>
      <div id="aiThemesResult"></div>
    </div>

    <h3>${t('codebook_dims_title')}</h3>
    <div class="theme-manager">
      ${dimRows || `<div class="empty-hint">${t('dim_empty')}</div>`}
      <div class="theme-create-row">
        <input type="text" id="newDimName" placeholder="${t('dim_name_placeholder')}" onkeydown="if(event.key==='Enter')createDimension()">
        <button class="action-btn secondary" onclick="createDimension()">${t('dim_create')}</button>
        <button class="action-btn" onclick="generateDimensionsAI()" ${Object.keys(state.themes).length < 2 ? 'disabled title="' + t('gen_dims_min') + '"' : ''}><i data-lucide="sparkles" class="icon-sm"></i> ${t('gen_dims_btn')}</button>
      </div>
      <div id="aiDimsResult"></div>
    </div>

    <h3>${t('codebook_creative_coding')}</h3>
    <button class="action-btn secondary" onclick="showCreativeCoding()">${t('creative_coding_btn')}</button>

    <h3>${t('project_memo_title')}</h3>
    <textarea class="project-memo" id="projectMemo" placeholder="${t('project_memo_placeholder')}" onchange="state.projectMemo=this.value;saveSession()">${escapeHtml(state.projectMemo || '')}</textarea>
  `;
  lucide.createIcons();
}

function updateDefinition(code, def) {
  if (state.codebook[code]) { state.codebook[code].definition = def; saveSession(); }
}

function toggleCodeDetail(code) {
  const el = document.getElementById('codeDetail_' + CSS.escape(code));
  if (el) el.style.display = el.style.display === 'none' ? '' : 'none';
}

function filterCodebook(query) {
  const q = query.toLowerCase();
  document.querySelectorAll('#codeTable tbody tr').forEach(row => {
    if (row.classList.contains('code-detail-row')) {
      if (q) row.style.display = 'none'; // hide details when filtering
    } else {
      row.style.display = !q || row.dataset.code.includes(q) ? '' : 'none';
    }
  });
}

function exportCodebook() {
  const codes = Object.entries(state.codebook).sort((a, b) => b[1].frequency - a[1].frequency);
  const header = 'code,type,frequency,definition';
  const rows = codes.map(([c, i]) => [csvEsc(c), i.type, i.frequency, csvEsc(i.definition || '')].join(','));
  const csv = '﻿' + header + '\n' + rows.join('\n');
  downloadFile(csv, `codebook_${ts()}.csv`, 'text/csv;charset=utf-8');
}

// ─── Drift resolution ───
// Resolve segment ID — strip brackets, expand ranges like S0508-S0512
function resolveSegIds(raw) {
  const clean = raw.replace(/^\[|\]$/g, '');
  const rangeMatch = clean.match(/^([A-Za-z]*)(\d+)-\1?(\d+)$/);
  if (rangeMatch) {
    const [, prefix, startStr, endStr] = rangeMatch;
    const start = parseInt(startStr), end = parseInt(endStr);
    const pad = startStr.length;
    const ids = [];
    for (let i = start; i <= end; i++) ids.push(prefix + String(i).padStart(pad, '0'));
    return ids;
  }
  return [clean];
}

function recodeDrift(segId, newCode, btn) {
  const ids = resolveSegIds(segId);
  const records = state.codedRecords.filter(r => ids.includes(r.segment_id));
  if (!records.length) return;
  pushUndo('recodeDrift');
  for (const record of records) {
    const oldCode = record.first_order_code;
    record.first_order_code = newCode;
    record.notes = (record.notes || '') + ` [drift recode: ${oldCode} → ${newCode}]`;
  }
  recalcAllFrequencies();
  saveSession();
  // Mark as resolved
  const detail = btn.closest('.drift-detail');
  if (detail) {
    detail.classList.add('merge-applied');
    const actions = detail.querySelector('.drift-actions');
    if (actions) actions.innerHTML = `<span class="merge-done-badge">✓ ${escapeHtml(segId)} → ${escapeHtml(newCode)} (${records.length})</span>`;
  }
}

function dismissDrift(btn) {
  const detail = btn.closest('.drift-detail');
  if (detail) detail.remove();
}

function updateGrounding(dim, text) {
  if (!state._dimensionGroundings) state._dimensionGroundings = {};
  const existing = state._dimensionGroundings[dim];
  if (typeof existing === 'object') {
    existing.text = text;
  } else {
    state._dimensionGroundings[dim] = { theory: '', author: '', text };
  }
  saveSession();
}

// ─── Theme / Dimension CRUD ───
function createTheme() {
  const name = document.getElementById('newThemeName')?.value.trim();
  if (!name || state.themes[name]) return;
  pushUndo('createTheme');
  state.themes[name] = [];
  saveSession();
  renderCodebookView();
}

function removeTheme(name) {
  pushUndo('removeTheme');
  delete state.themes[name];
  // Also remove from dimensions
  for (const [dim, themes] of Object.entries(state.dimensions)) {
    state.dimensions[dim] = themes.filter(t2 => t2 !== name);
    if (!state.dimensions[dim].length) delete state.dimensions[dim];
  }
  saveSession();
  renderCodebookView();
}

function addCodeToTheme(theme, code) {
  if (!code || !state.themes[theme]) return;
  pushUndo('addCodeToTheme');
  // Remove from other themes first
  for (const [t2, codes] of Object.entries(state.themes)) {
    state.themes[t2] = codes.filter(c => c !== code);
  }
  state.themes[theme].push(code);
  saveSession();
  renderCodebookView();
}

function removeCodeFromTheme(theme, code) {
  if (!state.themes[theme]) return;
  pushUndo('removeCodeFromTheme');
  state.themes[theme] = state.themes[theme].filter(c => c !== code);
  saveSession();
  renderCodebookView();
}

function createDimension() {
  const name = document.getElementById('newDimName')?.value.trim();
  if (!name || state.dimensions[name]) return;
  pushUndo('createDimension');
  state.dimensions[name] = [];
  saveSession();
  renderCodebookView();
}

function removeDimension(name) {
  pushUndo('removeDimension');
  delete state.dimensions[name];
  saveSession();
  renderCodebookView();
}

function addThemeToDimension(dim, theme) {
  if (!theme || !state.dimensions[dim]) return;
  pushUndo('addThemeToDimension');
  for (const [d2, themes] of Object.entries(state.dimensions)) {
    state.dimensions[d2] = themes.filter(t2 => t2 !== theme);
  }
  state.dimensions[dim].push(theme);
  saveSession();
  renderCodebookView();
}

function removeThemeFromDimension(dim, theme) {
  if (!state.dimensions[dim]) return;
  pushUndo('removeThemeFromDimension');
  state.dimensions[dim] = state.dimensions[dim].filter(t2 => t2 !== theme);
  saveSession();
  renderCodebookView();
}

async function suggestConsolidation() {
  const apiKey = document.getElementById('apiKey').value;
  if (currentProvider !== 'local' && !apiKey) { showError(t('coding_no_api')); return; }

  const el = document.getElementById('consolidationResult');

  // Filter codes with frequency > 0
  const activeCodes = Object.entries(state.codebook).filter(([, v]) => v.frequency > 0);
  if (activeCodes.length < 3) {
    el.innerHTML = `<div class="ai-result"><p>${t('consolidation_min_codes')}</p></div>`;
    return;
  }

  el.innerHTML = `<div class="api-spinner-wrap"><span class="api-spinner"></span> ${t('codebook_analyzing')}</div>`;

  const codeList = activeCodes
    .sort((a, b) => b[1].frequency - a[1].frequency)
    .map(([c, i]) => `- ${c} (${i.frequency}×)`).join('\n');

  try {
    abortController = new AbortController();
    const response = await callAIWithRetry(apiKey, getConsolidationSuggestionsPrompt(state.codingLang), `Lista kodów:\n${codeList}`, 3, { temperature: 0 });

    // Parse MERGE suggestions
    const suggestions = [];
    const lines = response.split('\n');
    let currentMerge = null;
    for (const line of lines) {
      if (line.toUpperCase().startsWith('MERGE:')) {
        const parts = line.split(':').slice(1).join(':').trim();
        const arrow = parts.indexOf('→') !== -1 ? '→' : (parts.indexOf('->') !== -1 ? '->' : null);
        if (arrow) {
          const [left, right] = parts.split(arrow).map(s => s.trim());
          const sources = left.split('+').map(s => s.trim()).filter(Boolean);
          currentMerge = { sources, target: right, reason: '' };
        }
      } else if (line.toUpperCase().startsWith('REASON:') && currentMerge) {
        currentMerge.reason = line.split(':').slice(1).join(':').trim();
        suggestions.push(currentMerge);
        currentMerge = null;
      }
    }
    if (currentMerge) suggestions.push(currentMerge);

    if (!suggestions.length) {
      el.innerHTML = `<div class="ai-result"><p>${t('consolidation_none')}</p></div>`;
      return;
    }

    // Render actionable cards
    const cards = suggestions.map((s, i) => {
      const sourceBadges = s.sources.map(c => `<code>${escapeHtml(c)}</code>`).join(' + ');
      return `<div class="consolidation-card" id="mergeCard_${i}">
        <div class="consolidation-merge">${sourceBadges} → <code class="consolidation-target">${escapeHtml(s.target)}</code></div>
        ${s.reason ? `<div class="consolidation-reason">${escapeHtml(s.reason)}</div>` : ''}
        <div class="consolidation-actions">
          <button class="action-btn small" data-merge-idx="${i}">${t('consolidation_apply')}</button>
          <button class="action-btn small secondary" data-dismiss-idx="${i}">${t('consolidation_dismiss')}</button>
        </div>
      </div>`;
    }).join('');

    el.innerHTML = `<div class="ai-result"><h4>${t('codebook_consolidation_title')}</h4>${cards}</div>`;

    // Store suggestions for apply
    state._pendingMerges = suggestions;

    // Bind buttons
    el.querySelectorAll('[data-merge-idx]').forEach(btn => {
      btn.addEventListener('click', () => applyMerge(parseInt(btn.dataset.mergeIdx)));
    });
    el.querySelectorAll('[data-dismiss-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('mergeCard_' + btn.dataset.dismissIdx)?.remove();
      });
    });

  } catch (err) {
    el.innerHTML = `<div class="error-msg">${err.message}</div>`;
  }
}

function applyMerge(idx) {
  const merge = state._pendingMerges?.[idx];
  if (!merge) return;

  // Validate: check if any source codes still exist in codebook or records
  const liveSources = merge.sources.filter(c => state.codebook[c] || state.codedRecords.some(r => r.first_order_code === c));
  if (!liveSources.length) {
    // All source codes already merged/removed — mark as done
    const card = document.getElementById('mergeCard_' + idx);
    if (card) { card.classList.add('merge-applied'); card.querySelector('.consolidation-actions').innerHTML = `<span class="merge-done-badge">✓ ${t('consolidation_applied')}</span>`; }
    return;
  }

  pushUndo('merge');
  const targetCode = merge.target;
  const sourceType = merge.sources.map(c => state.codebook[c]?.type).find(t2 => t2) || 'descriptive';

  // Recode all records from source codes to target
  for (const record of state.codedRecords) {
    if (merge.sources.includes(record.first_order_code)) {
      record.notes = (record.notes || '') + ` [consolidated: ${record.first_order_code} → ${targetCode}]`;
      record.first_order_code = targetCode;
    }
  }

  // Remove source codes from codebook
  for (const src of merge.sources) {
    delete state.codebook[src];
  }

  // Update themes — replace source codes with target
  for (const [theme, codes] of Object.entries(state.themes)) {
    const replaced = codes.map(c => merge.sources.includes(c) ? targetCode : c);
    state.themes[theme] = [...new Set(replaced)];
  }

  // Register target code and recalc
  recalcAllFrequencies();
  saveSession();

  // Mark card as applied (visual feedback) before re-render destroys it
  const card = document.getElementById('mergeCard_' + idx);
  if (card) {
    card.classList.add('merge-applied');
    card.querySelector('.consolidation-actions').innerHTML = `<span class="merge-done-badge">✓ ${t('consolidation_applied')}</span>`;
  }

  // Preserve remaining consolidation HTML, re-render codebook, then restore
  const consEl = document.getElementById('consolidationResult');
  const savedHtml = consEl ? consEl.innerHTML : '';
  renderCodebookView();
  const newConsEl = document.getElementById('consolidationResult');
  if (newConsEl && savedHtml) {
    newConsEl.innerHTML = savedHtml;
    // Re-bind remaining apply/dismiss buttons
    newConsEl.querySelectorAll('[data-merge-idx]').forEach(btn => {
      btn.addEventListener('click', () => applyMerge(parseInt(btn.dataset.mergeIdx)));
    });
    newConsEl.querySelectorAll('[data-dismiss-idx]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('mergeCard_' + btn.dataset.dismissIdx)?.remove();
      });
    });
  }
}

// ─── AI generation (standalone — available in all modes, uses multi-pass) ───
async function generateThemesAI() {
  const apiKey = document.getElementById('apiKey').value;
  const elLocal = document.getElementById('aiThemesResult');
  if (currentProvider !== 'local' && !apiKey) {
    const msg = t('coding_no_api');
    showError(msg);
    if (elLocal) elLocal.innerHTML = `<div class="error-msg">${escapeHtml(msg)}</div>`;
    return;
  }

  const codes = Object.entries(state.codebook).filter(([, v]) => v.frequency > 0).sort((a, b) => b[1].frequency - a[1].frequency);
  if (codes.length < 3) {
    const msg = t('gen_themes_min');
    showError(msg);
    if (elLocal) elLocal.innerHTML = `<div class="error-msg">${escapeHtml(msg)}</div>`;
    return;
  }

  // Confirm overwrite if themes already exist
  if (Object.keys(state.themes).length > 0) {
    if (!safeConfirm(t('gen_themes_overwrite'))) return;
  }
  pushUndo('themes');

  const el = document.getElementById('aiThemesResult');

  try {
    // Pass 1
    if (el) el.innerHTML = `<div class="api-spinner-wrap"><span class="api-spinner"></span> ${t('auto_themes_pass1')}</div>`;
    abortController = new AbortController();
    const pass1Response = await callAIWithRetry(apiKey, getAutoThemesPrompt(state.codingLang, state.researchQuestion, codes), `Generate second-order themes from these ${codes.length} first-order codes.`, 3, { temperature: 0 });
    const pass1Themes = parseThemesResponse(pass1Response);
    if (!Object.keys(pass1Themes).length) { if (el) el.innerHTML = `<div class="error-msg">${t('gen_themes_fail')}</div>`; return; }

    // Pass 2: Critique
    if (el) el.innerHTML = `<div class="api-spinner-wrap"><span class="api-spinner"></span> ${t('auto_themes_pass2')}</div>`;
    abortController = new AbortController();
    const critiqueResponse = await callAIWithRetry(apiKey, getThemeCritiquePrompt(state.codingLang, state.researchQuestion, pass1Themes, codes), `Critique the proposed theme structure.`, 3, { temperature: 0 });

    if (critiqueResponse.toUpperCase().includes('PASS:')) {
      state.themes = pass1Themes;
      state._themeAuditTrail = { pass1: pass1Themes, critique: 'PASS', pass3: null };
    } else {
      // Pass 3: Revise
      if (el) el.innerHTML = `<div class="api-spinner-wrap"><span class="api-spinner"></span> ${t('auto_themes_pass3')}</div>`;
      abortController = new AbortController();
      const pass3Response = await callAIWithRetry(apiKey, getThemeRevisionPrompt(state.codingLang, state.researchQuestion, pass1Themes, critiqueResponse, codes), `Revise themes based on the critique.`, 3, { temperature: 0 });
      const pass3Themes = parseThemesResponse(pass3Response);
      state.themes = Object.keys(pass3Themes).length ? pass3Themes : pass1Themes;
      state._themeAuditTrail = { pass1: pass1Themes, critique: critiqueResponse, pass3: pass3Themes };
    }

    saveSession();
    if (currentView === 'codebook') renderCodebookView();
    else if (currentView === 'visualization') renderVisualizationView();
    const el2 = document.getElementById('aiThemesResult');
    if (el2) el2.innerHTML = `<div class="status-msg">${t('gen_themes_done')} ${Object.keys(state.themes).length}</div>`;
  } catch (err) {
    const elErr = document.getElementById('aiThemesResult');
    if (elErr) elErr.innerHTML = `<div class="error-msg">${err.message}</div>`;
  }
}

async function generateDimensionsAI() {
  const apiKey = document.getElementById('apiKey').value;
  const elLocal = document.getElementById('aiDimsResult');
  if (currentProvider !== 'local' && !apiKey) {
    const msg = t('coding_no_api');
    showError(msg);
    if (elLocal) elLocal.innerHTML = `<div class="error-msg">${escapeHtml(msg)}</div>`;
    return;
  }

  if (Object.keys(state.themes).length < 2) {
    const msg = t('gen_dims_min');
    showError(msg);
    if (elLocal) elLocal.innerHTML = `<div class="error-msg">${escapeHtml(msg)}</div>`;
    return;
  }

  // Confirm overwrite if dimensions already exist
  if (Object.keys(state.dimensions).length > 0) {
    if (!safeConfirm(t('gen_dims_overwrite'))) return;
  }
  pushUndo('dimensions');

  const el = document.getElementById('aiDimsResult');
  if (el) el.innerHTML = `<div class="api-spinner-wrap"><span class="api-spinner"></span> ${t('auto_dims_progress')}</div>`;

  try {
    abortController = new AbortController();
    const systemPrompt = getAutoDimensionsPrompt(state.codingLang, state.researchQuestion, state.themes, state.framework);
    const response = await callAIWithRetry(apiKey, systemPrompt, `Generate aggregate dimensions from these ${Object.keys(state.themes).length} themes.`, 3, { temperature: 0 });

    const newDims = parseDimensionsResponse(response);

    if (Object.keys(newDims).length) {
      saveSession();
      if (currentView === 'codebook') renderCodebookView();
      else if (currentView === 'visualization') renderVisualizationView();
      const el2 = document.getElementById('aiDimsResult');
      if (el2) el2.innerHTML = `<div class="status-msg">${t('gen_dims_done')} ${Object.keys(newDims).length}</div>`;
    } else {
      const elF = document.getElementById('aiDimsResult');
      if (elF) elF.innerHTML = `<div class="error-msg">${t('gen_dims_fail')}</div>`;
    }
  } catch (err) {
    const elErr = document.getElementById('aiDimsResult');
    if (elErr) elErr.innerHTML = `<div class="error-msg">${err.message}</div>`;
  }
}

// ─── Visualization view ───
function renderVisualizationView() {
  const panel = document.getElementById('view-visualization');
  const codes = state.codebook;
  const records = state.codedRecords;

  if (!records.length) { panel.innerHTML = `<div class="empty-state">${t('empty_data')}</div>`; return; }

  // Diagnostics
  const totalCoded = records.length;
  const totalCodes = Object.keys(codes).length;
  const singletons = Object.values(codes).filter(c => c.frequency === 1).length;
  const singletonPct = Math.round(singletons / totalCodes * 100);
  const overloaded = Object.entries(codes).filter(([, c]) => c.frequency > totalCoded * 0.15);

  let singletonStatus = 'ok', overloadStatus = 'ok';
  if (singletonPct > 25) singletonStatus = 'error';
  else if (singletonPct > 10) singletonStatus = 'warn';
  if (overloaded.length) overloadStatus = 'error';

  // Saturation
  let satHtml = '';
  if (totalCoded >= 10) {
    const before = new Set(records.slice(0, -10).map(r => r.first_order_code));
    const newLast10 = records.slice(-10).filter(r => !before.has(r.first_order_code)).length;
    satHtml = `<div class="diag-item diag-${newLast10 === 0 ? 'ok' : newLast10 <= 2 ? 'warn' : 'info'}">
      ${t('viz_saturation')} ${newLast10} ${t('viz_new_last10')}</div>`;
  }

  // Gioia table
  let gioiaHtml = `<div class="empty-state">
    <p>${t('viz_no_themes')}</p>
    ${totalCodes >= 3 ? `<button class="action-btn" onclick="generateThemesAI()"><i data-lucide="sparkles" class="icon-sm"></i> ${t('gen_themes_btn')}</button><div id="aiThemesResult"></div>` : ''}
  </div>`;
  if (Object.keys(state.themes).length) {
    let rows = '';
    if (Object.keys(state.dimensions).length) {
      for (const [dim, dimThemes] of Object.entries(state.dimensions)) {
        let first = true;
        for (const theme of dimThemes) {
          if (state.themes[theme]) {
            const codesStr = state.themes[theme].map(c =>
              codes[c]?.type === 'in_vivo' ? `<em>${escapeHtml(c)}</em>` : escapeHtml(c)
            ).join(', ');
            rows += `<tr><td>${codesStr}</td><td>${escapeHtml(theme)}</td><td>${first ? escapeHtml(dim) : ''}</td></tr>`;
            first = false;
          }
        }
      }
    } else {
      for (const [theme, tCodes] of Object.entries(state.themes)) {
        const codesStr = tCodes.map(c => codes[c]?.type === 'in_vivo' ? `<em>${escapeHtml(c)}</em>` : escapeHtml(c)).join(', ');
        rows += `<tr><td>${codesStr}</td><td>${escapeHtml(theme)}</td><td></td></tr>`;
      }
    }
    const noDims = !Object.keys(state.dimensions).length && Object.keys(state.themes).length >= 2;
    gioiaHtml = `<div class="gioia-table-wrap"><table class="gioia-table">
      <thead><tr><th>${t('gioia_col_codes')}</th><th>${t('gioia_col_themes')}</th><th>${t('gioia_col_dims')}</th></tr></thead>
      <tbody>${rows}</tbody></table></div>
      ${noDims ? `<div style="margin-top:0.75rem"><button class="action-btn" onclick="generateDimensionsAI()"><i data-lucide="sparkles" class="icon-sm"></i> ${t('gen_dims_btn')}</button><div id="aiDimsResult"></div></div>` : ''}`;
  }

  // Dimension groundings
  let groundingHtml = '';
  if (state._dimensionGroundings && Object.keys(state._dimensionGroundings).length) {
    const groundingCards = Object.entries(state._dimensionGroundings).map(([dim, g]) => {
      // Support both old format (string) and new format ({theory, author, text})
      const isRich = typeof g === 'object';
      const theory = isRich ? (g.theory || '') : '';
      const author = isRich ? (g.author || '') : '';
      const text = isRich ? (g.text || '') : (g || '');
      return `<div class="grounding-card">
        <div class="grounding-dim">${escapeHtml(dim)}</div>
        ${theory ? `<div class="grounding-theory"><span class="grounding-label">${t('grounding_theory')}:</span> ${escapeHtml(theory)}</div>` : ''}
        ${author ? `<div class="grounding-author"><span class="grounding-label">${t('grounding_author')}:</span> ${escapeHtml(author)}</div>` : ''}
        <div class="grounding-text">${escapeHtml(text)}</div>
        <div class="grounding-edit-row">
          <input type="text" class="grounding-edit-input" placeholder="${t('grounding_edit_placeholder')}" value="${escapeHtml(text)}"
                 onchange="updateGrounding('${dim.replace(/'/g, "\\'")}', this.value)">
        </div>
        <div class="grounding-verify">${t('grounding_verify_hint')}</div>
      </div>`;
    }).join('');
    groundingHtml = `<h3>${t('viz_grounding')}</h3>${groundingCards}`;
  }

  // Abduction stats
  let abductionHtml = '';
  if (state._abductionStats) {
    const s = state._abductionStats;
    abductionHtml = `<h3>${t('viz_abduction_stats')}</h3><div class="diag-grid">
      <div class="diag-item diag-${s.recoded > 0 ? 'warn' : 'ok'}">${t('viz_recoded')}: ${s.recoded}/${s.total}</div>
      <div class="diag-item diag-${s.orphans > 0 ? 'error' : 'ok'}">${t('viz_orphans')}: ${s.orphans}</div>
    </div>`;
  }

  // Drift warnings — actionable
  let driftHtml = '';
  if (state._driftWarnings && state._driftWarnings.length) {
    const driftCards = state._driftWarnings.map((w, wi) => {
      const driftDetails = w.drifts.map((d, di) => {
        // Support both old format (string) and new format ({line, type, suggestion})
        const dLine = typeof d === 'string' ? d : d.line;
        const dType = typeof d === 'object' ? (d.type || '') : '';
        const dSuggestion = typeof d === 'object' ? (d.suggestion || '') : '';
        // Parse DRIFT line: extract two segment groups and their codes
        // Format variants: DRIFT: [S01] (code: x) ↔ [S02] (code: y)
        //                  DRIFT: [S01] (code: x) ↔ [S02], [S03], [S04] (code: y)
        //                  DRIFT: [S01-S05] (code: x) ↔ [S06-S10] (code: y)
        const match = dLine.match(/DRIFT:\s*(.+?)\s*\(code:\s*([^)]+)\)\s*↔\s*(.+?)\s*\(code:\s*([^)]+)\)/i);
        if (match) {
          const [, seg1raw, code1, seg2raw, code2] = match;
          const seg1 = seg1raw.trim(), seg2 = seg2raw.trim();
          // Skip false positives — same code on both segments
          if (code1.trim() === code2.trim()) return '';
          // Resolve all segment IDs from each group (handles ranges, lists, brackets)
          const parseSegGroup = (raw) => {
            const parts = raw.split(',').map(s => s.trim()).filter(Boolean);
            return parts.flatMap(p => resolveSegIds(p));
          };
          const ids1 = parseSegGroup(seg1), ids2 = parseSegGroup(seg2);
          const r1 = state.codedRecords.find(r => ids1.includes(r.segment_id));
          const r2 = state.codedRecords.find(r => ids2.includes(r.segment_id));
          const typeBadge = dType ? `<span class="drift-type drift-type-${dType.toLowerCase()}">${escapeHtml(dType)}</span>` : '';
          const suggestionLine = dSuggestion ? `<div class="drift-suggestion">${escapeHtml(dSuggestion)}</div>` : '';
          // Recode buttons: recode seg1→code2, recode seg2→code1
          const s1safe = seg1.replace(/'/g, "\\'");
          const s2safe = seg2.replace(/'/g, "\\'");
          const c1safe = code1.replace(/'/g, "\\'");
          const c2safe = code2.replace(/'/g, "\\'");
          const recodeButtons = `<div class="drift-actions">
            <button class="action-btn small" onclick="recodeDrift('${s1safe}','${c2safe}',this)" title="${t('drift_recode_to')} ${escapeHtml(code2)}">${escapeHtml(seg1)} → ${escapeHtml(code2)}</button>
            <button class="action-btn small" onclick="recodeDrift('${s2safe}','${c1safe}',this)" title="${t('drift_recode_to')} ${escapeHtml(code1)}">${escapeHtml(seg2)} → ${escapeHtml(code1)}</button>
            <button class="action-btn small secondary" onclick="dismissDrift(this)">${t('drift_dismiss')}</button>
          </div>`;
          return `<div class="drift-detail" id="drift_${wi}_${di}">
            <div class="drift-pair">
              <div class="drift-seg"><span class="seg-id">${escapeHtml(seg1)}</span> <code>${escapeHtml(code1)}</code>
                ${r1 ? `<div class="drift-text">${escapeHtml(r1.text_primary.substring(0, 150))}${r1.text_primary.length > 150 ? '...' : ''}</div>` : ''}
              </div>
              <div class="drift-seg"><span class="seg-id">${escapeHtml(seg2)}</span> <code>${escapeHtml(code2)}</code>
                ${r2 ? `<div class="drift-text">${escapeHtml(r2.text_primary.substring(0, 150))}${r2.text_primary.length > 150 ? '...' : ''}</div>` : ''}
              </div>
            </div>
            ${typeBadge}${suggestionLine}
            ${recodeButtons}
          </div>`;
        }
        return `<div class="drift-detail">${escapeHtml(dLine)}</div>`;
      }).join('');
      // Count actual (non-empty) drift details after false-positive filtering
      const actualCount = (driftDetails.match(/<div class="drift-detail"/g) || []).length;
      if (!actualCount) return ''; // All were false positives
      return `<details class="drift-card">
        <summary class="diag-item diag-warn"><strong>${t('viz_drift_batch')} ${w.batch}:</strong> ${actualCount} ${t('drift_issues')}</summary>
        ${driftDetails}
      </details>`;
    }).join('');
    driftHtml = `<h3>${t('viz_drift_warnings')}</h3>${driftCards}`;
  }

  // Actionable diagnostics — links to codebook
  const singletonLink = singletons > 0 ? ` <button class="link-btn" onclick="showView('codebook')">${t('diag_go_codebook')}</button>` : '';
  const overloadLink = overloaded.length ? ` <button class="link-btn" onclick="showView('codebook')">${t('diag_go_codebook')}</button>` : '';

  panel.innerHTML = `
    <h3>${t('viz_diagnostics')}</h3>
    <div class="diag-grid">
      <div class="diag-item diag-${singletonStatus}">${t('viz_singletons')} ${singletons}/${totalCodes} (${singletonPct}%)${singletonStatus !== 'ok' ? singletonLink : ''}</div>
      <div class="diag-item diag-${overloadStatus}">${t('viz_overloaded')} ${overloaded.length}${overloaded.length ? ' — ' + overloaded.map(([c]) => escapeHtml(c)).join(', ') + overloadLink : ''}</div>
      ${satHtml}
    </div>
    ${abductionHtml}
    ${driftHtml}
    <h3>${t('viz_gioia')}</h3>
    ${gioiaHtml}
    ${groundingHtml}
    ${renderCodeDocMatrix()}
    ${renderCoOccurrenceMatrix()}
    <h3>${t('viz_freq')}</h3>
    <div class="code-bars">${Object.entries(codes).sort((a, b) => b[1].frequency - a[1].frequency).slice(0, 15).map(([c, i]) => {
      const w = Math.round(i.frequency / totalCoded * 100);
      return `<div class="bar-item"><div class="bar-name">${escapeHtml(c)}</div><div class="bar-row"><div class="bar-track"><div class="bar-fill" style="width:${Math.max(w, 2)}%"></div></div><span class="bar-count">${i.frequency}</span></div></div>`;
    }).join('')}</div>
  `;
  lucide.createIcons();
}

// ─── Code × Document matrix ───
function renderCodeDocMatrix() {
  const files = [...new Set(state.codedRecords.map(r => r.source_file).filter(Boolean))];
  if (files.length < 2) return ''; // only useful with multiple files

  const topCodes = Object.entries(state.codebook).sort((a, b) => b[1].frequency - a[1].frequency).slice(0, 20).map(([c]) => c);
  // Build matrix
  const matrix = {};
  for (const code of topCodes) { matrix[code] = {}; for (const f of files) matrix[code][f] = 0; }
  for (const r of state.codedRecords) {
    if (r.source_file && matrix[r.first_order_code]) matrix[r.first_order_code][r.source_file]++;
  }
  const maxVal = Math.max(1, ...Object.values(matrix).flatMap(row => Object.values(row)));

  // Numeric labels
  const codeLabels = {};
  topCodes.forEach((c, idx) => { codeLabels[c] = 'K' + (idx + 1); });
  const fileLabels = {};
  files.forEach((f, idx) => { fileLabels[f] = 'D' + (idx + 1); });

  const headerCells = files.map(f => `<th class="matrix-col-header-num" title="${escapeHtml(f)}">${fileLabels[f]}</th>`).join('');
  const rows = topCodes.map(code => {
    const cells = files.map(f => {
      const v = matrix[code][f];
      const intensity = v / maxVal;
      const bg = v ? `rgba(59,130,246,${0.15 + intensity * 0.7})` : '';
      return `<td class="matrix-cell" style="${bg ? 'background:' + bg : ''}" title="${escapeHtml(code)} × ${escapeHtml(f)}: ${v}">${v || ''}</td>`;
    }).join('');
    return `<tr><td class="matrix-row-label-num" title="${escapeHtml(code)}">${codeLabels[code]}</td>${cells}</tr>`;
  }).join('');

  const codeLegend = topCodes.map(c => `<div class="cooc-legend-item"><strong>${codeLabels[c]}</strong> — ${escapeHtml(c)}</div>`).join('');
  const fileLegend = files.map(f => `<div class="cooc-legend-item"><strong>${fileLabels[f]}</strong> — ${escapeHtml(f)}</div>`).join('');

  return `<h3>${t('viz_code_doc_matrix')}</h3>
    <div class="matrix-wrap"><table class="matrix-table">
      <thead><tr><th></th>${headerCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="cooc-legend">${fileLegend}</div>
    <div class="cooc-legend" style="margin-top:0.4rem">${codeLegend}</div>`;
}

// ─── Co-occurrence matrix (proximity-based) ───
function renderCoOccurrenceMatrix() {
  const topCodes = Object.entries(state.codebook).sort((a, b) => b[1].frequency - a[1].frequency).slice(0, 15).map(([c]) => c);
  if (topCodes.length < 3) return '';

  // Build adjacency: codes appearing within 2 segments of each other
  const cooccur = {};
  for (const c of topCodes) { cooccur[c] = {}; for (const c2 of topCodes) cooccur[c][c2] = 0; }

  for (let i = 0; i < state.codedRecords.length; i++) {
    const r1 = state.codedRecords[i];
    if (!topCodes.includes(r1.first_order_code)) continue;
    for (let j = i + 1; j < Math.min(i + 3, state.codedRecords.length); j++) {
      const r2 = state.codedRecords[j];
      if (!topCodes.includes(r2.first_order_code)) continue;
      if (r1.first_order_code !== r2.first_order_code) {
        cooccur[r1.first_order_code][r2.first_order_code]++;
        cooccur[r2.first_order_code][r1.first_order_code]++;
      }
    }
  }

  const maxVal = Math.max(1, ...topCodes.flatMap(c => topCodes.map(c2 => cooccur[c][c2])));
  // Numeric labels for column headers (K1, K2, ...)
  const codeLabels = {};
  topCodes.forEach((c, idx) => { codeLabels[c] = 'K' + (idx + 1); });

  const headerCells = topCodes.map(c => `<th class="matrix-col-header-num" title="${escapeHtml(c)}">${codeLabels[c]}</th>`).join('');
  const rows = topCodes.map(code => {
    const cells = topCodes.map(c2 => {
      if (code === c2) return '<td class="matrix-cell matrix-diag"></td>';
      const v = cooccur[code][c2];
      const intensity = v / maxVal;
      const bg = v ? `rgba(234,88,12,${0.15 + intensity * 0.7})` : '';
      return `<td class="matrix-cell" style="${bg ? 'background:' + bg : ''}" title="${escapeHtml(code)} ↔ ${escapeHtml(c2)}: ${v}">${v || ''}</td>`;
    }).join('');
    return `<tr><td class="matrix-row-label-num" title="${escapeHtml(code)}">${codeLabels[code]}</td>${cells}</tr>`;
  }).join('');

  const legend = topCodes.map(c => `<div class="cooc-legend-item"><strong>${codeLabels[c]}</strong> — ${escapeHtml(c)}</div>`).join('');

  return `<h3>${t('viz_cooccurrence')}</h3>
    <p class="matrix-hint">${t('viz_cooccurrence_hint')}</p>
    <div class="matrix-wrap"><table class="matrix-table">
      <thead><tr><th></th>${headerCells}</tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <div class="cooc-legend">${legend}</div>`;
}

// ─── Creative coding (visual drag-and-drop grouping) ───
function showCreativeCoding() {
  const overlay = document.createElement('div');
  overlay.id = 'creativeCodingOverlay';
  overlay.className = 'cc-overlay';

  const allCodes = Object.keys(state.codebook).sort();
  const assignedCodes = new Set(Object.values(state.themes).flat());
  const unassigned = allCodes.filter(c => !assignedCodes.has(c));

  const codeChips = (codes, draggable) => codes.map(c => {
    const color = state.codebook[c]?.color || '#6b7280';
    return `<div class="cc-chip" draggable="${draggable}" data-code="${escapeHtml(c)}" style="border-left:3px solid ${color}">${escapeHtml(c)} <span class="cc-chip-freq">(${state.codebook[c]?.frequency || 0})</span></div>`;
  }).join('');

  const themeColumns = Object.entries(state.themes).map(([name, codes]) => `
    <div class="cc-theme-col" data-theme="${escapeHtml(name)}">
      <div class="cc-theme-header">${escapeHtml(name)} <button class="tag-remove" onclick="ccRemoveTheme('${name.replace(/'/g, "\\'")}')" title="×">×</button></div>
      <div class="cc-drop-zone" data-theme="${escapeHtml(name)}">${codeChips(codes, true)}</div>
    </div>`).join('');

  overlay.innerHTML = `
    <div class="cc-modal">
      <div class="cc-header">
        <h3>${t('creative_coding_title')}</h3>
        <button class="action-btn secondary" onclick="closeCreativeCoding()">${t('creative_coding_close')}</button>
      </div>
      <div class="cc-body">
        <div class="cc-pool">
          <div class="cc-pool-header">${t('creative_coding_pool')} (${unassigned.length})</div>
          <div class="cc-drop-zone" data-theme="__pool__">${codeChips(unassigned, true)}</div>
        </div>
        <div class="cc-themes">
          ${themeColumns}
          <div class="cc-new-theme">
            <input type="text" id="ccNewTheme" placeholder="${t('theme_name_placeholder')}" onkeydown="if(event.key==='Enter')ccCreateTheme()">
            <button class="action-btn small" onclick="ccCreateTheme()">+</button>
          </div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  initCreativeCodingDrag();
}

function closeCreativeCoding() {
  document.getElementById('creativeCodingOverlay')?.remove();
  if (currentView === 'codebook') renderCodebookView();
}

function ccCreateTheme() {
  const input = document.getElementById('ccNewTheme');
  const name = input?.value.trim();
  if (!name || state.themes[name]) return;
  pushUndo('ccCreateTheme');
  state.themes[name] = [];
  saveSession();
  closeCreativeCoding();
  showCreativeCoding();
}

function ccRemoveTheme(name) {
  pushUndo('ccRemoveTheme');
  delete state.themes[name];
  saveSession();
  closeCreativeCoding();
  showCreativeCoding();
}

function initCreativeCodingDrag() {
  const overlay = document.getElementById('creativeCodingOverlay');
  if (!overlay) return;

  overlay.querySelectorAll('.cc-chip').forEach(chip => {
    chip.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', chip.dataset.code);
      chip.classList.add('cc-dragging');
    });
    chip.addEventListener('dragend', () => chip.classList.remove('cc-dragging'));
  });

  overlay.querySelectorAll('.cc-drop-zone').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('cc-drop-hover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('cc-drop-hover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('cc-drop-hover');
      const code = e.dataTransfer.getData('text/plain');
      const targetTheme = zone.dataset.theme;
      if (!code) return;

      pushUndo('ccDrop');
      // Remove from all themes first
      for (const [t2, codes] of Object.entries(state.themes)) {
        state.themes[t2] = codes.filter(c => c !== code);
      }
      // Add to target theme (unless pool)
      if (targetTheme !== '__pool__' && state.themes[targetTheme]) {
        state.themes[targetTheme].push(code);
      }
      saveSession();
      closeCreativeCoding();
      showCreativeCoding();
    });
  });
}

// ─── Export view ───
function renderExportView() {
  const panel = document.getElementById('view-export');
  if (!state.codedRecords.length) { panel.innerHTML = `<div class="empty-state">${t('empty_export')}</div>`; return; }

  panel.innerHTML = `
    <h3>${t('export_title')}</h3>
    <div class="export-buttons">
      <button class="export-btn" onclick="exportJSON()"><i data-lucide="braces" class="icon-sm"></i> ${t('export_json')}</button>
      <button class="export-btn" onclick="exportCSV()"><i data-lucide="table" class="icon-sm"></i> ${t('export_csv')}</button>
      <button class="export-btn" onclick="exportGioia()"><i data-lucide="layout-grid" class="icon-sm"></i> ${t('export_gioia')}</button>
      <button class="export-btn" onclick="exportReport()"><i data-lucide="file-text" class="icon-sm"></i> ${t('export_report')}</button>
      <button class="export-btn" onclick="exportREFI_QDA()"><i data-lucide="package" class="icon-sm"></i> ${t('export_refi')}</button>
      <button class="export-btn" onclick="exportVisualizationHTML()"><i data-lucide="layout-dashboard" class="icon-sm"></i> ${t('export_viz_html')}</button>
      <button class="export-btn" onclick="exportGioiaSVG()" ${!Object.keys(state.themes).length ? 'disabled' : ''}><i data-lucide="image" class="icon-sm"></i> ${t('export_gioia_svg')}</button>
    </div>
    <div id="exportPreview"></div>
  `;
  lucide.createIcons();
}

// ─── Session persistence ───
function saveSession() {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem('coding_tool_session', json);
    // Warn if approaching localStorage limit (~5MB)
    if (json.length > 4 * 1024 * 1024) {
      console.warn('Session data exceeds 4MB — consider exporting a backup (JSON).');
    }
  } catch (e) {
    showError(t('save_quota_error'));
    console.error('localStorage quota exceeded:', e);
  }
}

function loadSession() {
  try {
    const saved = localStorage.getItem('coding_tool_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.assign(state, parsed);
      return true;
    }
  } catch (e) { /* corrupt */ }
  return false;
}

// ─── Helpers ───
// escapeHtml() defined in export.js (loaded before app.js)

// ─── Status / Error ───
function showStatus(msg) {
  const el = document.getElementById('statusMsg');
  if (el) { el.className = 'status-msg'; el.textContent = msg; el.style.display = 'block'; }
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  if (el) {
    el.textContent = msg;
    el.classList.add('visible');
    el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => el.classList.remove('visible'), 5000);
  }
}

// ─── Init ───
(function init() {
  if (loadSession() && state.configured) {
    const bar = document.getElementById('sessionBar');
    if (bar) bar.style.display = '';
  }
})();

function restoreSession() {
  document.getElementById('sessionBar').style.display = 'none';
  // Populate setup form from restored state
  if (state.configured) {
    const coderEl = document.getElementById('coderId');
    if (coderEl) coderEl.value = state.coderId || '';
    const langEl = document.getElementById('codingLang');
    if (langEl) langEl.value = state.codingLang || 'pl';
    const threshEl = document.getElementById('thresholdN');
    if (threshEl) threshEl.value = state.thresholdN || 20;
    const batchEl = document.getElementById('batchSize');
    if (batchEl) batchEl.value = state.batchSize || 10;
    const rqEl = document.getElementById('researchQuestion');
    if (rqEl) rqEl.value = state.researchQuestion || '';
    const fwEl = document.getElementById('framework');
    if (fwEl) fwEl.value = state.framework || '';
    const srcEl = document.getElementById('sourceType');
    if (srcEl) srcEl.value = state.sourceType || 'interview';
    const guidedEl = document.getElementById('guidedMode');
    if (guidedEl) guidedEl.checked = !!state.guidedMode;
    const modeRadio = document.querySelector(`input[name="codingMode"][value="${state.codingMode}"]`);
    if (modeRadio) modeRadio.checked = true;
  }
  showView(state.configured ? 'coding' : 'setup');
}

function dismissSession() {
  document.getElementById('sessionBar').style.display = 'none';
  state = { configured: false, sourceType: null, codingMode: 'inductive', guidedMode: false, codingLang: 'pl', coderId: '', thresholdN: 20, batchSize: 10, researchQuestion: '', framework: '', segments: [], currentIdx: 0, codedRecords: [], codebook: {}, themes: {}, dimensions: {}, _themeAuditTrail: null, _abductionStats: null, _driftWarnings: [], _dimensionGroundings: {}, memos: {}, projectMemo: '' };
  localStorage.removeItem('coding_tool_session');
}

function resetSession() {
  if (!safeConfirm(t('reset_confirm'))) return;
  dismissSession();
  undoStack.length = 0;
  // Clear form fields
  const fields = { coderId: '', researchQuestion: '', framework: '', importText: '' };
  for (const [id, val] of Object.entries(fields)) {
    const el = document.getElementById(id);
    if (el) el.value = val;
  }
  const guidedEl = document.getElementById('guidedMode');
  if (guidedEl) guidedEl.checked = false;
  const modeRadio = document.querySelector('input[name="codingMode"][value="inductive"]');
  if (modeRadio) modeRadio.checked = true;
  const previewEl = document.getElementById('previewArea');
  if (previewEl) previewEl.innerHTML = '';
  const fileListEl = document.getElementById('fileList');
  if (fileListEl) { fileListEl.innerHTML = ''; fileListEl.style.display = 'none'; }
  pendingFiles = [];
  showView('setup');
  showStatus(t('reset_done'));
}
