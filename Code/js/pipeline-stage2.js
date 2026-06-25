// ─── pipeline-stage2.js ───
// Stage 2: FRS Review Pipeline — integrated with existing Pipeline Author
//
// Defines renderStageCustom() which hooks into pipeline-stage-common.js
// and renders the full 4-phase FRS review UI inside #content.
// All state stored in sd.frsData; all AI calls use existing callOllama() etc.
// ========================================================

// ─── FRS helpers — shared across render functions ───

let _frsRetryAction = null;

function frsGenId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

function frsGetDoc(sd) {
  const fd = sd.frsData;
  if (!fd || !fd.activeDocId) return null;
  return fd.documents.find(d => d.id === fd.activeDocId) || null;
}

function frsGetActivePoints(doc) {
  if (!doc || !doc.points) return [];
  const map = {};
  doc.points.forEach(p => {
    const base = Math.floor(parseFloat(p.id));
    if (!map[base] || frsCmpVersions(p.id, map[base].id) > 0) map[base] = p;
  });
  return Object.values(map).sort((a, b) => parseFloat(a.id) - parseFloat(b.id));
}

function frsCmpVersions(a, b) {
  const [am, as = 0] = a.split('.').map(Number);
  const [bm, bs = 0] = b.split('.').map(Number);
  return am !== bm ? am - bm : as - bs;
}

function frsNextSubV(baseId, points) {
  const base = Math.floor(parseFloat(baseId));
  const existing = points.filter(p => Math.floor(parseFloat(p.id)) === base).map(p => p.id);
  let maxSub = 0;
  existing.forEach(id => { const s = parseInt(id.split('.')[1]) || 0; if (s > maxSub) maxSub = s; });
  return `${base}.${maxSub + 1}`;
}

function frsPriorId(pointId) {
  const parts = pointId.split('.');
  const s = parseInt(parts[1]);
  return s > 0 ? `${parts[0]}.${s - 1}` : pointId;
}

function frsGetOriginClass(p) {
  if (p.accepted && p.change_origin !== 'ai-impact') return 'accepted';
  if (p.change_origin === 'ai-impact') return 'impact';
  if (p.change_origin === 'manual') return 'proposal';
  return 'noimpact';
}

function frsGetOriginLabel(p) {
  if (p.accepted && p.change_origin !== 'ai-impact' && !(p.decision === null && p.accepted === false && p.change_origin !== 'initial')) return 'Manually accepted';
  if (p.change_origin === 'ai-impact') return `AI cross-impact${p.source_impact ? ' ← ' + p.source_impact : ''}`;
  if (p.change_origin === 'manual' && !p.accepted) return 'Your proposal';
  if (p.accepted) return 'No impact this round';
  return 'Initial';
}

function frsGetHistory(doc, pid) {
  const base = Math.floor(parseFloat(pid));
  return doc.points.filter(p => Math.floor(parseFloat(p.id)) === base && p.id !== pid).sort((a, b) => frsCmpVersions(a.id, b.id));
}

// ─── AI call router (same pattern as pipeline-stage-common.js) ───

async function frsCallAI(systemPrompt, userContent) {
  const stage = PIPELINE[1]; // Stage 2 in 0-indexed
  const models = getStageModels(stage);
  let raw = '';
  switch(CONFIG.mode) {
    case 'cloud':      raw = await callAnthropic(systemPrompt, userContent); break;
    case 'openai':     raw = await callOpenAI(systemPrompt, userContent); break;
    case 'gemini':     raw = await callGemini(systemPrompt, userContent); break;
    case 'azure':      raw = await callAzure(systemPrompt, userContent); break;
    case 'groq':       raw = await callGroq(systemPrompt, userContent); break;
    case 'cerebras':   raw = await callCerebras(systemPrompt, userContent); break;
    case 'openrouter': raw = await callOpenRouter(systemPrompt, userContent); break;
    case 'nvidia':     raw = await callNvidia(systemPrompt, userContent); break;
    case 'siliconflow': raw = await callSiliconflow(systemPrompt, userContent); break;
    default:           raw = await callOllama(systemPrompt, userContent, models[0]); break;
  }
  raw = raw.replace(/^```json\s*/gm, '').replace(/```\s*$/gm, '').trim();
  return raw;
}

async function frsWithRetry(fn, doc, sd) {
  try {
    // Clear any prior error
    const el = document.getElementById('frs-errors');
    if (el) el.innerHTML = '';
    const result = await fn();
    return result;
  } catch (err) {
    const el = document.getElementById('frs-errors');
    if (el) {
      el.innerHTML = `<div class="error-banner">
        <span>${escHtml(err.message)}</span>
        <button class="btn btn-sm btn-danger" onclick="document.getElementById('frs-errors').innerHTML='';renderStage2FRS()">Retry</button>
      </div>`;
    } else {
      showToast('Error: ' + err.message);
    }
    throw err;
  }
}

// ─── CSS injected once ───

