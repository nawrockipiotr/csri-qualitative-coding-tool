// ─── Qualitative Coding Tool v0.1 — Export ───

function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
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
        inclusion_rule: '',
        exclusion_rule: '',
        anchor_example: ''
      }])
    ),
    second_order_themes: state.themes,
    aggregate_dimensions: state.dimensions,
    segments: state.codedRecords
  };

  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `coding_export_${ts()}.json`, 'application/json');
  document.getElementById('exportPreview')?.innerHTML = `<pre class="export-preview">${escHtml(json.substring(0, 2000))}${json.length > 2000 ? '\n...' : ''}</pre>`;
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
  document.getElementById('exportPreview')?.textContent = `CSV: ${rows.length} ${t('export_csv_rows')}`;
}

function exportGioia() {
  if (!Object.keys(state.themes).length) {
    document.getElementById('exportPreview')?.textContent = t('export_no_themes');
    return;
  }

  let lines = ['| First-Order Concepts | Second-Order Themes | Aggregate Dimensions |',
               '|----------------------|---------------------|----------------------|'];

  if (Object.keys(state.dimensions).length) {
    for (const [dim, dimThemes] of Object.entries(state.dimensions)) {
      let first = true;
      for (const theme of dimThemes) {
        if (state.themes[theme]) {
          const codes = state.themes[theme].map(c =>
            state.codebook[c]?.type === 'in_vivo' ? `*${c}*` : c
          ).join(', ');
          lines.push(`| ${codes} | ${theme} | ${first ? dim : ''} |`);
          first = false;
        }
      }
    }
  } else {
    for (const [theme, codes] of Object.entries(state.themes)) {
      const codesStr = codes.map(c =>
        state.codebook[c]?.type === 'in_vivo' ? `*${c}*` : c
      ).join(', ');
      lines.push(`| ${codesStr} | ${theme} | |`);
    }
  }

  const md = lines.join('\n');
  downloadFile(md, 'gioia_table.md', 'text/markdown');
  document.getElementById('exportPreview')?.innerHTML = `<pre class="export-preview">${escHtml(md)}</pre>`;
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
${singletons > Object.keys(codes).length * 0.25 ? `  - ${t('report_singleton_warn')} ${singletons}/${Object.keys(codes).length} (>25%)\n` : ''}${coded > 50 && !Object.keys(state.themes).length ? `  - >50 ${t('report_no_themes_warn')}\n` : ''}${!singletons && coded ? `  ${t('report_no_warnings')}\n` : ''}`;

  downloadFile(report, `coding_report_${ts()}.txt`, 'text/plain');
  document.getElementById('exportPreview')?.innerHTML = `<pre class="export-preview">${escHtml(report)}</pre>`;
}

// ─── Helpers ───
function ts() { return new Date().toISOString().replace(/[:.]/g, '').substring(0, 15); }
function csvEsc(s) { return s && (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : (s || ''); }
function escHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
