// ─── pipeline-stage1.js ───
// Stage 1 PRD — accordion sections, event handlers, D5/D4 generation, JSON save

// ─── Stage 1 PRD State helpers ───

/** Get dynamic function instances based on count */
function getFunctionInstances() {
  const sd = stageData[1];
  if (!sd) return { count: 0, names: [], summaries: [], scoping: [] };
  const count = parseInt(sd.functionCount) || 0;
  if (count < 1 || count > 10) return { count: 0, names: [], summaries: [], scoping: [] };
  const names = sd.functionNames || [];
  const summaries = sd.functionSummaries || [];
  const scoping = sd.functionScoping || [];
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

// ─── Stage 1 Input Saving ───

function saveStage1Inputs() {
  const stage = PIPELINE[currentStage - 1];
  const sd = stageData[currentStage];
  if (!stage.isStage1PRD || !sd) return;

  // Save all input fields
  document.querySelectorAll('[data-stage1-id]').forEach(el => {
    const id = el.dataset.stage1Id;
    if (el.type === 'checkbox') {
      if (el.dataset.stage1Type === 'yesno') {
        // handled via click handlers
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
      if (el.checked) sd.inputs[id] = el.value;
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
}

// ─── Main Stage 1 Renderer ───

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
  const isOpen = section.id === 'section_basics';
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

  // Statement type
  if (item.type === 'statement') {
    container.className = 's1-statement';
    container.innerHTML = `<div class="s1-statement-icon">📌</div><div>${escHtml(item.desc)}</div>`;
    return container;
  }

  // Manual text input
  if (item.type === 'manual') {
    container.className = 's1-item';
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
      renderStage(); // Re-render (data stays in memory until Save JSON)
    };
    itemsContainer.appendChild(addBtn);
  });
}

/** Render D5 section */
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

/** Render D4 section */
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
  while (sd.functionNames.length < count) sd.functionNames.push('');
  while (sd.functionSummaries.length < count) sd.functionSummaries.push('');
  while (sd.functionScoping.length < count) sd.functionScoping.push([]);

  const tag = getManualTag('D1.4.1');
  logTag('section_functions', 'D1.4.1', tag, String(count), 'Function count set to ' + count);
  updateTagBadge('D1.4.1', 'section_functions', String(count));

  const container = document.getElementById('s1-func-instances');
  if (!container) return;
  renderFunctionInstances(count, container);
}

function renderFunctionInstances(count, container) {
  const sd = stageData[1];
  let html = '';

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
}

function onFunctionScopingChange(idx, option, checked) {
  const sd = stageData[1];
  if (!sd.functionScoping[idx]) sd.functionScoping[idx] = [];
  if (checked && !sd.functionScoping[idx].includes(option)) {
    sd.functionScoping[idx].push(option);
  } else if (!checked) {
    sd.functionScoping[idx] = sd.functionScoping[idx].filter(v => v !== option);
  }
}

function onStage1InputChange(id, val) {
  const sd = stageData[1];
  sd.inputs[id] = val;
  const tag = getManualTag(id);
  logTag('', id, tag, val, 'Manual input');
  updateTagBadge(id, '', val);
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
  // Hide tag badge for yes/no items — they don't need a manual/auto label
  const badge = document.getElementById('tag-' + id);
  if (badge) { badge.textContent = ''; badge.style.display = 'none'; }

  const followContainer = document.getElementById('followups-' + id);
  if (followContainer) followContainer.remove();

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
      const textarea = div.querySelector('textarea');
      if (textarea) {
        textarea.addEventListener('change', function() { sd.inputs[fu.id] = this.value; });
      }
    });
    el.closest('.s1-item').appendChild(container);
  }
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
}

function updateTagBadge(itemId, sectionId, val) {
  const el = document.getElementById('tag-' + itemId);
  if (!el) return;
  if (val && val.toString().trim()) {
    const tag = getManualTag(itemId);
    el.textContent = TAG_LABELS[tag] || tag;
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
    json.externalLinkages.bffProducts.push(sd.inputs['D3.3.' + 'bff_' + i] || '');
  }
  for (let i = 1; i <= (extCounts.perm || 0); i++) {
    json.externalLinkages.databaseProducts.push(sd.inputs['D3.4.' + 'perm_' + i] || '');
  }
  for (let i = 1; i <= (extCounts.imm || 0); i++) {
    json.externalLinkages.inMemoryProducts.push(sd.inputs['D3.5.' + 'imm_' + i] || '');
  }

  if (sd.inputs['D1.2.3.1'] === 'yes') json.userTypes.readOnlyDescription = sd.inputs['D1.2.3.1a'] || '';
  if (sd.inputs['D1.2.3.2'] === 'yes') json.userTypes.writeOnlyDescription = sd.inputs['D1.2.3.2a'] || '';
  if (sd.inputs['D1.2.3.3'] === 'yes') json.userTypes.premiumFeatures = sd.inputs['D1.2.3.3a'] || '';

  if (sd.d5Results) json.d5Results = sd.d5Results;
  if (sd.d4ContextDiagram) json.d4ContextDiagram = sd.d4ContextDiagram;

  return json;
}

// ─── D5 Auto-Checks ───

async function runD5Checks() {
  const sd = stageData[1];
  const btn = document.getElementById('btn-d5-run');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '⏳ Running D5 Checks…';

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
      case 'cloud': raw = await callAnthropic(systemPrompt, userPrompt); break;
      case 'openai': raw = await callOpenAI(systemPrompt, userPrompt); break;
      case 'gemini': raw = await callGemini(systemPrompt, userPrompt); break;
      case 'azure': raw = await callAzure(systemPrompt, userPrompt); break;
      case 'groq': raw = await callGroq(systemPrompt, userPrompt); break;
      case 'cerebras': raw = await callCerebras(systemPrompt, userPrompt); break;
      case 'openrouter': raw = await callOpenRouter(systemPrompt, userPrompt); break;
      case 'nvidia': raw = await callNvidia(systemPrompt, userPrompt); break;
      case 'siliconflow': raw = await callSiliconflow(systemPrompt, userPrompt); break;
      default: raw = await callOllama(systemPrompt, userPrompt, models[0]);
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
      case 'nvidia': raw = await callNvidia(systemPrompt, userPrompt); break;
      case 'siliconflow': raw = await callSiliconflow(systemPrompt, userPrompt); break;
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