(function injectFrsStyles() {
  if (document.getElementById('frs-styles')) return;
  const style = document.createElement('style');
  style.id = 'frs-styles';
  style.textContent = `
/* FRS sub-pipeline */
.frs-stepper { display:flex; align-items:center; gap:6px; padding:10px 14px; background:var(--surface-2); border:1px solid var(--border); border-radius:8px; margin-bottom:16px; }
.frs-step { display:flex; align-items:center; gap:6px; padding:4px 12px; border-radius:16px; font-size:12px; font-weight:500; color:var(--text-3); cursor:default; white-space:nowrap; }
.frs-step .frs-sc { width:20px; height:20px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:600; background:var(--surface-3); color:var(--text-3); flex-shrink:0; }
.frs-step.completed { color:var(--success); }
.frs-step.completed .frs-sc { background:var(--success); color:#fff; content:'✓'; }
.frs-step.completed .frs-sc::after { content:'✓'; }
.frs-step.current { color:var(--text); font-weight:600; }
.frs-step.current .frs-sc { background:var(--accent); color:#fff; }
.frs-step.disabled { opacity:0.4; }
.frs-step.clickable { cursor:pointer; }
.frs-step.clickable:hover { background:var(--surface-3); }
.frs-step-arrow { color:var(--border-strong); font-size:12px; }
.frs-version-badge { margin-left:auto; font-family:var(--mono); font-size:10px; padding:3px 8px; border-radius:4px; background:var(--surface); border:1px solid var(--border); color:var(--text-2); }
.frs-doc-bar { display:flex; gap:8px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.frs-doc-bar select { font-family:var(--mono); font-size:11px; padding:4px 8px; border:1px solid var(--border-strong); border-radius:5px; background:var(--surface); color:var(--text); }
/* Phase 1 */
.frs-input-name { width:100%; font-size:16px; font-weight:600; color:var(--text); border:none; border-bottom:2px solid var(--border); padding:3px 0 6px; margin-bottom:12px; outline:none; background:transparent; }
.frs-input-name:focus { border-color:var(--accent); }
.frs-textarea { width:100%; min-height:300px; padding:12px; border:1px solid var(--border-strong); border-radius:8px; font-family:var(--mono); font-size:12px; line-height:1.7; color:var(--text); background:var(--surface-2); resize:vertical; outline:none; }
.frs-textarea:focus { border-color:var(--accent); }
.frs-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; }
/* Phase 2 */
.frs-p2info { display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; padding:10px 14px; background:var(--surface-3); border-radius:8px; font-size:12px; color:var(--text-2); }
.frs-p2list { display:flex; flex-direction:column; gap:6px; }
.frs-p2item { display:flex; align-items:flex-start; gap:8px; padding:8px 10px; background:var(--surface); border:1px solid var(--border); border-radius:8px; }
.frs-p2item textarea { flex:1; font-family:var(--mono); font-size:12px; color:var(--text); border:none; background:transparent; outline:none; resize:none; padding:2px 0; line-height:1.6; min-height:18px; }
.frs-p2para { display:none; width:100%; margin-top:6px; padding:6px 10px; background:var(--surface-2); border-radius:6px; font-size:11px; color:var(--text-2); }
.frs-p2para.open { display:block; }
/* Phase 3 */
.frs-p3sum { display:flex; gap:18px; margin-bottom:12px; padding:10px 14px; background:var(--surface-3); border-radius:8px; font-size:12px; color:var(--text-2); }
.frs-p3sum .stat { display:flex; gap:5px; align-items:center; }
.frs-p3sum .sv { font-weight:600; color:var(--text); }
.frs-p3list { display:flex; flex-direction:column; gap:6px; }
/* Phase 4 — cards */
.frs-inc-banner { display:none; padding:10px 14px; background:var(--danger-bg); border:1px solid #fca5a5; border-radius:8px; color:var(--danger); font-size:12px; font-weight:500; margin-bottom:12px; }
.frs-inc-banner.show { display:flex; }
.frs-cards { display:flex; flex-direction:column; gap:8px; }
.frs-card { border:1px solid var(--border); border-radius:8px; overflow:hidden; }
.frs-card.incongruent { border-left:3px solid var(--danger); }
.frs-card.accepted { opacity:0.65; }
.frs-ch { display:flex; align-items:center; gap:6px; padding:8px 12px; background:var(--surface); flex-wrap:wrap; }
.frs-ch.incongruent { background:var(--danger-bg); }
.frs-ch .frs-pt { flex:1; font-family:var(--mono); font-size:12px; color:var(--text); min-width:180px; }
.frs-ibadge { font-size:9px; font-weight:600; padding:2px 7px; border-radius:4px; background:var(--danger); color:#fff; }
.frs-ciwarn { font-size:10px; padding:2px 6px; border-radius:4px; background:var(--warning-bg); color:var(--warning); border:1px solid #fde68a; }
.frs-diff { padding:6px 12px; border-top:1px solid var(--border); background:var(--surface); }
.frs-diff-label { font-size:10px; color:var(--text-3); margin-bottom:3px; }
.frs-diff-old { padding:3px 8px; background:#fff1f0; color:#7f1d1d; text-decoration:line-through; border-radius:4px; font-family:var(--mono); font-size:11px; margin-bottom:3px; }
.frs-diff-new { padding:3px 8px; background:#f0fdf4; color:#065f46; border-radius:4px; font-family:var(--mono); font-size:11px; }
.frs-acc { padding:6px 12px; border-top:1px solid var(--border); background:var(--surface-2); cursor:pointer; font-size:11px; font-weight:500; color:var(--text-3); display:flex; align-items:center; gap:4px; }
.frs-acc:hover { background:var(--surface-3); }
.frs-acc-body { display:none; padding:12px; border-top:1px solid var(--border); background:var(--surface-2); }
.frs-acc-body.open { display:block; }
.frs-ai-note { margin-top:4px; padding:5px 10px; background:#fef3c7; border:1px solid #fde68a; border-radius:4px; font-size:11px; color:#92400e; }
.frs-decision { display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border-top:1px solid var(--border); background:var(--surface); gap:10px; flex-wrap:wrap; }
.frs-dbtn { min-width:80px; height:32px; font-weight:500; font-size:12px; border-radius:5px; cursor:pointer; transition:all 0.1s; border:1px solid var(--border-strong); background:var(--surface); color:var(--text-3); }
.frs-dbtn:hover { border-color:var(--text-2); color:var(--text); }
.frs-dbtn.ay { background:var(--success); border-color:var(--success); color:#fff; }
.frs-dbtn.rj { background:var(--danger); border-color:var(--danger); color:#fff; }
.frs-dlocked { display:flex; align-items:center; gap:8px; font-size:12px; font-weight:500; color:var(--success); }
.frs-dlocked .reopen { font-size:11px; color:var(--text-3); cursor:pointer; font-weight:400; }
.frs-dlocked .reopen:hover { color:var(--text); }
.frs-rej { padding:8px 12px; border-top:1px solid var(--border); background:var(--surface-2); }
.frs-rej textarea { width:100%; min-height:60px; padding:6px 8px; border:1px solid var(--border-strong); border-radius:5px; font-family:var(--mono); font-size:11px; line-height:1.6; color:var(--text); background:var(--surface); resize:vertical; outline:none; }
.frs-rej textarea:focus { border-color:var(--accent); }
.frs-rej textarea.incongruent { background:#fff1f0; border-color:#fca5a5; }
.frs-hist-toggle { padding:5px 12px; border-top:1px solid var(--border); background:var(--surface); cursor:pointer; font-size:11px; color:var(--text-3); display:flex; align-items:center; gap:3px; }
.frs-hist-toggle:hover { color:var(--text); }
.frs-hist-body { display:none; border-top:1px solid var(--border); }
.frs-hist-body.open { display:block; }
.frs-hist-item { padding:6px 12px 6px 22px; border-bottom:1px solid var(--border); background:var(--surface-2); font-size:11px; }
/* Submit bar */
.frs-submit-bar { border-top:1px solid var(--border); background:var(--surface); padding:10px 16px; display:flex; align-items:center; justify-content:space-between; gap:14px; margin-top:16px; }
.frs-submit-bar .frs-prog { font-size:12px; color:var(--text-2); font-weight:500; }
.frs-submit-bar .frs-prog span { color:var(--text); }
.frs-submit-bar .frs-blocked { display:none; font-size:11px; color:var(--danger); }
.frs-submit-bar .frs-blocked.show { display:block; }
/* Accepted screen */
.frs-accepted { display:none; }
.frs-accepted.show { display:block; }
.frs-accepted .banner { padding:16px 20px; background:#d1fae5; border:1px solid #a7f3d0; border-radius:8px; margin-bottom:16px; }
.frs-accepted .banner h2 { font-size:16px; color:#065f46; margin-bottom:3px; }
.frs-accepted .banner p { font-size:12px; color:#047857; }
.frs-rtable { width:100%; border-collapse:collapse; margin-top:12px; font-size:12px; }
.frs-rtable th { text-align:left; padding:6px 10px; background:var(--surface-3); color:var(--text-2); font-weight:600; font-size:10px; text-transform:uppercase; letter-spacing:0.04em; border:1px solid var(--border); }
.frs-rtable td { padding:6px 10px; border:1px solid var(--border); color:var(--text); }
.frs-rtable tr:hover td { background:var(--surface-2); }
/* small tag overrides */
.frs-tag { font-family:var(--mono); font-size:10px; font-weight:500; padding:2px 7px; border-radius:20px; background:var(--accent); color:#fff; white-space:nowrap; }
.frs-tag.sm { font-size:9px; padding:1px 5px; }
.frs-origin { font-size:10px; font-weight:500; padding:2px 7px; border-radius:4px; white-space:nowrap; }
`;
  document.head.appendChild(style);
})();

