const database = require('../database');
const licenseServer = require('./licenseServer');
const gemini = require('./gemini');
const { generateId } = require('../config/neocareAi');

const USE_CASES = {
  lesson: 'lesson',
  neoschool: 'lesson',
  app_builder: 'lesson',
  homework: 'homework',
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
  return { mode: process.env.AI_MODE || 'mock' };
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
      try {
        const generated = await gemini.generate(input.prompt);
        const cost = gemini.estimateEur(generated.inputTokens, generated.outputTokens);
        await database.insertAiUsageLog({
          id,
          tenant_id: tenantId,
          user_id: userId,
          role,
          module: moduleName,
          use_case: useCase,
          provider_status: 'SUCCESS',
          result: generated.text,
          cost,
          input_tokens: generated.inputTokens,
          output_tokens: generated.outputTokens,
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
          source: 'gemini',
          result: generated.text,
          cost,
          input_tokens: generated.inputTokens,
          output_tokens: generated.outputTokens
        };
      } catch (error) {
        const message = error.code === 'PROVIDER_UNAVAILABLE'
          ? error.message
          : 'Provider call failed.';
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
          input_tokens: null,
          output_tokens: null,
          error: message,
          created_at: createdAt
        });
        throw new UltraAiError(502, message, 'PROVIDER_UNAVAILABLE');
      }
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
      input_tokens: 0,
      output_tokens: 0,
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
