// ─── pipeline-api.js ───
// LLM API callers for all providers

function getAdvancedBody(provider) {
  const advMap = {
    local: 'localAdvanced', cloud: 'cloudAdvanced', openai: 'openaiAdvanced',
    gemini: 'geminiAdvanced', azure: 'azureAdvanced', groq: 'groqAdvanced',
    cerebras: 'cerebrasAdvanced', openrouter: 'openrouterAdvanced',
    nvidia: 'nvidiaAdvanced', siliconflow: 'siliconflowAdvanced'
  };
  const adv = CONFIG[advMap[provider]];
  if (!adv) return {};
  const body = {};
  if (adv.maxTokens) body.max_tokens = adv.maxTokens;
  if (adv.temperature) body.temperature = adv.temperature;
  if (adv.topP) body.top_p = adv.topP;
  if (adv.stream) body.stream = adv.stream;
  if (adv.reasoningEffort) body.reasoning_effort = adv.reasoningEffort;
  if (adv.topK !== undefined && adv.topK !== 0) body.top_k = adv.topK;
  return body;
}

async function callAnthropic(system, user) {
  const adv = getAdvancedBody('cloud');
  const body = {
    model: CONFIG.cloudModel,
    max_tokens: adv.max_tokens || 2000,
    system: system,
    messages: [{ role: 'user', content: user }]
  };
  if (adv.temperature) body.temperature = adv.temperature;
  if (adv.top_p) body.top_p = adv.top_p;
  if (adv.top_k) body.top_k = adv.top_k;
  if (adv.stream) body.stream = adv.stream;
  
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': CONFIG.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Anthropic API error');
  return data.content?.find(b => b.type === 'text')?.text || '';
}

async function callOpenAI(system, user) {
  const adv = getAdvancedBody('openai');
  const body = {
    model: CONFIG.openaiModel,
    max_tokens: adv.max_tokens || 2000,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  };
  if (adv.temperature) body.temperature = adv.temperature;
  if (adv.top_p) body.top_p = adv.top_p;
  if (adv.reasoning_effort) body.reasoning_effort = adv.reasoning_effort;
  if (adv.stream) body.stream = adv.stream;

  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + CONFIG.openaiKey
    },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'OpenAI API error');
  return data.choices?.[0]?.message?.content || '';
}

async function callGemini(system, user) {
  const adv = getAdvancedBody('gemini');
  const body = {
    contents: [{ parts: [{ text: system + '\n\n' + user }] }]
  };
  const generationConfig = {};
  if (adv.max_tokens) generationConfig.maxOutputTokens = adv.max_tokens;
  if (adv.temperature) generationConfig.temperature = adv.temperature;
  if (adv.top_p) generationConfig.topP = adv.top_p;
  if (adv.top_k) generationConfig.topK = adv.top_k;
  if (Object.keys(generationConfig).length > 0) body.generationConfig = generationConfig;

  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.geminiModel}:generateContent?key=${CONFIG.geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Gemini API error');
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callAzure(system, user) {
  const adv = getAdvancedBody('azure');
  const body = {
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ],
    max_tokens: adv.max_tokens || 2000
  };
  if (adv.temperature) body.temperature = adv.temperature;
  if (adv.top_p) body.top_p = adv.top_p;
  if (adv.reasoning_effort) body.reasoning_effort = adv.reasoning_effort;
  if (adv.stream) body.stream = adv.stream;

  const r = await fetch(`${CONFIG.azureEndpoint}/openai/deployments/${CONFIG.azureDeployment}/chat/completions?api-version=2024-02-01`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': CONFIG.azureKey
    },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Azure API error');
  return data.choices?.[0]?.message?.content || '';
}