// ─── Main custom renderer ───

function renderStageCustom(stage, sd, content) {
  // Only intercept Stage 2 (SRS/FRS)
  if (stage.id !== 2) return false;

  // Initialize FRS data if needed
  if (!sd.frsData) {
    sd.frsData = { documents: [], activeDocId: null, activePhase: 1 };
  }
  const fd = sd.frsData;
  if (fd.documents.length === 0) {
    fd.documents.push({
      id: frsGenId(), name: 'Untitled FRS', rawInput: '',
      version: { p: 'P_1.0', r: 'R_0', a: null },
      points: [], status: 'draft', history: []
    });
    fd.activeDocId = fd.documents[0].id;
    fd.activePhase = 1;
  }

  renderStage2FRS(content, sd, fd);
  return true;
}

// ─── Render dispatcher ───

function renderStage2FRS(content, sd, fd) {
  if (!content) content = document.getElementById('content');
  if (!sd) sd = stageData[2];
  if (!fd) fd = sd.frsData;
  content.innerHTML = '';

  // Error container
  const errDiv = document.createElement('div');
  errDiv.id = 'frs-errors';
  content.appendChild(errDiv);

  // Document selector bar
  const docBar = document.createElement('div');
  docBar.className = 'frs-doc-bar';
  const docSelect = document.createElement('select');
  docSelect.id = 'frs-doc-select';
  fd.documents.forEach(d => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.name;
    if (d.id === fd.activeDocId) opt.selected = true;
    docSelect.appendChild(opt);
  });
  docSelect.addEventListener('change', function() {
    fd.activeDocId = this.value;
    const doc = fd.documents.find(d => d.id === fd.activeDocId);
    if (doc) {
      if (doc.status === 'accepted') fd.activePhase = 5;
      else if (doc.status === 'draft') fd.activePhase = 1;
      else if (doc.status === 'cleanup') fd.activePhase = 2;
      else if (doc.status === 'reviewed') fd.activePhase = 3;
      else if (doc.status === 'in-acceptance') fd.activePhase = 4;
    }
    saveToStorage();
    renderStage2FRS(content, sd, fd);
  });
  docBar.appendChild(docSelect);

  const newDocBtn = document.createElement('button');
  newDocBtn.className = 'btn btn-sm';
  newDocBtn.textContent = '+ New FRS';
  newDocBtn.addEventListener('click', function() {
    fd.documents.push({
      id: frsGenId(), name: 'Untitled FRS', rawInput: '',
      version: { p: 'P_1.0', r: 'R_0', a: null },
      points: [], status: 'draft', history: []
    });
    fd.activeDocId = fd.documents[fd.documents.length - 1].id;
    fd.activePhase = 1;
    saveToStorage();
    renderStage2FRS(content, sd, fd);
  });
  docBar.appendChild(newDocBtn);

  // Delete doc button
  if (fd.documents.length > 1) {
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-sm btn-danger';
    delBtn.textContent = '✕ Delete';
    delBtn.style.marginLeft = 'auto';
    delBtn.addEventListener('click', function() {
      const idx = fd.documents.findIndex(d => d.id === fd.activeDocId);
      if (idx > -1) fd.documents.splice(idx, 1);
      fd.activeDocId = fd.documents[0]?.id || null;
      fd.activePhase = 1;
      saveToStorage();
      renderStage2FRS(content, sd, fd);
    });
    docBar.appendChild(delBtn);
  }

  content.appendChild(docBar);

  // Sub-stepper
  const doc = fd.documents.find(d => d.id === fd.activeDocId);
  if (!doc) return;

  const stepper = document.createElement('div');
  stepper.className = 'frs-stepper';
  const phases = [
    { n: 1, label: 'Input' },
    { n: 2, label: 'Cleanup' },
    { n: 3, label: 'Review' },
    { n: 4, label: 'Accept' }
  ];
  phases.forEach((p, i) => {
    if (i > 0) {
      const arrow = document.createElement('span');
      arrow.className = 'frs-step-arrow';
      arrow.textContent = '→';
      stepper.appendChild(arrow);
    }
    const step = document.createElement('div');
    step.className = 'frs-step';
    const sc = document.createElement('span');
    sc.className = 'frs-sc';

    if (p.n < fd.activePhase) { step.classList.add('completed'); sc.textContent = '✓'; }
    else if (p.n === fd.activePhase) { step.classList.add('current'); sc.textContent = p.n; }
    else { step.classList.add('disabled'); sc.textContent = p.n; }

    if (p.n < fd.activePhase) {
      step.classList.add('clickable');
      step.style.cursor = 'pointer';
      step.addEventListener('click', function() { frsGoToPhase(p.n, content, sd, fd); });
    }

    step.appendChild(sc);
    step.appendChild(document.createTextNode(p.label));
    stepper.appendChild(step);
  });

  const vBadge = document.createElement('span');
  vBadge.className = 'frs-version-badge';
  const parts = [doc.version.p];
  if (doc.version.r !== 'R_0') parts.push(doc.version.r);
  if (doc.version.a) parts.push(doc.version.a);
  vBadge.textContent = parts.join(' / ');
  stepper.appendChild(vBadge);
  content.appendChild(stepper);

  // Render phase content
  if (fd.activePhase === 5) {
    frsRenderAccepted(doc, content, sd, fd);
    return;
  }
  switch(fd.activePhase) {
    case 1: frsRenderPhase1(doc, content, sd, fd); break;
    case 2: frsRenderPhase2(doc, content, sd, fd); break;
    case 3: frsRenderPhase3(doc, content, sd, fd); break;
    case 4: frsRenderPhase4(doc, content, sd, fd); break;
  }
}

function frsGoToPhase(phase, content, sd, fd) {
  const doc = fd.documents.find(d => d.id === fd.activeDocId);
  if (!doc) return;
  if (phase === 2 && !doc.rawInput.trim()) { showToast('Paste raw FRS text first'); return; }
  if (phase === 3 && doc.points.length === 0) { showToast('Run AI cleanup first'); return; }
  if (phase === 4 && doc.version.r === 'R_0') { showToast('Run AI review first'); return; }
  fd.activePhase = phase;
  saveToStorage();
  renderStage2FRS(content, sd, fd);
}

