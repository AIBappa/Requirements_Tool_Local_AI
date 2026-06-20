// ─── pipeline-sidebar.js ───
// Sidebar rendering and stage navigation

function buildSidebar() {
  const list = document.getElementById('stage-list');
  if (!list) return;
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
  const sfBar = document.getElementById('sf-progress-bar');
  if (sfBar) sfBar.style.width = pct + '%';
  const sfText = document.getElementById('sf-progress-text');
  if (sfText) sfText.textContent = `Progress: ${done} of ${PIPELINE.length} stages done`;
  const progBar = document.getElementById('progress-bar');
  if (progBar) progBar.style.width = pct + '%';
  saveToStorage();
}

function goStage(n) {
  if (n < 1 || n > PIPELINE.length) return;
  const sd = stageData[currentStage];
  if (sd && sd.inputs) {
    const hasInputs = Object.values(sd.inputs).some(v => v && v.toString().trim());
    if (hasInputs) {
      const stage = PIPELINE[currentStage - 1];
      showToast('⚠️ Stage ' + stage.id + ' has unsaved inputs. Click "Save JSON" before leaving if you want to keep them.');
    }
  }
  if (typeof saveCurrentInputs === 'function') saveCurrentInputs();
  currentStage = n;
  buildSidebar();
  if (typeof renderStage === 'function') renderStage();
}
