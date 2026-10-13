const database = require('../database');
const licenseServer = require('./licenseServer');
const { generateId } = require('../config/neocareAi');

const USE_CASES = {
  lesson: 'lesson',
  neoschool: 'lesson',
  app_builder: 'lesson',
  sponsor: 'sponsor',
  neocard: 'card'
};

class UltraAiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'UltraAiError';
    this.status = status;
    this.code = code;
  }
}

function providerSettings() {
  const url = process.env.AI_PROVIDER_URL || '';
  const placeholder = !url || url.includes('api.ai-provider.com');
  return {
    mode: process.env.AI_MODE || 'mock',
    apiKey: process.env.AI_PROVIDER_API_KEY || '',
    url,
    placeholder
  };
}

function useCaseFor(moduleName) {
  const key = String(moduleName || '').trim().toLowerCase();
  return USE_CASES[key] || key || 'general';
}

class UltraAi {
  async complete(input, auth) {
    const tenantId = String(input.tenant_id || '').trim();
    const userId = String(input.user_id || '').trim();
    const role = String(input.role || '').trim();
    const moduleName = String(input.module || '').trim();
    if (!tenantId || !userId || !role || !moduleName) {
      throw new UltraAiError(400, 'tenant_id, user_id, role, and module are required.', 'MISSING_FIELD');
    }

    await licenseServer.validate({
      tenant_id: tenantId,
      user_id: userId,
      action: 'check'
    }, auth);

    const useCase = useCaseFor(moduleName);
    const settings = providerSettings();
    const id = generateId('aiu');
    const createdAt = new Date().toISOString();

    if (settings.mode === 'live') {
      const failure = !settings.apiKey || settings.placeholder
        ? 'No AI provider is configured.'
        : null;
      let providerError = failure;
      let providerText = null;
      if (!providerError) {
        try {
          const response = await fetch(settings.url, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${settings.apiKey}`
            },
            body: JSON.stringify({
              tenant_id: tenantId,
              user_id: userId,
              role,
              module: moduleName,
              use_case: useCase,
              prompt: input.prompt || ''
            }),
            signal: AbortSignal.timeout(8000)
          });
          if (!response.ok) providerError = `Provider returned ${response.status}.`;
          else providerText = await response.text();
        } catch (error) {
          providerError = 'Provider call failed.';
        }
      }
      if (providerError) {
        await database.insertAiUsageLog({
          id,
          tenant_id: tenantId,
          user_id: userId,
          role,
          module: moduleName,
          use_case: useCase,
          provider_status: 'FAILED',
          result: null,
          cost: null,
          error: providerError,
          created_at: createdAt
        });
        throw new UltraAiError(502, providerError, 'PROVIDER_UNAVAILABLE');
      }
      await database.insertAiUsageLog({
        id,
        tenant_id: tenantId,
        user_id: userId,
        role,
        module: moduleName,
        use_case: useCase,
        provider_status: 'SUCCESS',
        result: providerText,
        cost: null,
        error: null,
        created_at: createdAt
      });
      return {
        id,
        tenant_id: tenantId,
        user_id: userId,
        role,
        module: moduleName,
        use_case: useCase,
        source: 'provider',
        result: providerText,
        cost: null
      };
    }

    const result = input.prompt
      ? `Draft response for ${useCase}: ${input.prompt}`
      : `Draft response for ${useCase}.`;
    await database.insertAiUsageLog({
      id,
      tenant_id: tenantId,
      user_id: userId,
      role,
      module: moduleName,
      use_case: useCase,
      provider_status: 'MOCK',
      result,
      cost: 0,
      error: null,
      created_at: createdAt
    });
    return {
      id,
      tenant_id: tenantId,
      user_id: userId,
      role,
      module: moduleName,
      use_case: useCase,
      source: 'mock',
      result,
      cost: 0
    };
  }
}

module.exports = new UltraAi();
module.exports.UltraAiError = UltraAiError;