// ============================
// PHASE 1 — INPUT
// ============================

function frsRenderPhase1(doc, content, sd, fd) {
  const nameInput = document.createElement('input');
  nameInput.className = 'frs-input-name';
  nameInput.type = 'text';
  nameInput.value = doc.name;
  nameInput.placeholder = 'FRS document name…';
  nameInput.addEventListener('input', function() {
    doc.name = this.value || 'Untitled FRS';
    saveToStorage();
    // Update select option text
    const sel = document.getElementById('frs-doc-select');
    if (sel) {
      const opt = sel.querySelector(`option[value="${doc.id}"]`);
      if (opt) opt.textContent = doc.name;
    }
  });
  content.appendChild(nameInput);

  const textarea = document.createElement('textarea');
  textarea.className = 'frs-textarea';
  textarea.placeholder = 'Paste your raw FRS document here…\n\nInclude paragraphs and bullet points describing functional requirements.';
  textarea.value = doc.rawInput;
  textarea.addEventListener('input', function() {
    doc.rawInput = this.value;
    saveToStorage();
  });
  content.appendChild(textarea);

  const actions = document.createElement('div');
  actions.className = 'frs-actions';
  const runBtn = document.createElement('button');
  runBtn.className = 'btn btn-primary';
  runBtn.textContent = 'Run AI cleanup →';
  runBtn.id = 'frs-btn-p1';
  runBtn.addEventListener('click', function() { frsRunPhase2(); });
  actions.appendChild(runBtn);
  content.appendChild(actions);
}

// ============================
// PHASE 2 — CLEANUP
// ============================

async function frsRunPhase2() {
  const sd = stageData[2];
  const fd = sd.frsData;
  const doc = fd.documents.find(d => d.id === fd.activeDocId);
  if (!doc || !doc.rawInput.trim()) { showToast('Paste raw FRS text first'); return; }

  const btn = document.getElementById('frs-btn-p2');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Running…'; }

  try {
    await frsWithRetry(async () => {
      const sp = 'You are an FRS analyst. Parse the raw input and split it into atomic sub-requirements. Each point must represent exactly one testable behaviour. Return JSON only, no markdown, no preamble:\n{\n  "points": [\n    { "id": "1.0", "text": "...", "paragraph": "..." }\n  ]\n}';
      const raw = await frsCallAI(sp, doc.rawInput);
      const parsed = JSON.parse(raw);
      const points = parsed.points || [];
      if (points.length === 0) throw new Error('No points identified by AI');

      doc.points = points.map(p => ({
        id: p.id, text: p.text, paragraph: p.paragraph || '',
        prev_text: null, change_origin: 'initial', source_impact: null,
        review: null, decision: null, rejectionNote: '',
        proposalStatus: null, proposalNote: null, accepted: false
      }));
      doc.status = 'cleanup';
      doc.version.p = 'P_1.0';
      doc.version.r = 'R_0';
      fd.activePhase = 2;
      saveToStorage();
      renderStage2FRS(contentById('content'), sd, fd);
      showToast(doc.points.length + ' points identified');
    }, doc, sd);
  } catch(err) {
    showToast('Error: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Run AI cleanup →'; }
  }
}

function frsRenderPhase2(doc, content, sd, fd) {
  const info = document.createElement('div');
  info.className = 'frs-p2info';
  info.innerHTML = `<span>${doc.points.length} points identified</span><span style="font-size:11px;color:var(--text-3);">— review and edit before AI review</span>`;
  content.appendChild(info);

  const list = document.createElement('div');
  list.className = 'frs-p2list';
  doc.points.forEach((point, idx) => {
    const item = document.createElement('div');
    item.className = 'frs-p2item';

    const badge = document.createElement('span');
    badge.className = 'frs-tag sm';
    badge.textContent = point.id;
    item.appendChild(badge);

    const ta = document.createElement('textarea');
    ta.value = point.text;
    ta.rows = 1;
    ta.addEventListener('input', function() { point.text = this.value; saveToStorage(); });
    item.appendChild(ta);

    if (point.paragraph) {
      const toggle = document.createElement('span');
      toggle.style.cssText = 'font-size:10px;color:var(--text-3);cursor:pointer;white-space:nowrap;';
      toggle.textContent = '▾ para';
      toggle.addEventListener('click', function() {
        const p = item.querySelector('.frs-p2para');
        p.classList.toggle('open');
        toggle.textContent = p.classList.contains('open') ? '▴ para' : '▾ para';
      });
      item.appendChild(toggle);

      const paraDiv = document.createElement('div');
      paraDiv.className = 'frs-p2para';
      paraDiv.textContent = point.paragraph;
      item.appendChild(paraDiv);
    }

    list.appendChild(item);
  });
  content.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'frs-actions';
  const backBtn = document.createElement('button');
  backBtn.className = 'btn';
  backBtn.textContent = '← Back to input';
  backBtn.addEventListener('click', function() { frsGoToPhase(1, content, sd, fd); });
  actions.appendChild(backBtn);

  const runBtn = document.createElement('button');
  runBtn.className = 'btn btn-primary';
  runBtn.textContent = 'Run AI review →';
  runBtn.id = 'frs-btn-p2';
  runBtn.addEventListener('click', function() { frsRunPhase3(); });
  actions.appendChild(runBtn);
  content.appendChild(actions);
}

// ============================
// PHASE 3 — REVIEW
// ============================

async function frsRunPhase3() {
  const sd = stageData[2];
  const fd = sd.frsData;
  const doc = fd.documents.find(d => d.id === fd.activeDocId);
  if (!doc || doc.points.length === 0) { showToast('No points to review'); return; }

  const btn = document.getElementById('frs-btn-p3');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Running…'; }

  try {
    await frsWithRetry(async () => {
      const sp = 'You are a systems engineer reviewing FRS points. Return a structured review for every point in the list provided. Return JSON only, no markdown, no preamble:\n{\n  "reviews": {\n    "<id>": {\n      "clarity_score": N,\n      "ambiguity_flags": [],\n      "suggested_reword": "...",\n      "testability": "high|medium|low",\n      "cross_impact": []\n    }\n  }\n}';
      const payload = JSON.stringify({ points: doc.points.map(p => ({ id: p.id, text: p.text, paragraph: p.paragraph })) });
      const raw = await frsCallAI(sp, payload);
      const parsed = JSON.parse(raw);
      const reviews = parsed.reviews || {};

      doc.points.forEach(p => {
        const r = reviews[p.id];
        if (r) {
          p.review = {
            clarity_score: r.clarity_score || 3,
            ambiguity_flags: r.ambiguity_flags || [],
            suggested_reword: r.suggested_reword || '',
            testability: r.testability || 'medium',
            cross_impact: r.cross_impact || []
          };
        }
      });
      doc.status = 'reviewed';
      doc.version.r = 'R_1.0';
      fd.activePhase = 3;
      saveToStorage();
      renderStage2FRS(contentById('content'), sd, fd);
      showToast('AI review complete');
    }, doc, sd);
  } catch(err) {
    showToast('Error: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Run AI review →'; }
  }
}

