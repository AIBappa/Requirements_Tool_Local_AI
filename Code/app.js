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
  const sessionPage = document.getElementById('session-page');
  const pipelineView = document.getElementById('pipeline-view');
  if (sessionPage) sessionPage.classList.remove('hidden');
  if (pipelineView) pipelineView.classList.add('hidden');
  loadSessions();
}