// Catalistics AI — Firebase Cloud Function.
// The browser calls `askCatalistics` with a question. This function:
//   1. checks the caller is signed in as an active admin or manager,
//   2. checks the AI is switched on and the daily / monthly limits,
//   3. lets Claude call the data tools in tools.js until it has an answer,
//   4. logs the question, tokens and estimated cost to the `aiUsage` collection.
// The Claude API key is stored as a Firebase secret, never in the web pages.

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const Anthropic = require('@anthropic-ai/sdk');
const { buildTools, systemPrompt } = require('./tools');

initializeApp();
const db = getFirestore();
const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

// Must match functionsRegion in assets/firebase-config.js
const REGION = 'europe-west2';

const AI_DEFAULTS = {
  enabled: true, assistantName: 'Catalistics AI', model: 'claude-sonnet-5-5', maxAnswerTokens: 2000, maxToolRounds: 8,
  inputPricePerMillion: 2, outputPricePerMillion: 10, priceCurrency: '$', dailyQuestionsPerUser: 50, monthlyBudget: 50,
};

function todayIn(tz) {
  try { return new Intl.DateTimeFormat('en-CA', { timeZone: tz || 'Europe/London' }).format(new Date()); }
  catch (e) { return new Date().toISOString().slice(0, 10); }
}

exports.askCatalistics = onCall({ region: REGION, secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 120, memory: '512MiB', maxInstances: 5 }, async (req) => {
  const started = Date.now();
  if (!req.auth) throw new HttpsError('unauthenticated', 'Please sign in.');
  const uid = req.auth.uid;

  const [userSnap, cfgSnap] = await Promise.all([db.doc(`users/${uid}`).get(), db.doc('settings/config').get()]);
  const user = userSnap.data();
  if (!user || user.active === false || !['admin', 'manager'].includes(user.role)) throw new HttpsError('permission-denied', 'Your account does not have access to Catalistics AI.');
  if (!cfgSnap.exists) throw new HttpsError('failed-precondition', 'Settings have not been saved yet. Open Targets & KPIs and press Save.');
  const cfg = cfgSnap.data();
  const ai = { ...AI_DEFAULTS, ...(cfg.ai || {}) };
  if (!ai.enabled) throw new HttpsError('failed-precondition', 'Catalistics AI is switched off on Targets & KPIs.');

  const question = String(req.data?.question || '').trim();
  if (!question) throw new HttpsError('invalid-argument', 'Ask a question.');
  if (question.length > 2000) throw new HttpsError('invalid-argument', 'Please keep questions under 2,000 characters.');

  const today = todayIn(cfg.company?.timeZone);
  const month = today.slice(0, 7);

  // Limits: questions per person per day, and spend per month.
  const mine = await db.collection('aiUsage').where('uid', '==', uid).where('date', '==', today).get();
  if (ai.dailyQuestionsPerUser && mine.size >= ai.dailyQuestionsPerUser) throw new HttpsError('resource-exhausted', `You have reached today's limit of ${ai.dailyQuestionsPerUser} questions.`);
  if (ai.monthlyBudget) {
    const monthSnap = await db.collection('aiUsage').where('month', '==', month).get();
    const spent = monthSnap.docs.reduce((t, d) => t + (Number(d.data().cost) || 0), 0);
    if (spent >= ai.monthlyBudget) throw new HttpsError('resource-exhausted', `This month's AI budget (${ai.priceCurrency}${ai.monthlyBudget}) has been used. An admin can raise it on Targets & KPIs.`);
  }

  // Earlier turns of this conversation (text only), newest last.
  const history = (Array.isArray(req.data?.history) ? req.data.history : []).slice(-10)
    .filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.text === 'string' && m.text.trim())
    .map(m => ({ role: m.role, content: m.text.slice(0, 6000) }));
  while (history.length && history[0].role !== 'user') history.shift();
  const messages = [...history, { role: 'user', content: question }];
  // The API needs user/assistant turns to alternate.
  for (let i = messages.length - 1; i > 0; i--) if (messages[i].role === messages[i - 1].role) messages.splice(i - 1, 1);

  const tools = buildTools(db, cfg, today);
  const byName = Object.fromEntries(tools.map(t => [t.name, t]));
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });
  const system = systemPrompt(cfg, today, ai.assistantName);
  const usage = { input: 0, output: 0 };
  const toolsUsed = [];
  let answer = '';

  try {
    for (let round = 0; round <= ai.maxToolRounds; round++) {
      const lastRound = round === ai.maxToolRounds;
      const res = await client.messages.create({
        model: ai.model, max_tokens: ai.maxAnswerTokens, system,
        tools: tools.map(({ name, description, input_schema }) => ({ name, description, input_schema })),
        ...(lastRound ? { tool_choice: { type: 'none' } } : {}),
        messages,
      });
      usage.input += res.usage?.input_tokens || 0;
      usage.output += res.usage?.output_tokens || 0;
      const calls = res.content.filter(b => b.type === 'tool_use');
      if (res.stop_reason !== 'tool_use' || !calls.length) {
        answer = res.content.filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
        break;
      }
      messages.push({ role: 'assistant', content: res.content });
      const results = [];
      for (const call of calls) {
        toolsUsed.push(call.name);
        let out;
        try { out = byName[call.name] ? await byName[call.name].run(call.input || {}) : { error: 'Unknown tool' }; }
        catch (e) { out = { error: e.message }; }
        results.push({ type: 'tool_result', tool_use_id: call.id, content: JSON.stringify(out).slice(0, 60000), ...(out?.error ? { is_error: true } : {}) });
      }
      messages.push({ role: 'user', content: results });
    }
  } catch (e) {
    console.error('Claude API error', e);
    const status = e?.status;
    if (status === 401) throw new HttpsError('failed-precondition', 'The Claude API key is missing or wrong. An admin needs to set it (see README).');
    if (status === 404) throw new HttpsError('failed-precondition', `The AI model "${ai.model}" was not found. Check the model name on Targets & KPIs.`);
    if (status === 429 || status === 529) throw new HttpsError('unavailable', 'The AI service is busy. Please try again in a minute.');
    throw new HttpsError('internal', 'The AI service could not answer just now. Please try again.');
  }
  if (!answer) answer = 'Sorry — I could not put an answer together for that. Try asking it a different way.';

  const cost = (usage.input * ai.inputPricePerMillion + usage.output * ai.outputPricePerMillion) / 1e6;
  await db.collection('aiUsage').add({
    date: today, month, uid, email: user.email || req.auth.token.email || '', name: user.name || '',
    question, answerPreview: answer.slice(0, 500), model: ai.model, inputTokens: usage.input, outputTokens: usage.output,
    cost: Math.round(cost * 10000) / 10000, toolsUsed, ms: Date.now() - started, createdAt: FieldValue.serverTimestamp(),
  });
  return { answer, toolsUsed, usage: { inputTokens: usage.input, outputTokens: usage.output, cost: Math.round(cost * 10000) / 10000 } };
});