function frsRenderPhase3(doc, content, sd, fd) {
  // Summary
  const sum = document.createElement('div');
  sum.className = 'frs-p3sum';
  const total = doc.points.length;
  const reviewed = doc.points.filter(p => p.review).length;
  let avg = 0, hi = 0, med = 0, lo = 0;
  doc.points.forEach(p => {
    if (p.review) {
      avg += p.review.clarity_score;
      if (p.review.testability === 'high') hi++;
      else if (p.review.testability === 'medium') med++;
      else lo++;
    }
  });
  avg = reviewed > 0 ? (avg / reviewed) : 0;
  sum.innerHTML = `
    <div class="stat"><span class="sv">${total}</span> points</div>
    <div class="stat">avg clarity <span class="sv">${avg.toFixed(1)}</span></div>
    <div class="stat"><span style="color:var(--success)">◆</span>${hi} <span style="color:var(--warning);margin-left:5px;">◇</span>${med} <span style="color:var(--danger);margin-left:5px;">○</span>${lo}</div>
  `;
  content.appendChild(sum);

  const list = document.createElement('div');
  list.className = 'frs-p3list';

  doc.points.forEach(p => {
    const card = document.createElement('div');
    card.style.cssText = 'border:1px solid var(--border);border-radius:8px;overflow:hidden;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface);cursor:pointer;';
    header.innerHTML = `<span class="frs-tag sm">${p.id}</span><span style="flex:1;font-family:var(--mono);font-size:12px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(p.text)}</span>`;
    const reviewBody = document.createElement('div');
    reviewBody.style.cssText = 'display:none;padding:12px;border-top:1px solid var(--border);background:var(--surface-2);';

    if (p.review) {
      const r = p.review;
      const pct = (r.clarity_score / 5) * 100;
      const cc = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
      reviewBody.innerHTML = `
        <div style="margin-bottom:8px;">
          <div style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;letter-spacing:0.04em;margin-bottom:3px;">Clarity Score</div>
          <div style="font-size:12px;color:var(--text);">${r.clarity_score} / 5</div>
          <div style="height:5px;background:var(--border);border-radius:3px;margin-top:3px;overflow:hidden;"><div style="height:100%;border-radius:3px;width:${pct}%;background:${cc};"></div></div>
        </div>
        <div style="margin-bottom:8px;">
          <div style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;margin-bottom:3px;">Ambiguity Flags</div>
          <div style="display:flex;flex-wrap:wrap;gap:3px;">${r.ambiguity_flags.length > 0 ? r.ambiguity_flags.map(f => `<span style="font-size:10px;padding:2px 7px;border-radius:4px;background:var(--warning-bg);color:var(--warning);border:1px solid #fde68a;">${escHtml(f)}</span>`).join('') : '<span style="font-size:11px;color:var(--success);">None</span>'}</div>
        </div>
        ${r.suggested_reword ? `<div style="margin-bottom:8px;"><div style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;margin-bottom:3px;">Suggested Reword</div><div style="font-family:var(--mono);font-size:11px;color:var(--text);">${escHtml(r.suggested_reword)}</div></div>` : ''}
        <div style="margin-bottom:8px;">
          <div style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;margin-bottom:3px;">Testability</div>
          <span style="font-size:10px;font-weight:500;padding:2px 7px;border-radius:4px;background:${r.testability === 'high' ? '#d1fae5' : r.testability === 'medium' ? '#fef3c7' : '#fef2f2'};color:${r.testability === 'high' ? '#065f46' : r.testability === 'medium' ? '#b45309' : '#991b1b'};">${r.testability}</span>
        </div>
        ${r.cross_impact && r.cross_impact.length > 0 ? `<div><div style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;margin-bottom:3px;">Cross-Impact</div><div style="font-family:var(--mono);font-size:11px;color:var(--text);">${r.cross_impact.join(', ')}</div></div>` : ''}
      `;
    } else {
      reviewBody.innerHTML = '<div style="color:var(--text-3);font-size:11px;">Pending review…</div>';
    }

    header.addEventListener('click', function() {
      reviewBody.style.display = reviewBody.style.display === 'block' ? 'none' : 'block';
    });
    card.appendChild(header);
    card.appendChild(reviewBody);
    list.appendChild(card);
  });
  content.appendChild(list);

  const actions = document.createElement('div');
  actions.className = 'frs-actions';
  const backBtn = document.createElement('button');
  backBtn.className = 'btn';
  backBtn.textContent = '← Back to cleanup';
  backBtn.addEventListener('click', function() { frsGoToPhase(2, content, sd, fd); });
  actions.appendChild(backBtn);

  const goBtn = document.createElement('button');
  goBtn.className = 'btn btn-primary';
  goBtn.textContent = 'Go to acceptance →';
  goBtn.id = 'frs-btn-p3';
  goBtn.addEventListener('click', function() { frsGoToPhase(4, content, sd, fd); });
  actions.appendChild(goBtn);
  content.appendChild(actions);
}

// ============================
// PHASE 4 — ACCEPTANCE
// ============================

function frsRenderPhase4(doc, content, sd, fd) {
  const activePoints = frsGetActivePoints(doc);
  const incongruent = activePoints.filter(p => p.proposalStatus === 'incongruent');

  // Incongruent banner
  const banner = document.createElement('div');
  banner.className = 'frs-inc-banner';
  if (incongruent.length > 0) {
    banner.classList.add('show');
    banner.textContent = `⚠ ${incongruent.length} point(s) have incongruent proposals — revise them to continue.`;
  }
  content.appendChild(banner);

  // Cards
  const cardsDiv = document.createElement('div');
  cardsDiv.className = 'frs-cards';

  activePoints.forEach(p => {
    const card = document.createElement('div');
    card.className = `frs-card${p.proposalStatus === 'incongruent' ? ' incongruent' : ''}${p.accepted ? ' accepted' : ''}`;

    // Header
    const ch = document.createElement('div');
    ch.className = `frs-ch${p.proposalStatus === 'incongruent' ? ' incongruent' : ''}`;

    const idBadge = document.createElement('span');
    idBadge.className = 'frs-tag sm';
    idBadge.textContent = p.id;
    ch.appendChild(idBadge);

    const ob = document.createElement('span');
    ob.className = `frs-origin`;
    ob.style.cssText = `background:${frsGetOriginClass(p) === 'accepted' ? '#d1fae5' : frsGetOriginClass(p) === 'impact' ? '#fef3c7' : frsGetOriginClass(p) === 'proposal' ? '#e0e7ff' : '#f3f4f6'};color:${frsGetOriginClass(p) === 'accepted' ? '#065f46' : frsGetOriginClass(p) === 'impact' ? '#b45309' : frsGetOriginClass(p) === 'proposal' ? '#4338ca' : '#6b7280'};padding:2px 7px;border-radius:4px;font-size:10px;font-weight:500;white-space:nowrap;`;
    ob.textContent = frsGetOriginLabel(p);
    ch.appendChild(ob);

    if (p.proposalStatus === 'incongruent') {
      const inc = document.createElement('span');
      inc.className = 'frs-ibadge';
      inc.textContent = 'Incongruent';
      ch.appendChild(inc);
    }

    if (p.review && p.review.cross_impact && p.review.cross_impact.length > 0) {
      const ci = document.createElement('span');
      ci.className = 'frs-ciwarn';
      ci.title = 'Affects: ' + p.review.cross_impact.join(', ');
      ci.textContent = `⬡ ${p.review.cross_impact.length} impact(s)`;
      ch.appendChild(ci);
    }

    const pt = document.createElement('span');
    pt.className = 'frs-pt';
    pt.textContent = p.text;
    ch.appendChild(pt);
    card.appendChild(ch);

    // Diff strip
    if (p.prev_text) {
      const diff = document.createElement('div');
      diff.className = 'frs-diff';
      diff.innerHTML = `<div class="frs-diff-label">Changed from ${frsPriorId(p.id)}</div><div class="frs-diff-old">${escHtml(p.prev_text)}</div><div class="frs-diff-new">${escHtml(p.text)}</div>`;
      card.appendChild(diff);
    }

    // AI review accordion
    if (p.review) {
      const accToggle = document.createElement('div');
      accToggle.className = 'frs-acc';
      accToggle.textContent = '▸ AI Review';
      const accBody = document.createElement('div');
      accBody.className = 'frs-acc-body';
      const r = p.review;
      const pct = (r.clarity_score / 5) * 100;
      const cc = pct >= 80 ? 'var(--success)' : pct >= 50 ? 'var(--warning)' : 'var(--danger)';
      accBody.innerHTML = `
        <div style="margin-bottom:6px;"><div style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Clarity Score</div><div style="font-size:12px;">${r.clarity_score} / 5</div><div style="height:5px;background:var(--border);border-radius:3px;margin-top:2px;overflow:hidden;"><div style="height:100%;width:${pct}%;background:${cc};"></div></div></div>
        <div style="margin-bottom:6px;"><div style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Ambiguity Flags</div><div style="display:flex;flex-wrap:wrap;gap:3px;">${r.ambiguity_flags.length > 0 ? r.ambiguity_flags.map(f => `<span style="font-size:10px;padding:2px 7px;border-radius:4px;background:var(--warning-bg);color:var(--warning);border:1px solid #fde68a;">${escHtml(f)}</span>`).join('') : '<span style="font-size:11px;color:var(--success);">None</span>'}</div></div>
        ${r.suggested_reword ? `<div style="margin-bottom:6px;"><div style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Suggested Reword</div><div style="font-family:var(--mono);font-size:11px;">${escHtml(r.suggested_reword)}</div></div>` : ''}
        <div style="margin-bottom:6px;"><div style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Testability</div><span style="font-size:10px;font-weight:500;padding:2px 7px;border-radius:4px;background:${r.testability === 'high' ? '#d1fae5' : r.testability === 'medium' ? '#fef3c7' : '#fef2f2'};color:${r.testability === 'high' ? '#065f46' : r.testability === 'medium' ? '#b45309' : '#991b1b'};">${r.testability}</span></div>
        ${r.cross_impact && r.cross_impact.length > 0 ? `<div><div style="font-size:10px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Cross-Impact</div><div style="font-family:var(--mono);font-size:11px;">${r.cross_impact.join(', ')}</div></div>` : ''}
      `;
      accToggle.addEventListener('click', function() {
        accBody.classList.toggle('open');
        this.textContent = accBody.classList.contains('open') ? '▾ AI Review' : '▸ AI Review';
      });
      card.appendChild(accToggle);
      card.appendChild(accBody);
    }

    // AI note for incongruent
    if (p.proposalNote) {
      const note = document.createElement('div');
      note.className = 'frs-rej';
      note.innerHTML = `<div class="frs-ai-note"><strong>AI Note:</strong> ${escHtml(p.proposalNote)}</div>`;
      card.appendChild(note);
    }

    // Decision row
    const decRow = document.createElement('div');
    decRow.className = 'frs-decision';

    if (p.accepted && !(p.decision === null && p.accepted === false && p.change_origin !== 'initial')) {
      const locked = document.createElement('div');
      locked.className = 'frs-dlocked';
      locked.innerHTML = `<span>✓ Accepted</span><span class="reopen" onclick="frsReopen('${p.id}')">Reopen</span>`;
      decRow.appendChild(locked);
    } else {
      const btns = document.createElement('div');
      btns.style.display = 'flex';
      btns.style.gap = '6px';

      const aBtn = document.createElement('button');
      aBtn.className = `frs-dbtn${p.decision === 'Y' ? ' ay' : ''}`;
      aBtn.textContent = '✓ Accept';
      aBtn.addEventListener('click', function() { frsSetDecision(p.id, 'Y'); });
      btns.appendChild(aBtn);

      const rBtn = document.createElement('button');
      rBtn.className = `frs-dbtn${p.decision === 'N' ? ' rj' : ''}`;
      rBtn.textContent = '✗ Reject';
      rBtn.addEventListener('click', function() { frsSetDecision(p.id, 'N'); });
      btns.appendChild(rBtn);

      decRow.appendChild(btns);

      const st = document.createElement('span');
      st.style.cssText = 'font-size:11px;color:var(--text-3);';
      if (p.decision === 'Y') st.textContent = 'Accepted — awaiting submit';
      else if (p.decision === 'N') st.textContent = 'Rejected — provide proposal below';
      decRow.appendChild(st);
    }
    card.appendChild(decRow);

    // Rejection textarea
    if (p.decision === 'N' || p.proposalStatus === 'incongruent') {
      const rej = document.createElement('div');
      rej.className = 'frs-rej';
      const ta = document.createElement('textarea');
      ta.className = p.proposalStatus === 'incongruent' ? 'incongruent' : '';
      ta.placeholder = 'Reason for rejection + new proposal…';
      ta.value = p.rejectionNote || '';
      ta.addEventListener('input', function() {
        p.rejectionNote = this.value;
        saveToStorage();
        frsUpdateSubmitBar();
      });
      rej.appendChild(ta);
      if (p.proposalStatus === 'incongruent' && p.proposalNote) {
        const note = document.createElement('div');
        note.className = 'frs-ai-note';
        note.innerHTML = `<strong>Why it was flagged:</strong> ${escHtml(p.proposalNote)}`;
        rej.appendChild(note);
      }
      card.appendChild(rej);
    }

    // Version history
    const hist = frsGetHistory(doc, p.id);
    if (hist.length > 0) {
      const ht = document.createElement('div');
      ht.className = 'frs-hist-toggle';
      ht.textContent = `▸ History (${hist.length} prior)`;
      const hb = document.createElement('div');
      hb.className = 'frs-hist-body';
      hist.forEach(v => {
        const hi = document.createElement('div');
        hi.className = 'frs-hist-item';
        hi.innerHTML = `<div style="font-family:var(--mono);font-weight:500;">${v.id}</div><div style="color:var(--text-2);">${escHtml(v.text)}</div><div style="color:var(--text-3);font-size:10px;">Decision: ${v.decision === 'Y' ? 'Accepted' : v.decision === 'N' ? 'Rejected' : 'Undecided'}</div>`;
        hb.appendChild(hi);
      });
      ht.addEventListener('click', function() {
        hb.classList.toggle('open');
        ht.textContent = hb.classList.contains('open') ? `▾ History (${hist.length} prior)` : `▸ History (${hist.length} prior)`;
      });
      card.appendChild(ht);
      card.appendChild(hb);
    }

    cardsDiv.appendChild(card);
  });
  content.appendChild(cardsDiv);

  // Submit bar
  const sbar = document.createElement('div');
  sbar.className = 'frs-submit-bar';
  sbar.id = 'frs-submit-bar';
  sbar.innerHTML = `
    <div>
      <div class="frs-prog" id="frs-progress">0 of ${activePoints.length} points decided</div>
      <div class="frs-blocked" id="frs-blocked"></div>
    </div>
    <button class="btn btn-primary" id="frs-btn-submit" disabled>Submit all decisions</button>
  `;
  content.appendChild(sbar);
  frsUpdateSubmitBar();
}

function frsUpdateSubmitBar() {
  const sd = stageData[2];
  const fd = sd.frsData;
  const doc = fd.documents.find(d => d.id === fd.activeDocId);
  if (!doc) return;
  const activePoints = frsGetActivePoints(doc);
  const total = activePoints.length;
  const decided = activePoints.filter(p => p.decision === 'Y' || p.decision === 'N').length;
  const incongruent = activePoints.filter(p => p.proposalStatus === 'incongruent');
  const rejectedNoNote = activePoints.filter(p => p.decision === 'N' && (!p.rejectionNote || !p.rejectionNote.trim()));
  const undecided = activePoints.filter(p => p.decision === null);

  const prog = document.getElementById('frs-progress');
  if (prog) prog.innerHTML = `<span>${decided}</span> of <span>${total}</span> points decided`;

  const blocked = document.getElementById('frs-blocked');
  const btn = document.getElementById('frs-btn-submit');
  const reasons = [];
  if (undecided.length > 0) reasons.push(`${undecided.length} point(s) undecided`);
  if (rejectedNoNote.length > 0) reasons.push(`${rejectedNoNote.length} rejection(s) need a reason + proposal`);
  if (incongruent.length > 0) reasons.push(`${incongruent.length} incongruent proposal(s) must be revised`);

  if (reasons.length > 0) {
    if (btn) btn.disabled = true;
    if (blocked) { blocked.className = 'frs-blocked show'; blocked.textContent = reasons.join(' · '); }
  } else {
    if (btn) btn.disabled = (decided !== total);
    if (blocked) { blocked.className = 'frs-blocked'; blocked.innerHTML = ''; }
    if (btn) {
      btn.onclick = function() { frsHandleSubmit(); };
    }
  }
}

function frsSetDecision(pointId, decision) {
  const sd = stageData[2];
  const fd = sd.frsData;
  const doc = fd.documents.find(d => d.id === fd.activeDocId);
  if (!doc) return;
  const p = doc.points.find(pt => pt.id === pointId);
  if (!p) return;
  p.decision = decision;
  if (decision === 'Y') { p.rejectionNote = ''; p.proposalStatus = null; }
  saveToStorage();
  renderStage2FRS();
}

function frsReopen(pointId) {
  const sd = stageData[2];
  const fd = sd.frsData;
  const doc = fd.documents.find(d => d.id === fd.activeDocId);
  if (!doc) return;
  const p = doc.points.find(pt => pt.id === pointId);
  if (!p) return;
  p.decision = null;
  p.accepted = false;
  saveToStorage();
  renderStage2FRS();
}

// ============================
// ROUND STATE MACHINE
// ============================

async function frsHandleSubmit() {
  const sd = stageData[2];
  const fd = sd.frsData;
  const doc = fd.documents.find(d => d.id === fd.activeDocId);
  if (!doc) return;

  const activePoints = frsGetActivePoints(doc);
  const rejected = activePoints.filter(p => p.decision === 'N');
  const updatedIds = rejected.map(p => p.id);

  if (updatedIds.length === 0 && activePoints.every(p => p.accepted === true)) {
    // All accepted — terminate
    doc.status = 'accepted';
    const aVer = doc.history.length + 1;
    doc.version.a = `A_${aVer}.0`;
    fd.activePhase = 5;
    saveToStorage();
    renderStage2FRS();
    showToast('FRS accepted!');
    return;
  }

  if (updatedIds.length === 0) { showToast('No rejections to process'); return; }

  const btn = document.getElementById('frs-btn-submit');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Submitting…'; }

  try {
    await frsWithRetry(async () => {
      // Create new sub-versions
      const newPoints = [];
      updatedIds.forEach(id => {
        const old = doc.points.find(p => p.id === id);
        if (!old) return;
        const nid = frsNextSubV(id, doc.points);
        const np = {
          id: nid, text: old.rejectionNote || old.text, paragraph: old.paragraph,
          prev_text: old.text, change_origin: 'manual', source_impact: null,
          review: null, decision: null, rejectionNote: '',
          proposalStatus: null, proposalNote: null, accepted: false
        };
        old.accepted = false;
        newPoints.push(np);
      });

      const tempPoints = [...doc.points, ...newPoints];

      // Call re-review API
      const sp = 'You are a systems engineer reviewing an FRS update round.\n\n' +
        'You will receive the full current point set. Each point carries its current text, its immediately prior version text (prev_text), its change_origin, and its accepted status.\n\n' +
        'For each point, apply exactly one of these three actions:\n\n' +
        'UPDATED (id is in updated_ids):\n' +
        '  - This point was revised by the user this round.\n' +
        '  - Review it fully: clarity, ambiguity, testability, cross_impact.\n' +
        '  - Compare text to prev_text and note what materially changed.\n' +
        '  - Assess legibility of the new text as a requirement statement:\n' +
        '      LEGIBLE: coherent, in scope, testable. Proceed with review.\n' +
        '      INCONGRUENT: gibberish, contradicts FRS scope, or not a valid requirement statement. Explain why. Do not accept.\n\n' +
        'IMPACTED (id not in updated_ids, but affected by an updated point):\n' +
        '  - An updated point creates a dependency, contradiction, or gap with this point.\n' +
        '  - Propose updated text for this point (new sub-version).\n' +
        '  - Provide a cross_impact_note explaining the dependency.\n' +
        '  - Do not change its accepted status — the user must re-accept.\n\n' +
        'UNAFFECTED (id not in updated_ids, no impact found):\n' +
        '  - Omit this point from the response entirely.\n' +
        '  - Your silence means: no action needed, point stands as accepted.\n\n' +
        'Return JSON only, no markdown, no preamble:\n' +
        '{\n  "updated": {\n    "<id>": {\n      "review": { "clarity_score": N, "ambiguity_flags": [], "suggested_reword": "", "testability": "high|medium|low", "cross_impact": [] },\n      "legibility": { "status": "legible|incongruent", "note": "..." }\n    }\n  },\n  "impacted": {\n    "<id>": {\n      "proposed_text": "...",\n      "cross_impact_note": "..."\n    }\n  }\n}';

      const payloadPoints = tempPoints.map(p => ({
        id: p.id, text: p.text, paragraph: p.paragraph,
        prev_text: p.prev_text, change_origin: p.change_origin, accepted: p.accepted
      }));
      const userPayload = JSON.stringify({
        updated_ids: [...updatedIds, ...newPoints.map(p => p.id)],
        all_points: payloadPoints
      });

      const raw = await frsCallAI(sp, userPayload);
      const parsed = JSON.parse(raw);
      const updatedReviews = parsed.updated || {};
      const impacted = parsed.impacted || {};

      // Merge updated reviews
      const allNew = [...updatedIds, ...newPoints.map(p => p.id)];
      allNew.forEach(id => {
        const upd = updatedReviews[id];
        if (!upd) return;
        const target = tempPoints.find(p => p.id === id);
        if (!target) return;
        target.review = upd.review || target.review;
        if (upd.legibility) {
          if (upd.legibility.status === 'incongruent') {
            target.proposalStatus = 'incongruent';
            target.proposalNote = upd.legibility.note || 'Proposal is incongruent';
            target.decision = 'N';
            target.accepted = false;
          } else {
            target.proposalStatus = 'legible';
            target.proposalNote = null;
            target.decision = null;
            target.accepted = false;
          }
        }
      });

      // Create impacted sub-versions
      Object.keys(impacted).forEach(id => {
        const imp = impacted[id];
        const old = tempPoints.find(p => p.id === id);
        if (!old) return;
        const nid = frsNextSubV(id, tempPoints);
        newPoints.push({
          id: nid, text: imp.proposed_text, paragraph: old.paragraph,
          prev_text: old.text, change_origin: 'ai-impact',
          source_impact: updatedIds[0] || newPoints[0]?.id || 'unknown',
          review: null, decision: null, rejectionNote: '',
          proposalStatus: null, proposalNote: null, accepted: false
        });
      });

      // Add new points
      newPoints.forEach(np => doc.points.push(np));

      // Update R version
      const curR = parseInt(doc.version.r.split('_')[1]?.split('.')[0] || '0');
      doc.version.r = `R_${curR + 1}.0`;

      // Round history
      doc.history.push({
        round: doc.history.length + 1,
        timestamp: new Date().toISOString(),
        r_version: doc.version.r,
        changes: [
          ...updatedIds.map(id => `Point ${id} rejected and revised`),
          ...Object.keys(impacted).map(id => `Point ${id} impacted — new sub-version created`)
        ]
      });
      doc.status = 'in-acceptance';

      // Check termination
      const newActive = frsGetActivePoints(doc);
      const allAccepted = newActive.every(p => p.accepted === true);
      if (allAccepted && Object.keys(impacted).length === 0) {
        doc.status = 'accepted';
        doc.version.a = `A_${doc.history.length + 1}.0`;
        fd.activePhase = 5;
        showToast('FRS accepted!');
      } else {
        showToast(`Round ${doc.history.length} complete — ${newPoints.length} point(s) updated`);
      }

      saveToStorage();
      renderStage2FRS();
    }, doc, sd);
  } catch(err) {
    showToast('Error: ' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Submit all decisions'; }
  }
}

// ============================
// ACCEPTED SCREEN
// ============================

function frsRenderAccepted(doc, content, sd, fd) {
  const acceptedDiv = document.createElement('div');
  acceptedDiv.className = 'frs-accepted show';
  acceptedDiv.innerHTML = `
    <div class="banner">
      <h2>✓ FRS accepted — version ${doc.version.a || '—'}</h2>
      <p>All points accepted after ${doc.history.length} review round(s).</p>
    </div>
    <h3 style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;">Round History</h3>
    <table class="frs-rtable">
      <thead><tr><th>Round</th><th>Timestamp</th><th>R version</th><th>Changes</th></tr></thead>
      <tbody id="frs-round-tbody"></tbody>
    </table>
    <div style="display:flex;gap:10px;margin-top:16px;">
      <button class="btn btn-success" onclick="frsExportSummary()">Export summary</button>
      <button class="btn btn-primary" onclick="frsNewDoc()">Start new document</button>
    </div>
  `;
  content.appendChild(acceptedDiv);

  const tbody = document.getElementById('frs-round-tbody');
  if (doc.history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--text-3);">No review rounds recorded</td></tr>';
  } else {
    doc.history.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.round}</td><td>${new Date(r.timestamp).toLocaleString()}</td><td style="font-family:var(--mono);">${r.r_version}</td><td>${r.changes.length > 0 ? r.changes.join('; ') : '—'}</td>`;
      tbody.appendChild(tr);
    });
  }
}

