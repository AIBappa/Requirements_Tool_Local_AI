// ─── pipeline-settings.js ───
// Core configuration, helpers, storage, export/import, setup overlay, theme, model modal

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

const DATA_VERSION = 3;
const STORAGE_KEY = 'pipeline-author-data';

// ─── Setup overlay state ───
let activeSetupTab = 'local';
let exportDropdownOpen = false;

// ─── Helper functions ───
function escHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g,'&').replace(/</g,'<').replace(/>/g,'>').replace(/"/g,'"');
}

function toDataUri(str) {
  return 'data:text/plain;charset=utf-8,' + encodeURIComponent(str);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── Stage model helpers ───
function getStageModels(stage) {
  const sd = stageData[stage.id];
  return sd ? (sd.modelOverride || stage.models) : stage.models;
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
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = isDark ? '🌙' : '☀️';
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
      },
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
    if (data.config) Object.assign(CONFIG, data.config);
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
function downloadJSON(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName || 'pipeline-snapshot.json';
  a.click();
  URL.revokeObjectURL(url);
}

async function exportPipelineJSON() {
  if (typeof saveCurrentInputs === 'function') saveCurrentInputs();
  const data = {
    version: DATA_VERSION,
    sessionId: (typeof currentSessionId !== 'undefined' && currentSessionId) ? currentSessionId : '',
    stageData: stageData,
    currentStage: currentStage,
    stagesCompleted: PIPELINE.filter(s => stageData[s.id].completed).length,
    totalManualInputs: PIPELINE.reduce((sum, s) => {
      const sd = stageData[s.id];
      return sum + (sd ? Object.values(sd.manualInputs || {}).filter(v => v && v.trim()).length : 0);
    }, 0),
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
  const fileName = 'pipeline-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json';
  try {
    const res = await fetch('/api/exports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName, data })
    });
    if (!res.ok) throw new Error('Server error ' + res.status);
    showToast('Saved to server ✓');
  } catch (e) {
    showToast('Save failed: ' + e.message);
  }
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
      if (typeof buildSidebar === 'function') buildSidebar();
      if (typeof renderStage === 'function') renderStage();
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

  if (stage.hasPrdIntro && sd && sd.prdIntro) {
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
<pre style="background:#f8f7ff;padding:10px;border-radius:6px;white-space:pre-wrap;">${escHtml(sd ? sd.manualInputs[d.id] : '')}</pre>`;
    });
  }

  if (stage.aiDeliverables.length > 0) {
    html += `<h2 style="color:#4a4770;margin-top:20px;">AI-Generated Outputs</h2>`;
    stage.aiDeliverables.forEach(d => {
      html += `<h3 style="color:#6366f1;font-size:14px;">${escHtml(d.label)}</h3>
<pre style="background:#f0fdf4;padding:10px;border-radius:6px;white-space:pre-wrap;">${escHtml(sd ? sd.aiOutputs[d.id] : '')}</pre>`;
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
function toggleExportDropdown() {
  exportDropdownOpen = !exportDropdownOpen;
  const menu = document.getElementById('export-dropdown-menu');
  if (menu) menu.classList.toggle('open', exportDropdownOpen);
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
  const overlay = document.getElementById('setup-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  const map = {
    'api-key-input': CONFIG.apiKey,
    'openai-key-input': CONFIG.openaiKey,
    'gemini-key-input': CONFIG.geminiKey,
    'azure-key-input': CONFIG.azureKey,
    'ollama-url': CONFIG.ollamaUrl,
    'cloud-model-select': CONFIG.cloudModel,
    'openai-model-select': CONFIG.openaiModel,
    'gemini-model-select': CONFIG.geminiModel,
    'azure-endpoint-input': CONFIG.azureEndpoint,
    'azure-deployment-input': CONFIG.azureDeployment,
    'azure-model-select': CONFIG.azureModel,
    'groq-key-input': CONFIG.groqKey,
    'groq-model-select': CONFIG.groqModel,
    'cerebras-key-input': CONFIG.cerebrasKey,
    'cerebras-model-select': CONFIG.cerebrasModel,
    'openrouter-key-input': CONFIG.openrouterKey,
    'openrouter-model-select': CONFIG.openrouterModel
  };
  Object.keys(map).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = map[id];
  });
  switchSetupTab(CONFIG.mode === 'local' ? 'local' : CONFIG.mode);
}

function closeSetup() {
  const overlay = document.getElementById('setup-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function saveSetup() {
  CONFIG.mode = activeSetupTab;
  CONFIG.ollamaUrl = (document.getElementById('ollama-url')?.value || '').trim().replace(/\/$/, '');
  CONFIG.apiKey = (document.getElementById('api-key-input')?.value || '').trim();
  CONFIG.cloudModel = document.getElementById('cloud-model-select')?.value || CONFIG.cloudModel;
  CONFIG.openaiKey = (document.getElementById('openai-key-input')?.value || '').trim();
  CONFIG.openaiModel = document.getElementById('openai-model-select')?.value || CONFIG.openaiModel;
  CONFIG.geminiKey = (document.getElementById('gemini-key-input')?.value || '').trim();
  CONFIG.geminiModel = document.getElementById('gemini-model-select')?.value || CONFIG.geminiModel;
  CONFIG.azureKey = (document.getElementById('azure-key-input')?.value || '').trim();
  CONFIG.azureEndpoint = (document.getElementById('azure-endpoint-input')?.value || '').trim().replace(/\/$/, '');
  CONFIG.azureDeployment = (document.getElementById('azure-deployment-input')?.value || '').trim();
  CONFIG.azureModel = document.getElementById('azure-model-select')?.value || CONFIG.azureModel;
  CONFIG.groqKey = (document.getElementById('groq-key-input')?.value || '').trim();
  CONFIG.groqModel = document.getElementById('groq-model-select')?.value || CONFIG.groqModel;
  CONFIG.cerebrasKey = (document.getElementById('cerebras-key-input')?.value || '').trim();
  CONFIG.cerebrasModel = document.getElementById('cerebras-model-select')?.value || CONFIG.cerebrasModel;
  CONFIG.openrouterKey = (document.getElementById('openrouter-key-input')?.value || '').trim();
  CONFIG.openrouterModel = document.getElementById('openrouter-model-select')?.value || CONFIG.openrouterModel;

  const statusEl = document.getElementById('setup-footer-status');
  if (!statusEl) { closeSetup(); updateSetupIndicator(); saveToStorage(); showToast(getProviderLabel() + ' mode active'); return; }

  const requiredChecks = {
    cloud: { key: 'apiKey', label: 'API key for cloud mode' },
    openai: { key: 'openaiKey', label: 'an OpenAI API key' },
    gemini: { key: 'geminiKey', label: 'a Gemini API key' },
    azure: { key: null, label: 'all Azure fields' },
    groq: { key: 'groqKey', label: 'a Groq API key' },
    cerebras: { key: 'cerebrasKey', label: 'a Cerebras API key' },
    openrouter: { key: 'openrouterKey', label: 'an OpenRouter API key' }
  };

  const check = requiredChecks[CONFIG.mode];
  if (check) {
    if (CONFIG.mode === 'azure') {
      if (!CONFIG.azureKey || !CONFIG.azureEndpoint || !CONFIG.azureDeployment) {
        statusEl.textContent = '⚠️ Please fill in all Azure fields.';
        statusEl.style.color = 'var(--danger)';
        return;
      }
    } else if (!CONFIG[check.key]) {
      statusEl.textContent = '⚠️ Please enter ' + check.label + '.';
      statusEl.style.color = 'var(--danger)';
      return;
    }
  }

  closeSetup();
  if (typeof updateSetupIndicator === 'function') updateSetupIndicator();
  saveToStorage();
  showToast(getProviderLabel() + ' mode active');
}

function updateSetupIndicator() {
  const btn = document.getElementById('setup-reopen-btn');
  if (!btn) return;
  const label = getProviderLabel();
  btn.innerHTML = `⚙️ Connection Setup <span style="font-size:9px;padding:1px 6px;border-radius:8px;margin-left:4px;">${label}</span>`;
}

function toggleKeyVisibility(inputId) {
  const inp = document.getElementById(inputId);
  if (inp) inp.type = inp.type === 'password' ? 'text' : 'password';
}

// ─── Provider test functions ───
async function testOllama() {
  const url = (document.getElementById('ollama-url')?.value || '').trim().replace(/\/$/, '');
  const el = document.getElementById('ollama-test-result');
  if (!el) return;
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
  const key = (document.getElementById('api-key-input')?.value || '').trim();
  const model = document.getElementById('cloud-model-select')?.value || CONFIG.cloudModel;
  const el = document.getElementById('cloud-test-result');
  if (!el) return;
  if (!key) { el.textContent = '⚠️ Enter an API key first'; el.style.color = 'var(--warning)'; return; }
  el.textContent = 'Testing…'; el.style.color = 'var(--text-3)';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] })
    });
    if (r.ok) { el.textContent = '✅ API key valid — ' + model; el.style.color = 'var(--success)'; }
    else { const d = await r.json(); el.textContent = '❌ ' + (d.error?.message || 'Invalid key'); el.style.color = 'var(--danger)'; }
  } catch(e) { el.textContent = '❌ ' + e.message; el.style.color = 'var(--danger)'; }
}

async function testOpenAI() {
  const key = (document.getElementById('openai-key-input')?.value || '').trim();
  const model = document.getElementById('openai-model-select')?.value || CONFIG.openaiModel;
  const el = document.getElementById('openai-test-result');
  if (!el) return;
  if (!key) { el.textContent = '⚠️ Enter an API key first'; el.style.color = 'var(--warning)'; return; }
  el.textContent = 'Testing…'; el.style.color = 'var(--text-3)';
  try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] })
    });
    if (r.ok) { el.textContent = '✅ API key valid — ' + model; el.style.color = 'var(--success)'; }
    else { const d = await r.json(); el.textContent = '❌ ' + (d.error?.message || 'Invalid key'); el.style.color = 'var(--danger)'; }
  } catch(e) { el.textContent = '❌ ' + e.message; el.style.color = 'var(--danger)'; }
}

async function testGemini() {
  const key = (document.getElementById('gemini-key-input')?.value || '').trim();
  const model = document.getElementById('gemini-model-select')?.value || CONFIG.geminiModel;
  const el = document.getElementById('gemini-test-result');
  if (!el) return;
  if (!key) { el.textContent = '⚠️ Enter an API key first'; el.style.color = 'var(--warning)'; return; }
  el.textContent = 'Testing…'; el.style.color = 'var(--text-3)';
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }] })
    });
    if (r.ok) { el.textContent = '✅ API key valid — ' + model; el.style.color = 'var(--success)'; }
    else { const d = await r.json(); el.textContent = '❌ ' + (d.error?.message || 'Invalid key'); el.style.color = 'var(--danger)'; }
  } catch(e) { el.textContent = '❌ ' + e.message; el.style.color = 'var(--danger)'; }
}

async function testAzure() {
  const key = (document.getElementById('azure-key-input')?.value || '').trim();
  const endpoint = (document.getElementById('azure-endpoint-input')?.value || '').trim().replace(/\/$/, '');
  const deployment = (document.getElementById('azure-deployment-input')?.value || '').trim();
  const el = document.getElementById('azure-test-result');
  if (!el) return;
  if (!key || !endpoint || !deployment) { el.textContent = '⚠️ Fill in all fields first'; el.style.color = 'var(--warning)'; return; }
  el.textContent = 'Testing…'; el.style.color = 'var(--text-3)';
  try {
    const r = await fetch(`${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=2024-02-01`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'api-key': key },
      body: JSON.stringify({ messages: [{ role: 'user', content: 'Hi' }], max_tokens: 10 })
    });
    if (r.ok) { el.textContent = '✅ Connected — ' + deployment; el.style.color = 'var(--success)'; }
    else { const d = await r.json(); el.textContent = '❌ ' + (d.error?.message || 'Connection failed'); el.style.color = 'var(--danger)'; }
  } catch(e) { el.textContent = '❌ ' + e.message; el.style.color = 'var(--danger)'; }
}

async function testGroq() {
  const key = (document.getElementById('groq-key-input')?.value || '').trim();
  const model = document.getElementById('groq-model-select')?.value || CONFIG.groqModel;
  const el = document.getElementById('groq-test-result');
  if (!el) return;
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
  const key = (document.getElementById('cerebras-key-input')?.value || '').trim();
  const model = document.getElementById('cerebras-model-select')?.value || CONFIG.cerebrasModel;
  const el = document.getElementById('cerebras-test-result');
  if (!el) return;
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
  const key = (document.getElementById('openrouter-key-input')?.value || '').trim();
  const model = document.getElementById('openrouter-model-select')?.value || CONFIG.openrouterModel;
  const el = document.getElementById('openrouter-test-result');
  if (!el) return;
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

// ─── Model modal ───
function openModelModal() {
  const stage = PIPELINE[currentStage - 1];
  const models = getStageModels(stage);
  const primaryEl = document.getElementById('model-primary');
  const secondaryEl = document.getElementById('model-secondary');
  if (primaryEl) primaryEl.value = models[0] || '';
  if (secondaryEl) secondaryEl.value = models[1] || '';

  ['primary', 'secondary'].forEach(slot => {
    const el = document.getElementById(slot + '-presets');
    if (!el) return;
    el.innerHTML = '';
    LOCAL_PRESETS.forEach(m => {
      const b = document.createElement('button');
      b.className = 'model-preset-btn';
      b.textContent = m;
      b.onclick = () => { const inp = document.getElementById('model-' + slot); if (inp) inp.value = m; };
      el.appendChild(b);
    });
    CLOUD_PRESETS.forEach(m => {
      const b = document.createElement('button');
      b.className = 'model-preset-btn cloud-preset';
      b.textContent = m;
      b.onclick = () => { const inp = document.getElementById('model-' + slot); if (inp) inp.value = m; };
      el.appendChild(b);
    });
  });

  const modal = document.getElementById('model-modal');
  if (modal) modal.classList.remove('hidden');
}

function closeModelModal() {
  const modal = document.getElementById('model-modal');
  if (modal) modal.classList.add('hidden');
}

function saveModelOverride() {
  const primary = (document.getElementById('model-primary')?.value || '').trim();
  if (!primary) { showToast('Primary model is required'); return; }
  const secondary = (document.getElementById('model-secondary')?.value || '').trim();
  const sd = stageData[currentStage];
  sd.modelOverride = [primary, secondary].filter(Boolean);
  closeModelModal();
  const label = sd.modelOverride.join(' · ');
  const textEl = document.getElementById('topbar-models-text');
  if (textEl) textEl.textContent = label;
  saveToStorage();
  showToast('Models updated for this stage ✓');
}