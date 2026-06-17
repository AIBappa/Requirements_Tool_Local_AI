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
  // Try server first
  try {
    const sessions = await apiFetch('/api/sessions');
    renderSessions(sessions);
    return;
  } catch (e) {
    console.warn('Server unavailable, falling back to localStorage:', e.message);
  }
  // Fallback: look for stored session ID in localStorage
  const lastId = localStorage.getItem('pipeline-last-session');
  if (lastId) {
    // Show a single "resume last" option
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
    // Build full session data from current state
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
    // Calculate completed count
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
    // Restore stage data
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
  // Show pipeline view
  document.getElementById('session-page').classList.add('hidden');
  document.getElementById('pipeline-view').classList.remove('hidden');
  buildSidebar();
  renderStage();
  updateSetupIndicator();
}

function goToSessions() {
  saveCurrentInputs();
  // Save before leaving
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
  mode: 'cloud', // 'local' | 'cloud' | 'openai' | 'gemini' | 'azure' | 'openai-compat'
  ollamaUrl: 'http://localhost:11434',
  apiKey: '',
  cloudModel: 'claude-sonnet-4-6',
  // Multi-provider support
  openaiKey: '',
  openaiModel: 'gpt-4o',
  geminiKey: '',
  geminiModel: 'gemini-2.0-flash',
  azureKey: '',
  azureEndpoint: '',
  azureDeployment: 'gpt-4o',
  azureModel: 'gpt-4o',
  // OpenAI Compatible provider (Siliconflow, Deepseek, Groq, Openrouter, Cerebras, etc.)
  openaiCompatKey: '',
  openaiCompatUrl: 'https://api.openai.com/v1',
  openaiCompatModel: ''
};

const DATA_VERSION = 2;
const STORAGE_KEY = 'pipeline-author-data';

let currentStage = 1;
let historyOpen = false;
let assistOpen = false;
let activeAssistTab = 'chatgpt';
let activeSetupTab = 'local';

