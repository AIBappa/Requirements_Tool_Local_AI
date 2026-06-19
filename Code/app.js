// ─── Session state ───
let currentSessionId = null;

// ─── Server API helpers ───
async function apiFetch(path, options = {}) {
  const url = window.location.origin + path;
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!r.ok) {
    const errBody = await r.text().catch(() => '');
    throw new Error(`Server error ${r.status}: ${errBody || r.statusText}`);
  }
  return r.json();
}

// ─── Session management ───
async function loadSessions() {
  try {
    const sessions = await apiFetch('/api/sessions');
    renderSessions(sessions);
    return;
  } catch (e) {
    console.warn('Server unavailable, falling back to localStorage:', e.message);
  }
  const lastId = localStorage.getItem('pipeline-last-session');
  if (lastId) {
    renderSessionsFallback(lastId);
  } else {
    renderSessions([]);
  }
}

async function createNewSession() {
  const name = document.getElementById('new-session-name').value.trim();
  const desc = document.getElementById('new-session-desc').value.trim();
  if (!name) { showToast('Please enter a session name'); return; }

  try {
    const session = await apiFetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ name, description: desc })
    });
    openSession(session.id);
    showToast('Session created ✓');
  } catch (e) {
    showToast('Failed to create session: ' + e.message);
  }
}

async function deleteSession(id, event) {
  if (event) event.stopPropagation();
  if (!confirm('Delete this session? This cannot be undone.')) return;
  try {
    await apiFetch('/api/sessions/' + id, { method: 'DELETE' });
    loadSessions();
    showToast('Session deleted');
  } catch (e) {
    showToast('Failed to delete: ' + e.message);
  }
}

async function renameSession(id, newName) {
  if (!newName.trim()) return;
  try {
    await apiFetch('/api/sessions/' + id, {
      method: 'PUT',
      body: JSON.stringify({ name: newName.trim() })
    });
    loadSessions();
  } catch (e) {
    showToast('Failed to rename: ' + e.message);
  }
}

async function loadSessionData(sessionId) {
  try {
    const data = await apiFetch('/api/sessions/' + sessionId);
    return data;
  } catch (e) {
    console.warn('Could not load session from server:', e.message);
    return null;
  }
}

async function saveSessionToServer() {
  if (!currentSessionId) return;
  try {
    const data = {
      currentStage: currentStage,
      stageData: stageData,
      config: {
        mode: CONFIG.mode,
        ollamaUrl: CONFIG.ollamaUrl,
        cloudModel: CONFIG.cloudModel,
        openaiModel: CONFIG.openaiModel,
        geminiModel: CONFIG.geminiModel,
        azureEndpoint: CONFIG.azureEndpoint,
        azureDeployment: CONFIG.azureDeployment,
        azureModel: CONFIG.azureModel
      }
    };
    const completed = PIPELINE.filter(s => stageData[s.id].completed).length;
    data.completed = completed;
    await apiFetch('/api/sessions/' + currentSessionId, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  } catch (e) {
    console.warn('Failed to save to server:', e.message);
  }
}

async function openSession(sessionId) {
  currentSessionId = sessionId;
  localStorage.setItem('pipeline-last-session', sessionId);
  const data = await loadSessionData(sessionId);
  if (data && data.stageData) {
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
    if (data.currentStage) currentStage = data.currentStage;
    if (data.config) Object.assign(CONFIG, data.config);
  }
  document.getElementById('session-page').classList.add('hidden');
  document.getElementById('pipeline-view').classList.remove('hidden');
  buildSidebar();
  renderStage();
  updateSetupIndicator();
}

function goToSessions() {
  saveCurrentInputs();
  if (currentSessionId) saveSessionToServer();
  currentSessionId = null;
  document.getElementById('pipeline-view').classList.add('hidden');
  document.getElementById('session-page').classList.remove('hidden');
  loadSessions();
}

function renderSessions(sessions) {
  const list = document.getElementById('session-list');
  const empty = document.getElementById('session-empty');
  list.innerHTML = '';
  if (sessions.length === 0) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  sessions.forEach(s => {
    const card = document.createElement('div');
    card.className = 'session-card';
    const isActive = s.updatedAt && (Date.now() - new Date(s.updatedAt).getTime()) < 3600000;
    card.innerHTML = `
      <div class="session-card-icon ${isActive ? 'active' : ''}">📁</div>
      <div class="session-card-info">
        <div class="session-card-name">${escHtml(s.name)}</div>
        ${s.description ? `<div class="session-card-desc">${escHtml(s.description)}</div>` : ''}
        <div class="session-card-meta">
          <span class="session-card-stage">Stage ${s.currentStage || 1}/${s.totalStages || 9}</span>
          <span>📅 ${s.updatedAt ? new Date(s.updatedAt).toLocaleString() : ''}</span>
          ${s.completed > 0 ? `<span>✅ ${s.completed}/${s.totalStages || 9} done</span>` : ''}
        </div>
      </div>
      <div class="session-card-actions">
        <button class="btn btn-primary" onclick="event.stopPropagation(); openSession('${s.id}')">Open</button>
        <button class="btn btn-danger" onclick="deleteSession('${s.id}', event)">🗑</button>
      </div>`;
    card.onclick = () => openSession(s.id);
    list.appendChild(card);
  });
}

function renderSessionsFallback(lastId) {
  const list = document.getElementById('session-list');
  const empty = document.getElementById('session-empty');
  list.innerHTML = '';
  empty.classList.add('hidden');
  const card = document.createElement('div');
  card.className = 'session-card';
  card.innerHTML = `
    <div class="session-card-icon active">📁</div>
    <div class="session-card-info">
      <div class="session-card-name">Last session</div>
      <div class="session-card-meta">Saved in browser storage</div>
    </div>
    <div class="session-card-actions">
      <button class="btn btn-primary" onclick="event.stopPropagation(); openSession('${lastId}')">Resume</button>
    </div>`;
  card.onclick = () => openSession(lastId);
  list.appendChild(card);
}

// ─── Global config ───
const CONFIG = {
  mode: 'cloud',
  ollamaUrl: 'http://localhost:11434',
  apiKey: '',
  cloudModel: 'claude-sonnet-4-6',
  openaiKey: '',
  openaiModel: 'gpt-4o',
  geminiKey: '',
  geminiModel: 'gemini-2.0-flash',
  azureKey: '',
  azureEndpoint: '',
  azureDeployment: 'gpt-4o',
  azureModel: 'gpt-4o',
  groqKey: '',
  groqModel: 'llama3-70b-8192',
  cerebrasKey: '',
  cerebrasModel: 'llama-3.1-8b',
  openrouterKey: '',
  openrouterModel: 'deepseek/deepseek-chat'
};

const DATA_VERSION = 3; // bumped for Stage 1 PRD restructuring
const STORAGE_KEY = 'pipeline-author-data';

let currentStage = 1;
let historyOpen = false;
let assistOpen = false;
let activeAssistTab = 'chatgpt';
let activeSetupTab = 'local';

// ─── Tag History Engine ───

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
  saveToStorage();
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

// ─── Stage 1 PRD State ───

/** Get dynamic function instances based on count */
function getFunctionInstances() {
  const sd = stageData[1];
  if (!sd) return { count: 0, names: [], summaries: [], scoping: [] };
  const count = parseInt(sd.functionCount) || 0;
  if (count < 1 || count > 10) return { count: 0, names: [], summaries: [], scoping: [] };
  const names = sd.functionNames || [];
  const summaries = sd.functionSummaries || [];
  const scoping = sd.functionScoping || [];
  // Ensure arrays are big enough
  while (names.length < count) names.push('');
  while (summaries.length < count) summaries.push('');
  while (scoping.length < count) scoping.push([]);
  return { count, names, summaries, scoping };
}

/** Count answered items in a section for progress */
function countSectionAnswered(sectionId) {
  const sd = stageData[1];
  if (!sd) return [0, 0];
  let total = 0;
  let answered = 0;
  const countItems = (items) => {
    items.forEach(item => {
      if (item.type === 'statement') return;
      total++;
      const val = sd.inputs[item.id];
      if (item.type === 'yesno') {
        if (val === 'yes' || val === 'no') answered++;
      } else if (item.type === 'manual') {
        if (val && val.trim()) answered++;
      } else if (item.type === 'checkboxes') {
        if (val && Array.isArray(val) && val.length > 0) answered++;
      } else if (item.type === 'scoping') {
        if (val && Array.isArray(val) && val.length > 0) answered++;
      } else {
        if (val && val.trim()) answered++;
      }
    });
  };
  // Find the section
  const allSections = [STAGE1_PRD_DELIVERABLES, [STAGE1_INFRASTRUCTURE_SECTION], [STAGE1_EXTERNAL_SECTION]];
  for (const group of allSections) {
    for (const section of group) {
      if (section.id === sectionId && section.items) {
        countItems(section.items);
      }
    }
  }
  return [answered, total];
}

// ─── Per-stage state (updated for Stage 1 PRD) ───
let stageData = {};
PIPELINE.forEach(s => {
  stageData[s.id] = {
    manualInputs: {},
    prdIntro: { productName: '', tagline: '', targetUsers: '', problem: '', goals: '' },
    aiOutputs: {}, qaAnswers: {}, reviewAnswers: {}, reviewNotes: {},
    aiQuestions: [], completed: false, aiGenerated: false,
    modelOverride: null,
    // Stage 1 PRD fields
    inputs: {},          // all Stage 1 inputs keyed by deliverable ID
    functionCount: 0,    // D1.4.1 value
    functionNames: [],   // D1.4.2.x values
    functionSummaries: [], // D2.1.x values
    functionScoping: [],   // D2.2.x values (arrays of strings)
    infrastructure: {},    // infrastructure yes/no + follow-ups
    externalLinkages: {},  // external products
    externalCounts: {},    // { bff: 0, perm: 0, imm: 0 }
    historyLog: [],        // chronological tagged events
    d5Results: null,       // D5 LLM results
    d4ContextDiagram: '',  // D4 AI-generated
    savedJsonAt: null      // timestamp of last JSON save
  };
});

// ─── Helper ───
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
}

function toDataUri(str) {
  return 'data:text/plain;charset=utf-8,' + encodeURIComponent(str);
}

