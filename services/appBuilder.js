const database = require('../database');
const licenseServer = require('./licenseServer');
const ultraAi = require('./ultraAi');
const { generateId } = require('../config/neocareAi');

class AppBuilderError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'AppBuilderError';
    this.status = status;
    this.code = code;
  }
}

function draftLesson(input, source, content) {
  const grade = String(input.grade || '2');
  const topic = String(input.topic || 'Addition');
  const subject = String(input.subject || 'Mathematics');
  return {
    grade,
    subject,
    topic,
    objectives: [`Practice ${topic} at grade ${grade}.`],
    steps: [
      `Show an example of ${topic}.`,
      'Ask the learner to try one item.',
      'Check the answer with the learner.'
    ],
    content: content || null,
    source
  };
}

function present(row) {
  return {
    lesson_id: row.lesson_id,
    tenant_id: row.tenant_id,
    user_id: row.user_id,
    role: row.role,
    status: row.status,
    source: row.source,
    lesson: JSON.parse(row.lesson_json),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

class AppBuilder {
  async createLesson(input, auth) {
    const completion = await ultraAi.complete({
      tenant_id: input.tenant_id,
      user_id: input.user_id,
      role: input.role,
      module: 'app_builder',
      prompt: `${input.subject || 'Mathematics'} grade ${input.grade || '2'} ${input.topic || 'Addition'}`
    }, auth);
    const now = new Date().toISOString();
    const lesson = {
      lesson_id: generateId('les'),
      tenant_id: completion.tenant_id,
      user_id: completion.user_id,
      role: completion.role,
      status: 'DRAFT',
      lesson_json: JSON.stringify(draftLesson(input, completion.source, completion.result)),
      source: completion.source,
      created_at: now,
      updated_at: now
    };
    await database.insertAppLesson(lesson);
    return present(lesson);
  }

  async getLesson(lessonId, auth) {
    const row = await database.getAppLesson(lessonId);
    if (!row) throw new AppBuilderError(404, 'Lesson not found.', 'LESSON_NOT_FOUND');
    await licenseServer.validate({ tenant_id: row.tenant_id, user_id: row.user_id, action: 'check' }, auth);
    return present(row);
  }

  async setStatus(lessonId, status, auth) {
    const row = await database.getAppLesson(lessonId);
    if (!row) throw new AppBuilderError(404, 'Lesson not found.', 'LESSON_NOT_FOUND');
    await licenseServer.validate({ tenant_id: row.tenant_id, user_id: row.user_id, action: 'check' }, auth);
    const updatedAt = new Date().toISOString();
    await database.setAppLessonStatus(lessonId, status, updatedAt);
    return present({ ...row, status, updated_at: updatedAt });
  }
}

module.exports = new AppBuilder();
module.exports.AppBuilderError = AppBuilderError;
