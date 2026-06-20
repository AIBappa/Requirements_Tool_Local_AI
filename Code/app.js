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
function autoSaveAndMaybeRestore() {
  try { saveToStorage(); } catch(e) {}
  try { if (typeof saveSessionToServer === 'function') saveSessionToServer(); } catch(e) {}
  // Auto-load most recent snapshot if pipeline view is about to show
  const snapshots = window.__pipelineSnapshots || [];
  if (snapshots.length > 0) {
    const latest = snapshots[snapshots.length - 1];
    if (latest && latest.rawJson) {
      const data = latest.rawJson;
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
window.addEventListener('beforeunload', function(e) {
  try { saveToStorage(); } catch(err) {}
  try { if (typeof saveCurrentInputs === 'function') saveCurrentInputs(); } catch(err) {}
  try { if (typeof saveSessionToServer === 'function') saveSessionToServer(); } catch(err) {}
  // Show browser's native confirmation dialog
  e.preventDefault();
  e.returnValue = '';
  return '';
});
const loaded = loadFromStorage();
if (window.location.protocol !== 'file:') {
  const sessionPage = document.getElementById('session-page');
  const pipelineView = document.getElementById('pipeline-view');
  if (sessionPage) sessionPage.classList.remove('hidden');
  if (pipelineView) pipelineView.classList.add('hidden');
  loadSessions();
} else if (loaded) {
  const pipelineView = document.getElementById('pipeline-view');
  if (pipelineView) pipelineView.classList.remove('hidden');
  const sessionPage = document.getElementById('session-page');
  if (sessionPage) sessionPage.classList.add('hidden');
  buildSidebar();
  renderStage();
  updateSetupIndicator();
  showToast('Session restored from local storage ✓');
} else {
  autoSaveAndMaybeRestore();
}
