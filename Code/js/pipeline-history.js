// ─── pipeline-history.js ───
// Tag history engine — logging, formatting, rendering

/** Append a tagged event to the history log for Stage 1 */
function logTag(sectionId, itemId, tagCode, content, notes) {
  const sd = stageData[1];
  if (!sd.historyLog) sd.historyLog = [];
  const entry = {
    timestamp: new Date().toISOString(),
    sectionId: sectionId,
    itemId: itemId,
    tagCode: tagCode,
    tagLabel: TAG_LABELS[tagCode] || tagCode,
    content: content || '',
    notes: notes || ''
  };
  sd.historyLog.push(entry);
  return entry;
}

/** Get the tag code for a manual entry (first time = MGFP) */
function getManualTag(itemId) {
  const sd = stageData[1];
  if (!sd.historyLog) sd.historyLog = [];
  // Check if this item already has manual tags
  const existing = sd.historyLog.filter(e => e.itemId === itemId);
  if (existing.length === 0) return 'MGFP';
  // If previously AI-generated and now manually edited
  const lastTag = existing[existing.length - 1].tagCode;
  if (['AGFP', 'AGRM', 'MAAP'].includes(lastTag)) return 'MEAP';
  return 'MGFP';
}

/** Format a tag for display: S1_PRD_D1.1_MGFP_2026-06-19T17:30 */
function formatTag(itemId, tagCode) {
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  return `S1_PRD_${itemId}_${tagCode}_${ts}`;
}

/** Render the history panel content */
function renderHistoryPanel() {
  const sd = stageData[1];
  const panel = document.getElementById('history-content');
  if (!panel) return;
  if (!sd.historyLog || sd.historyLog.length === 0) {
    panel.innerHTML = '<p style="color:var(--text-3);padding:16px;text-align:center;">No history yet. Start filling in your PRD to record events.</p>';
    return;
  }
  let html = '';
  [...sd.historyLog].reverse().forEach(entry => {
    const color = TAG_COLORS[entry.tagCode] || '#888';
    html += `<div class="history-entry" style="border-left: 3px solid ${color};">
      <div class="history-stage-tag" style="display:flex;justify-content:space-between;">
        <span>${escHtml(entry.itemId)}</span>
        <span style="font-size:10px;opacity:0.6;">${new Date(entry.timestamp).toLocaleString()}</span>
      </div>
      <div class="history-field">
        <span class="history-label">Tag</span>
        <span class="history-value" style="color:${color};font-weight:600;">${formatTag(entry.itemId, entry.tagCode)}</span>
      </div>
      <div class="history-field">
        <span class="history-label">${TAG_LABELS[entry.tagCode] || entry.tagCode}</span>
        <span class="history-value">${escHtml(entry.content.substring(0, 120))}${entry.content.length > 120 ? '…' : ''}</span>
      </div>
      ${entry.notes ? `<div class="history-field"><span class="history-label">Note</span><span class="history-value">${escHtml(entry.notes)}</span></div>` : ''}
    </div>`;
  });
  panel.innerHTML = html;
}

function toggleHistory() {
  if (typeof historyOpen === 'undefined') window.historyOpen = false;
  historyOpen = !historyOpen;
  const panel = document.getElementById('history-panel');
  if (panel) panel.classList.toggle('open', historyOpen);
  if (historyOpen) renderHistoryPanel();
}

function addToHistory(stage, sd) {
  const historyEl = document.getElementById('history-content');
  if (!historyEl) return;
  const entry = document.createElement('div');
  entry.className = 'history-entry';
  const time = new Date().toLocaleTimeString();
  const manualCount = Object.values(sd.manualInputs).filter(v => v && v.trim()).length;
  entry.innerHTML = `
    <div class="history-stage-tag">Stage ${stage.id} — ${time}</div>
    <div class="history-field"><span class="history-label">Stage</span><br><span class="history-value">${escHtml(stage.name)}</span></div>
    <div class="history-field"><span class="history-label">Mode</span><br><span class="history-value">${getProviderLabel()} — ${getStageModels(stage)[0]}</span></div>
    <div class="history-field"><span class="history-label">Manual inputs filled</span><br><span class="history-value">${manualCount}</span></div>
    <div class="history-field"><span class="history-label">AI deliverables</span><br><span class="history-value">${stage.aiDeliverables.length} generated</span></div>
    <div class="history-field"><span class="history-label">Questions raised</span><br><span class="history-value">${(sd.aiQuestions || []).length}</span></div>`;
  if (historyEl.querySelector('p')) historyEl.innerHTML = '';
  historyEl.prepend(entry);
}