// ─── Local Storage persistence ───
function saveToStorage() {
  try {
    const data = {
      version: DATA_VERSION,
      stageData: stageData,
      currentStage: currentStage,
      config: {
        mode: CONFIG.mode,
        ollamaUrl: CONFIG.ollamaUrl,
        cloudModel: CONFIG.cloudModel,
        openaiModel: CONFIG.openaiModel,
        geminiModel: CONFIG.geminiModel,
        azureEndpoint: CONFIG.azureEndpoint,
        azureDeployment: CONFIG.azureDeployment,
        azureModel: CONFIG.azureModel
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch(e) {
    console.warn('localStorage save failed:', e.message);
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || data.version !== DATA_VERSION) return false;

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
    if (data.config) {
      Object.assign(CONFIG, data.config);
    }
    return true;
  } catch(e) {
    console.warn('localStorage load failed:', e.message);
    return false;
  }
}

function clearSavedData() {
  localStorage.removeItem(STORAGE_KEY);
  location.reload();
}

// ─── Export / Import ───
function exportPipelineJSON() {
  saveCurrentInputs();
  const data = {
    exportedAt: new Date().toISOString(),
    version: DATA_VERSION,
    stageData: stageData,
    currentStage: currentStage,
    config: {
      mode: CONFIG.mode,
      ollamaUrl: CONFIG.ollamaUrl,
      cloudModel: CONFIG.cloudModel,
      openaiModel: CONFIG.openaiModel,
      geminiModel: CONFIG.geminiModel,
      azureEndpoint: CONFIG.azureEndpoint,
      azureDeployment: CONFIG.azureDeployment,
      azureModel: CONFIG.azureModel
    }
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pipeline-snapshot.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Pipeline data exported ✓');
}

function importPipelineJSON(file) {
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.stageData) { showToast('Invalid pipeline file'); return; }
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
      if (data.currentStage) currentStage = data.currentStage;
      if (data.config) Object.assign(CONFIG, data.config);
      saveToStorage();
      buildSidebar();
      renderStage();
      showToast('Pipeline data imported ✓');
    } catch(err) {
      showToast('Import failed: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// ─── PDF Export ───
function exportPDF() {
  const html2canvasScript = document.createElement('script');
  html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  html2canvasScript.onload = function() {
    const jsPDFScript = document.createElement('script');
    jsPDFScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    jsPDFScript.onload = function() {
      const stage = PIPELINE[currentStage - 1];
      const contentEl = document.getElementById('content');
      const clone = contentEl.cloneNode(true);
      clone.style.width = '800px';
      clone.style.padding = '24px';
      clone.style.background = 'white';
      clone.style.position = 'absolute';
      clone.style.left = '-9999px';
      clone.style.top = '0';
      document.body.appendChild(clone);

      html2canvas(clone, { scale: 2, useCORS: true }).then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pdfHeight;

        while (heightLeft > 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pdfHeight;
        }

        pdf.save(`stage-${stage.id}-${stage.name.replace(/[^a-zA-Z0-9]/g,'-')}.pdf`);
        document.body.removeChild(clone);
        showToast('PDF exported ✓');
      }).catch(err => {
        document.body.removeChild(clone);
        showToast('PDF export failed: ' + err.message);
      });
    };
    document.head.appendChild(jsPDFScript);
  };
  document.head.appendChild(html2canvasScript);
}

// ─── DOCX Export ───
function exportDOCX() {
  const stage = PIPELINE[currentStage - 1];
  const sd = stageData[currentStage];

  let html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>${escHtml(stage.name)}</title></head>
<body style="font-family:Inter,sans-serif;max-width:800px;margin:auto;padding:20px;">
<h1 style="color:#1e1b3a;">Stage ${stage.id}: ${escHtml(stage.name)}</h1>
<hr style="border:1px solid #e2e0f5;">`;

  if (stage.hasPrdIntro && sd.prdIntro) {
    const p = sd.prdIntro;
    html += `<h2 style="color:#4a4770;margin-top:20px;">Product Introduction</h2>
<table style="width:100%;border-collapse:collapse;">
<tr><td style="font-weight:600;padding:4px 8px;width:140px;">Product Name</td><td style="padding:4px 8px;">${escHtml(p.productName)}</td></tr>
<tr><td style="font-weight:600;padding:4px 8px;">Tagline</td><td style="padding:4px 8px;">${escHtml(p.tagline)}</td></tr>
<tr><td style="font-weight:600;padding:4px 8px;">Target Users</td><td style="padding:4px 8px;">${escHtml(p.targetUsers)}</td></tr>
<tr><td style="font-weight:600;padding:4px 8px;">Problem</td><td style="padding:4px 8px;">${escHtml(p.problem)}</td></tr>
<tr><td style="font-weight:600;padding:4px 8px;">Goals</td><td style="padding:4px 8px;">${escHtml(p.goals)}</td></tr>
</table>`;
  }

  if (stage.manualDeliverables.length > 0) {
    html += `<h2 style="color:#4a4770;margin-top:20px;">Manual Inputs</h2>`;
    stage.manualDeliverables.forEach(d => {
      html += `<h3 style="color:#6366f1;font-size:14px;">${escHtml(d.label)}</h3>
<pre style="background:#f8f7ff;padding:10px;border-radius:6px;white-space:pre-wrap;">${escHtml(sd.manualInputs[d.id] || '')}</pre>`;
    });
  }

  if (stage.aiDeliverables.length > 0) {
    html += `<h2 style="color:#4a4770;margin-top:20px;">AI-Generated Outputs</h2>`;
    stage.aiDeliverables.forEach(d => {
      html += `<h3 style="color:#6366f1;font-size:14px;">${escHtml(d.label)}</h3>
<pre style="background:#f0fdf4;padding:10px;border-radius:6px;white-space:pre-wrap;">${escHtml(sd.aiOutputs[d.id] || '')}</pre>`;
    });
  }

  html += `</body></html>`;

  const blob = new Blob([html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stage-${stage.id}-${stage.name.replace(/[^a-zA-Z0-9]/g,'-')}.doc`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('DOCX exported ✓ (opens in Word)');
}

// ─── Export dropdown ───
let exportDropdownOpen = false;
function toggleExportDropdown() {
  exportDropdownOpen = !exportDropdownOpen;
  document.getElementById('export-dropdown-menu').classList.toggle('open', exportDropdownOpen);
}

// ─── Theme / Dark mode ───
function initTheme() {
  const saved = localStorage.getItem('pipeline-theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  if (isDark) {
    html.removeAttribute('data-theme');
    localStorage.setItem('pipeline-theme', 'light');
  } else {
    html.setAttribute('data-theme', 'dark');
    localStorage.setItem('pipeline-theme', 'dark');
  }
  document.getElementById('theme-toggle').textContent = isDark ? '🌙' : '☀️';
}

// ─── Stage model helpers ───
function getStageModels(stage) {
  const sd = stageData[stage.id];
  return sd.modelOverride || stage.models;
}

function stageModelsLabel(stage) {
  const m = getStageModels(stage);
  return m.filter(Boolean).join(' · ');
}

// ─── Provider display names ───
function getProviderLabel() {
  switch(CONFIG.mode) {
    case 'local': return '🖥 Ollama';
    case 'cloud': return '☁️ Claude';
    case 'openai': return '🤖 OpenAI';
    case 'gemini': return '✦ Gemini';
    case 'azure': return '🔷 Azure';
    case 'groq': return '🟣 Groq';
    case 'cerebras': return '🟡 Cerebras';
    case 'openrouter': return '🧡 OpenRouter';
    default: return 'Not set';
  }
}

// ─── Setup overlay ───
function switchSetupTab(tab) {
  activeSetupTab = tab;
  document.querySelectorAll('.setup-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  document.querySelectorAll('.setup-pane').forEach(el => {
    el.classList.toggle('active', el.id === 'tab-' + tab);
  });
}

function openSetup() {
  document.getElementById('setup-overlay').classList.remove('hidden');
  document.getElementById('api-key-input').value = CONFIG.apiKey;
  document.getElementById('openai-key-input').value = CONFIG.openaiKey;
  document.getElementById('gemini-key-input').value = CONFIG.geminiKey;
  document.getElementById('azure-key-input').value = CONFIG.azureKey;
  document.getElementById('ollama-url').value = CONFIG.ollamaUrl;
  document.getElementById('cloud-model-select').value = CONFIG.cloudModel;
  document.getElementById('openai-model-select').value = CONFIG.openaiModel;
  document.getElementById('gemini-model-select').value = CONFIG.geminiModel;
  document.getElementById('azure-endpoint-input').value = CONFIG.azureEndpoint;
  document.getElementById('azure-deployment-input').value = CONFIG.azureDeployment;
  document.getElementById('azure-model-select').value = CONFIG.azureModel;
  document.getElementById('groq-key-input').value = CONFIG.groqKey;
  document.getElementById('groq-model-select').value = CONFIG.groqModel;
  document.getElementById('cerebras-key-input').value = CONFIG.cerebrasKey;
  document.getElementById('cerebras-model-select').value = CONFIG.cerebrasModel;
  document.getElementById('openrouter-key-input').value = CONFIG.openrouterKey;
  document.getElementById('openrouter-model-select').value = CONFIG.openrouterModel;
  switchSetupTab(CONFIG.mode === 'local' ? 'local' : CONFIG.mode);
}

function closeSetup() {
  document.getElementById('setup-overlay').classList.add('hidden');
}

function saveSetup() {
  CONFIG.mode = activeSetupTab;
  CONFIG.ollamaUrl = document.getElementById('ollama-url').value.trim().replace(/\/$/, '');
  CONFIG.apiKey = document.getElementById('api-key-input').value.trim();
  CONFIG.cloudModel = document.getElementById('cloud-model-select').value;
  CONFIG.openaiKey = document.getElementById('openai-key-input').value.trim();
  CONFIG.openaiModel = document.getElementById('openai-model-select').value;
  CONFIG.geminiKey = document.getElementById('gemini-key-input').value.trim();
  CONFIG.geminiModel = document.getElementById('gemini-model-select').value;
  CONFIG.azureKey = document.getElementById('azure-key-input').value.trim();
  CONFIG.azureEndpoint = document.getElementById('azure-endpoint-input').value.trim().replace(/\/$/, '');
  CONFIG.azureDeployment = document.getElementById('azure-deployment-input').value.trim();
  CONFIG.azureModel = document.getElementById('azure-model-select').value;
  CONFIG.groqKey = document.getElementById('groq-key-input').value.trim();
  CONFIG.groqModel = document.getElementById('groq-model-select').value;
  CONFIG.cerebrasKey = document.getElementById('cerebras-key-input').value.trim();
  CONFIG.cerebrasModel = document.getElementById('cerebras-model-select').value;
  CONFIG.openrouterKey = document.getElementById('openrouter-key-input').value.trim();
  CONFIG.openrouterModel = document.getElementById('openrouter-model-select').value;

  if (CONFIG.mode === 'cloud' && !CONFIG.apiKey) {
    document.getElementById('setup-footer-status').textContent = '⚠️ Please enter an API key for cloud mode.';
    document.getElementById('setup-footer-status').style.color = 'var(--danger)';
    return;
  }
  if (CONFIG.mode === 'openai' && !CONFIG.openaiKey) {
    document.getElementById('setup-footer-status').textContent = '⚠️ Please enter an OpenAI API key.';
    document.getElementById('setup-footer-status').style.color = 'var(--danger)';
    return;
  }
  if (CONFIG.mode === 'gemini' && !CONFIG.geminiKey) {
    document.getElementById('setup-footer-status').textContent = '⚠️ Please enter a Gemini API key.';
    document.getElementById('setup-footer-status').style.color = 'var(--danger)';
    return;
  }
  if (CONFIG.mode === 'azure' && (!CONFIG.azureKey || !CONFIG.azureEndpoint || !CONFIG.azureDeployment)) {
    document.getElementById('setup-footer-status').textContent = '⚠️ Please fill in all Azure fields.';
    document.getElementById('setup-footer-status').style.color = 'var(--danger)';
    return;
  }
  if (CONFIG.mode === 'groq' && !CONFIG.groqKey) {
    document.getElementById('setup-footer-status').textContent = '⚠️ Please enter a Groq API key.';
    document.getElementById('setup-footer-status').style.color = 'var(--danger)';
    return;
  }
  if (CONFIG.mode === 'cerebras' && !CONFIG.cerebrasKey) {
    document.getElementById('setup-footer-status').textContent = '⚠️ Please enter a Cerebras API key.';
    document.getElementById('setup-footer-status').style.color = 'var(--danger)';
    return;
  }
  if (CONFIG.mode === 'openrouter' && !CONFIG.openrouterKey) {
    document.getElementById('setup-footer-status').textContent = '⚠️ Please enter an OpenRouter API key.';
    document.getElementById('setup-footer-status').style.color = 'var(--danger)';
    return;
  }

  closeSetup();
  updateSetupIndicator();
  saveToStorage();
  showToast(getProviderLabel() + ' mode active');
}

function updateSetupIndicator() {
  const btn = document.getElementById('setup-reopen-btn');
  const label = getProviderLabel();
  btn.innerHTML = `⚙️ Connection Setup <span style="font-size:9px;padding:1px 6px;border-radius:8px;margin-left:4px;">${label}</span>`;
}

function toggleKeyVisibility(inputId) {
  const inp = document.getElementById(inputId);
  inp.type = inp.type === 'password' ? 'text' : 'password';
}

// ─── Provider test functions ───
async function testOllama() {
  const url = document.getElementById('ollama-url').value.trim().replace(/\/$/, '');
  const el = document.getElementById('ollama-test-result');
  el.textContent = 'Testing…'; el.style.color = 'var(--text-3)';
  try {
    const r = await fetch(url + '/api/tags', { signal: AbortSignal.timeout(4000) });
    if (r.ok) {
      const d = await r.json();
      const names = (d.models || []).map(m => m.name).slice(0, 3).join(', ');
      el.textContent = '✅ Connected — models: ' + (names || 'none pulled yet');
      el.style.color = 'var(--success)';
    } else { throw new Error('HTTP ' + r.status); }
  } catch(e) {
    el.textContent = '❌ Could not reach Ollama (' + e.message + ')';
    el.style.color = 'var(--danger)';
  }
}

async function testCloudAPI() {
  const key = document.getElementById('api-key-input').value.trim();
  const model = document.getElementById('cloud-model-select').value;
  const el = document.getElementById('cloud-test-result');
  if (!key) { el.textContent = '⚠️ Enter an API key first'; el.style.color = 'var(--warning)'; return; }
  el.textContent = 'Testing…'; el.style.color = 'var(--text-3)';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] })
    });
    if (r.ok) {
      el.textContent = '✅ API key valid — ' + model;
      el.style.color = 'var(--success)';
    } else {
      const d = await r.json();
      el.textContent = '❌ ' + (d.error?.message || 'Invalid key');
      el.style.color = 'var(--danger)';
    }
  } catch(e) {
    el.textContent = '❌ ' + e.message;
    el.style.color = 'var(--danger)';
  }
}

