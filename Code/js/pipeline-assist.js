// ─── pipeline-assist.js ───
// AI Assistant panel — prompts, tab switching, scratchpad

let assistOpen = false;
let activeAssistTab = 'chatgpt';

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
  const intro = stageData[currentStage]?.prdIntro || {};
  const fn = ASSIST_PROMPTS[service];
  return fn ? fn(stage, intro) : '';
}

function toggleAssist() {
  assistOpen = !assistOpen;
  const panel = document.getElementById('ai-assist-panel');
  if (panel) panel.classList.toggle('open', assistOpen);
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
    if (n) { n.classList.add('show'); setTimeout(() => n.classList.remove('show'), 2000); }
  });
}

function clearNotes() {
  if (confirm('Clear your notes? This cannot be undone.')) {
    const el = document.getElementById('assist-scratchpad');
    if (el) el.value = '';
  }
}