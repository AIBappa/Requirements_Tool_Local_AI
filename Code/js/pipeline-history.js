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
  const panel = document.getElementById('history-content');
  if (!panel) return;
  let snapshots = window.__pipelineSnapshots || [];
  if (snapshots.length === 0) {
    panel.innerHTML = '<p style="color:var(--text-3);padding:16px;text-align:center;">No saved snapshots yet. Click "Save JSON" to create one.</p>';
    return;
  }
  let html = '';
  [...snapshots].reverse().forEach((snapshot, idx) => {
    const realIdx = snapshots.length - 1 - idx;
    html += `<div class="history-entry" style="border-left: 3px solid var(--accent);">
      <div class="history-stage-tag" style="display:flex;justify-content:space-between;align-items:center;">
        <span>📦 ${escHtml(snapshot.fileName)}</span>
        <span style="font-size:10px;opacity:0.6;">${new Date(snapshot.timestamp).toLocaleString()}</span>
      </div>
      <div class="history-field">
        <span class="history-label">Size</span>
        <span class="history-value">${(snapshot.size / 1024).toFixed(1)} KB</span>
      </div>
      <div class="history-field">
        <span class="history-label">Stages completed</span>
        <span class="history-value">${snapshot.stagesCompleted || 0}/9</span>
      </div>
      <div class="history-field">
        <span class="history-label">Total manual inputs</span>
        <span class="history-value">${snapshot.totalManualInputs || 0}</span>
      </div>
      <div style="margin-top:8px;display:flex;gap:6px;">
        <button class="btn" style="font-size:11px;padding:4px 10px;" onclick="downloadSnapshot(${realIdx})">⬇ Download</button>
        <button class="btn btn-danger" style="font-size:11px;padding:4px 10px;" onclick="removeSnapshot(${realIdx})">🗑 Remove</button>
      </div>
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

/** Download a saved snapshot by index */
function downloadSnapshot(idx) {
  const snapshots = window.__pipelineSnapshots || [];
  const snap = snapshots[idx];
  if (!snap) return;
  // We don't keep the full JSON blob, so notify user to use the downloaded file
  showToast('Use the previously downloaded file: ' + snap.fileName);
}

/** Remove a snapshot from the in-memory list */
function removeSnapshot(idx) {
  const snapshots = window.__pipelineSnapshots || [];
  if (!confirm('Remove this snapshot from history? The downloaded file will still exist.')) return;
  snapshots.splice(idx, 1);
  saveToStorage();
  renderHistoryPanel();
  showToast('Snapshot removed from history');
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