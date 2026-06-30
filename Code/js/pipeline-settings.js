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
  openrouterModel: 'deepseek/deepseek-chat',
  nvidiaKey: '',
  nvidiaModel: 'minimaxai/minimax-m3',
  siliconflowKey: '',
  siliconflowModel: 'Qwen/Qwen3-32B'
};

const DATA_VERSION = 3;
const STORAGE_KEY = 'pipeline-author-data';

// ─── Setup overlay state ───
let activeSetupTab = 'local';
let exportDropdownOpen = false;
let globalViewMode = 'wizard'; // 'wizard' | 'full'

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
    case 'nvidia': return '🟢 NVIDIA NIM';
    case 'siliconflow': return '🔷 SiliconFlow';
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

function toggleGlobalViewMode() {
  globalViewMode = globalViewMode === 'wizard' ? 'full' : 'wizard';
  updateViewModeButton();
  if (typeof s1ViewMode !== 'undefined') {
    s1ViewMode = globalViewMode;
  }
  renderStage();
  showToast(globalViewMode === 'full' ? 'Full Document View' : 'Wizard Mode');
}

function updateViewModeButton() {
  const btn = document.getElementById('view-mode-toggle');
  if (btn) {
    btn.textContent = globalViewMode === 'wizard' ? '📄 Full View' : '🧙 Wizard View';
  }
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
        azureModel: CONFIG.azureModel,
        nvidiaModel: CONFIG.nvidiaModel
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
      azureModel: CONFIG.azureModel,
      nvidiaModel: CONFIG.nvidiaModel
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

// ─── Build export payload for server ───
function buildExportPayload() {
  // Gather ALL stage data (all 9 stages)
  const exportStageData = {};
  PIPELINE.forEach(stage => {
    const sid = String(stage.id);
    exportStageData[sid] = stageData[stage.id];
  });

  // Include the PIPELINE definition so the server knows how to interpret the data
  // Deep-clean PIPELINE to remove any functions/classes that can't be serialized
  const cleanPipeline = PIPELINE.map(stage => {
    const clean = {};
    Object.keys(stage).forEach(k => {
      const v = stage[k];
      if (typeof v !== 'function' && typeof v !== 'symbol') {
        clean[k] = v;
      }
    });
    return clean;
  });

  return {
    stageData: exportStageData,
    pipelineDef: cleanPipeline
  };
}

// ─── PDF Export (server-side generation) ───
async function exportPDF() {
  try {
    if (typeof saveCurrentInputs === 'function') saveCurrentInputs();
    
    const payload = buildExportPayload();
    
    const response = await fetch('/api/export/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.error || `Server error ${response.status}`);
    }

    // Get the filename from Content-Disposition header
    const disposition = response.headers.get('Content-Disposition') || '';
    const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
    const filename = filenameMatch ? filenameMatch[1] : `pipeline-export-${Date.now()}.pdf`;

    // Download the blob
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('PDF exported ✓');
  } catch (err) {
    showToast('PDF export failed: ' + err.message);
    console.error('PDF export error:', err);
  }
}

// ─── DOCX Export (server-side generation) ───
async function exportDOCX() {
  try {
    if (typeof saveCurrentInputs === 'function') saveCurrentInputs();
    
    const payload = buildExportPayload();
    
    const response = await fetch('/api/export/docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => null);
      throw new Error(errData?.error || `Server error ${response.status}`);
    }

    // Get the filename from Content-Disposition header
    const disposition = response.headers.get('Content-Disposition') || '';
    const filenameMatch = disposition.match(/filename="?([^";\n]+)"?/);
    const filename = filenameMatch ? filenameMatch[1] : `pipeline-export-${Date.now()}.docx`;

    // Download the blob
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('DOCX exported ✓');
  } catch (err) {
    showToast('DOCX export failed: ' + err.message);
    console.error('DOCX export error:', err);
  }
}

