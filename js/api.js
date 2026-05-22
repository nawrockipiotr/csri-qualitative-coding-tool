// ─── Qualitative Coding Tool v0.1 — API Layer ───
// Reuses architecture from CSRI Transcript Analysis Tool

function formatApiError(status, serverMsg, provider) {
  const providerLinks = {
    Anthropic: 'console.anthropic.com',
    OpenAI: 'platform.openai.com',
    Google: 'aistudio.google.com',
    Local: ''
  };
  const link = providerLinks[provider] || '';

  switch (status) {
    case 401:
    case 403:
      return `Invalid API key — check your ${provider} key` + (link ? ` at ${link}` : '') + '.';
    case 429:
      return `Rate limit exceeded — wait 60 seconds. ${serverMsg || ''}`.trim();
    case 404:
      return `Model not found — check the model name` + (provider === 'Local' ? ' (run "ollama list")' : '') + '.';
    case 500: case 502: case 503:
      return `${provider} server error (${status}) — try again in a few minutes. ${serverMsg || ''}`.trim();
    case 0:
      return provider === 'Local'
        ? `Cannot reach local server — is it running? Check the endpoint URL.`
        : `Network error — check your internet connection.`;
    default:
      return serverMsg || `${provider} API error ${status}`;
  }
}

const API_TIMEOUT_MS = 60000; // 60 seconds per call

async function callAIWithRetry(apiKey, systemPrompt, userContent, maxRetries = 3, options = {}) {
  let lastError;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await callAI(apiKey, systemPrompt, userContent, options);
    } catch (err) {
      lastError = err;
      if (err.name === 'AbortError') throw err;
      const msg = err.message || '';
      if (msg.includes('401') || msg.includes('403') || msg.includes('invalid')) throw err;
      if (attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
        await new Promise(r => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

function withTimeout(signal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), API_TIMEOUT_MS);
  if (signal) signal.addEventListener('abort', () => ctrl.abort());
  const cleanup = () => clearTimeout(timer);
  return { signal: ctrl.signal, cleanup };
}

async function callAI(apiKey, systemPrompt, userContent, options = {}) {
  if (currentProvider === 'anthropic') return callAnthropic(apiKey, systemPrompt, userContent, options);
  if (currentProvider === 'openai') return callOpenAI(apiKey, systemPrompt, userContent, options);
  if (currentProvider === 'google') return callGoogle(apiKey, systemPrompt, userContent, options);
  if (currentProvider === 'local') return callLocal(apiKey, systemPrompt, userContent, options);
}

async function callAnthropic(apiKey, systemPrompt, userContent, options = {}) {
  const body = {
    model: getModel(),
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userContent }]
  };
  if (options.temperature !== undefined) body.temperature = options.temperature;
  const { signal, cleanup } = withTimeout(abortController?.signal);
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(formatApiError(resp.status, err.error?.message, 'Anthropic'));
    }
    const data = await resp.json();
    return data.content.map(c => c.text || '').join('');
  } finally { cleanup(); }
}

async function callOpenAI(apiKey, systemPrompt, userContent, options = {}) {
  const body = {
    model: getModel(),
    max_tokens: 4096,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ]
  };
  if (options.temperature !== undefined) body.temperature = options.temperature;
  const { signal, cleanup } = withTimeout(abortController?.signal);
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(formatApiError(resp.status, err.error?.message, 'OpenAI'));
    }
    const data = await resp.json();
    return data.choices[0]?.message?.content || '';
  } finally { cleanup(); }
}

async function callGoogle(apiKey, systemPrompt, userContent, options = {}) {
  const genConfig = { maxOutputTokens: 4096 };
  if (options.temperature !== undefined) genConfig.temperature = options.temperature;
  const { signal, cleanup } = withTimeout(abortController?.signal);
  try {
    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${getModel()}:generateContent?key=${apiKey}`, {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: userContent }] }],
        generationConfig: genConfig
      })
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(formatApiError(resp.status, err.error?.message, 'Google'));
    }
    const data = await resp.json();
    return data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  } finally { cleanup(); }
}

async function callLocal(apiKey, systemPrompt, userContent, options = {}) {
  const endpoint = document.getElementById('localEndpoint')?.value?.trim() || 'http://localhost:11434/v1';
  const url = endpoint.replace(/\/+$/, '') + '/chat/completions';
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const body = {
    model: getModel(),
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ]
  };
  if (options.temperature !== undefined) body.temperature = options.temperature;

  const { signal, cleanup } = withTimeout(abortController?.signal);
  try {
    const resp = await fetch(url, {
      method: 'POST',
      signal,
      headers,
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(formatApiError(resp.status, err.error?.message, 'Local'));
    }
    const data = await resp.json();
    return data.choices[0]?.message?.content || '';
  } catch (fetchErr) {
    if (fetchErr.name === 'AbortError') throw fetchErr;
    throw new Error(formatApiError(0, fetchErr.message, 'Local'));
  } finally { cleanup(); }
}