// Per-stage state
let stageData = {};
PIPELINE.forEach(s => {
  stageData[s.id] = {
    manualInputs: {},
    prdIntro: { productName: '', tagline: '', targetUsers: '', problem: '', goals: '' },
    aiOutputs: {}, qaAnswers: {}, reviewAnswers: {}, reviewNotes: {},
    aiQuestions: [], completed: false, aiGenerated: false,
    modelOverride: null // [primary, secondary]
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

// ─── Local Storage persistence (Improvement #5) ───
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

    // Merge stage data
    if (data.stageData) {
      PIPELINE.forEach(s => {
        if (data.stageData[s.id]) {
          // Deep merge without losing any fields
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

// ─── Export / Import (Improvement #1) ───
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
      // Merge
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

// ─── PDF Export (Improvement #6) ───
function exportPDF() {
  // Load html2canvas and jsPDF dynamically
  const html2canvasScript = document.createElement('script');
  html2canvasScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
  html2canvasScript.onload = function() {
    const jsPDFScript = document.createElement('script');
    jsPDFScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
    jsPDFScript.onload = function() {
      const stage = PIPELINE[currentStage - 1];
      const contentEl = document.getElementById('content');
      // Create a clone for PDF rendering
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

// ─── DOCX Export (Improvement #6) ───
function exportDOCX() {
  const stage = PIPELINE[currentStage - 1];
  const sd = stageData[currentStage];

  // Build clean HTML document for DOCX
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

  // Save as .doc — Word will open it
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

// ─── Theme / Dark mode (Improvement #4) ───
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
    case 'openai-compat': return '🔗 OpenAI Compatible';
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
  document.getElementById('openai-compat-key-input').value = CONFIG.openaiCompatKey;
  document.getElementById('openai-compat-url').value = CONFIG.openaiCompatUrl;
  document.getElementById('openai-compat-model').value = CONFIG.openaiCompatModel;
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
  CONFIG.openaiCompatKey = document.getElementById('openai-compat-key-input').value.trim();
  CONFIG.openaiCompatUrl = document.getElementById('openai-compat-url').value.trim().replace(/\/$/, '');
  CONFIG.openaiCompatModel = document.getElementById('openai-compat-model').value.trim();

  // Validation
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

  // PRD intro
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

  // Config warning if not set up
  if (!CONFIG.apiKey && CONFIG.mode === 'cloud') {
    const w = document.createElement('div');
    w.className = 'warn-strip';
    w.innerHTML = `<span class="warn-strip-icon">⚠️</span><span>No API key configured. <strong>Click "Connection Setup"</strong> in the sidebar.</span>`;
    content.appendChild(w);
  }
  if (!CONFIG.openaiKey && CONFIG.mode === 'openai') {
    const w = document.createElement('div');
    w.className = 'warn-strip';
    w.innerHTML = `<span class="warn-strip-icon">⚠️</span><span>No OpenAI API key configured. <strong>Click "Connection Setup"</strong> in the sidebar.</span>`;
    content.appendChild(w);
  }
  if (!CONFIG.geminiKey && CONFIG.mode === 'gemini') {
    const w = document.createElement('div');
    w.className = 'warn-strip';
    w.innerHTML = `<span class="warn-strip-icon">⚠️</span><span>No Gemini API key configured. <strong>Click "Connection Setup"</strong> in the sidebar.</span>`;
    content.appendChild(w);
  }
  if ((!CONFIG.azureKey || !CONFIG.azureEndpoint || !CONFIG.azureDeployment) && CONFIG.mode === 'azure') {
    const w = document.createElement('div');
    w.className = 'warn-strip';
    w.innerHTML = `<span class="warn-strip-icon">⚠️</span><span>Azure not fully configured. <strong>Click "Connection Setup"</strong> in the sidebar.</span>`;
    content.appendChild(w);
  }
  if ((!CONFIG.openaiCompatKey || !CONFIG.openaiCompatModel) && CONFIG.mode === 'openai-compat') {
    const w = document.createElement('div');
    w.className = 'warn-strip';
    w.innerHTML = `<span class="warn-strip-icon">⚠️</span><span>OpenAI Compatible provider not configured. <strong>Click "Connection Setup"</strong> in the sidebar.</span>`;
    content.appendChild(w);
  }

  // Stage note
  if (stage.note) {
    const note = document.createElement('div');
    note.className = 'info-strip';
    note.innerHTML = `<strong>ℹ️ Stage note:</strong> ${escHtml(stage.note)}`;
    content.appendChild(note);
  }

  // PRD intro section (Stage 1 only)
  if (stage.hasPrdIntro) {
    renderPrdIntro(sd, content);
  }

  // Manual deliverables
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

  // AI deliverables
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

  // QA section
  if (sd.aiGenerated && sd.aiQuestions && sd.aiQuestions.length > 0) {
    renderQASection(stage, sd, content);
  }

  // Gate review
  if (stage.gateReviews && sd.aiGenerated) {
    renderGateReview(stage, sd, content);
  }

  updateToolbar(stage, sd);
}

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

  if (!sd.aiGenerated) {
    btnAction.textContent = 'Generate AI Output →';
    btnAction.className = 'btn btn-primary';
    btnAction.disabled = false;
    btnNext.disabled = true;
    statusMsg.textContent = 'Fill in your inputs, then click Generate AI Output.';
  } else if (sd.aiQuestions && sd.aiQuestions.length > 0 && !stage.gateReviews) {
    btnAction.textContent = '↻ Regenerate with Answers';
    btnAction.className = 'btn btn-primary';
    btnAction.disabled = false;
    const unanswered = sd.aiQuestions.filter((q, i) => !sd.qaAnswers[i]).length;
    btnNext.disabled = unanswered > 0;
    statusMsg.textContent = unanswered > 0 ? `${unanswered} question(s) still need answers.` : 'All answered — proceed or regenerate.';
  } else if (stage.gateReviews) {
    const allAnswered = stage.gateReviews.every(r => sd.reviewAnswers[r.id]);
    const allPass = allAnswered && stage.gateReviews.every(r => ['yes','partial'].includes(sd.reviewAnswers[r.id]));
    btnAction.textContent = '↻ Regenerate AI Output';
    btnAction.className = 'btn';
    btnNext.disabled = !allPass;
    statusMsg.textContent = !allAnswered ? 'Complete the gate review checklist to proceed.'
      : !allPass ? 'One or more gate items failed — return to fix.'
      : 'Gate approved — proceed.';
  } else {
    btnAction.textContent = '↻ Regenerate';
    btnAction.className = 'btn';
    btnNext.disabled = false;
    statusMsg.textContent = 'AI output generated. Proceed or regenerate.';
  }
}

// ─── AI generation ───
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

  // Build context
  let prdIntroCtx = '';
  if (stage.hasPrdIntro && sd.prdIntro) {
    const p = sd.prdIntro;
    prdIntroCtx = `Product Introduction:
- Name: ${p.productName || '(not set)'}
- Tagline: ${p.tagline || '(not set)'}
- Target users: ${p.targetUsers || '(not set)'}
- Problem: ${p.problem || '(not set)'}
- Goals: ${p.goals || '(not set)'}

`;
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
      case 'cloud': // Anthropic
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
      case 'openai-compat':
        raw = await callOpenAICompat(systemPrompt, userPrompt);
        break;
      default: // local / Ollama
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
  // Use the server proxy if available (same-origin), otherwise direct to Ollama
  const isServerMode = window.location.protocol !== 'file:';
  const url = isServerMode
    ? '/api/ollama/chat'  // proxy through the Python server
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

async function callOpenAICompat(system, user) {
  const url = (CONFIG.openaiCompatUrl + '/chat/completions').replace(/\/+/g, '/').replace(':/', '://');
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + CONFIG.openaiCompatKey
    },
    body: JSON.stringify({
      model: CONFIG.openaiCompatModel,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'API error: ' + (r.status));
  return data.choices?.[0]?.message?.content || '';
}

async function testOpenAICompat() {
  const key = document.getElementById('openai-compat-key-input').value.trim();
  const url = document.getElementById('openai-compat-url').value.trim().replace(/\/$/, '');
  const model = document.getElementById('openai-compat-model').value.trim();
  const el = document.getElementById('openai-compat-test-result');
  if (!key || !model) { el.textContent = '⚠️ Enter an API key and model first'; el.style.color = 'var(--warning)'; return; }
  el.textContent = 'Testing…'; el.style.color = 'var(--text-3)';
  try {
    const apiUrl = (url + '/chat/completions').replace(/\/+/g, '/').replace(':/', '://');
    const r = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] })
    });
    if (r.ok) {
      el.textContent = '✅ Connected — ' + model;
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

function setCompatPreset(model, url) {
  document.getElementById('openai-compat-model').value = model;
  document.getElementById('openai-compat-url').value = url;
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

// ─── Init ───
initTheme();
const loaded = loadFromStorage();
// Start on the sessions page (unless server mode, then load sessions list)
if (window.location.protocol !== 'file:') {
  // Server mode — show session list
  document.getElementById('session-page').classList.remove('hidden');
  document.getElementById('pipeline-view').classList.add('hidden');
  loadSessions();
} else if (loaded) {
  // Fallback: direct to localStorage session
  document.getElementById('pipeline-view').classList.remove('hidden');
  buildSidebar();
  renderStage();
  updateSetupIndicator();
  showToast('Session restored from local storage ✓');
} else {
  // No session — show session page with empty state
  document.getElementById('session-page').classList.remove('hidden');
  document.getElementById('pipeline-view').classList.add('hidden');
  loadSessions();
}
