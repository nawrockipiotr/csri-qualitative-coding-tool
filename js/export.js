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

// ─── HTML Visualization Export (standalone) ───
function exportVisualizationHTML() {
  const codes = state.codebook;
  const records = state.codedRecords;
  if (!records.length) { setPreviewText(t('empty_data')); return; }

  const totalCoded = records.length;
  const totalCodes = Object.keys(codes).length;
  const singletons = Object.values(codes).filter(c => c.frequency === 1).length;
  const singletonPct = Math.round(singletons / totalCodes * 100);
  const overloaded = Object.entries(codes).filter(([, c]) => c.frequency > totalCoded * 0.15);

  // Gioia table
  let gioiaHtml = '';
  if (Object.keys(state.themes).length) {
    let rows = '';
    if (Object.keys(state.dimensions).length) {
      for (const [dim, dimThemes] of Object.entries(state.dimensions)) {
        let first = true;
        for (const theme of dimThemes) {
          if (state.themes[theme]) {
            const codesStr = state.themes[theme].map(c => {
              const info = codes[c];
              return (info && info.type === 'in_vivo') ? `<em>${escapeHtml(c)}</em>` : escapeHtml(c);
            }).join(', ');
            rows += `<tr><td>${codesStr}</td><td>${escapeHtml(theme)}</td><td>${first ? escapeHtml(dim) : ''}</td></tr>`;
            first = false;
          }
        }
      }
    } else {
      for (const [theme, tCodes] of Object.entries(state.themes)) {
        const codesStr = tCodes.map(c => {
          const info = codes[c];
          return (info && info.type === 'in_vivo') ? `<em>${escapeHtml(c)}</em>` : escapeHtml(c);
        }).join(', ');
        rows += `<tr><td>${codesStr}</td><td>${escapeHtml(theme)}</td><td></td></tr>`;
      }
    }
    gioiaHtml = `<h2>Gioia Data Structure</h2>
      <table class="gioia"><thead><tr><th>First-Order Concepts</th><th>Second-Order Themes</th><th>Aggregate Dimensions</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
  }

  // Theoretical grounding
  let groundingHtml = '';
  if (state._dimensionGroundings && Object.keys(state._dimensionGroundings).length) {
    const cards = Object.entries(state._dimensionGroundings).map(([dim, g]) => {
      const isRich = typeof g === 'object';
      const theory = isRich ? (g.theory || '') : '';
      const author = isRich ? (g.author || '') : '';
      const text = isRich ? (g.text || '') : (g || '');
      return `<div class="grounding"><strong>${escapeHtml(dim)}</strong>
        ${theory ? `<br>Theory: ${escapeHtml(theory)}` : ''}
        ${author ? `<br>Author(s): ${escapeHtml(author)}` : ''}
        ${text ? `<br>${escapeHtml(text)}` : ''}</div>`;
    }).join('');
    groundingHtml = `<h2>Theoretical Grounding</h2>${cards}`;
  }

  // Frequency chart (horizontal bars via CSS)
  const sortedCodes = Object.entries(codes).sort((a, b) => b[1].frequency - a[1].frequency).slice(0, 20);
  const maxFreq = sortedCodes.length ? sortedCodes[0][1].frequency : 1;
  const barsHtml = sortedCodes.map(([c, info]) => {
    const w = Math.round(info.frequency / maxFreq * 100);
    const color = info.color || '#3b82f6';
    return `<div class="bar-row"><span class="bar-label">${escapeHtml(c)}</span><div class="bar-track"><div class="bar-fill" style="width:${w}%;background:${color}"></div></div><span class="bar-count">${info.frequency}</span></div>`;
  }).join('');

  // Code × Document matrix
  let matrixHtml = '';
  const files = [...new Set(records.map(r => r.source_file).filter(Boolean))];
  if (files.length >= 2) {
    const topCodes = Object.entries(codes).sort((a, b) => b[1].frequency - a[1].frequency).slice(0, 20).map(([c]) => c);
    const matrix = {};
    for (const code of topCodes) { matrix[code] = {}; for (const f of files) matrix[code][f] = 0; }
    for (const r of records) { if (r.source_file && matrix[r.first_order_code]) matrix[r.first_order_code][r.source_file]++; }
    const maxVal = Math.max(1, ...Object.values(matrix).flatMap(row => Object.values(row)));
    const hdr = files.map(f => `<th title="${escapeHtml(f)}">${escapeHtml(f.length > 15 ? f.substring(0, 13) + '..' : f)}</th>`).join('');
    const mrows = topCodes.map(code => {
      const cells = files.map(f => {
        const v = matrix[code][f];
        const bg = v ? `background:rgba(59,130,246,${0.15 + v / maxVal * 0.7})` : '';
        return `<td style="${bg}">${v || ''}</td>`;
      }).join('');
      return `<tr><td class="row-label">${escapeHtml(code)}</td>${cells}</tr>`;
    }).join('');
    matrixHtml = `<h2>Code × Document Matrix</h2><table class="matrix"><thead><tr><th></th>${hdr}</tr></thead><tbody>${mrows}</tbody></table>`;
  }

  // Co-occurrence matrix
  let cooccurHtml = '';
  const topCo = Object.entries(codes).sort((a, b) => b[1].frequency - a[1].frequency).slice(0, 15).map(([c]) => c);
  if (topCo.length >= 3) {
    const co = {};
    for (const c of topCo) { co[c] = {}; for (const c2 of topCo) co[c][c2] = 0; }
    for (let i = 0; i < records.length; i++) {
      const r1 = records[i];
      if (!topCo.includes(r1.first_order_code)) continue;
      for (let j = i + 1; j < Math.min(i + 3, records.length); j++) {
        const r2 = records[j];
        if (!topCo.includes(r2.first_order_code) || r1.first_order_code === r2.first_order_code) continue;
        co[r1.first_order_code][r2.first_order_code]++;
        co[r2.first_order_code][r1.first_order_code]++;
      }
    }
    const maxCo = Math.max(1, ...topCo.flatMap(c => topCo.map(c2 => co[c][c2])));
    const chdr = topCo.map(c => `<th title="${escapeHtml(c)}">${escapeHtml(c.length > 8 ? c.substring(0, 7) + '..' : c)}</th>`).join('');
    const crows = topCo.map(code => {
      const cells = topCo.map(c2 => {
        if (code === c2) return '<td class="diag-cell"></td>';
        const v = co[code][c2];
        const bg = v ? `background:rgba(234,88,12,${0.15 + v / maxCo * 0.7})` : '';
        return `<td style="${bg}">${v || ''}</td>`;
      }).join('');
      return `<tr><td class="row-label">${escapeHtml(code.length > 12 ? code.substring(0, 11) + '..' : code)}</td>${cells}</tr>`;
    }).join('');
    cooccurHtml = `<h2>Co-occurrence Matrix</h2><p class="hint">Proximity-based: codes within 2 segments of each other</p><table class="matrix"><thead><tr><th></th>${chdr}</tr></thead><tbody>${crows}</tbody></table>`;
  }

  const html = `<!DOCTYPE html>
<html lang="${currentLang || 'en'}">
<head>
<meta charset="UTF-8">
<title>Qualitative Coding — Visualization Report</title>
<style>
  :root { --bg: #fff; --text: #1e293b; --border: #e2e8f0; --accent: #3b82f6; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0f172a; --text: #e2e8f0; --border: #334155; --accent: #60a5fa; } }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', -apple-system, sans-serif; color: var(--text); background: var(--bg); padding: 2rem; max-width: 1100px; margin: 0 auto; line-height: 1.6; }
  h1 { font-size: 1.5rem; margin-bottom: 0.5rem; }
  h2 { font-size: 1.15rem; margin: 2rem 0 0.75rem; border-bottom: 2px solid var(--accent); padding-bottom: 0.3rem; }
  .meta { color: #64748b; font-size: 0.85rem; margin-bottom: 1.5rem; }
  .diag-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.5rem; margin-bottom: 1rem; }
  .diag-item { padding: 0.5rem 0.75rem; border-radius: 6px; font-size: 0.85rem; }
  .diag-ok { background: #dcfce7; color: #166534; }
  .diag-warn { background: #fef3c7; color: #92400e; }
  .diag-error { background: #fee2e2; color: #991b1b; }
  table { width: 100%; border-collapse: collapse; margin: 0.5rem 0 1rem; font-size: 0.85rem; }
  th, td { border: 1px solid var(--border); padding: 0.4rem 0.6rem; text-align: left; }
  th { background: #f1f5f9; font-weight: 600; }
  .gioia td:first-child { max-width: 400px; }
  .gioia em { font-style: italic; color: var(--accent); }
  .matrix { font-size: 0.75rem; }
  .matrix th { writing-mode: vertical-rl; text-orientation: mixed; padding: 0.3rem; white-space: nowrap; }
  .matrix td { text-align: center; padding: 0.25rem; min-width: 28px; }
  .matrix .row-label { text-align: left; font-weight: 500; white-space: nowrap; }
  .matrix .diag-cell { background: #f1f5f9; }
  .bar-row { display: flex; align-items: center; gap: 0.5rem; margin: 0.25rem 0; font-size: 0.8rem; }
  .bar-label { width: 180px; text-align: right; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0; }
  .bar-track { flex: 1; height: 18px; background: #f1f5f9; border-radius: 4px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; min-width: 2px; }
  .bar-count { width: 30px; text-align: right; font-weight: 600; flex-shrink: 0; }
  .grounding { background: #f8fafc; border-left: 3px solid var(--accent); padding: 0.6rem 0.8rem; margin: 0.5rem 0; border-radius: 4px; font-size: 0.85rem; }
  .hint { color: #64748b; font-size: 0.8rem; margin-bottom: 0.5rem; }
  @media print { body { padding: 1rem; } h2 { break-after: avoid; } table { break-inside: avoid; } }
</style>
</head>
<body>
<h1>Qualitative Coding — Visualization Report</h1>
<div class="meta">
  Coder: ${escapeHtml(state.coderId || '—')} | Mode: ${escapeHtml(state.codingMode || '—')} |
  Segments: ${state.segments.length} | Coded: ${totalCoded} | Codes: ${totalCodes} |
  Themes: ${Object.keys(state.themes).length} | Dimensions: ${Object.keys(state.dimensions).length} |
  Exported: ${new Date().toISOString().split('T')[0]}
</div>

<h2>Diagnostics</h2>
<div class="diag-grid">
  <div class="diag-item ${singletonPct > 25 ? 'diag-error' : singletonPct > 10 ? 'diag-warn' : 'diag-ok'}">Singletons: ${singletons}/${totalCodes} (${singletonPct}%)</div>
  <div class="diag-item ${overloaded.length ? 'diag-error' : 'diag-ok'}">Overloaded codes: ${overloaded.length}${overloaded.length ? ' — ' + overloaded.map(([c]) => escapeHtml(c)).join(', ') : ''}</div>
</div>

${gioiaHtml}
${groundingHtml}

<h2>Code Frequency (top 20)</h2>
${barsHtml}

${matrixHtml}
${cooccurHtml}
</body>
</html>`;

  downloadFile(html, `visualization_report_${ts()}.html`, 'text/html');
  setPreviewText(t('export_viz_done'));
}

// ─── SVG Gioia Table Export ───
function exportGioiaSVG() {
  if (!Object.keys(state.themes).length) { setPreviewText(t('export_no_themes')); return; }

  const codes = state.codebook;
  const padding = 20;
  const colWidths = [320, 220, 220];
  const totalW = colWidths[0] + colWidths[1] + colWidths[2] + padding * 2;
  const rowH = 32;
  const headerH = 36;
  const fontSize = 12;

  // Build rows
  const tableRows = [];
  if (Object.keys(state.dimensions).length) {
    for (const [dim, dimThemes] of Object.entries(state.dimensions)) {
      let first = true;
      for (const theme of dimThemes) {
        if (state.themes[theme]) {
          const codesStr = state.themes[theme].map(c => {
            const info = codes[c];
            return (info && info.type === 'in_vivo') ? `"${c}"` : c;
          }).join(', ');
          tableRows.push({ codes: codesStr, theme, dim: first ? dim : '' });
          first = false;
        }
      }
    }
  } else {
    for (const [theme, tCodes] of Object.entries(state.themes)) {
      const codesStr = tCodes.map(c => {
        const info = codes[c];
        return (info && info.type === 'in_vivo') ? `"${c}"` : c;
      }).join(', ');
      tableRows.push({ codes: codesStr, theme, dim: '' });
    }
  }

  const totalH = headerH + tableRows.length * rowH + padding * 2;
  const xe = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // Truncate long text
  const trunc = (s, max) => s.length > max ? s.substring(0, max - 2) + '..' : s;

  let rowsSvg = '';
  tableRows.forEach((r, i) => {
    const y = padding + headerH + i * rowH;
    const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff';
    rowsSvg += `<rect x="${padding}" y="${y}" width="${colWidths[0] + colWidths[1] + colWidths[2]}" height="${rowH}" fill="${bg}" stroke="#e2e8f0"/>`;
    // Column separators
    rowsSvg += `<line x1="${padding + colWidths[0]}" y1="${y}" x2="${padding + colWidths[0]}" y2="${y + rowH}" stroke="#e2e8f0"/>`;
    rowsSvg += `<line x1="${padding + colWidths[0] + colWidths[1]}" y1="${y}" x2="${padding + colWidths[0] + colWidths[1]}" y2="${y + rowH}" stroke="#e2e8f0"/>`;
    // Text
    rowsSvg += `<text x="${padding + 6}" y="${y + rowH / 2 + 4}" font-size="${fontSize}" fill="#1e293b">${xe(trunc(r.codes, 50))}</text>`;
    rowsSvg += `<text x="${padding + colWidths[0] + 6}" y="${y + rowH / 2 + 4}" font-size="${fontSize}" fill="#1e293b" font-weight="500">${xe(trunc(r.theme, 30))}</text>`;
    if (r.dim) rowsSvg += `<text x="${padding + colWidths[0] + colWidths[1] + 6}" y="${y + rowH / 2 + 4}" font-size="${fontSize}" fill="#1e293b" font-weight="600">${xe(trunc(r.dim, 30))}</text>`;
  });

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">
  <style>text { font-family: 'Inter', -apple-system, Helvetica, sans-serif; }</style>
  <!-- Header -->
  <rect x="${padding}" y="${padding}" width="${colWidths[0] + colWidths[1] + colWidths[2]}" height="${headerH}" fill="#3b82f6" rx="4"/>
  <text x="${padding + 6}" y="${padding + headerH / 2 + 5}" font-size="13" fill="white" font-weight="600">First-Order Concepts</text>
  <text x="${padding + colWidths[0] + 6}" y="${padding + headerH / 2 + 5}" font-size="13" fill="white" font-weight="600">Second-Order Themes</text>
  <text x="${padding + colWidths[0] + colWidths[1] + 6}" y="${padding + headerH / 2 + 5}" font-size="13" fill="white" font-weight="600">Aggregate Dimensions</text>
  <line x1="${padding + colWidths[0]}" y1="${padding}" x2="${padding + colWidths[0]}" y2="${padding + headerH}" stroke="rgba(255,255,255,0.3)"/>
  <line x1="${padding + colWidths[0] + colWidths[1]}" y1="${padding}" x2="${padding + colWidths[0] + colWidths[1]}" y2="${padding + headerH}" stroke="rgba(255,255,255,0.3)"/>
  <!-- Rows -->
  ${rowsSvg}
  <!-- Footer -->
  <text x="${padding}" y="${totalH - 4}" font-size="9" fill="#94a3b8">QCT ${TOOL_VERSION} — ${new Date().toISOString().split('T')[0]} — ${state.coderId || 'researcher'}</text>
</svg>`;

  downloadFile(svg, `gioia_table_${ts()}.svg`, 'image/svg+xml');
  setPreviewText(t('export_svg_done'));
}

// ─── Helpers ───
function ts() { return new Date().toISOString().replace(/[:.]/g, '').substring(0, 15); }
function csvEsc(s) { return s && (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : (s || ''); }
function escapeHtml(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