async function testOpenAI() {
  const key = document.getElementById('openai-key-input').value.trim();
  const model = document.getElementById('openai-model-select').value;
  const el = document.getElementById('openai-test-result');
  if (!key) { el.textContent = '⚠️ Enter an API key first'; el.style.color = 'var(--warning)'; return; }
  el.textContent = 'Testing…'; el.style.color = 'var(--text-3)';
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] })
    });
    if (r.ok) {
      el.textContent = '✅ API key valid — ' + model;
      el.style.color = 'var(--success)';
    } else {
      const d = await r.json();
      el.textContent = '❌ ' + (d.error?.message || 'Invalid key');
      el.style.color = 'var(--danger)';
    }
  } catch(e) {
    el.textContent = '❌ ' + e.message;
    el.style.color = 'var(--danger)';
  }
}

async function testGemini() {
  const key = document.getElementById('gemini-key-input').value.trim();
  const model = document.getElementById('gemini-model-select').value;
  const el = document.getElementById('gemini-test-result');
  if (!key) { el.textContent = '⚠️ Enter an API key first'; el.style.color = 'var(--warning)'; return; }
  el.textContent = 'Testing…'; el.style.color = 'var(--text-3)';
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }] })
    });
    if (r.ok) {
      el.textContent = '✅ API key valid — ' + model;
      el.style.color = 'var(--success)';
    } else {
      const d = await r.json();
      el.textContent = '❌ ' + (d.error?.message || 'Invalid key');
      el.style.color = 'var(--danger)';
    }
  } catch(e) {
    el.textContent = '❌ ' + e.message;
    el.style.color = 'var(--danger)';
  }
}

async function testAzure() {
  const key = document.getElementById('azure-key-input').value.trim();
  const endpoint = document.getElementById('azure-endpoint-input').value.trim().replace(/\/$/, '');
  const deployment = document.getElementById('azure-deployment-input').value.trim();
  const el = document.getElementById('azure-test-result');
  if (!key || !endpoint || !deployment) { el.textContent = '⚠️ Fill in all fields first'; el.style.color = 'var(--warning)'; return; }
  el.textContent = 'Testing…'; el.style.color = 'var(--text-3)';
  try {
    const r = await fetch(`${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-01`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': key },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }], max_tokens: 10 })
    });
    if (r.ok) {
      el.textContent = '✅ Connected — ' + deployment;
      el.style.color = 'var(--success)';
    } else {
      const d = await r.json();
      el.textContent = '❌ ' + (d.error?.message || 'Connection failed');
      el.style.color = 'var(--danger)';
    }
  } catch(e) {
    el.textContent = '❌ ' + e.message;
    el.style.color = 'var(--danger)';
  }
}

// ─── Model modal ───
function openModelModal() {
  const stage = PIPELINE[currentStage - 1];
  const models = getStageModels(stage);
  document.getElementById('model-primary').value = models[0] || '';
  document.getElementById('model-secondary').value = models[1] || '';

  ['primary', 'secondary'].forEach(slot => {
    const el = document.getElementById(slot + '-presets');
    el.innerHTML = '';
    LOCAL_PRESETS.forEach(m => {
      const b = document.createElement('button');
      b.className = 'model-preset-btn';
      b.textContent = m;
      b.onclick = () => { document.getElementById('model-' + slot).value = m; };
      el.appendChild(b);
    });
    CLOUD_PRESETS.forEach(m => {
      const b = document.createElement('button');
      b.className = 'model-preset-btn cloud-preset';
      b.textContent = m;
      b.onclick = () => { document.getElementById('model-' + slot).value = m; };
      el.appendChild(b);
    });
  });

  document.getElementById('model-modal').classList.remove('hidden');
}

function closeModelModal() {
  document.getElementById('model-modal').classList.add('hidden');
}

function saveModelOverride() {
  const primary = document.getElementById('model-primary').value.trim();
  const secondary = document.getElementById('model-secondary').value.trim();
  if (!primary) { showToast('Primary model is required'); return; }
  const sd = stageData[currentStage];
  sd.modelOverride = [primary, secondary].filter(Boolean);
  closeModelModal();
  const label = sd.modelOverride.join(' · ');
  document.getElementById('topbar-models-text').textContent = label;
  saveToStorage();
  showToast('Models updated for this stage ✓');
}

// ─── Sidebar ───
function buildSidebar() {
  const list = document.getElementById('stage-list');
  list.innerHTML = '';
  PIPELINE.forEach(stage => {
    const item = document.createElement('div');
    item.className = 'stage-item'
      + (stage.isGate ? ' gate' : '')
      + (stageData[stage.id].completed ? ' completed' : '')
      + (stage.id === currentStage ? ' active' : '');
    item.onclick = () => goStage(stage.id);
    item.innerHTML = `
      <div class="stage-num">${stage.isGate ? '⛩' : stage.id}</div>
      <div class="stage-info">
        <div class="stage-name">${escHtml(stage.name)}</div>
        <div class="stage-type-tag">${escHtml(stage.type)}${stage.isGate ? ' — GATE' : ''}</div>
      </div>
      <div class="stage-status-dot"></div>`;
    list.appendChild(item);
  });
  const done = PIPELINE.filter(s => stageData[s.id].completed).length;
  const pct = Math.round((done / PIPELINE.length) * 100);
  document.getElementById('sf-progress-bar').style.width = pct + '%';
  document.getElementById('sf-progress-text').textContent = `Progress: ${done} of ${PIPELINE.length} stages done`;
  document.getElementById('progress-bar').style.width = pct + '%';
  saveToStorage();
}

function goStage(n) {
  if (n < 1 || n > PIPELINE.length) return;
  saveCurrentInputs();
  currentStage = n;
  buildSidebar();
  renderStage();
}

function saveCurrentInputs() {
  const stage = PIPELINE[currentStage - 1];
  const sd = stageData[currentStage];

  // Stage 1 PRD saving
  if (stage.isStage1PRD) {
    // Save all input fields
    document.querySelectorAll('[data-stage1-id]').forEach(el => {
      const id = el.dataset.stage1Id;
      if (el.type === 'checkbox') {
        if (el.dataset.stage1Type === 'yesno') {
          // Yes/no radio buttons are handled via click handlers
        } else if (el.dataset.stage1Type === 'scoping') {
          if (!sd.functionScoping[id]) sd.functionScoping[id] = [];
          const idx = sd.functionScoping[id].indexOf(el.value);
          if (el.checked && idx === -1) sd.functionScoping[id].push(el.value);
          else if (!el.checked && idx > -1) sd.functionScoping[id].splice(idx, 1);
        } else if (el.dataset.stage1Type === 'checkbox-group') {
          if (!sd.inputs[id]) sd.inputs[id] = [];
          if (el.checked && !sd.inputs[id].includes(el.value)) sd.inputs[id].push(el.value);
          else if (!el.checked) sd.inputs[id] = sd.inputs[id].filter(v => v !== el.value);
        }
      } else if (el.type === 'radio') {
        if (el.checked) {
          sd.inputs[id] = el.value;
        }
      } else {
        sd.inputs[id] = el.value;
      }
    });
    // Save function count
    const fc = document.getElementById('s1-func-count');
    if (fc) sd.functionCount = parseInt(fc.value) || 0;
    // Save function names
    sd.functionNames = [];
    document.querySelectorAll('[data-stage1-fn="name"]').forEach(el => {
      const idx = parseInt(el.dataset.idx);
      sd.functionNames[idx] = el.value;
    });
    // Save function summaries
    sd.functionSummaries = [];
    document.querySelectorAll('[data-stage1-fn="summary"]').forEach(el => {
      const idx = parseInt(el.dataset.idx);
      sd.functionSummaries[idx] = el.value;
    });
    saveToStorage();
    return;
  }

  // PRD intro (stage 1 legacy - keep for backward compat)
  if (stage.hasPrdIntro) {
    ['productName','tagline','targetUsers','problem','goals'].forEach(f => {
      const el = document.getElementById('intro-' + f);
      if (el) sd.prdIntro[f] = el.value;
    });
  }

  stage.manualDeliverables.forEach(d => {
    const el = document.getElementById('input-' + d.id);
    if (el) sd.manualInputs[d.id] = el.value;
  });

  (sd.aiQuestions || []).forEach((q, i) => {
    const el = document.getElementById('qa-answer-' + i);
    if (el) sd.qaAnswers[i] = el.value;
  });

  if (stage.gateReviews) {
    stage.gateReviews.forEach(r => {
      const el = document.getElementById('review-notes-' + r.id);
      if (el) sd.reviewNotes[r.id] = el.value;
    });
  }
  saveToStorage();
}