async function callOllama(system, user, model) {
  const adv = getAdvancedBody('local');
  const body = {
    model: model,
    stream: adv.stream || false,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  };
  // Ollama uses 'options' sub-object for advanced params
  const options = {};
  if (adv.temperature) options.temperature = adv.temperature;
  if (adv.top_p) options.top_p = adv.top_p;
  if (adv.max_tokens) options.num_predict = adv.max_tokens;
  if (Object.keys(options).length > 0) body.options = options;

  const isServerMode = window.location.protocol !== 'file:';
  const url = isServerMode
    ? '/api/ollama/chat'
    : CONFIG.ollamaUrl + '/api/chat';
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Ollama error');
  return data.message?.content || '';
}

async function callGroq(system, user) {
  const adv = getAdvancedBody('groq');
  const body = {
    model: CONFIG.groqModel,
    max_tokens: adv.max_tokens || 2000,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  };
  if (adv.temperature) body.temperature = adv.temperature;
  if (adv.top_p) body.top_p = adv.top_p;
  if (adv.reasoning_effort) body.reasoning_effort = adv.reasoning_effort;
  if (adv.stream) body.stream = adv.stream;

  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.groqKey },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Groq API error');
  return data.choices?.[0]?.message?.content || '';
}

async function callCerebras(system, user) {
  const adv = getAdvancedBody('cerebras');
  const body = {
    model: CONFIG.cerebrasModel,
    max_tokens: adv.max_tokens || 2000,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  };
  if (adv.temperature) body.temperature = adv.temperature;
  if (adv.top_p) body.top_p = adv.top_p;
  if (adv.reasoning_effort) body.reasoning_effort = adv.reasoning_effort;
  if (adv.stream) body.stream = adv.stream;

  const r = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.cerebrasKey },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'Cerebras API error');
  return data.choices?.[0]?.message?.content || '';
}

async function callOpenRouter(system, user) {
  const adv = getAdvancedBody('openrouter');
  const body = {
    model: CONFIG.openrouterModel,
    max_tokens: adv.max_tokens || 2000,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  };
  if (adv.temperature) body.temperature = adv.temperature;
  if (adv.top_p) body.top_p = adv.top_p;
  if (adv.reasoning_effort) body.reasoning_effort = adv.reasoning_effort;
  if (adv.stream) body.stream = adv.stream;

  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.openrouterKey },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'OpenRouter API error');
  return data.choices?.[0]?.message?.content || '';
}

async function callNvidia(system, user) {
  const adv = getAdvancedBody('nvidia');
  const body = {
    model: CONFIG.nvidiaModel,
    max_tokens: adv.max_tokens || 2000,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  };
  if (adv.temperature) body.temperature = adv.temperature;
  if (adv.top_p) body.top_p = adv.top_p;
  if (adv.reasoning_effort) body.reasoning_effort = adv.reasoning_effort;
  if (adv.stream) body.stream = adv.stream;

  const isServerMode = window.location.protocol !== 'file:';
  const url = isServerMode ? '/api/nvidia' : 'https://integrate.api.nvidia.com/v1/chat/completions';
  // In server mode, send API key as a special field the proxy extracts
  if (isServerMode) {
    body._apiKey = CONFIG.nvidiaKey;
  }
  const headers = { 'Content-Type': 'application/json' };
  if (!isServerMode) {
    headers['Authorization'] = 'Bearer ' + CONFIG.nvidiaKey;
  }
  const r = await fetch(url, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'NVIDIA NIM API error');
  return data.choices?.[0]?.message?.content || '';
}

async function callSiliconflow(system, user) {
  const adv = getAdvancedBody('siliconflow');
  const body = {
    model: CONFIG.siliconflowModel,
    max_tokens: adv.max_tokens || 2000,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user }
    ]
  };
  if (adv.temperature) body.temperature = adv.temperature;
  if (adv.top_p) body.top_p = adv.top_p;
  if (adv.reasoning_effort) body.reasoning_effort = adv.reasoning_effort;
  if (adv.stream) body.stream = adv.stream;

  const r = await fetch('https://api.siliconflow.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CONFIG.siliconflowKey },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error?.message || 'SiliconFlow API error');
  return data.choices?.[0]?.message?.content || '';
}