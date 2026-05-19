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
  document.getElementById('view-' + view).style.display = '';
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
    const speaker = s.author ? `<strong>${s.author}:</strong> ` : '';
    const text = s.text_primary.length > 200 ? s.text_primary.substring(0, 200) + '...' : s.text_primary;
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
        ${seg.author ? `<span class="seg-author">${seg.author}</span>` : ''}
      </div>
      <div class="segment-text">${seg.text_primary}</div>
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

// ─── Record management ───
function saveRecord(record) {
  // Remove previous coding of same segment (re-code)
  state.codedRecords = state.codedRecords.filter(r => r.segment_id !== record.segment_id);
  state.codedRecords.push(record);
  registerCode(record.first_order_code, record.code_type);
  saveSession();
}

function registerCode(code, type) {
  if (state.codebook[code]) {
    state.codebook[code].frequency = state.codedRecords.filter(r => r.first_order_code === code).length;
  } else {
    state.codebook[code] = { definition: '', type: type || 'descriptive', frequency: 1, created: new Date().toISOString() };
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

  let themeHtml = '';
  if (Object.keys(state.themes).length) {
    themeHtml = `<h3>${t('codebook_themes_title')}</h3>` + Object.entries(state.themes).map(([name, tCodes]) =>
      `<div class="theme-item"><strong>${name}</strong>: ${tCodes.map(c => `<code>${c}</code>`).join(', ')}</div>`
    ).join('');
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
          <td><code>${code}</code></td>
          <td>${info.type}</td>
          <td>${info.frequency}</td>
          <td><input type="text" class="def-input" value="${info.definition || ''}" onchange="updateDefinition('${code.replace(/'/g, "\\'")}', this.value)"></td>
        </tr>`).join('')}
      </tbody>
    </table>
    ${state.codingMode !== 'inductive' ? `<button class="action-btn secondary" onclick="suggestConsolidation()">${t('codebook_consolidate')}</button>` : ''}
    <div id="consolidationResult"></div>
    ${themeHtml}
  `;
}

function updateDefinition(code, def) {
  if (state.codebook[code]) { state.codebook[code].definition = def; saveSession(); }
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
    const response = await callAIWithRetry(apiKey, getConsolidationSuggestionsPrompt(), `Lista kodów:\n${codeList}`);
    el.innerHTML = `<div class="ai-result"><h4>${t('codebook_consolidation_title')}</h4><pre>${response}</pre></div>`;
  } catch (err) {
    el.innerHTML = `<div class="error-msg">${err.message}</div>`;
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
  let gioiaHtml = `<div class="empty-state">${t('viz_no_themes')}</div>`;
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
    gioiaHtml = `<table class="gioia-table">
      <thead><tr><th>First-Order Concepts</th><th>Second-Order Themes</th><th>Aggregate Dimensions</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
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

// ─── Status / Error ───
function showStatus(msg) {
  const el = document.getElementById('statusMsg');
  if (el) { el.className = 'status-msg'; el.textContent = msg; el.style.display = ''; }
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
  showView(state.configured ? 'coding' : 'setup');
}

function dismissSession() {
  document.getElementById('sessionBar').style.display = 'none';
  state = { configured: false, sourceType: null, codingMode: 'inductive', guidedMode: false, codingLang: 'pl', coderId: '', thresholdN: 20, researchQuestion: '', framework: '', segments: [], currentIdx: 0, codedRecords: [], codebook: {}, themes: {}, dimensions: {} };
  localStorage.removeItem('coding_tool_session');
}