// ─── Render ───
function renderStage() {
  const stage = PIPELINE[currentStage - 1];
  const sd = stageData[currentStage];
  const content = document.getElementById('content');
  content.innerHTML = '';

  document.getElementById('topbar-stage-badge').textContent = 'Stage ' + stage.id;
  document.getElementById('topbar-stage-badge').className = stage.isGate ? 'gate' : '';
  document.getElementById('topbar-title').textContent = stage.name;
  document.getElementById('topbar-models-text').textContent = stageModelsLabel(stage);

  // Show Stage 1 PRD UI if applicable
  if (stage.isStage1PRD) {
    renderStage1PRD(content);
    // Update the toolbar for Stage 1
    const btnAction = document.getElementById('btn-action');
    const btnNext = document.getElementById('btn-next');
    btnAction.style.display = 'none';
    btnNext.disabled = true;
    document.getElementById('status-msg').textContent = 'Complete all sections to enable D5 Auto-Checks →';
    return;
  }

  // Config warning if not set up (for stages 2+)
  const setupChecks = [
    { mode: 'cloud', key: 'apiKey' }, { mode: 'openai', key: 'openaiKey' },
    { mode: 'gemini', key: 'geminiKey' }, { mode: 'groq', key: 'groqKey' },
    { mode: 'cerebras', key: 'cerebrasKey' }, { mode: 'openrouter', key: 'openrouterKey' }
  ];
  for (const sc of setupChecks) {
    if (CONFIG.mode === sc.mode && !CONFIG[sc.key]) {
      const w = document.createElement('div');
      w.className = 'warn-strip';
      w.innerHTML = `<span class="warn-strip-icon">⚠️</span><span>No ${sc.mode} API key configured. <strong>Click "Connection Setup"</strong> in the sidebar.</span>`;
      content.appendChild(w);
      break;
    }
  }
  if (CONFIG.mode === 'azure' && (!CONFIG.azureKey || !CONFIG.azureEndpoint || !CONFIG.azureDeployment)) {
    const w = document.createElement('div');
    w.className = 'warn-strip';
    w.innerHTML = `<span class="warn-strip-icon">⚠️</span><span>Azure not fully configured. <strong>Click "Connection Setup"</strong> in the sidebar.</span>`;
    content.appendChild(w);
  }

  if (stage.note) {
    const note = document.createElement('div');
    note.className = 'info-strip';
    note.innerHTML = `<strong>ℹ️ Stage note:</strong> ${escHtml(stage.note)}`;
    content.appendChild(note);
  }

  if (stage.hasPrdIntro) {
    renderPrdIntro(sd, content);
  }

  if (stage.manualDeliverables.length > 0) {
    const card = document.createElement('div');
    card.className = 'section-card';
    card.innerHTML = `
      <div class="section-header human">
        <span class="section-icon">✍️</span>
        Your inputs — manual authoring required
      </div>
      <div class="section-body"><div class="deliverables-list" id="manual-deliverables"></div></div>`;
    content.appendChild(card);
    const list = card.querySelector('#manual-deliverables');
    stage.manualDeliverables.forEach(d => {
      const item = document.createElement('div');
      item.className = 'deliverable-item';
      item.innerHTML = `
        <div class="deliverable-label">
          ${escHtml(d.label)}
          <span class="d-badge ${d.badge}">${d.badge === 'manual' ? 'You write this' : 'AI generates'}</span>
        </div>
        <textarea class="d-input" id="input-${d.id}" placeholder="${escHtml(d.placeholder)}">${escHtml(sd.manualInputs[d.id] || '')}</textarea>`;
      list.appendChild(item);
    });
  }

  if (stage.aiDeliverables.length > 0) {
    const card = document.createElement('div');
    card.className = 'section-card';
    card.innerHTML = `
      <div class="section-header ai">
        <span class="section-icon">🤖</span>
        AI-generated outputs
        ${!sd.aiGenerated ? '<span style="font-size:10px;font-weight:400;margin-left:auto;opacity:0.7;">Click "Generate AI Output" to populate</span>' : ''}
      </div>
      <div class="section-body"><div class="deliverables-list" id="ai-deliverables"></div></div>`;
    content.appendChild(card);
    const list = card.querySelector('#ai-deliverables');
    stage.aiDeliverables.forEach(d => {
      const item = document.createElement('div');
      item.className = 'deliverable-item';
      const out = sd.aiOutputs[d.id];
      item.innerHTML = `
        <div class="deliverable-label">${escHtml(d.label)}<span class="d-badge ai-gen">AI generated</span></div>
        <div class="ai-output-box" id="ai-out-${d.id}">${out ? escHtml(out) : '<span style="opacity:0.5;font-style:italic;">Not yet generated</span>'}</div>`;
      list.appendChild(item);
    });
  }

  if (sd.aiGenerated && sd.aiQuestions && sd.aiQuestions.length > 0) {
    renderQASection(stage, sd, content);
  }

  if (stage.gateReviews && sd.aiGenerated) {
    renderGateReview(stage, sd, content);
  }

  updateToolbar(stage, sd);
}

// ─── Stage 1 PRD Renderer ───