// ─── CSV Export (client-side generation) ───
function exportCSV() {
  try {
    if (typeof saveCurrentInputs === 'function') saveCurrentInputs();
    
    const payload = buildExportPayload();
    
    // Build CSV content
    let csv = 'Stage ID,Stage Name,Section,Field ID,Field Label,Type,Value\n';
    
    PIPELINE.forEach(stage => {
      const sid = String(stage.id);
      const sd = stageData[stage.id];
      const stageName = stage.name || '';
      const isStage1 = stage.isStage1PRD || false;
      
      if (isStage1) {
        // Stage 1 PRD: enumerate all inputs
        const inputs = sd.inputs || {};
        Object.keys(inputs).forEach(key => {
          let val = inputs[key];
          let label = key;
          let section = '';
          let type = typeof val;
          
          if (Array.isArray(val)) {
            val = val.join('; ');
            type = 'array';
          }
          
          // Determine section from known config
          if (key.startsWith('D1.1') || key.startsWith('D1.2')) section = 'Product Basics';
          else if (key.startsWith('D1.3')) section = 'Repository';
          else if (key.startsWith('D1.4') || key.startsWith('D2.1') || key.startsWith('D2.2')) section = 'Functions';
          else if (key.startsWith('D1.6')) section = 'Infrastructure';
          else if (key.startsWith('D3')) section = 'External Linkages';
          else if (key.startsWith('D5')) section = 'Auto-Checks';
          else section = 'Other';
          
          csv += `${sid},${escCsv(stageName)},${escCsv(section)},${escCsv(key)},${escCsv(label)},${escCsv(type)},${escCsv(String(val))}\n`;
        });
        
        // Function names/summaries/scoping
        (sd.functionNames || []).forEach((name, i) => {
          csv += `${sid},${escCsv(stageName)},Functions,D1.4.2.${i+1},Function ${i+1} Name,text,${escCsv(name)}\n`;
          const summary = (sd.functionSummaries || [])[i] || '';
          csv += `${sid},${escCsv(stageName)},Functions,D2.1.${i+1},Function ${i+1} Summary,text,${escCsv(summary)}\n`;
          const scope = (sd.functionScoping || [])[i] || [];
          csv += `${sid},${escCsv(stageName)},Functions,D2.2.${i+1},Function ${i+1} Scope,array,${escCsv(scope.join('; '))}\n`;
        });
        
        // D5 / D4
        if (sd.d5Results) {
          csv += `${sid},${escCsv(stageName)},Auto-Checks,D5,D5 Auto-Checks Results,text,${escCsv(sd.d5Results)}\n`;
        }
        if (sd.d4ContextDiagram) {
          csv += `${sid},${escCsv(stageName)},Context Diagram,D4,D4 Context Diagram,text,${escCsv(sd.d4ContextDiagram)}\n`;
        }
      }
      
      // Manual inputs (stages 2-9)
      (stage.manualDeliverables || []).forEach(d => {
        const val = sd.manualInputs[d.id] || '';
        csv += `${sid},${escCsv(stageName)},Manual Inputs,${escCsv(d.id)},${escCsv(d.label)},text,${escCsv(val)}\n`;
      });
      
      // AI outputs
      (stage.aiDeliverables || []).forEach(d => {
        const val = sd.aiOutputs[d.id] || '';
        csv += `${sid},${escCsv(stageName)},AI Outputs,${escCsv(d.id)},${escCsv(d.label)},text,${escCsv(val)}\n`;
      });
      
      // Gate reviews
      (stage.gateReviews || []).forEach(r => {
        const notes = sd.reviewNotes[r.id] || '';
        csv += `${sid},${escCsv(stageName)},Gate Reviews,${escCsv(r.id)},${escCsv(r.question)},text,${escCsv(notes)}\n`;
      });
      
      // Completed status
      csv += `${sid},${escCsv(stageName)},Status,completed,,boolean,${sd.completed ? 'Yes' : 'No'}\n`;
    });
    
    // Download CSV
    const bom = '\uFEFF'; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pipeline-export-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('CSV exported ✓');
  } catch (err) {
    showToast('CSV export failed: ' + err.message);
    console.error('CSV export error:', err);
  }
}

