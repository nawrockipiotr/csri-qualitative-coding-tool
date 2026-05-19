// ─── Qualitative Coding Tool v0.1 — App Logic ───

const TOOL_VERSION = 'v0.1';

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
  researchQuestion: '',
  framework: '',
  segments: [],
  currentIdx: 0,
  codedRecords: [],
  codebook: {},
  themes: {},
  dimensions: {},
};

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

  state.segments = segments;
  renderPreview();
}

function renderPreview() {
  const el = document.getElementById('previewArea');
  if (!state.segments.length) { el.innerHTML = ''; return; }
  const preview = state.segments.slice(0, 5).map(s => {
    const speaker = s.author ? `<strong>${escapeHtml(s.author)}:</strong> ` : '';
    const raw = s.text_primary.length > 200 ? s.text_primary.substring(0, 200) + '...' : s.text_primary;
    const text = escapeHtml(raw);
    return `<div class="preview-segment"><span class="seg-id">${s.segment_id}</span> ${speaker}${text}</div>`;
  }).join('');
  el.innerHTML = `<div class="preview-header">${t('parse_preview')} (${Math.min(5, state.segments.length)} ${t('parse_of')} ${state.segments.length}):</div>${preview}`;
}

function confirmSetup() {
  if (!state.segments.length) { showError(t('err_no_data')); return; }
  const coderId = document.getElementById('coderId').value.trim();
  if (!coderId) { showError(t('err_no_coder')); return; }

  state.coderId = coderId;
  state.codingMode = document.querySelector('input[name="codingMode"]:checked')?.value || 'inductive';
  state.guidedMode = document.getElementById('guidedMode').checked;
  state.codingLang = document.getElementById('codingLang').value;
  state.thresholdN = parseInt(document.getElementById('thresholdN').value) || 20;
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
  const alreadyCoded = state.codedRecords.some(r => r.segment_id === seg.segment_id);

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
    </div>
    ${guidedHtml}
    <div class="segment-display">
      <div class="segment-meta">
        <span class="seg-id">${seg.segment_id}</span>
        ${seg.author ? `<span class="seg-author">${escapeHtml(seg.author)}</span>` : ''}
      </div>
      <div class="segment-text">${escapeHtml(seg.text_primary)}</div>
    </div>
    ${modeHtml}
    <div class="recent-codes" id="recentCodes"></div>
  `;
  lucide.createIcons();
  renderRecentCodes();
}

function renderInductiveUI(seg) {
  const codes = Object.keys(state.codebook).sort();
  const datalist = codes.map(c => `<option value="${c}">`).join('');
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
  const datalist = codes.map(c => `<option value="${c}">`).join('');
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
    const userPrompt = `Fragment: ${seg.text_primary}\nKod badacza: ${code}`;
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
        <div class="counter-col"><div class="counter-label">${t('coding_your_code')}</div><div class="counter-code">${code}</div></div>
        <div class="counter-col"><div class="counter-label">${t('coding_ai_proposal')}</div><div class="counter-code">${proposedCode || response}</div>
          ${justification ? `<div class="counter-reason">${justification}</div>` : ''}</div>
      </div>
      <div class="decision-row">
        <label><input type="radio" name="decision" value="researcher" checked> ${t('coding_decision_mine')}</label>
        <label><input type="radio" name="decision" value="tool"> ${t('coding_decision_ai')}</label>
        <label><input type="radio" name="decision" value="modified"> ${t('coding_decision_new')}</label>
        <input type="text" id="modifiedCode" placeholder="${t('coding_modified_placeholder')}" style="display:none">
      </div>
      <input type="text" id="codeNotes" placeholder="${t('coding_note')}">
      <button class="action-btn" onclick="saveCounterDecision('${code.replace(/'/g, "\\'")}', '${(proposedCode || '').replace(/'/g, "\\'")}')"> ${t('coding_save_decision')}</button>
    `;

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
    const response = await callAIWithRetry(apiKey, systemPrompt, `Fragment: ${seg.text_primary}`);

    let proposedCode = '', proposedType = 'descriptive', justification = '';
    for (const line of response.split('\n')) {
      if (line.toUpperCase().startsWith('CODE:') || line.toUpperCase().startsWith('KOD:'))
        proposedCode = line.split(':').slice(1).join(':').trim();
      if (line.toUpperCase().startsWith('TYPE:') || line.toUpperCase().startsWith('TYP:')) {
        const t = line.split(':').slice(1).join(':').trim().toLowerCase();
        if (['descriptive', 'in_vivo', 'process'].includes(t)) proposedType = t;
      }
      if (line.toUpperCase().startsWith('JUSTIFICATION:') || line.toUpperCase().startsWith('UZASADNIENIE:'))
        justification = line.split(':').slice(1).join(':').trim();
    }

    resultEl.innerHTML = `
      <div class="assisted-proposal">
        <div class="counter-label">${t('coding_ai_proposal')}</div>
        <div class="counter-code">${proposedCode || response}</div>
        ${justification ? `<div class="counter-reason">${justification}</div>` : ''}
      </div>
      <div class="decision-row">
        <label><input type="radio" name="aDecision" value="tool" checked> ${t('coding_decision_accept')}</label>
        <label><input type="radio" name="aDecision" value="modified"> ${t('coding_decision_modify')}</label>
        <label><input type="radio" name="aDecision" value="researcher"> ${t('coding_decision_reject')}</label>
      </div>
      <input type="text" id="altCode" placeholder="${t('coding_alt_placeholder')}" style="display:none">
      <input type="text" id="codeNotes" placeholder="${t('coding_note')}">
      <button class="action-btn" onclick="saveAssistedDecision('${(proposedCode || '').replace(/'/g, "\\'")}', '${proposedType}')">${t('coding_save_short')}</button>
    `;

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
  const uncoded = state.segments.filter(s => !state.codedRecords.some(r => r.segment_id === s.segment_id));

  let content = '';

  if (coded === 0 && !autoRunning) {
    // Not started yet — auto-start
    content = `
      <div class="auto-start-panel">
        <div class="api-spinner-wrap"><span class="api-spinner"></span> ${t('auto_progress')}</div>
      </div>`;
    setTimeout(() => runAutoCoding(), 100);
  } else if (uncoded.length > 0) {
    // Partially done — offer to continue
    content = `
      <div class="auto-start-panel">
        <p>${t('auto_done').replace('.', '')} — ${coded}/${total} (${pct}%).</p>
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
    <div id="autoReviewArea"></div>
  `;
  lucide.createIcons();
}

async function runAutoCoding() {
  const apiKey = document.getElementById('apiKey').value;
  if (currentProvider !== 'local' && !apiKey) { showError(t('coding_no_api')); autoRunning = false; return; }

  autoCancelled = false;
  autoRunning = true;
  const uncoded = state.segments.filter(s => !state.codedRecords.some(r => r.segment_id === s.segment_id));
  if (!uncoded.length) { autoRunning = false; renderCodingView(); return; }

  // Clear previous auto-generated themes/dimensions before regenerating
  state.themes = {};
  state.dimensions = {};

  const statusEl = document.getElementById('autoStatus');
  const panel = document.getElementById('view-coding');

  // Show progress UI with cancel button
  statusEl.innerHTML = `
    <div class="auto-progress-bar">
      <div class="api-spinner-wrap"><span class="api-spinner"></span> <span id="autoProgressText">${t('auto_progress')} 0/${uncoded.length}</span></div>
      <button class="action-btn secondary" onclick="autoCancelled=true">${t('auto_cancel')}</button>
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
      const response = await callAIWithRetry(apiKey, systemPrompt, `Fragment: ${seg.text_primary}`);

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
      if ((i + 1) % 10 === 0) saveSession(); // batch persist every 10
    } catch (err) {
      if (err.name === 'AbortError' || autoCancelled) break;
      console.error(`Auto-coding error on ${seg.segment_id}:`, err.message);
      // Skip this segment and continue
    }
  }
  saveSession(); // final persist

  if (autoCancelled) { autoRunning = false; renderCodingView(); return; }

  // Phase 2: Generate themes
  await autoGenerateThemes(apiKey);
  if (autoCancelled) { autoRunning = false; renderCodingView(); return; }

  // Phase 3: Generate dimensions
  await autoGenerateDimensions(apiKey);

  // Phase 4: Show results — switch to visualization
  autoRunning = false;
  saveSession();
  showView('visualization');
}

async function autoGenerateThemes(apiKey) {
  const statusEl = document.getElementById('autoStatus');
  if (statusEl) statusEl.innerHTML = `
    <div class="auto-progress-bar">
      <div class="api-spinner-wrap"><span class="api-spinner"></span> <span>${t('auto_themes_progress')}</span></div>
      <button class="action-btn secondary" onclick="autoCancelled=true">${t('auto_cancel')}</button>
    </div>`;

  try {
    abortController = new AbortController();
    const codes = Object.entries(state.codebook).filter(([, v]) => v.frequency > 0).sort((a, b) => b[1].frequency - a[1].frequency);
    const systemPrompt = getAutoThemesPrompt(state.codingLang, state.researchQuestion, codes);
    const response = await callAIWithRetry(apiKey, systemPrompt, `Generate second-order themes from these ${codes.length} first-order codes.`);

    // Parse THEME: / CODES: pairs
    const lines = response.split('\n');
    let currentTheme = '';
    for (const line of lines) {
      if (line.toUpperCase().startsWith('THEME:') || line.toUpperCase().startsWith('TEMAT:')) {
        currentTheme = line.split(':').slice(1).join(':').trim();
      } else if ((line.toUpperCase().startsWith('CODES:') || line.toUpperCase().startsWith('KODY:')) && currentTheme) {
        const allCodeNames = Object.keys(state.codebook);
        const themeCodes = line.split(':').slice(1).join(':').split(',').map(c => c.trim()).map(c => {
          if (state.codebook[c]) return c;
          // Fuzzy: find closest match (case-insensitive, trimmed)
          return allCodeNames.find(k => k.toLowerCase() === c.toLowerCase()) || null;
        }).filter(Boolean);
        if (themeCodes.length) {
          state.themes[currentTheme] = themeCodes;
        }
        currentTheme = '';
      }
    }
  } catch (err) {
    console.error('Auto themes error:', err.message);
  }
}

async function autoGenerateDimensions(apiKey) {
  if (!Object.keys(state.themes).length) return;

  const statusEl = document.getElementById('autoStatus');
  if (statusEl) statusEl.innerHTML = `
    <div class="auto-progress-bar">
      <div class="api-spinner-wrap"><span class="api-spinner"></span> <span>${t('auto_dims_progress')}</span></div>
      <button class="action-btn secondary" onclick="autoCancelled=true">${t('auto_cancel')}</button>
    </div>`;

  try {
    abortController = new AbortController();
    const systemPrompt = getAutoDimensionsPrompt(state.codingLang, state.researchQuestion, state.themes);
    const response = await callAIWithRetry(apiKey, systemPrompt, `Generate aggregate dimensions from these ${Object.keys(state.themes).length} themes.`);

    const lines = response.split('\n');
    let currentDim = '';
    for (const line of lines) {
      if (line.toUpperCase().startsWith('DIMENSION:') || line.toUpperCase().startsWith('WYMIAR:')) {
        currentDim = line.split(':').slice(1).join(':').trim();
      } else if ((line.toUpperCase().startsWith('THEMES:') || line.toUpperCase().startsWith('TEMATY:')) && currentDim) {
        const allThemeNames = Object.keys(state.themes);
        const dimThemes = line.split(':').slice(1).join(':').split(',').map(th => th.trim()).map(th => {
          if (state.themes[th]) return th;
          return allThemeNames.find(k => k.toLowerCase() === th.toLowerCase()) || null;
        }).filter(Boolean);
        if (dimThemes.length) {
          state.dimensions[currentDim] = dimThemes;
        }
        currentDim = '';
      }
    }
  } catch (err) {
    console.error('Auto dimensions error:', err.message);
  }
}

function renderAutoReview() {
  const records = state.codedRecords.filter(r => r.coding_mode === 'auto');
  if (!records.length) return '';

  const rows = records.map((r, idx) => {
    const textPreview = r.text_primary.length > 120 ? r.text_primary.substring(0, 120) + '...' : r.text_primary;
    return `<tr>
      <td class="seg-id">${r.segment_id}</td>
      <td>${escapeHtml(textPreview)}</td>
      <td><code>${escapeHtml(r.first_order_code)}</code></td>
      <td>${r.code_type}</td>
      <td class="auto-notes">${escapeHtml(r.notes || '')}</td>
      <td><button class="action-btn small" onclick="editAutoCode('${r.segment_id}', event)">${t('auto_edit')}</button></td>
    </tr>`;
  }).join('');

  return `
    <div class="auto-review">
      <h3>${t('auto_review_title')} (${records.length})</h3>
      <table class="auto-review-table">
        <thead><tr><th>ID</th><th>${t('auto_col_text')}</th><th>${t('auto_col_code')}</th><th>${t('auto_col_type')}</th><th>${t('auto_col_justification')}</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
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
  btnCell.innerHTML = `
    <button class="action-btn small" onclick="saveAutoEdit('${segId}')">${t('auto_save_edit')}</button>
    <button class="action-btn small secondary" onclick="renderCodingView()">${t('auto_cancel_edit')}</button>`;
}

function saveAutoEdit(segId) {
  const newCode = document.getElementById(`editCode_${segId}`)?.value.trim();
  const newType = document.getElementById(`editType_${segId}`)?.value || 'descriptive';
  if (!newCode) return;

  const record = state.codedRecords.find(r => r.segment_id === segId);
  if (!record) return;

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
    state.codebook[code] = { definition: '', type: type || 'descriptive', frequency: 1, created: new Date().toISOString() };
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
    recent.map(r => `<span class="recent-item">${r.segment_id}: <code>${r.first_order_code}</code></span>`).join('');
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
    <table class="code-table">
      <thead><tr><th>${t('codebook_code')}</th><th>${t('codebook_type')}</th><th>${t('codebook_freq')}</th><th>${t('codebook_def')}</th></tr></thead>
      <tbody>${codes.map(([code, info]) => `
        <tr>
          <td><code>${escapeHtml(code)}</code></td>
          <td>${info.type}</td>
          <td>${info.frequency}</td>
          <td><input type="text" class="def-input" value="${escapeHtml(info.definition || '')}" onchange="updateDefinition('${code.replace(/'/g, "\\'")}', this.value)"></td>
        </tr>`).join('')}
      </tbody>
    </table>
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
  `;
}

function updateDefinition(code, def) {
  if (state.codebook[code]) { state.codebook[code].definition = def; saveSession(); }
}

// ─── Theme / Dimension CRUD ───
function createTheme() {
  const name = document.getElementById('newThemeName')?.value.trim();
  if (!name || state.themes[name]) return;
  state.themes[name] = [];
  saveSession();
  renderCodebookView();
}

function removeTheme(name) {
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
  state.themes[theme] = state.themes[theme].filter(c => c !== code);
  saveSession();
  renderCodebookView();
}

function createDimension() {
  const name = document.getElementById('newDimName')?.value.trim();
  if (!name || state.dimensions[name]) return;
  state.dimensions[name] = [];
  saveSession();
  renderCodebookView();
}

function removeDimension(name) {
  delete state.dimensions[name];
  saveSession();
  renderCodebookView();
}

function addThemeToDimension(dim, theme) {
  if (!theme || !state.dimensions[dim]) return;
  for (const [d2, themes] of Object.entries(state.dimensions)) {
    state.dimensions[d2] = themes.filter(t2 => t2 !== theme);
  }
  state.dimensions[dim].push(theme);
  saveSession();
  renderCodebookView();
}

function removeThemeFromDimension(dim, theme) {
  if (!state.dimensions[dim]) return;
  state.dimensions[dim] = state.dimensions[dim].filter(t2 => t2 !== theme);
  saveSession();
  renderCodebookView();
}

async function suggestConsolidation() {
  const apiKey = document.getElementById('apiKey').value;
  if (currentProvider !== 'local' && !apiKey) { showError(t('coding_no_api')); return; }

  const el = document.getElementById('consolidationResult');
  el.innerHTML = `<div class="api-spinner-wrap"><span class="api-spinner"></span> ${t('codebook_analyzing')}</div>`;

  const codeList = Object.entries(state.codebook)
    .sort((a, b) => b[1].frequency - a[1].frequency)
    .map(([c, i]) => `- ${c} (${i.frequency}×)`).join('\n');

  try {
    abortController = new AbortController();
    const response = await callAIWithRetry(apiKey, getConsolidationSuggestionsPrompt(), `Lista kodów:\n${codeList}`);
    el.innerHTML = `<div class="ai-result"><h4>${t('codebook_consolidation_title')}</h4><pre>${response}</pre></div>`;
  } catch (err) {
    el.innerHTML = `<div class="error-msg">${err.message}</div>`;
  }
}

// ─── AI generation (standalone — available in all modes) ───
async function generateThemesAI() {
  const apiKey = document.getElementById('apiKey').value;
  if (currentProvider !== 'local' && !apiKey) { showError(t('coding_no_api')); return; }

  const codes = Object.entries(state.codebook).filter(([, v]) => v.frequency > 0).sort((a, b) => b[1].frequency - a[1].frequency);
  if (codes.length < 3) { showError(t('gen_themes_min')); return; }

  const el = document.getElementById('aiThemesResult');
  if (el) el.innerHTML = `<div class="api-spinner-wrap"><span class="api-spinner"></span> ${t('auto_themes_progress')}</div>`;

  try {
    abortController = new AbortController();
    const systemPrompt = getAutoThemesPrompt(state.codingLang, state.researchQuestion, codes);
    const response = await callAIWithRetry(apiKey, systemPrompt, `Generate second-order themes from these ${codes.length} first-order codes.`);

    // Parse THEME: / CODES: pairs
    const lines = response.split('\n');
    let currentTheme = '';
    const newThemes = {};
    for (const line of lines) {
      if (line.toUpperCase().startsWith('THEME:') || line.toUpperCase().startsWith('TEMAT:')) {
        currentTheme = line.split(':').slice(1).join(':').trim();
      } else if ((line.toUpperCase().startsWith('CODES:') || line.toUpperCase().startsWith('KODY:')) && currentTheme) {
        const allCodeNames = Object.keys(state.codebook);
        const themeCodes = line.split(':').slice(1).join(':').split(',').map(c => c.trim()).map(c => {
          if (state.codebook[c]) return c;
          return allCodeNames.find(k => k.toLowerCase() === c.toLowerCase()) || null;
        }).filter(Boolean);
        if (themeCodes.length) newThemes[currentTheme] = themeCodes;
        currentTheme = '';
      }
    }

    if (Object.keys(newThemes).length) {
      state.themes = newThemes;
      saveSession();
      if (currentView === 'codebook') renderCodebookView();
      else if (currentView === 'visualization') renderVisualizationView();
      if (el) el.innerHTML = `<div class="status-msg">${t('gen_themes_done')} ${Object.keys(newThemes).length}</div>`;
    } else {
      if (el) el.innerHTML = `<div class="error-msg">${t('gen_themes_fail')}</div>`;
    }
  } catch (err) {
    if (el) el.innerHTML = `<div class="error-msg">${err.message}</div>`;
  }
}

async function generateDimensionsAI() {
  const apiKey = document.getElementById('apiKey').value;
  if (currentProvider !== 'local' && !apiKey) { showError(t('coding_no_api')); return; }

  if (Object.keys(state.themes).length < 2) { showError(t('gen_dims_min')); return; }

  const el = document.getElementById('aiDimsResult');
  if (el) el.innerHTML = `<div class="api-spinner-wrap"><span class="api-spinner"></span> ${t('auto_dims_progress')}</div>`;

  try {
    abortController = new AbortController();
    const systemPrompt = getAutoDimensionsPrompt(state.codingLang, state.researchQuestion, state.themes);
    const response = await callAIWithRetry(apiKey, systemPrompt, `Generate aggregate dimensions from these ${Object.keys(state.themes).length} themes.`);

    const lines = response.split('\n');
    let currentDim = '';
    const newDims = {};
    for (const line of lines) {
      if (line.toUpperCase().startsWith('DIMENSION:') || line.toUpperCase().startsWith('WYMIAR:')) {
        currentDim = line.split(':').slice(1).join(':').trim();
      } else if ((line.toUpperCase().startsWith('THEMES:') || line.toUpperCase().startsWith('TEMATY:')) && currentDim) {
        const allThemeNames = Object.keys(state.themes);
        const dimThemes = line.split(':').slice(1).join(':').split(',').map(th => th.trim()).map(th => {
          if (state.themes[th]) return th;
          return allThemeNames.find(k => k.toLowerCase() === th.toLowerCase()) || null;
        }).filter(Boolean);
        if (dimThemes.length) newDims[currentDim] = dimThemes;
        currentDim = '';
      }
    }

    if (Object.keys(newDims).length) {
      state.dimensions = newDims;
      saveSession();
      if (currentView === 'codebook') renderCodebookView();
      else if (currentView === 'visualization') renderVisualizationView();
      if (el) el.innerHTML = `<div class="status-msg">${t('gen_dims_done')} ${Object.keys(newDims).length}</div>`;
    } else {
      if (el) el.innerHTML = `<div class="error-msg">${t('gen_dims_fail')}</div>`;
    }
  } catch (err) {
    if (el) el.innerHTML = `<div class="error-msg">${err.message}</div>`;
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
              codes[c]?.type === 'in_vivo' ? `<em>${c}</em>` : c
            ).join(', ');
            rows += `<tr><td>${codesStr}</td><td>${theme}</td><td>${first ? dim : ''}</td></tr>`;
            first = false;
          }
        }
      }
    } else {
      for (const [theme, tCodes] of Object.entries(state.themes)) {
        const codesStr = tCodes.map(c => codes[c]?.type === 'in_vivo' ? `<em>${c}</em>` : c).join(', ');
        rows += `<tr><td>${codesStr}</td><td>${theme}</td><td></td></tr>`;
      }
    }
    const noDims = !Object.keys(state.dimensions).length && Object.keys(state.themes).length >= 2;
    gioiaHtml = `<table class="gioia-table">
      <thead><tr><th>First-Order Concepts</th><th>Second-Order Themes</th><th>Aggregate Dimensions</th></tr></thead>
      <tbody>${rows}</tbody></table>
      ${noDims ? `<div style="margin-top:0.75rem"><button class="action-btn" onclick="generateDimensionsAI()"><i data-lucide="sparkles" class="icon-sm"></i> ${t('gen_dims_btn')}</button><div id="aiDimsResult"></div></div>` : ''}`;
  }

  panel.innerHTML = `
    <h3>${t('viz_diagnostics')}</h3>
    <div class="diag-grid">
      <div class="diag-item diag-${singletonStatus}">${t('viz_singletons')} ${singletons}/${totalCodes} (${singletonPct}%)</div>
      <div class="diag-item diag-${overloadStatus}">${t('viz_overloaded')} ${overloaded.length}${overloaded.length ? ' — ' + overloaded.map(([c]) => c).join(', ') : ''}</div>
      ${satHtml}
    </div>
    <h3>${t('viz_gioia')}</h3>
    ${gioiaHtml}
    <h3>${t('viz_freq')}</h3>
    <div class="code-bars">${Object.entries(codes).sort((a, b) => b[1].frequency - a[1].frequency).slice(0, 15).map(([c, i]) => {
      const w = Math.round(i.frequency / totalCoded * 100);
      return `<div class="bar-row"><span class="bar-label">${c}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(w, 2)}%"></div></div><span class="bar-count">${i.frequency}</span></div>`;
    }).join('')}</div>
  `;
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
    </div>
    <div id="exportPreview"></div>
  `;
  lucide.createIcons();
}

// ─── Session persistence ───
function saveSession() {
  try { localStorage.setItem('coding_tool_session', JSON.stringify(state)); } catch (e) { /* quota */ }
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
function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

// ─── Status / Error ───
function showStatus(msg) {
  const el = document.getElementById('statusMsg');
  if (el) { el.className = 'status-msg'; el.textContent = msg; el.style.display = 'block'; }
}

function showError(msg) {
  const el = document.getElementById('errorMsg');
  if (el) { el.textContent = msg; el.classList.add('visible'); setTimeout(() => el.classList.remove('visible'), 5000); }
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
  state = { configured: false, sourceType: null, codingMode: 'inductive', guidedMode: false, codingLang: 'pl', coderId: '', thresholdN: 20, researchQuestion: '', framework: '', segments: [], currentIdx: 0, codedRecords: [], codebook: {}, themes: {}, dimensions: {} };
  localStorage.removeItem('coding_tool_session');
}