/** Main Stage 1 renderer with accordion sections */
function renderStage1PRD(content) {
  const sd = stageData[1];

  // Header with save button and progress
  const header = document.createElement('div');
  header.className = 's1-header';
  header.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
      <div>
        <h2 style="margin:0;font-size:18px;">📋 Product Requirements Document</h2>
        <p style="margin:4px 0 0;font-size:12px;color:var(--text-3);">Answer all questions to generate D5 Auto-Checks and D4 Context Diagram</p>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn" onclick="saveStage1JSON()" title="Save all data to JSON file">💾 Save JSON</button>
        <button class="btn" onclick="toggleHistory()" title="View tag history">📜 History</button>
      </div>
    </div>`;
  content.appendChild(header);

  // Render each accordion section
  STAGE1_PRD_DELIVERABLES.forEach(section => {
    renderAccordionSection(section, content);
  });

  // Render infrastructure section
  renderInfrastructureSection(content);

  // Render external linkages section
  renderExternalSection(content);

  // D5 Auto-Checks section
  renderD5Section(content);

  // D4 Context Diagram section
  renderD4Section(content);
}

/** Render an accordion section */
function renderAccordionSection(section, container) {
  const sd = stageData[1];
  const [answered, total] = countSectionAnswered(section.id);
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  const accordion = document.createElement('div');
  accordion.className = 's1-accordion';
  const isOpen = section.id === 'section_basics'; // First section open by default
  accordion.innerHTML = `
    <div class="s1-accordion-header ${isOpen ? 'open' : ''}" onclick="toggleAccordion(this)">
      <div class="s1-accordion-title">
        <span>${escHtml(section.title)}</span>
        <span class="s1-progress-badge" style="margin-left:8px;">${answered}/${total}</span>
      </div>
      <div class="s1-accordion-toggle">${isOpen ? '▼' : '▶'}</div>
    </div>
    <div class="s1-accordion-body" style="display:${isOpen ? 'block' : 'none'}">
      <div class="s1-progress-bar-container">
        <div class="s1-progress-bar" style="width:${pct}%"></div>
      </div>
      <div class="s1-items"></div>
    </div>`;
  container.appendChild(accordion);

  const itemsContainer = accordion.querySelector('.s1-items');
  section.items.forEach(item => {
    const el = renderStage1Item(item, section.id);
    if (el) itemsContainer.appendChild(el);
  });
}

/** Render a single Stage 1 item (manual, statement, yesno, etc.) */
function renderStage1Item(item, sectionId) {
  const sd = stageData[1];
  const val = sd.inputs[item.id] || '';
  const container = document.createElement('div');

  // Statement type — just display text
  if (item.type === 'statement') {
    container.className = 's1-statement';
    container.innerHTML = `<div class="s1-statement-icon">📌</div><div>${escHtml(item.desc)}</div>`;
    return container;
  }

  // Manual text input
  if (item.type === 'manual') {
    container.className = 's1-item';
    // Check if this is the function count input
    if (item.isFunctionCount) {
      const currentCount = sd.functionCount || 0;
      container.innerHTML = `
        <div class="s1-item-label">
          <span class="s1-item-id">${escHtml(item.id)}</span>
          ${escHtml(item.desc)}
          <span class="s1-tag-badge" id="tag-${item.id}"></span>
        </div>
        <div class="s1-item-hint">${escHtml(item.hint)}</div>
        <input type="number" id="s1-func-count" class="s1-input" min="1" max="${item.maxCount || 10}" value="${currentCount || ''}" placeholder="Enter number (1-${item.maxCount || 10})" data-stage1-id="${item.id}"
          onchange="onFunctionCountChange(this.value)" />
        <div id="s1-func-instances"></div>`;
    } else {
      container.innerHTML = `
        <div class="s1-item-label">
          <span class="s1-item-id">${escHtml(item.id)}</span>
          ${escHtml(item.desc)}
          <span class="s1-tag-badge" id="tag-${item.id}"></span>
        </div>
        <div class="s1-item-hint">${escHtml(item.hint)}</div>
        <textarea class="s1-textarea" data-stage1-id="${item.id}" placeholder="Enter your answer…" onchange="onStage1InputChange('${item.id}', this.value)">${escHtml(val)}</textarea>`;
    }
    // Update tag badge
    updateTagBadge(item.id, sectionId, val);
    return container;
  }

  // Yes/No toggle
  if (item.type === 'yesno') {
    container.className = 's1-item';
    const isYes = val === 'yes';
    const isNo = val === 'no';
    let followUpHtml = '';
    if (isYes && item.followUpYes) {
      followUpHtml = '<div class="s1-followups" id="followups-' + item.id + '">';
      item.followUpYes.forEach(fu => {
        const fuVal = sd.inputs[fu.id] || '';
        followUpHtml += `
          <div class="s1-followup-item">
            <div class="s1-item-label" style="font-size:12px;padding-left:24px;">
              <span class="s1-item-id">${escHtml(fu.id)}</span>
              ${escHtml(fu.desc)}
            </div>
            <textarea class="s1-textarea" style="margin-left:24px;width:calc(100% - 24px);" data-stage1-id="${fu.id}" placeholder="Describe…">${escHtml(fuVal)}</textarea>
          </div>`;
      });
      followUpHtml += '</div>';
    }
    // Infrastructure follow-ups
    if (isYes && item.infraFollowUps) {
      followUpHtml = '<div class="s1-followups" id="followups-' + item.id + '">';
      item.infraFollowUps.forEach(fu => {
        const fuVal = sd.inputs[fu.id] || '';
        followUpHtml += `
          <div class="s1-followup-item">
            <div class="s1-item-label" style="font-size:12px;padding-left:24px;">
              <span class="s1-item-id">${escHtml(fu.id)}</span>
              ${escHtml(fu.desc)}
            </div>
            <div class="s1-item-hint" style="padding-left:24px;font-size:11px;">${escHtml(fu.hint)}</div>
            <input class="s1-input" style="margin-left:24px;width:calc(100% - 24px);" data-stage1-id="${fu.id}" value="${escHtml(fuVal)}" placeholder="Enter answer…" />
          </div>`;
      });
      followUpHtml += '</div>';
    }

    container.innerHTML = `
      <div class="s1-item-label">
        <span class="s1-item-id">${escHtml(item.id)}</span>
        ${escHtml(item.desc)}
        <span class="s1-tag-badge" id="tag-${item.id}"></span>
      </div>
      <div class="s1-item-hint">${escHtml(item.hint)}</div>
      <div class="s1-yesno-group">
        <label class="s1-yesno-opt ${isYes ? 'selected' : ''}">
          <input type="radio" name="radio-${item.id}" value="yes" data-stage1-id="${item.id}" data-stage1-type="yesno" ${isYes ? 'checked' : ''}
            onchange="onYesNoChange('${item.id}', 'yes', ${JSON.stringify(item.followUpYes || item.infraFollowUps || null)}, this)" /> ✅ Yes
        </label>
        <label class="s1-yesno-opt ${isNo ? 'selected' : ''}">
          <input type="radio" name="radio-${item.id}" value="no" data-stage1-id="${item.id}" data-stage1-type="yesno" ${isNo ? 'checked' : ''}
            onchange="onYesNoChange('${item.id}', 'no', null, this)" /> ❌ No
        </label>
      </div>
      ${followUpHtml}`;
    updateTagBadge(item.id, sectionId, val);
    return container;
  }

  // Checkboxes (for D3.2 type)
  if (item.type === 'checkboxes') {
    container.className = 's1-item';
    const selected = sd.inputs[item.id] || [];
    let optionsHtml = item.options.map(opt => `
      <label class="s1-checkbox-opt">
        <input type="checkbox" data-stage1-id="${item.id}" data-stage1-type="checkbox-group" value="${escHtml(opt)}" ${selected.includes(opt) ? 'checked' : ''}
          onchange="onStage1CheckboxChange('${item.id}', '${escHtml(opt)}', this.checked)" />
        ${escHtml(opt)}
      </label>
    `).join('');
    container.innerHTML = `
      <div class="s1-item-label">
        <span class="s1-item-id">${escHtml(item.id)}</span>
        ${escHtml(item.desc)}
        <span class="s1-tag-badge" id="tag-${item.id}"></span>
      </div>
      <div class="s1-item-hint">${escHtml(item.hint)}</div>
      <div class="s1-checkbox-group">${optionsHtml}</div>`;
    updateTagBadge(item.id, sectionId, selected.length > 0 ? 'yes' : '');
    return container;
  }

  return null;
}

/** Render the infrastructure section with yes/no items */
function renderInfrastructureSection(container) {
  const sd = stageData[1];
  const section = STAGE1_INFRASTRUCTURE_SECTION;
  const [answered, total] = countSectionAnswered(section.id);
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;

  const accordion = document.createElement('div');
  accordion.className = 's1-accordion';
  accordion.innerHTML = `
    <div class="s1-accordion-header" onclick="toggleAccordion(this)">
      <div class="s1-accordion-title">
        <span>${escHtml(section.title)}</span>
        <span class="s1-progress-badge" style="margin-left:8px;">${answered}/${total}</span>
      </div>
      <div class="s1-accordion-toggle">▶</div>
    </div>
    <div class="s1-accordion-body" style="display:none">
      <div class="s1-progress-bar-container">
        <div class="s1-progress-bar" style="width:${pct}%"></div>
      </div>
      <div class="s1-items"></div>
    </div>`;
  container.appendChild(accordion);

  const itemsContainer = accordion.querySelector('.s1-items');
  section.items.forEach(item => {
    const el = renderStage1Item(item, section.id);
    if (el) {
      // For statement items in infrastructure
      if (item.type === 'statement') {
        el.className = 's1-statement';
        el.innerHTML = `<div class="s1-statement-icon">📌</div><div>${escHtml(item.desc)}</div>`;
      }
      itemsContainer.appendChild(el);
    }
  });
}

/** Render external linkages section */
function renderExternalSection(container) {
  const sd = stageData[1];
  const section = STAGE1_EXTERNAL_SECTION;
  const [answered, total] = countSectionAnswered(section.id);

  const accordion = document.createElement('div');
  accordion.className = 's1-accordion';
  accordion.innerHTML = `
    <div class="s1-accordion-header" onclick="toggleAccordion(this)">
      <div class="s1-accordion-title">
        <span>${escHtml(section.title)}</span>
        <span class="s1-progress-badge" style="margin-left:8px;">${answered}/${total}</span>
      </div>
      <div class="s1-accordion-toggle">▶</div>
    </div>
    <div class="s1-accordion-body" style="display:none">
      <div class="s1-items"></div>
    </div>`;
  container.appendChild(accordion);

  const itemsContainer = accordion.querySelector('.s1-items');
  section.items.forEach(item => {
    if (item.type === 'statement') {
      const st = document.createElement('div');
      st.className = 's1-statement';
      st.innerHTML = `<div class="s1-statement-icon">📌</div><div>${escHtml(item.desc)}</div>`;
      itemsContainer.appendChild(st);
    } else if (item.type === 'yesno') {
      const el = renderStage1Item(item, section.id);
      if (el) itemsContainer.appendChild(el);
    } else if (item.type === 'checkboxes') {
      const el = renderStage1Item(item, section.id);
      if (el) itemsContainer.appendChild(el);
    }
  });

  // Dynamic external fields (D3.3.x, D3.4.x, D3.5.x)
  const externalCounts = sd.externalCounts || { bff: 0, perm: 0, imm: 0 };
  ['bff', 'perm', 'imm'].forEach(type => {
    let countKey, template;
    if (type === 'bff') { countKey = 'D3.3'; template = STAGE1_EXTERNAL_DYNAMIC[0]; }
    else if (type === 'perm') { countKey = 'D3.4'; template = STAGE1_EXTERNAL_DYNAMIC[1]; }
    else { countKey = 'D3.5'; template = STAGE1_EXTERNAL_DYNAMIC[2]; }

    const count = externalCounts[type === 'bff' ? type : type] || 0;
    if (count > 0) {
      for (let i = 1; i <= count; i++) {
        const id = template.template.replace('{n}', type + '_' + i);
        const label = template.desc.replace('{n}', String(i));
        const val = sd.inputs[id] || '';
        const item = document.createElement('div');
        item.className = 's1-item';
        item.innerHTML = `
          <div class="s1-item-label">
            <span class="s1-item-id">${id}</span>
            ${escHtml(label)}
          </div>
          <div class="s1-item-hint">${escHtml(template.hint)}</div>
          <input class="s1-input" data-stage1-id="${id}" value="${escHtml(val)}" placeholder="Enter external product name…" />
        `;
        itemsContainer.appendChild(item);
      }
    }

    // Add button for each
    const addBtn = document.createElement('div');
    addBtn.className = 's1-add-btn';
    addBtn.innerHTML = `➕ Add external product (${type === 'bff' ? 'BFF' : type === 'perm' ? 'Database' : 'In-Memory'})`;
    const currCount = count;
    addBtn.onclick = () => {
      sd.externalCounts = sd.externalCounts || { bff: 0, perm: 0, imm: 0 };
      sd.externalCounts[type === 'bff' ? 'bff' : type]++;
      saveToStorage();
      renderStage(); // Re-render
    };
    itemsContainer.appendChild(addBtn);
  });
}

/** Render D5 section and D4 */
function renderD5Section(container) {
  const sd = stageData[1];
  const accordion = document.createElement('div');
  accordion.className = 's1-accordion';
  const hasResults = sd.d5Results !== null;
  accordion.innerHTML = `
    <div class="s1-accordion-header" onclick="toggleAccordion(this)">
      <div class="s1-accordion-title">
        <span>🔍 Auto-Generated Checks (D5)</span>
        ${hasResults ? '<span class="s1-progress-badge" style="background:var(--success);color:white;">✓ Complete</span>' : ''}
      </div>
      <div class="s1-accordion-toggle">▶</div>
    </div>
    <div class="s1-accordion-body" style="display:none">
      <div class="s1-items">
        <div class="s1-statement">
          <div class="s1-statement-icon">📌</div>
          <div>Autogenerated checks start. These will be generated by the LLM once all manual inputs are completed.</div>
        </div>
        <div style="padding:16px;">
          <p style="font-size:13px;color:var(--text-3);">The LLM will review all collected data and perform:
            <br/>1. <strong>Self-checks:</strong> Does each function summary match its expected infrastructure impact?
            <br/>2. <strong>Cross-checks:</strong> Do functions overlap? Can they be combined?
            <br/>3. <strong>Ambiguity & assumption analysis</strong></p>
          <button class="btn btn-primary" onclick="runD5Checks()" ${hasResults ? '' : ''} id="btn-d5-run">
            ${hasResults ? '↻ Re-run D5 Checks' : '▶ Run D5 Auto-Checks'}
          </button>
        </div>
        <div id="s1-d5-results">${hasResults ? escHtml(sd.d5Results) : ''}</div>
      </div>
    </div>`;
  container.appendChild(accordion);
}

function renderD4Section(container) {
  const sd = stageData[1];
  const accordion = document.createElement('div');
  accordion.className = 's1-accordion';
  const hasD4 = !!sd.d4ContextDiagram;
  accordion.innerHTML = `
    <div class="s1-accordion-header" onclick="toggleAccordion(this)">
      <div class="s1-accordion-title">
        <span>🏗️ Context Diagram of Product (D4)</span>
        ${hasD4 ? '<span class="s1-progress-badge" style="background:var(--success);color:white;">✓ Generated</span>' : ''}
      </div>
      <div class="s1-accordion-toggle">▶</div>
    </div>
    <div class="s1-accordion-body" style="display:none">
      <div class="s1-items">
        <div style="padding:16px;">
          <p style="font-size:13px;color:var(--text-3);">Based on the reviewed inputs, the LLM will generate a C4 Context Diagram describing the entire product.</p>
          <button class="btn" onclick="runD4Generation()" ${hasD4 ? '' : ''} id="btn-d4-run">
            ${hasD4 ? '↻ Re-generate D4' : '▶ Generate D4 Context Diagram'}
          </button>
        </div>
        <div id="s1-d4-result" style="padding:0 16px 16px;">
          ${hasD4 ? `<pre style="background:var(--bg-2);padding:12px;border-radius:6px;white-space:pre-wrap;">${escHtml(sd.d4ContextDiagram)}</pre>` : ''}
        </div>
      </div>
    </div>`;
  container.appendChild(accordion);
}

// ─── Stage 1 Event Handlers ───

function toggleAccordion(header) {
  const body = header.nextElementSibling;
  const isOpen = body.style.display === 'block';
  body.style.display = isOpen ? 'none' : 'block';
  header.classList.toggle('open', !isOpen);
  header.querySelector('.s1-accordion-toggle').textContent = isOpen ? '▶' : '▼';
}

function onFunctionCountChange(val) {
  const sd = stageData[1];
  const count = Math.min(Math.max(parseInt(val) || 0, 0), 10);
  sd.functionCount = count;
  // Resize arrays
  while (sd.functionNames.length < count) sd.functionNames.push('');
  while (sd.functionSummaries.length < count) sd.functionSummaries.push('');
  while (sd.functionScoping.length < count) sd.functionScoping.push([]);

  // Tag the function count entry
  const tag = getManualTag('D1.4.1');
  const fmtTag = formatTag('D1.4.1', tag);
  logTag('section_functions', 'D1.4.1', tag, String(count), 'Function count set to ' + count);
  updateTagBadge('D1.4.1', 'section_functions', String(count));

  // Re-render the function instances
  const container = document.getElementById('s1-func-instances');
  if (!container) return;
  renderFunctionInstances(count, container);
  saveToStorage();
}

function renderFunctionInstances(count, container) {
  const sd = stageData[1];
  let html = '';

  // Function names
  if (count > 0) {
    html += '<div class="s1-subsection-title">Function Names</div>';
    for (let i = 0; i < count; i++) {
      const val = sd.functionNames[i] || '';
      html += `<div class="s1-item" style="padding-left:16px;border-left:2px solid var(--accent);margin:4px 0;">
        <div class="s1-item-label"><span class="s1-item-id">D1.4.2.${i+1}</span> Name of function ${i+1}</div>
        <input class="s1-input" data-stage1-fn="name" data-idx="${i}" value="${escHtml(val)}" placeholder="Enter function name…" onchange="onFunctionNameChange(${i}, this.value)" />
        <span class="s1-tag-badge" id="tag-D1.4.2.${i+1}"></span>
      </div>`;
    }

    // Function summaries
    html += '<div class="s1-subsection-title" style="margin-top:12px;">Function Summaries</div>';
    for (let i = 0; i < count; i++) {
      const val = sd.functionSummaries[i] || '';
      html += `<div class="s1-item" style="padding-left:16px;border-left:2px solid var(--accent-alt);margin:4px 0;">
        <div class="s1-item-label"><span class="s1-item-id">D2.1.${i+1}</span> Function ${i+1} summary</div>
        <div class="s1-item-hint">Describe what this function does, its inputs, outputs, and who uses it.</div>
        <textarea class="s1-textarea" data-stage1-fn="summary" data-idx="${i}" placeholder="Enter function summary…">${escHtml(val)}</textarea>
        <span class="s1-tag-badge" id="tag-D2.1.${i+1}"></span>
      </div>`;
    }

    // Function scoping
    html += '<div class="s1-subsection-title" style="margin-top:12px;">Function Impact Scoping</div>';
    for (let i = 0; i < count; i++) {
      const selected = sd.functionScoping[i] || [];
      let checks = SCOPING_OPTIONS.map(opt => `
        <label class="s1-checkbox-opt" style="font-size:12px;">
          <input type="checkbox" data-stage1-type="scoping" data-stage1-id="${i}" value="${escHtml(opt)}" ${selected.includes(opt) ? 'checked' : ''}
            onchange="onFunctionScopingChange(${i}, '${escHtml(opt)}', this.checked)" />
          ${escHtml(opt)}
        </label>
      `).join('');
      html += `<div class="s1-item" style="padding-left:16px;border-left:2px solid var(--warning);margin:4px 0;">
        <div class="s1-item-label"><span class="s1-item-id">D2.2.${i+1}</span> For function ${i+1}, scope its impact</div>
        <div class="s1-item-hint">Tick all infrastructure components this function touches.</div>
        <div class="s1-checkbox-group" style="flex-wrap:wrap;gap:4px;">${checks}</div>
      </div>`;
    }
  }
  container.innerHTML = html;
}

function onFunctionNameChange(idx, val) {
  const sd = stageData[1];
  sd.functionNames[idx] = val;
  const tag = getManualTag('D1.4.2.' + (idx + 1));
  logTag('section_functions', 'D1.4.2.' + (idx + 1), tag, val, 'Function name');
  updateTagBadge('D1.4.2.' + (idx + 1), 'section_functions', val);
  saveToStorage();
}

function onFunctionScopingChange(idx, option, checked) {
  const sd = stageData[1];
  if (!sd.functionScoping[idx]) sd.functionScoping[idx] = [];
  if (checked && !sd.functionScoping[idx].includes(option)) {
    sd.functionScoping[idx].push(option);
  } else if (!checked) {
    sd.functionScoping[idx] = sd.functionScoping[idx].filter(v => v !== option);
  }
  saveToStorage();
}

function onStage1InputChange(id, val) {
  const sd = stageData[1];
  sd.inputs[id] = val;
  const tag = getManualTag(id);
  logTag('', id, tag, val, 'Manual input');
  updateTagBadge(id, '', val);
  saveToStorage();
}

function onYesNoChange(id, val, followUps, el) {
  const sd = stageData[1];
  const radio = el.closest('.s1-yesno-group').querySelectorAll('.s1-yesno-opt');
  radio.forEach(r => r.classList.remove('selected'));
  el.closest('.s1-yesno-opt').classList.add('selected');
  sd.inputs[id] = val;

  const tag = getManualTag(id);
  logTag('', id, tag, val, 'Yes/No: ' + val);
  updateTagBadge(id, '', val);

  // Show/hide follow-ups
  const followContainer = document.getElementById('followups-' + id);
  if (followContainer) {
    followContainer.remove();
  }
  if (val === 'yes' && followUps && followUps.length > 0) {
    const container = document.createElement('div');
    container.className = 's1-followups';
    container.id = 'followups-' + id;
    followUps.forEach(fu => {
      const fuVal = sd.inputs[fu.id] || '';
      const div = document.createElement('div');
      div.className = 's1-followup-item';
      div.innerHTML = `
        <div class="s1-item-label" style="font-size:12px;padding-left:24px;">
          <span class="s1-item-id">${escHtml(fu.id)}</span>
          ${escHtml(fu.desc)}
        </div>
        <div class="s1-item-hint" style="padding-left:24px;font-size:11px;">${escHtml(fu.hint)}</div>
        <textarea class="s1-textarea" style="margin-left:24px;width:calc(100% - 24px);" data-stage1-id="${fu.id}" placeholder="Describe…">${escHtml(fuVal)}</textarea>
      `;
      container.appendChild(div);
      // Ensure follow-up inputs are saved
      const textarea = div.querySelector('textarea');
      if (textarea) {
        textarea.addEventListener('change', function() { sd.inputs[fu.id] = this.value; saveToStorage(); });
      }
    });
    el.closest('.s1-item').appendChild(container);
  }
  saveToStorage();
  saveCurrentInputs();
}

function onStage1CheckboxChange(id, opt, checked) {
  const sd = stageData[1];
  if (!sd.inputs[id]) sd.inputs[id] = [];
  if (checked && !sd.inputs[id].includes(opt)) {
    sd.inputs[id].push(opt);
  } else if (!checked) {
    sd.inputs[id] = sd.inputs[id].filter(v => v !== opt);
  }
  logTag('', id, getManualTag(id), sd.inputs[id].join(', '), 'Checkbox toggle');
  saveToStorage();
}

function updateTagBadge(itemId, sectionId, val) {
  const el = document.getElementById('tag-' + itemId);
  if (!el) return;
  if (val && val.toString().trim()) {
    const tag = getManualTag(itemId);
    el.textContent = formatTag(itemId, tag);
    el.style.display = 'inline';
  } else {
    el.textContent = '';
    el.style.display = 'none';
  }
}

// ─── Stage 1 JSON Save ───

function buildStage1JSON() {
  const sd = stageData[1];
  const json = {
    exportedAt: new Date().toISOString(),
    productName: sd.inputs['D1.1'] || '',
    businessPurpose: sd.inputs['D1.2.1'] || '',
    newUserWorkflow: sd.inputs['D1.2.2'] || '',
    userTypes: {
      readOnlyUser: sd.inputs['D1.2.3.1'] === 'yes',
      writeOnlyUser: sd.inputs['D1.2.3.2'] === 'yes',
      premiumUser: sd.inputs['D1.2.3.3'] === 'yes',
      premiumSubTypes: parseInt(sd.inputs['D1.2.3.4']) || 0,
      adminPage: sd.inputs['D1.2.3.5'] === 'yes',
      superAdminPage: sd.inputs['D1.2.3.6'] === 'yes'
    },
    github: sd.inputs['D1.3'] === 'yes',
    functionCount: sd.functionCount || 0,
    functions: (sd.functionNames || []).map((name, i) => ({
      name: name,
      summary: (sd.functionSummaries || [])[i] || '',
      scope: (sd.functionScoping || [])[i] || []
    })),
    infrastructure: {},
    externalLinkages: {
      hasExternal: sd.inputs['D3.1'] === 'yes',
      interfaces: sd.inputs['D3.2'] || [],
      bffProducts: [],
      databaseProducts: [],
      inMemoryProducts: []
    },
    historyLog: sd.historyLog || []
  };

  // Infrastructure
  STAGE1_INFRASTRUCTURE_SECTION.items.forEach(item => {
    if (item.type === 'yesno') {
      const key = item.id;
      json.infrastructure[key] = {
        required: sd.inputs[key] === 'yes',
        details: {}
      };
      (item.infraFollowUps || []).forEach(fu => {
        json.infrastructure[key].details[fu.id] = sd.inputs[fu.id] || '';
      });
    }
  });

  // External products
  const extCounts = sd.externalCounts || {};
  for (let i = 1; i <= (extCounts.bff || 0); i++) {
    const val = sd.inputs['D3.3.' + 'bff_' + i] || '';
    json.externalLinkages.bffProducts.push(val);
  }
  for (let i = 1; i <= (extCounts.perm || 0); i++) {
    const val = sd.inputs['D3.4.' + 'perm_' + i] || '';
    json.externalLinkages.databaseProducts.push(val);
  }
  for (let i = 1; i <= (extCounts.imm || 0); i++) {
    const val = sd.inputs['D3.5.' + 'imm_' + i] || '';
    json.externalLinkages.inMemoryProducts.push(val);
  }

  // Follow-ups for user types
  if (sd.inputs['D1.2.3.1'] === 'yes') {
    json.userTypes.readOnlyDescription = sd.inputs['D1.2.3.1a'] || '';
  }
  if (sd.inputs['D1.2.3.2'] === 'yes') {
    json.userTypes.writeOnlyDescription = sd.inputs['D1.2.3.2a'] || '';
  }
  if (sd.inputs['D1.2.3.3'] === 'yes') {
    json.userTypes.premiumFeatures = sd.inputs['D1.2.3.3a'] || '';
  }

  if (sd.d5Results) json.d5Results = sd.d5Results;
  if (sd.d4ContextDiagram) json.d4ContextDiagram = sd.d4ContextDiagram;

  return json;
}

function saveStage1JSON() {
  const json = buildStage1JSON();
  const sd = stageData[1];
  sd.savedJsonAt = new Date().toISOString();
  const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const name = (sd.inputs['D1.1'] || 'product').replace(/[^a-zA-Z0-9]/g, '_');
  a.download = `prd-${name}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('PRD JSON saved ✓');
  saveToStorage();
}