// ─── Export ───

function frsExportSummary() {
  const sd = stageData[2];
  const fd = sd.frsData;
  const doc = fd.documents.find(d => d.id === fd.activeDocId);
  if (!doc) return;

  let text = `FRS Review Summary\nDocument: ${doc.name}\nFinal version: ${doc.version.a || doc.version.r}\nDate: ${new Date().toLocaleString()}\nPoints: ${doc.points.length}\n\n=== FINAL POINTS ===\n\n`;
  const active = frsGetActivePoints(doc);
  active.forEach(p => {
    text += `[${p.id}] ${p.text}\n`;
    if (p.paragraph) text += `  Context: ${p.paragraph}\n`;
    if (p.review) text += `  Clarity: ${p.review.clarity_score}/5, Testability: ${p.review.testability}\n`;
    text += `  Status: ${p.accepted ? 'Accepted' : p.decision === 'N' ? 'Rejected' : 'Undecided'}\n\n`;
  });
  text += `=== ROUND HISTORY ===\n\n`;
  doc.history.forEach(r => {
    text += `Round ${r.round} (${r.r_version}) — ${new Date(r.timestamp).toLocaleString()}\n`;
    r.changes.forEach(c => text += `  • ${c}\n`);
    text += '\n';
  });
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `frs_summary_${doc.name.replace(/\s+/g, '_')}.txt`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

function frsNewDoc() {
  const sd = stageData[2];
  const fd = sd.frsData;
  const doc = {
    id: frsGenId(), name: 'New FRS Document', rawInput: '',
    version: { p: 'P_1.0', r: 'R_0', a: null },
    points: [], status: 'draft', history: []
  };
  fd.documents.push(doc);
  fd.activeDocId = doc.id;
  fd.activePhase = 1;
  saveToStorage();
  renderStage2FRS();
}

// ─── Helper ───

function contentById(id) {
  return document.getElementById(id);
}