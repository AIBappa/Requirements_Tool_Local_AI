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
async function renderHistoryPanel() {
  const panel = document.getElementById('history-content');
  if (!panel) return;
  panel.innerHTML = '<p style="color:var(--text-3);padding:16px;text-align:center;">Loading…</p>';
  try {
    const res = await fetch('/api/exports');
    if (!res.ok) throw new Error('Failed to load exports');
    const exports = await res.json();
    if (exports.length === 0) {
      panel.innerHTML = '<p style="color:var(--text-3);padding:16px;text-align:center;">No saved exports yet. Click "Save to Server" to create one.</p>';
      return;
    }
    let html = '';
    exports.forEach((exp, idx) => {
      html += `<div class="history-entry" style="border-left: 3px solid var(--accent);">
        <div class="history-stage-tag" style="display:flex;justify-content:space-between;align-items:center;">
          <span class="snapshot-filename" onclick="viewRawJSON('${escHtml(exp.fileName)}')" title="Click to view raw JSON" style="cursor:pointer;text-decoration:underline;color:var(--accent-dark);">📦 ${escHtml(exp.fileName)}</span>
          <span style="font-size:10px;opacity:0.6;">${new Date(exp.timestamp).toLocaleString()}</span>
        </div>
        <div class="history-field">
          <span class="history-label">Size</span>
          <span class="history-value">${(exp.size / 1024).toFixed(1)} KB</span>
        </div>
        <div class="history-field">
          <span class="history-label">Stages completed</span>
          <span class="history-value">${exp.stagesCompleted || 0}/9</span>
        </div>
        <div class="history-field">
          <span class="history-label">Total manual inputs</span>
          <span class="history-value">${exp.totalManualInputs || 0}</span>
        </div>
        <div style="margin-top:8px;display:flex;gap:6px;">
          <button class="btn" style="font-size:11px;padding:4px 10px;" onclick="downloadSnapshot('${escHtml(exp.fileName)}')">⬇ Download</button>
          <button class="btn" style="font-size:11px;padding:4px 10px;" onclick="restoreSnapshot('${escHtml(exp.fileName)}')">↩ Restore</button>
          <button class="btn btn-danger" style="font-size:11px;padding:4px 10px;" onclick="removeSnapshot('${escHtml(exp.fileName)}')">🗑 Remove</button>
        </div>
      </div>`;
    });
    panel.innerHTML = html;
  } catch (e) {
    panel.innerHTML = '<p style="color:var(--text-3);padding:16px;text-align:center;">Failed to load exports.</p>';
  }
}

function toggleHistory() {
  if (typeof historyOpen === 'undefined') window.historyOpen = false;
  historyOpen = !historyOpen;
  const panel = document.getElementById('history-panel');
  if (panel) panel.classList.toggle('open', historyOpen);
  if (historyOpen) renderHistoryPanel();
}

/** View raw JSON of an export in modal */
async function viewRawJSON(fileName) {
  const modal = document.getElementById('raw-view-modal');
  const pre = document.getElementById('raw-view-content');
  if (!modal || !pre) return;
  try {
    const res = await fetch('/api/exports/' + encodeURIComponent(fileName));
    if (!res.ok) { showToast('Failed to load export'); return; }
    const data = await res.json();
    pre.textContent = JSON.stringify(data, null, 2);
    modal.classList.remove('hidden');
  } catch (e) {
    showToast('Failed to load export: ' + e.message);
  }
}

/** Restore an export into active session */
async function restoreSnapshot(fileName) {
  if (!confirm('Restore this snapshot? Current unsaved changes will be lost.')) return;
  try {
    const res = await fetch('/api/exports/' + encodeURIComponent(fileName));
    if (!res.ok) { showToast('Failed to load export'); return; }
    const data = await res.json();
    if (data.stageData) {
      PIPELINE.forEach(s => {
        if (data.stageData[s.id]) {
          Object.keys(data.stageData[s.id]).forEach(k => {
            if (typeof data.stageData[s.id][k] === 'object' && !Array.isArray(data.stageData[s.id][k]) && data.stageData[s.id][k] !== null) {
              stageData[s.id][k] = { ...stageData[s.id][k], ...data.stageData[s.id][k] };
            } else {
              stageData[s.id][k] = data.stageData[s.id][k];
            }
          });
        }
      });
    }
    if (data.currentStage) currentStage = data.currentStage;
    if (data.config) Object.assign(CONFIG, data.config);
    saveToStorage();
    if (typeof saveSessionToServer === 'function') saveSessionToServer();
    if (typeof buildSidebar === 'function') buildSidebar();
    if (typeof renderStage === 'function') renderStage();
    if (typeof updateSetupIndicator === 'function') updateSetupIndicator();
    showToast('Snapshot restored ✓');
  } catch (e) {
    showToast('Restore failed: ' + e.message);
  }
}

/** Download a saved export by filename */
function downloadSnapshot(fileName) {
  window.open('/api/exports/' + encodeURIComponent(fileName), '_blank');
}

/** Remove an export from server */
async function removeSnapshot(fileName) {
  if (!confirm('Remove this export from server? This cannot be undone.')) return;
  try {
    const res = await fetch('/api/exports/' + encodeURIComponent(fileName), { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    renderHistoryPanel();
    showToast('Export removed');
  } catch (e) {
    showToast('Remove failed: ' + e.message);
  }
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