// ─── D5 Auto-Checks ───

async function runD5Checks() {
  const sd = stageData[1];
  const btn = document.getElementById('btn-d5-run');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '⏳ Running D5 Checks…';

  // Auto-save JSON first
  saveStage1JSON();

  // Collect all data into context JSON
  const json = buildStage1JSON();
  const contextStr = JSON.stringify(json, null, 2);

  const systemPrompt = `You are a senior requirements analyst performing auto-checks on a Product Requirements Document (PRD).

For each function defined in the input, perform the following:

## D5.1.x — Self-Check per function
1. Read the function's summary and expected infrastructure scope (webapp, android, BFF, database, etc.).
2. Compare against what was manually entered for that function's impact scoping (D2.2.x).
3. If the LLM's expected impact differs from what was entered, raise an ambiguity, assumption, or open question.
4. Compare the product description/business purpose against the function scope to check if any user types or use-cases are missing.

## D5.x.y — Cross-Check between functions
1. Compare function summaries pairwise. If two functions are similar or overlapping, raise an ambiguity.
2. Consider if they could be combined into one function despite being dissimilar by design. If it would be better as two separate functions, do NOT raise an open question. If the analysis suggests combining is better, raise an open question.

Return ONLY valid JSON in this exact format:
{
  "selfChecks": [
    {
      "functionNumber": 1,
      "findings": [
        { "type": "ambiguity|assumption|open_question", "description": "..." }
      ]
    }
  ],
  "crossChecks": [
    {
      "functions": [1, 2],
      "finding": "description of overlap or ambiguity found"
    }
  ],
  "summary": "Overall assessment of the PRD completeness"
}`;

  const userPrompt = `Here is the complete PRD data for review:\n\n${contextStr}`;

  try {
    const models = getStageModels(PIPELINE[0]);
    let raw = '';

    switch(CONFIG.mode) {
      case 'cloud':
        raw = await callAnthropic(systemPrompt, userPrompt);
        break;
      case 'openai':
        raw = await callOpenAI(systemPrompt, userPrompt);
        break;
      case 'gemini':
        raw = await callGemini(systemPrompt, userPrompt);
        break;
      case 'azure':
        raw = await callAzure(systemPrompt, userPrompt);
        break;
      case 'groq':
        raw = await callGroq(systemPrompt, userPrompt);
        break;
      case 'cerebras':
        raw = await callCerebras(systemPrompt, userPrompt);
        break;
      case 'openrouter':
        raw = await callOpenRouter(systemPrompt, userPrompt);
        break;
      default:
        raw = await callOllama(systemPrompt, userPrompt, models[0]);
    }

    raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let parsed = null;
    try { parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw); } catch {}

    if (parsed) {
      sd.d5Results = JSON.stringify(parsed, null, 2);
      logTag('section_d5', 'D5', 'AGRM', raw.substring(0, 200), 'D5 auto-checks completed');
    } else {
      sd.d5Results = raw;
    }

    saveToStorage();
    renderStage();
    showToast('D5 Auto-Checks completed ✓');

    // ⏭ Now run D4 generation automatically
    await runD4Generation();

  } catch (err) {
    console.error(err);
    showToast('D5 Checks failed: ' + err.message);
    const results = document.getElementById('s1-d5-results');
    if (results) results.innerHTML = `<div style="color:var(--danger);padding:12px;">Error: ${escHtml(err.message)}</div>`;
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '↻ Re-run D5 Checks'; }
  }
}

