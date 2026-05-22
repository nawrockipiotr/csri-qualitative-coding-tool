// ─── Qualitative Coding Tool v0.1 — Export ───

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Helper: safely set innerHTML/textContent on an element that may not exist
function setPreview(html) {
  const el = document.getElementById('exportPreview');
  if (el) el.innerHTML = html;
}
function setPreviewText(text) {
  const el = document.getElementById('exportPreview');
  if (el) el.textContent = text;
}

function exportJSON() {
  const data = {
    metadata: {
      tool_version: TOOL_VERSION,
      coding_mode: state.codingMode,
      guided_mode: state.guidedMode,
      coding_language: state.codingLang,
      coder_id: state.coderId,
      source_type: state.sourceType,
      source_files: [...new Set(state.segments.map(s => s.source_file).filter(Boolean))],
      export_timestamp: new Date().toISOString(),
      stats: {
        total_segments: state.segments.length,
        coded_segments: state.codedRecords.length,
        total_codes: Object.keys(state.codebook).length,
        themes: Object.keys(state.themes).length,
        dimensions: Object.keys(state.dimensions).length,
      }
    },
    codebook: Object.fromEntries(
      Object.entries(state.codebook).map(([code, info]) => [code, {
        definition: info.definition || '',
        type: info.type,
        frequency: info.frequency,
        color: info.color || '',
        memo: info.memo || '',
        summary: info.summary || '',
        inclusion_rule: '',
        exclusion_rule: '',
        anchor_example: ''
      }])
    ),
    second_order_themes: state.themes,
    aggregate_dimensions: state.dimensions,
    memos: state.memos || {},
    project_memo: state.projectMemo || '',
    segments: state.codedRecords
  };

  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `coding_export_${ts()}.json`, 'application/json');
  setPreview(`<pre class="export-preview">${escapeHtml(json.substring(0, 2000))}${json.length > 2000 ? '\n...' : ''}</pre>`);
}

function exportCSV() {
  const codeToTheme = {};
  for (const [themeName, codes] of Object.entries(state.themes)) {
    for (const c of codes) codeToTheme[c] = themeName;
  }
  const themeToDim = {};
  for (const [dim, dimThemes] of Object.entries(state.dimensions)) {
    for (const th of dimThemes) themeToDim[th] = dim;
  }

  const header = 'segment_id,source_file,text_primary,author,first_order_code,code_type,coding_mode,final_decision,second_order_theme,aggregate_dimension,notes';
  const rows = state.codedRecords.map(r => {
    const theme = codeToTheme[r.first_order_code] || '';
    const dim = themeToDim[theme] || '';
    return [r.segment_id, csvEsc(r.source_file || ''), csvEsc(r.text_primary), csvEsc(r.author || ''), csvEsc(r.first_order_code),
            r.code_type, r.coding_mode || '', r.final_decision || '', csvEsc(theme), csvEsc(dim), csvEsc(r.notes || '')].join(',');
  });

  const csv = '﻿' + header + '\n' + rows.join('\n');
  downloadFile(csv, `coding_export_${ts()}.csv`, 'text/csv;charset=utf-8');
  setPreviewText(`CSV: ${rows.length} ${t('export_csv_rows')}`);
}

function exportGioia() {
  if (!Object.keys(state.themes).length) {
    setPreviewText(t('export_no_themes'));
    return;
  }

  let lines = ['| First-Order Concepts | Second-Order Themes | Aggregate Dimensions |',
               '|----------------------|---------------------|----------------------|'];

  if (Object.keys(state.dimensions).length) {
    for (const [dim, dimThemes] of Object.entries(state.dimensions)) {
      let first = true;
      for (const theme of dimThemes) {
        if (state.themes[theme]) {
          const codes = state.themes[theme].map(c => {
            const info = state.codebook[c];
            return (info && info.type === 'in_vivo') ? `*${c}*` : c;
          }).join(', ');
          lines.push(`| ${codes} | ${theme} | ${first ? dim : ''} |`);
          first = false;
        }
      }
    }
  } else {
    for (const [theme, codes] of Object.entries(state.themes)) {
      const codesStr = codes.map(c => {
        const info = state.codebook[c];
        return (info && info.type === 'in_vivo') ? `*${c}*` : c;
      }).join(', ');
      lines.push(`| ${codesStr} | ${theme} | |`);
    }
  }

  const md = lines.join('\n');
  downloadFile(md, 'gioia_table.md', 'text/markdown');
  setPreview(`<pre class="export-preview">${escapeHtml(md)}</pre>`);
}

