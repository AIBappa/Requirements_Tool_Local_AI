// ─── pipeline-api.js ───
// LLM API callers for all providers

async function callAnthropic(system, user) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CONFIG.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: CONFIG.cloudModel,
      max_tokens: 2000,
      system: system,
      messages: [{ role: 'user', content: user }]
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Anthropic API error');
  return data.content?.find(b => b.type === 'text')?.text || '';
}

async function callOpenAI(system, user) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + CONFIG.openaiKey
    },
    body: JSON.stringify({
      model: CONFIG.openaiModel,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'OpenAI API error');
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(system, user) {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.geminiModel}:generateContent?key=${CONFIG.geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: system + '\n\n' + user }] }]
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Gemini API error');
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callAzure(system, user) {
  const r = await fetch(`${CONFIG.azureEndpoint}/openai/deployments/${CONFIG.azureDeployment}/chat/completions?api-version=2024-02-01`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': CONFIG.azureKey
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      max_tokens: 2000
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Azure API error');
  return data.choices?.[0]?.message?.content || '';
}

async function callOllama(system, user, model) {
  const isServerMode = window.location.protocol !== 'file:';
  const url = isServerMode
    ? '/api/ollama/chat'
    : CONFIG.ollamaUrl + '/api/chat';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Ollama error');
  return data.message?.content || '';
}

async function callGroq(system, user) {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.groqKey },
    body: JSON.stringify({ model: CONFIG.groqModel, max_tokens: 2000, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Groq API error');
  return data.choices?.[0]?.message?.content || '';
}

async function callCerebras(system, user) {
  const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.cerebrasKey },
    body: JSON.stringify({ model: CONFIG.cerebrasModel, max_tokens: 2000, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Cerebras API error');
  return data.choices?.[0]?.message?.content || '';
}

async function callOpenRouter(system, user) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.openrouterKey },
    body: JSON.stringify({ model: CONFIG.openrouterModel, max_tokens: 2000, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] })
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'OpenRouter API error');
  return data.choices?.[0]?.message?.content || '';
}