// ─── D4 Context Diagram Generation ───

async function runD4Generation() {
  const sd = stageData[1];
  const btn = document.getElementById('btn-d4-run');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }

  const json = buildStage1JSON();
  const contextStr = JSON.stringify(json, null, 2);

  const systemPrompt = `You are an expert software architect. Based on the PRD data provided, generate a C4 Context Diagram (textual representation) of the entire product.

Describe:
1. The product system and its scope
2. All user types (normal, admin, super-admin, premium, etc.)
3. All external systems it interfaces with
4. The infrastructure components (webapp, android, BFF, databases)
5. How they all connect and interact

Use a clear text-based diagram format (you can use ASCII art or a descriptive hierarchical layout). Be thorough and complete.`;

  const userPrompt = `Generate the C4 Context Diagram for this product:\n\n${contextStr}`;

  try {
    const models = getStageModels(PIPELINE[0]);
    let raw = '';

    switch(CONFIG.mode) {
      case 'cloud': raw = await callAnthropic(systemPrompt, userPrompt); break;
      case 'openai': raw = await callOpenAI(systemPrompt, userPrompt); break;
      case 'gemini': raw = await callGemini(systemPrompt, userPrompt); break;
      case 'azure': raw = await callAzure(systemPrompt, userPrompt); break;
      case 'groq': raw = await callGroq(systemPrompt, userPrompt); break;
      case 'cerebras': raw = await callCerebras(systemPrompt, userPrompt); break;
      case 'openrouter': raw = await callOpenRouter(systemPrompt, userPrompt); break;
      default: raw = await callOllama(systemPrompt, userPrompt, models[0]);
    }

    sd.d4ContextDiagram = raw;
    logTag('section_d5', 'D4', 'AGFP', raw.substring(0, 200), 'D4 Context Diagram generated');
    saveToStorage();
    renderStage();
    showToast('D4 Context Diagram generated ✓');

  } catch (err) {
    console.error(err);
    showToast('D4 Generation failed: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '↻ Re-generate D4'; }
  }
}

// ─── Old Stage render helpers (for stages 2+) ───

function renderPrdIntro(sd, content) {
  const card = document.createElement('div');
  card.className = 'section-card';
  const intro = sd.prdIntro;
  card.innerHTML = `
    <div class="section-header human">
      <span class="section-icon">📋</span>
      Product introduction — describe what you're building
    </div>
    <div class="section-body">
      <div class="intro-grid">
        <div class="intro-field">
          <label class="intro-label">Product name</label>
          <input class="intro-input" id="intro-productName" type="text" placeholder="e.g. Fieldflow, PayLedger, Routr…" value="${escHtml(intro.productName)}" />
        </div>
        <div class="intro-field">
          <label class="intro-label">One-line tagline</label>
          <input class="intro-input" id="intro-tagline" type="text" placeholder="e.g. Real-time field ops management for SMEs" value="${escHtml(intro.tagline)}" />
        </div>
        <div class="intro-field full">
          <label class="intro-label">Target users / audience</label>
          <input class="intro-input" id="intro-targetUsers" type="text" placeholder="e.g. Operations managers at mid-size logistics companies, 50–500 employees" value="${escHtml(intro.targetUsers)}" />
        </div>
        <div class="intro-field full">
          <label class="intro-label">Problem being solved</label>
          <textarea class="intro-input" id="intro-problem" placeholder="Describe the core problem your product addresses. What pain point does it eliminate? Who currently suffers from it and how?">${escHtml(intro.problem)}</textarea>
        </div>
        <div class="intro-field full">
          <label class="intro-label">Key goals & success metrics</label>
          <textarea class="intro-input" id="intro-goals" placeholder="e.g.\n• Reduce manual reporting time by 80%\n• Support 500 concurrent field agents\n• Launch iOS & Android apps within 6 months">${escHtml(intro.goals)}</textarea>
        </div>
      </div>
    </div>`;
  content.appendChild(card);
}

function renderQASection(stage, sd, content) {
  const card = document.createElement('div');
  card.className = 'section-card';
  card.innerHTML = `
    <div class="section-header review">
      <span class="section-icon">❓</span>
      AI questions & clarifications — answer to refine outputs
    </div>
    <div class="section-body">
      <p style="font-size:12px;color:var(--text-3);margin-bottom:14px;">The AI raised the following questions. Answer them, then click "Regenerate with Answers" to get refined outputs.</p>
      <div class="qa-list" id="qa-list"></div>
    </div>`;
  content.appendChild(card);
  const list = card.querySelector('#qa-list');
  sd.aiQuestions.forEach((q, i) => {
    const item = document.createElement('div');
    item.className = 'qa-item';
    item.innerHTML = `
      <div class="qa-question"><span class="qa-q-num">Q${i+1}</span><span>${escHtml(q.question)}</span></div>
      <div>
        <textarea class="qa-answer" id="qa-answer-${i}" placeholder="Your answer…" rows="2">${escHtml(sd.qaAnswers[i] || '')}</textarea>
        <div class="qa-link-bar">Links to: <span class="linked-section-tag">${escHtml(q.linkedSection)}</span></div>
      </div>`;
    list.appendChild(item);
  });
}

function renderGateReview(stage, sd, content) {
  const card = document.createElement('div');
  card.className = 'section-card';
  card.innerHTML = `
    <div class="section-header ${sd.completed ? 'approved' : 'gate-header'}">
      <span class="section-icon">${sd.completed ? '✅' : '⛩'}</span>
      ${sd.completed ? 'Gate approved — proceed to next stage' : 'Gate review — all items must pass to proceed'}
    </div>
    <div class="section-body"><div class="review-checklist" id="gate-checklist"></div></div>`;
  content.appendChild(card);
  const list = card.querySelector('#gate-checklist');
  stage.gateReviews.forEach(r => {
    const item = document.createElement('div');
    item.className = 'review-item';
    const ans = sd.reviewAnswers[r.id];
    item.innerHTML = `
      <div class="review-question">${escHtml(r.question)}</div>
      <div class="review-options">
        <button class="review-opt ${ans === 'yes' ? 'selected-yes' : ''}" onclick="setReview('${r.id}','yes',this)">✅ Yes</button>
        <button class="review-opt ${ans === 'partial' ? 'selected-partial' : ''}" onclick="setReview('${r.id}','partial',this)">⚠️ Partial</button>
        <button class="review-opt ${ans === 'no' ? 'selected-no' : ''}" onclick="setReview('${r.id}','no',this)">❌ No</button>
      </div>
      <textarea class="review-notes ${(ans==='partial'||ans==='no')?'visible':''}" id="review-notes-${r.id}" placeholder="Notes on what needs fixing…">${escHtml(sd.reviewNotes[r.id] || '')}</textarea>`;
    list.appendChild(item);
  });
}

function setReview(id, val, btn) {
  const sd = stageData[currentStage];
  sd.reviewAnswers[id] = val;
  const parent = btn.closest('.review-item');
  parent.querySelectorAll('.review-opt').forEach(b => b.classList.remove('selected-yes','selected-partial','selected-no'));
  btn.classList.add('selected-' + val);
  const notes = parent.querySelector('.review-notes');
  notes.classList.toggle('visible', val === 'partial' || val === 'no');
  checkGateCompletion();
  saveToStorage();
}

function checkGateCompletion() {
  const stage = PIPELINE[currentStage - 1];
  if (!stage.gateReviews) return;
  const sd = stageData[currentStage];
  const allAnswered = stage.gateReviews.every(r => sd.reviewAnswers[r.id]);
  const allPass = stage.gateReviews.every(r => ['yes','partial'].includes(sd.reviewAnswers[r.id]));
  if (allAnswered && allPass) {
    sd.completed = true;
    buildSidebar();
    document.getElementById('btn-next').disabled = false;
    showToast('Gate review complete — stage approved ✅');
    document.getElementById('status-msg').textContent = 'Gate approved. Proceed to next stage.';
  }
  updateToolbar(stage, sd);
}

function updateToolbar(stage, sd) {
  const btnAction = document.getElementById('btn-action');
  const btnNext = document.getElementById('btn-next');
  const statusMsg = document.getElementById('status-msg');
  document.getElementById('btn-prev').disabled = currentStage <= 1;

  if (stage.isStage1PRD) {
    btnAction.style.display = 'none';
    btnNext.disabled = true;
    statusMsg.textContent = 'Complete all sections to enable D5 Auto-Checks →';
    return;
  }

  if (!sd.aiGenerated) {
    btnAction.style.display = 'inline-flex';
    btnAction.textContent = 'Generate AI Output →';
    btnAction.className = 'btn btn-primary';
    btnAction.disabled = false;
    btnNext.disabled = true;
    statusMsg.textContent = 'Fill in your inputs, then click Generate AI Output.';
  } else if (sd.aiQuestions && sd.aiQuestions.length > 0 && !stage.gateReviews) {
    btnAction.style.display = 'inline-flex';
    btnAction.textContent = '↻ Regenerate with Answers';
    btnAction.className = 'btn btn-primary';
    btnAction.disabled = false;
    const unanswered = sd.aiQuestions.filter((q, i) => !sd.qaAnswers[i]).length;
    btnNext.disabled = unanswered > 0;
    statusMsg.textContent = unanswered > 0 ? `${unanswered} question(s) still need answers.` : 'All answered — proceed or regenerate.';
  } else if (stage.gateReviews) {
    btnAction.style.display = 'inline-flex';
    const allAnswered = stage.gateReviews.every(r => sd.reviewAnswers[r.id]);
    const allPass = allAnswered && stage.gateReviews.every(r => ['yes','partial'].includes(sd.reviewAnswers[r.id]));
    btnAction.textContent = '↻ Regenerate AI Output';
    btnAction.className = 'btn';
    btnNext.disabled = !allPass;
    statusMsg.textContent = !allAnswered ? 'Complete the gate review checklist to proceed.'
      : !allPass ? 'One or more gate items failed — return to fix.'
      : 'Gate approved — proceed.';
  } else {
    btnAction.style.display = 'inline-flex';
    btnAction.textContent = '↻ Regenerate';
    btnAction.className = 'btn';
    btnNext.disabled = false;
    statusMsg.textContent = 'AI output generated. Proceed or regenerate.';
  }
}

// ─── AI generation (for stages 2+) ───
async function handleMainAction() {
  saveCurrentInputs();
  const stage = PIPELINE[currentStage - 1];
  const sd = stageData[currentStage];
  await generateAIOutput(stage, sd);
}

