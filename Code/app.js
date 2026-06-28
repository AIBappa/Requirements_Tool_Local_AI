// ─── app.js ───
// Bootstrap & glue — ties all modules together

// ─── Global state ───
let currentStage = 1;
let historyOpen = false;

// ─── Per-stage state ───
let stageData = {};

function initStageData() {
  stageData = {};
  PIPELINE.forEach(s => {
    stageData[s.id] = {
      manualInputs: {},
      prdIntro: { productName: '', tagline: '', targetUsers: '', problem: '', goals: '' },
      aiOutputs: {}, qaAnswers: {}, reviewAnswers: {}, reviewNotes: {},
      aiQuestions: [], completed: false, aiGenerated: false,
      modelOverride: null,
      // Stage 1 PRD fields
      inputs: {},
      functionCount: 0,
      functionNames: [],
      functionSummaries: [],
      functionScoping: [],
      infrastructure: {},
      externalLinkages: {},
      externalCounts: {},
      historyLog: [],
      d5Results: null,
      d4ContextDiagram: '',
      savedJsonAt: null
    };
  });
}

initStageData();

// ─── Init ───
initTheme();
async function autoSaveAndMaybeRestore() {
  try { saveToStorage(); } catch(e) {}
  try { if (typeof saveSessionToServer === 'function') saveSessionToServer(); } catch(e) {}
  // Auto-load most recent server export if no session is active
  try {
    const res = await fetch('/api/exports');
    if (res.ok) {
      const exports = await res.json();
      if (exports.length > 0) {
        const latest = exports[0];
        const dataRes = await fetch('/api/exports/' + encodeURIComponent(latest.fileName));
        if (dataRes.ok) {
          const data = await dataRes.json();
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
        }
      }
    }
  } catch(e) {}
}
// Show exports folder path in sidebar
function showExportsPath() {
  const el = document.getElementById('exports-path');
  if (el) el.textContent = '📦 Server folder: saved_exports';
}
// Track unsaved server changes for the "please save your changes" indicator
let _hasUnsavedServerChanges = false;

// Mark state as dirty whenever something changes (set by various save handlers)
function markDirty() {
  _hasUnsavedServerChanges = true;
  updateUnsavedIndicator();
}

function markClean() {
  _hasUnsavedServerChanges = false;
  updateUnsavedIndicator();
}

function hasUnsavedServerChanges() {
  // True if there are manual inputs that haven't been persisted to server session
  if (_hasUnsavedServerChanges) return true;
  return PIPELINE.some(s => {
    const sd = stageData[s.id];
    if (!sd) return false;
    return Object.values(sd.manualInputs || {}).some(v => v && v.trim());
  });
}

function updateUnsavedIndicator() {
  const el = document.getElementById('unsaved-warning');
  if (!el) return;
  if (hasUnsavedServerChanges()) {
    el.textContent = '⚠️ You have unsaved changes — please save your work before leaving.';
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

showExportsPath();
window.addEventListener('beforeunload', function(e) {
  try { saveToStorage(); } catch(err) {}
  try { if (typeof saveCurrentInputs === 'function') saveCurrentInputs(); } catch(err) {}
  try { if (typeof saveSessionToServer === 'function') saveSessionToServer(); } catch(err) {}
  // Only show browser's native confirmation dialog if there are unsaved server changes
  if (hasUnsavedServerChanges()) {
    e.preventDefault();
    e.returnValue = '';
    return '';
  }
});
const loaded = loadFromStorage();
if (loaded) {
  // Restore from localStorage (works for both file:// and http://)
  const pipelineView = document.getElementById('pipeline-view');
  const sessionPage = document.getElementById('session-page');
  if (pipelineView) pipelineView.classList.remove('hidden');
  if (sessionPage) sessionPage.classList.add('hidden');
  buildSidebar();
  renderStage();
  updateSetupIndicator();
  showToast('Session restored from local storage ✓');
  markClean();
} else {
  // Try auto-restore from server
  autoSaveAndMaybeRestore().then(async () => {
    const pipelineView = document.getElementById('pipeline-view');
    const sessionPage = document.getElementById('session-page');
    const hasData = PIPELINE.some(s => stageData[s.id] && Object.values(stageData[s.id].manualInputs || {}).some(v => v && v.trim()));
    if (hasData) {
      if (pipelineView) pipelineView.classList.remove('hidden');
      if (sessionPage) sessionPage.classList.add('hidden');
      buildSidebar();
      renderStage();
      updateSetupIndicator();
      showToast('Session restored from server ✓');
      markClean();
    } else {
      // Check if there's a last session to auto-open
      const lastId = localStorage.getItem('pipeline-last-session');
      if (lastId && typeof openSession === 'function' && currentSessionId !== lastId) {
        try {
          await openSession(lastId);
          showToast('Auto-resumed last session ✓');
          markClean();
          return;
        } catch (e) {
          console.warn('Could not auto-open last session:', e);
        }
      }
      // Show session page as fallback
      if (pipelineView) pipelineView.classList.add('hidden');
      if (sessionPage) sessionPage.classList.remove('hidden');
      loadSessions();
      markClean();
    }
  });
  showExportsPath();
}
