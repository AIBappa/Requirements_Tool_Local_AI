// ─── pipeline-session.js ───
// Session management — apiFetch, CRUD, session page rendering

let currentSessionId = null;

// ─── Server API helpers ───
async function apiFetch(path, options = {}) {
  const url = window.location.origin + path;
  const r = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!r.ok) {
    const errBody = await r.text().catch(() => '');
    throw new Error(`Server error ${r.status}: ${errBody || r.statusText}`);
  }
  return r.json();
}

// ─── Session management ───
async function loadSessions() {
  try {
    const sessions = await apiFetch('/api/sessions');
    renderSessions(sessions);
    return;
  } catch (e) {
    console.warn('Server unavailable, falling back to localStorage:', e.message);
  }
  const lastId = localStorage.getItem('pipeline-last-session');
  if (lastId) {
    renderSessionsFallback(lastId);
  } else {
    renderSessions([]);
  }
}

async function createNewSession() {
  const name = document.getElementById('new-session-name').value.trim();
  const desc = document.getElementById('new-session-desc').value.trim();
  if (!name) { showToast('Please enter a session name'); return; }

  try {
    const session = await apiFetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({ name, description: desc })
    });
    openSession(session.id);
    showToast('Session created ✓');
  } catch (e) {
    showToast('Failed to create session: ' + e.message);
  }
}

async function deleteSession(id, event) {
  if (event) event.stopPropagation();
  if (!confirm('Delete this session? This cannot be undone.')) return;
  try {
    await apiFetch('/api/sessions/' + id, { method: 'DELETE' });
    loadSessions();
    showToast('Session deleted');
  } catch (e) {
    showToast('Failed to delete: ' + e.message);
  }
}

async function renameSession(id, newName) {
  if (!newName.trim()) return;
  try {
    await apiFetch('/api/sessions/' + id, {
      method: 'PUT',
      body: JSON.stringify({ name: newName.trim() })
    });
    loadSessions();
  } catch (e) {
    showToast('Failed to rename: ' + e.message);
  }
}

async function loadSessionData(sessionId) {
  try {
    const data = await apiFetch('/api/sessions/' + sessionId);
    return data;
  } catch (e) {
    console.warn('Could not load session from server:', e.message);
    return null;
  }
}

async function saveSessionToServer() {
  if (!currentSessionId) return;
  try {
    const data = {
      currentStage: currentStage,
      stageData: stageData,
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
    const completed = PIPELINE.filter(s => stageData[s.id].completed).length;
    data.completed = completed;
    await apiFetch('/api/sessions/' + currentSessionId, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  } catch (e) {
    console.warn('Failed to save to server:', e.message);
  }
}

async function openSession(sessionId) {
  currentSessionId = sessionId;
  localStorage.setItem('pipeline-last-session', sessionId);
  const data = await loadSessionData(sessionId);
  if (data && data.stageData) {
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
  }
  document.getElementById('session-page').classList.add('hidden');
  document.getElementById('pipeline-view').classList.remove('hidden');
  if (typeof buildSidebar === 'function') buildSidebar();
  if (typeof renderStage === 'function') renderStage();
  if (typeof updateSetupIndicator === 'function') updateSetupIndicator();
}

function goToSessions() {
  if (typeof saveCurrentInputs === 'function') saveCurrentInputs();
  if (currentSessionId) saveSessionToServer();
  currentSessionId = null;
  document.getElementById('pipeline-view').classList.add('hidden');
  document.getElementById('session-page').classList.remove('hidden');
  loadSessions();
}

function renderSessions(sessions) {
  const list = document.getElementById('session-list');
  const empty = document.getElementById('session-empty');
  if (!list) return;
  list.innerHTML = '';
  if (sessions.length === 0) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');
  sessions.forEach(s => {
    const card = document.createElement('div');
    card.className = 'session-card';
    const isActive = s.updatedAt && (Date.now() - new Date(s.updatedAt).getTime()) < 3600000;
    card.innerHTML = `
      <div class="session-card-icon ${isActive ? 'active' : ''}">📁</div>
      <div class="session-card-info">
        <div class="session-card-name">${escHtml(s.name)}</div>
        ${s.description ? `<div class="session-card-desc">${escHtml(s.description)}</div>` : ''}
        <div class="session-card-meta">
          <span class="session-card-stage">Stage ${s.currentStage || 1}/${s.totalStages || 9}</span>
          <span>📅 ${s.updatedAt ? new Date(s.updatedAt).toLocaleString() : ''}</span>
          ${s.completed > 0 ? `<span>✅ ${s.completed}/${s.totalStages || 9} done</span>` : ''}
        </div>
      </div>
      <div class="session-card-actions">
        <button class="btn btn-primary" onclick="event.stopPropagation(); openSession('${s.id}')">Open</button>
        <button class="btn btn-danger" onclick="deleteSession('${s.id}', event)">🗑</button>
      </div>`;
    card.onclick = () => openSession(s.id);
    list.appendChild(card);
  });
}

function renderSessionsFallback(lastId) {
  const list = document.getElementById('session-list');
  const empty = document.getElementById('session-empty');
  if (!list) return;
  list.innerHTML = '';
  if (empty) empty.classList.add('hidden');
  const card = document.createElement('div');
  card.className = 'session-card';
  card.innerHTML = `
    <div class="session-card-icon active">📁</div>
    <div class="session-card-info">
      <div class="session-card-name">Last session</div>
      <div class="session-card-meta">Saved in browser storage</div>
    </div>
    <div class="session-card-actions">
      <button class="btn btn-primary" onclick="event.stopPropagation(); openSession('${lastId}')">Resume</button>
    </div>`;
  card.onclick = () => openSession(lastId);
  list.appendChild(card);
}