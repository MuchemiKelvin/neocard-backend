const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

function apiKey() {
  return process.env.GEMINI_API_KEY || process.env.AI_PROVIDER_API_KEY || '';
}

function estimateEur(inputTokens, outputTokens) {
  const inputRate = Number(process.env.GEMINI_INPUT_USD_PER_MILLION || 0.75);
  const outputRate = Number(process.env.GEMINI_OUTPUT_USD_PER_MILLION || 3.75);
  const usdToEur = Number(process.env.USD_TO_EUR || 0.92);
  const usd = (inputTokens / 1000000) * inputRate + (outputTokens / 1000000) * outputRate;
  return Math.round(usd * usdToEur * 1000000) / 1000000;
}

function providerError(message) {
  const error = new Error(message);
  error.status = 502;
  error.code = 'PROVIDER_UNAVAILABLE';
  return error;
}

async function generate(prompt) {
  const key = apiKey();
  if (!key) throw providerError('No AI provider is configured.');
  if (key === 'test-key') {
    return {
      text: `Gemini draft: ${prompt || ''}`.trim(),
      inputTokens: 12,
      outputTokens: 20
    };
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': key
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt || '' }] }]
      }),
      signal: AbortSignal.timeout(20000)
    }
  );
  if (!response.ok) throw providerError(`Provider returned ${response.status}.`);
  const payload = await response.json();
  const parts = payload.candidates?.[0]?.content?.parts || [];
  const text = parts.map((part) => part.text).filter(Boolean).join('\n');
  const usage = payload.usageMetadata || {};
  return {
    text,
    inputTokens: usage.promptTokenCount || 0,
    outputTokens: (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0)
  };
}

module.exports = { generate, estimateEur };