function escCsv(s) {
  if (!s) return '';
  const str = String(s);
  // Escape double quotes and wrap in quotes if contains comma, newline, or quote
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
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
    'openrouter-model-select': CONFIG.openrouterModel,
    'nvidia-key-input': CONFIG.nvidiaKey,
    'nvidia-model-select': CONFIG.nvidiaModel,
    'siliconflow-key-input': CONFIG.siliconflowKey,
    'siliconflow-model-select': CONFIG.siliconflowModel
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
  CONFIG.nvidiaKey = (document.getElementById('nvidia-key-input')?.value || '').trim();
  CONFIG.nvidiaModel = document.getElementById('nvidia-model-select')?.value || CONFIG.nvidiaModel;
  CONFIG.siliconflowKey = (document.getElementById('siliconflow-key-input')?.value || '').trim();
  CONFIG.siliconflowModel = document.getElementById('siliconflow-model-select')?.value || CONFIG.siliconflowModel;

  const statusEl = document.getElementById('setup-footer-status');
  if (!statusEl) { closeSetup(); updateSetupIndicator(); saveToStorage(); showToast(getProviderLabel() + ' mode active'); return; }

  const requiredChecks = {
    cloud: { key: 'apiKey', label: 'API key for cloud mode' },
    openai: { key: 'openaiKey', label: 'an OpenAI API key' },
    gemini: { key: 'geminiKey', label: 'a Gemini API key' },
    azure: { key: null, label: 'all Azure fields' },
    groq: { key: 'groqKey', label: 'a Groq API key' },
    cerebras: { key: 'cerebrasKey', label: 'a Cerebras API key' },
    openrouter: { key: 'openrouterKey', label: 'an OpenRouter API key' },
    nvidia: { key: 'nvidiaKey', label: 'a NVIDIA NIM API key' },
    siliconflow: { key: 'siliconflowKey', label: 'a SiliconFlow API key' }
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

async function testNvidia() {
  const key = (document.getElementById('nvidia-key-input')?.value || '').trim();
  const model = document.getElementById('nvidia-model-select')?.value || CONFIG.nvidiaModel;
  const el = document.getElementById('nvidia-test-result');
  if (!el) return;
  if (!key) { el.textContent = '⚠️ Enter an API key first'; el.style.color = 'var(--warning)'; return; }
  el.textContent = 'Testing…'; el.style.color = 'var(--text-3)';
  try {
    const isServerMode = window.location.protocol !== 'file:';
    const url = isServerMode ? '/api/nvidia' : 'https://integrate.api.nvidia.com/v1/chat/completions';
    const body = { model, max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] };
    const headers = { 'Content-Type': 'application/json' };
    if (isServerMode) {
      body._apiKey = key;
    } else {
      headers['Authorization'] = 'Bearer ' + key;
    }
    const r = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    });
    if (r.ok) { el.textContent = '✅ Connected — ' + model; el.style.color = 'var(--success)'; }
    else { const d = await r.json(); el.textContent = '❌ ' + (d.error?.message || 'Connection failed'); el.style.color = 'var(--danger)'; }
  } catch(e) { el.textContent = '❌ ' + e.message; el.style.color = 'var(--danger)'; }
}

async function testSiliconflow() {
  const key = (document.getElementById('siliconflow-key-input')?.value || '').trim();
  const model = document.getElementById('siliconflow-model-select')?.value || CONFIG.siliconflowModel;
  const el = document.getElementById('siliconflow-test-result');
  if (!el) return;
  if (!key) { el.textContent = '⚠️ Enter an API key first'; el.style.color = 'var(--warning)'; return; }
  el.textContent = 'Testing…'; el.style.color = 'var(--text-3)';
  try {
    const r = await fetch('https://api.siliconflow.com/v1/chat/completions', {
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