function exportReport() {
  const coded = state.codedRecords.length;
  const codes = state.codebook;
  const singletons = Object.values(codes).filter(c => c.frequency === 1).length;

  const decisions = {};
  state.codedRecords.forEach(r => { decisions[r.final_decision] = (decisions[r.final_decision] || 0) + 1; });
  const decLines = Object.entries(decisions).map(([k, v]) => `  ${k}: ${v} (${Math.round(v / coded * 100)}%)`).join('\n');

  const codeLines = Object.entries(codes)
    .sort((a, b) => b[1].frequency - a[1].frequency)
    .map(([c, i], idx) => `  ${idx + 1}. ${c} — ${i.frequency}×`).join('\n');

  const report = `${t('report_title')}
================
${t('report_date')} ${new Date().toISOString().split('T')[0]}
${t('report_coder')} ${state.coderId}
${t('report_mode')} ${state.codingMode}
${t('report_guided')} ${state.guidedMode ? t('report_yes') : t('report_no')}

${t('report_stats')}
  ${t('report_segments')} ${state.segments.length}
  ${t('report_coded')} ${coded}
  ${t('report_codes')} ${Object.keys(codes).length}
  ${t('report_themes')} ${Object.keys(state.themes).length}
  ${t('report_dims')} ${Object.keys(state.dimensions).length}

${t('report_decisions')}
${decLines}

${t('report_code_list')}
${codeLines}

${t('report_warnings')}
${(() => {
    const warns = [];
    if (singletons > Object.keys(codes).length * 0.25) warns.push(`  - ${t('report_singleton_warn')} ${singletons}/${Object.keys(codes).length} (>25%)`);
    if (coded > 50 && !Object.keys(state.themes).length) warns.push(`  - >50 ${t('report_no_themes_warn')}`);
    return warns.length ? warns.join('\n') : `  ${t('report_no_warnings')}`;
  })()}`;

  downloadFile(report, `coding_report_${ts()}.txt`, 'text/plain');
  setPreview(`<pre class="export-preview">${escapeHtml(report)}</pre>`);
}

function exportREFI_QDA() {
  if (typeof JSZip === 'undefined') {
    setPreviewText(t('export_refi_no_jszip'));
    return;
  }

  const guid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });

  const projGuid = guid();
  const userGuid = guid();
  const now = new Date().toISOString();

  // Build code GUIDs
  const codeGuids = {};
  for (const code of Object.keys(state.codebook)) {
    codeGuids[code] = guid();
  }

  // Build source GUIDs
  const sources = [...new Set(state.segments.map(s => s.source_file || 'data').filter(Boolean))];
  const sourceGuids = {};
  sources.forEach(s => { sourceGuids[s] = guid(); });

  // XML escape
  const xe = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Build codes XML
  const codesXml = Object.entries(state.codebook).map(([code, info]) => {
    const color = info.color ? ` color="${xe(info.color)}"` : '';
    return `    <Code guid="${codeGuids[code]}" name="${xe(code)}" isCodable="true"${color}>
      <Description>${xe(info.definition || '')}</Description>
    </Code>`;
  }).join('\n');

  // Build sources XML
  const sourcesXml = sources.map(s =>
    `    <TextSource guid="${sourceGuids[s]}" name="${xe(s)}" plainTextPath="sources/${xe(s)}.txt" />`
  ).join('\n');

  // Build codings XML (selections)
  const codingsXml = state.codedRecords.map(r => {
    const codeGuid = codeGuids[r.first_order_code];
    if (!codeGuid) return '';
    const srcFile = r.source_file || 'data';
    const srcGuid = sourceGuids[srcFile];
    if (!srcGuid) return '';
    return `    <Coding guid="${guid()}" codeGUID="${codeGuid}" codingSourceGUID="${srcGuid}">
      <PlainTextSelection startPosition="0" endPosition="${r.text_primary.length}" />
    </Coding>`;
  }).filter(Boolean).join('\n');

  const projectXml = `<?xml version="1.0" encoding="UTF-8"?>
<Project name="QCT Export" origin="QualitativeCodingTool/${TOOL_VERSION}"
  xmlns="urn:QDA-XML:project:1.0"
  creatingUserGUID="${userGuid}"
  creationDateTime="${now}">
  <Users>
    <User guid="${userGuid}" name="${xe(state.coderId || 'researcher')}" />
  </Users>
  <CodeBook>
${codesXml}
  </CodeBook>
  <Sources>
${sourcesXml}
  </Sources>
  <Codings>
${codingsXml}
  </Codings>
</Project>`;

  const zip = new JSZip();
  zip.file('project.qde', projectXml);

  // Add plain text sources
  const srcFolder = zip.folder('sources');
  for (const src of sources) {
    const segs = state.segments.filter(s => (s.source_file || 'data') === src);
    const text = segs.map(s => s.text_primary).join('\n\n');
    srcFolder.file(src + '.txt', text);
  }

  zip.generateAsync({ type: 'blob' }).then(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `coding_export_${ts()}.qdpx`;
    a.click();
    URL.revokeObjectURL(url);
    setPreviewText(t('export_refi_done'));
  });
}

// ─── Helpers ───
function ts() { return new Date().toISOString().replace(/[:.]/g, '').substring(0, 15); }
function csvEsc(s) { return s && (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : (s || ''); }
function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
