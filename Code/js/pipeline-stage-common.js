// ─── pipeline-stage-common.js ───
// Shared rendering logic for stages 2-9 (generic stage UI)

function saveCurrentInputs() {
  const stage = PIPELINE[currentStage - 1];
  const sd = stageData[currentStage];
  if (!sd) return;

  // Stage 1 PRD saving (delegated to stage1 module)
  if (stage.isStage1PRD) {
    saveStage1Inputs();
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

function renderStage() {
  const stage = PIPELINE[currentStage - 1];
  const sd = stageData[currentStage];
  const content = document.getElementById('content');
  if (!content) return;
  content.innerHTML = '';

  const badge = document.getElementById('topbar-stage-badge');
  if (badge) {
    badge.textContent = 'Stage ' + stage.id;
    badge.className = stage.isGate ? 'gate' : '';
  }
  const title = document.getElementById('topbar-title');
  if (title) title.textContent = stage.name;
  const modelsText = document.getElementById('topbar-models-text');
  if (modelsText) modelsText.textContent = stageModelsLabel(stage);

  // Check for stage-specific custom renderer
  if (typeof renderStageCustom === 'function') {
    if (renderStageCustom(stage, sd, content)) return;
  }

  // Show Stage 1 PRD UI if applicable
  if (stage.isStage1PRD) {
    if (typeof renderStage1PRD === 'function') {
      renderStage1PRD(content);
    }
    const btnAction = document.getElementById('btn-action');
    const btnNext = document.getElementById('btn-next');
    if (btnAction) btnAction.style.display = 'none';
    if (btnNext) btnNext.disabled = true;
    const statusMsg = document.getElementById('status-msg');
    if (statusMsg) statusMsg.textContent = 'Complete all sections to enable D5 Auto-Checks →';
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
  if (notes) notes.classList.toggle('visible', val === 'partial' || val === 'no');
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
    if (typeof buildSidebar === 'function') buildSidebar();
    const btnNext = document.getElementById('btn-next');
    if (btnNext) btnNext.disabled = false;
    showToast('Gate review complete — stage approved ✅');
    const statusMsg = document.getElementById('status-msg');
    if (statusMsg) statusMsg.textContent = 'Gate approved. Proceed to next stage.';
  }
  updateToolbar(stage, sd);
}

function updateToolbar(stage, sd) {
  const btnAction = document.getElementById('btn-action');
  const btnNext = document.getElementById('btn-next');
  const statusMsg = document.getElementById('status-msg');
  const btnPrev = document.getElementById('btn-prev');
  if (btnPrev) btnPrev.disabled = currentStage <= 1;

  if (stage.isStage1PRD) {
    if (btnAction) btnAction.style.display = 'none';
    if (btnNext) btnNext.disabled = true;
    if (statusMsg) statusMsg.textContent = 'Complete all sections to enable D5 Auto-Checks →';
    return;
  }

  if (!sd.aiGenerated) {
    if (btnAction) {
      btnAction.style.display = 'inline-flex';
      btnAction.textContent = 'Generate AI Output →';
      btnAction.className = 'btn btn-primary';
      btnAction.disabled = false;
    }
    if (btnNext) btnNext.disabled = true;
    if (statusMsg) statusMsg.textContent = 'Fill in your inputs, then click Generate AI Output.';
  } else if (sd.aiQuestions && sd.aiQuestions.length > 0 && !stage.gateReviews) {
    if (btnAction) {
      btnAction.style.display = 'inline-flex';
      btnAction.textContent = '↻ Regenerate with Answers';
      btnAction.className = 'btn btn-primary';
      btnAction.disabled = false;
    }
    const unanswered = sd.aiQuestions.filter((q, i) => !sd.qaAnswers[i]).length;
    if (btnNext) btnNext.disabled = unanswered > 0;
    if (statusMsg) statusMsg.textContent = unanswered > 0 ? `${unanswered} question(s) still need answers.` : 'All answered — proceed or regenerate.';
  } else if (stage.gateReviews) {
    if (btnAction) {
      btnAction.style.display = 'inline-flex';
      btnAction.textContent = '↻ Regenerate AI Output';
      btnAction.className = 'btn';
    }
    const allAnswered = stage.gateReviews.every(r => sd.reviewAnswers[r.id]);
    const allPass = allAnswered && stage.gateReviews.every(r => ['yes','partial'].includes(sd.reviewAnswers[r.id]));
    if (btnNext) btnNext.disabled = !allPass;
    if (statusMsg) statusMsg.textContent = !allAnswered ? 'Complete the gate review checklist to proceed.'
      : !allPass ? 'One or more gate items failed — return to fix.'
      : 'Gate approved — proceed.';
  } else {
    if (btnAction) {
      btnAction.style.display = 'inline-flex';
      btnAction.textContent = '↻ Regenerate';
      btnAction.className = 'btn';
    }
    if (btnNext) btnNext.disabled = false;
    if (statusMsg) statusMsg.textContent = 'AI output generated. Proceed or regenerate.';
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
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Generating…'; }
  const statusMsg = document.getElementById('status-msg');
  if (statusMsg) statusMsg.textContent = 'AI is processing your inputs…';

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

    if (typeof addToHistory === 'function') addToHistory(stage, sd);
    saveToStorage();
    renderStage();
    showToast('AI output generated ✓');

  } catch (err) {
    console.error(err);
    stage.aiDeliverables.forEach(d => {
      const el = document.getElementById('ai-out-' + d.id);
      if (el) el.innerHTML = `<span style="color:var(--danger)">Error: ${escHtml(err.message)}. Check setup and retry.</span>`;
    });
    const statusMsg = document.getElementById('status-msg');
    if (statusMsg) statusMsg.textContent = 'Error: ' + err.message;
    if (btn) { btn.disabled = false; btn.textContent = 'Generate AI Output →'; }
  }
}