async function generateAIOutput(stage, sd) {
  const btn = document.getElementById('btn-action');
  btn.disabled = true;
  btn.textContent = '⏳ Generating…';
  document.getElementById('status-msg').textContent = 'AI is processing your inputs…';

  stage.aiDeliverables.forEach(d => {
    const el = document.getElementById('ai-out-' + d.id);
    if (el) el.innerHTML = '<div class="ai-loading"><div class="spinner"></div>Generating…</div>';
  });

  let prdIntroCtx = '';
  if (stage.hasPrdIntro && sd.prdIntro) {
    const p = sd.prdIntro;
    prdIntroCtx = `Product Introduction:\n- Name: ${p.productName || '(not set)'}\n- Tagline: ${p.tagline || '(not set)'}\n- Target users: ${p.targetUsers || '(not set)'}\n- Problem: ${p.problem || '(not set)'}\n- Goals: ${p.goals || '(not set)'}\n\n`;
  }

  const manualCtx = stage.manualDeliverables.map(d =>
    `${d.label}:\n${sd.manualInputs[d.id] || '(not filled)'}`
  ).join('\n\n');

  const qaCtx = (sd.aiQuestions || []).length > 0
    ? '\n\nClarifications provided:\n' + sd.aiQuestions.map((q, i) =>
        sd.qaAnswers[i] ? `Q: ${q.question}\nA: ${sd.qaAnswers[i]}` : ''
      ).filter(Boolean).join('\n\n')
    : '';

  const models = getStageModels(stage);

  const systemPrompt = `You are an expert software architect helping author a comprehensive software development pipeline. You are on Stage ${stage.id}: "${stage.name}" (type: ${stage.type}).

Stage models: ${models.join(', ')}
Stage note: ${stage.note}

Return ONLY valid JSON — no markdown, no preamble, no backticks. Exactly this structure:
{
  "deliverables": {
    ${stage.aiDeliverables.map(d => `"${d.id}": "detailed content string"`).join(',\n    ')}
  },
  "questions": [
    { "question": "specific question", "linkedSection": "D1 or deliverable name" }
  ]
}

Be specific, technical, and professional. Generate 2–4 targeted questions that identify genuine ambiguities the human author must resolve.`;

  const userPrompt = `Stage ${stage.id}: ${stage.name}

${prdIntroCtx}Manual inputs:
${manualCtx || '(No manual inputs — generate based on context so far)'}
${qaCtx}

Generate all AI deliverables for this stage and list open questions.`;

  try {
    let raw = '';

    switch(CONFIG.mode) {
      case 'cloud':
        raw = await callAnthropic(systemPrompt, userPrompt);
        break;
      case 'openai':
        raw = await callOpenAI(systemPrompt, userPrompt);
        break;
      case 'gemini':
        raw = await callGemini(systemPrompt, userPrompt);
        break;
      case 'azure':
        raw = await callAzure(systemPrompt, userPrompt);
        break;
      case 'groq':
        raw = await callGroq(systemPrompt, userPrompt);
        break;
      case 'cerebras':
        raw = await callCerebras(systemPrompt, userPrompt);
        break;
      case 'openrouter':
        raw = await callOpenRouter(systemPrompt, userPrompt);
        break;
      default:
        raw = await callOllama(systemPrompt, userPrompt, models[0]);
    }

    raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    let parsed = null;
    try { parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw); } catch {}

    if (parsed && parsed.deliverables) {
      stage.aiDeliverables.forEach(d => {
        sd.aiOutputs[d.id] = parsed.deliverables[d.id] || '(No content for this deliverable — retry)';
      });
      sd.aiQuestions = parsed.questions || [];
    } else {
      stage.aiDeliverables.forEach(d => {
        sd.aiOutputs[d.id] = raw.length > 80 ? raw.substring(0, 500) + '\n…[truncated]' : '(Generation failed — retry)';
      });
      sd.aiQuestions = [];
    }

    sd.aiGenerated = true;
    if (!stage.gateReviews) {
      sd.completed = sd.aiQuestions.length === 0 || sd.aiQuestions.every((q, i) => sd.qaAnswers[i]);
    }

    addToHistory(stage, sd);
    saveToStorage();
    renderStage();
    showToast('AI output generated ✓');

  } catch (err) {
    console.error(err);
    stage.aiDeliverables.forEach(d => {
      const el = document.getElementById('ai-out-' + d.id);
      if (el) el.innerHTML = `<span style="color:var(--danger)">Error: ${escHtml(err.message)}. Check setup and retry.</span>`;
    });
    document.getElementById('status-msg').textContent = 'Error: ' + err.message;
    btn.disabled = false;
    btn.textContent = 'Generate AI Output →';
  }
}

// ─── API callers ───
async function callAnthropic(system, user) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CONFIG.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: CONFIG.cloudModel,
      max_tokens: 2000,
      system: system,
      messages: [{ role: 'user', content: user }]
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Anthropic API error');
  return data.content?.find(b => b.type === 'text')?.text || '';
}

async function callOpenAI(system, user) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + CONFIG.openaiKey
    },
    body: JSON.stringify({
      model: CONFIG.openaiModel,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'OpenAI API error');
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(system, user) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.geminiModel}:generateContent?key=${CONFIG.geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: system + '\n\n' + user }] }]
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Gemini API error');
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callAzure(system, user) {
  const r = await fetch(`${CONFIG.azureEndpoint}/openai/deployments/${CONFIG.azureDeployment}/chat/completions?api-version=2024-02-01`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': CONFIG.azureKey
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      max_tokens: 2000
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Azure API error');
  return data.choices?.[0]?.message?.content || '';
}

async function callOllama(system, user, model) {
  const isServerMode = window.location.protocol !== 'file:';
  const url = isServerMode
    ? '/api/ollama/chat'
    : CONFIG.ollamaUrl + '/api/chat';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Ollama error');
  return data.message?.content || '';
}

async function callGroq(system, user) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.groqKey },
    body: JSON.stringify({ model: CONFIG.groqModel, max_tokens: 2000, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Groq API error');
  return data.choices?.[0]?.message?.content || '';
}

async function callCerebras(system, user) {
  const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.cerebrasKey },
    body: JSON.stringify({ model: CONFIG.cerebrasModel, max_tokens: 2000, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Cerebras API error');
  return data.choices?.[0]?.message?.content || '';
}

async function callOpenRouter(system, user) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.openrouterKey },
    body: JSON.stringify({ model: CONFIG.openrouterModel, max_tokens: 2000, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'OpenRouter API error');
  return data.choices?.[0]?.message?.content || '';
}

// ─── Provider test functions (Groq, Cerebras, OpenRouter) ───
async function testGroq() {
  const key = document.getElementById('groq-key-input').value.trim();
  const model = document.getElementById('groq-model-select').value;
  const el = document.getElementById('groq-test-result');
  if (!key) { el.textContent = '⚠️ Enter an API key first'; el.style.color = 'var(--warning)'; return; }
  el.textContent = 'Testing…'; el.style.color = 'var(--text-3)';
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] })
    });
    if (r.ok) { el.textContent = '✅ Connected — ' + model; el.style.color = 'var(--success)'; }
    else { const d = await r.json(); el.textContent = '❌ ' + (d.error?.message || 'Connection failed'); el.style.color = 'var(--danger)'; }
  } catch(e) { el.textContent = '❌ ' + e.message; el.style.color = 'var(--danger)'; }
}

async function testCerebras() {
  const key = document.getElementById('cerebras-key-input').value.trim();
  const model = document.getElementById('cerebras-model-select').value;
  const el = document.getElementById('cerebras-test-result');
  if (!key) { el.textContent = '⚠️ Enter an API key first'; el.style.color = 'var(--warning)'; return; }
  el.textContent = 'Testing…'; el.style.color = 'var(--text-3)';
  try {
    const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] })
    });
    if (r.ok) { el.textContent = '✅ Connected — ' + model; el.style.color = 'var(--success)'; }
    else { const d = await r.json(); el.textContent = '❌ ' + (d.error?.message || 'Connection failed'); el.style.color = 'var(--danger)'; }
  } catch(e) { el.textContent = '❌ ' + e.message; el.style.color = 'var(--danger)'; }
}

async function testOpenRouter() {
  const key = document.getElementById('openrouter-key-input').value.trim();
  const model = document.getElementById('openrouter-model-select').value;
  const el = document.getElementById('openrouter-test-result');
  if (!key) { el.textContent = '⚠️ Enter an API key first'; el.style.color = 'var(--warning)'; return; }
  el.textContent = 'Testing…'; el.style.color = 'var(--text-3)';
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] })
    });
    if (r.ok) { el.textContent = '✅ Connected — ' + model; el.style.color = 'var(--success)'; }
    else { const d = await r.json(); el.textContent = '❌ ' + (d.error?.message || 'Connection failed'); el.style.color = 'var(--danger)'; }
  } catch(e) { el.textContent = '❌ ' + e.message; el.style.color = 'var(--danger)'; }
}

function addToHistory(stage, sd) {
  const historyEl = document.getElementById('history-content');
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

function toggleHistory() {
  historyOpen = !historyOpen;
  document.getElementById('history-panel').classList.toggle('open', historyOpen);
  if (historyOpen) {
    renderHistoryPanel();
  }
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── AI Assistant panel ───
const ASSIST_PROMPTS = {
  chatgpt: (stage, intro) => `I'm authoring a Product Requirements Document for a software project.

Product: ${intro.productName || '[product name]'}
Description: ${intro.tagline || '[brief description]'}
Target users: ${intro.targetUsers || '[target users]'}

I'm currently working on: ${stage.name}

My question: [type your question here]`,

  claude: (stage, intro) => `Context: I'm writing requirements for "${intro.productName || 'my product'}" — ${intro.tagline || '[brief description]'}.
Currently on stage: ${stage.name}

Please help me with: [type your question here]`,

  gemini: (stage, intro) => `I'm defining software requirements for a product called "${intro.productName || '[product]'}" — ${intro.tagline || '[brief description]'}.

Research question for stage "${stage.name}":
[type your question here]

Please provide a concise, specific answer I can use directly in my requirements document.`,

  perplexity: (stage, intro) => `Software requirements research: ${intro.productName || '[product]'}

Stage: ${stage.name}

Question: [type your question here]`
};

function getAssistPrompt(service) {
  const stage = PIPELINE[currentStage - 1];
  const intro = stageData[currentStage].prdIntro || {};
  const fn = ASSIST_PROMPTS[service];
  return fn ? fn(stage, intro) : '';
}

function toggleAssist() {
  assistOpen = !assistOpen;
  document.getElementById('ai-assist-panel').classList.toggle('open', assistOpen);
  if (assistOpen) updateAssistPrompts();
}

function updateAssistPrompts() {
  ['chatgpt','claude','gemini','perplexity'].forEach(svc => {
    const el = document.getElementById(svc + '-prompt-box');
    if (el) el.textContent = getAssistPrompt(svc);
  });
}

function switchAssistTab(tab) {
  activeAssistTab = tab;
  document.querySelectorAll('.assist-tab').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.assist-pane').forEach(el => el.classList.remove('active'));
  const tabs = document.querySelectorAll('.assist-tab');
  const order = ['chatgpt','claude','gemini','perplexity','scratchpad'];
  const idx = order.indexOf(tab);
  if (tabs[idx]) tabs[idx].classList.add('active');
  const pane = document.getElementById('assist-pane-' + tab);
  if (pane) pane.classList.add('active');
}

function copyPrompt(boxId) {
  const el = document.getElementById(boxId);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    const svc = boxId.replace('-prompt-box','');
    const notice = document.getElementById('copy-notice-' + svc);
    if (notice) { notice.style.opacity = 1; setTimeout(() => notice.style.opacity = 0, 2000); }
  });
}

function copyAllNotes() {
  const el = document.getElementById('assist-scratchpad');
  if (!el || !el.value) return;
  navigator.clipboard.writeText(el.value).then(() => {
    const n = document.getElementById('assist-copy-notice');
    n.classList.add('show'); setTimeout(() => n.classList.remove('show'), 2000);
  });
}

function clearNotes() {
  if (confirm('Clear your notes? This cannot be undone.')) {
    document.getElementById('assist-scratchpad').value = '';
  }
}

// ─── Fix for testGemini typo ───
// (The async function above had a syntax error with an extra parenthesis - keeping the working version)

// ─── Init ───
initTheme();
const loaded = loadFromStorage();
if (window.location.protocol !== 'file:') {
  document.getElementById('session-page').classList.remove('hidden');
  document.getElementById('pipeline-view').classList.add('hidden');
  loadSessions();
} else if (loaded) {
  document.getElementById('pipeline-view').classList.remove('hidden');
  buildSidebar();
  renderStage();
  updateSetupIndicator();
  showToast('Session restored from local storage ✓');
} else {
  document.getElementById('session-page').classList.remove('hidden');
  document.getElementById('pipeline-view').classList.add('hidden');
  loadSessions();
}