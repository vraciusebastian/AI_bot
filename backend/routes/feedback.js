const { Router }   = require('express');
const { ObjectId } = require('mongodb');
const { getDb }    = require('../db');

const router = Router();

function buildFeedbackPrompt(prompt, modelA, modelB, interactionNumber) {
  return `Evaluate two AI responses to a code debugging prompt. Interaction #${interactionNumber}.

User prompt:
${prompt}

--- MODEL A RESPONSE ---
${modelA}

--- MODEL B RESPONSE ---
${modelB}

Give feedback in this exact JSON format. Follow all rules strictly.

{
  "preferred": "A" or "B",
  "justification": "1-2 short sentences. Plain English. No AI words like certainly, comprehensive, robust. Why you picked this one.",
  "modelA": {
    "pros": "Short list of what worked. Plain words. No bullet symbols needed.",
    "cons": "Behavioral codes only, comma-separated. Format: CODE or CODE:filename.ext:line. Codes: STOP LAZY INST SCOPE TOOL VERIFY FALSE ROOT DESTRUCT FILE CONTEXT HALLUC DOCS VERBOSE. Each code once only. Empty string if nothing wrong."
  },
  "modelB": {
    "pros": "Short list of what worked. Plain words.",
    "cons": "Behavioral codes only, comma-separated. Same rules as above."
  },
  "axes": {
    "logicCorrectness":      {"winner": "A" or "B" or "tie", "preferredScore": 1-5, "note": "max 10 words"},
    "namingClarity":         {"winner": "A" or "B" or "tie", "preferredScore": 1-5, "note": "max 10 words"},
    "organizationModularity":{"winner": "A" or "B" or "tie", "preferredScore": 1-5, "note": "max 10 words"},
    "interfaceDesign":       {"winner": "A" or "B" or "tie", "preferredScore": 1-5, "note": "max 10 words"},
    "errorHandling":         {"winner": "A" or "B" or "tie", "preferredScore": 1-5, "note": "max 10 words"},
    "documentation":         {"winner": "A" or "B" or "tie", "preferredScore": 1-5, "note": "max 10 words"},
    "productionReadiness":   {"winner": "A" or "B" or "tie", "preferredScore": 1-5, "note": "max 10 words"}
  }
}

Cons rules (critical):
- ONLY behavioral codes in CODE:file:line format, no text descriptions
- Each code appears at most once per model's cons list
- The model you did NOT prefer must have at least 1 cons code
- If no file is involved, just write the code (e.g. VERBOSE, LAZY)
- Do not write sentences in cons, only codes

Axes rules (critical):
- NEVER use "N/A" as winner. Always pick "A", "B", or "tie"
- Always give a score from 1 to 5
- Always give a short note

Return only the JSON object, no extra text.`;
}

function sanitizeFeedback(data) {
  const nonPref = data.preferred === 'A' ? 'modelB' : 'modelA';
  if (!data[nonPref]?.cons?.trim()) data[nonPref] = { ...data[nonPref], cons: 'LAZY' };
  for (const ax of Object.values(data.axes || {})) {
    if (!ax.winner || ax.winner === 'N/A') ax.winner = 'tie';
    const score = parseInt(ax.preferredScore);
    ax.preferredScore = isNaN(score) ? 3 : Math.max(1, Math.min(5, score));
  }
  return data;
}

router.post('/generate', (req, res) => {
  const { session_id, interaction_number, prompt_used, model_a_response, model_b_response } = req.body;
  if (!session_id) return res.status(400).json({ detail: 'session_id required' });
  const promptText = buildFeedbackPrompt(prompt_used, model_a_response, model_b_response, interaction_number);
  res.json({ session_id, interaction_number, prompt_text: promptText });
});

router.post('/parse', async (req, res) => {
  const { session_id, interaction_number = 0, response_text, prompt_used = '' } = req.body;
  if (!session_id || !response_text)
    return res.status(400).json({ detail: 'session_id and response_text required' });

  const match = response_text.match(/\{[\s\S]*\}/);
  if (!match)
    return res.status(400).json({ detail: 'No JSON object found. Make sure Claude returned {...} format.' });

  let feedback;
  try { feedback = JSON.parse(match[0]); }
  catch (e) { return res.status(400).json({ detail: `Invalid JSON: ${e.message}` }); }

  feedback = sanitizeFeedback(feedback);

  await getDb().collection('sessions').updateOne(
    { _id: new ObjectId(session_id) },
    { $push: { interactions: { interaction_number, prompt_used, feedback, created_at: new Date().toISOString() } } }
  );
  res.json({ feedback });
});

router.get('/session/:id/interactions', async (req, res) => {
  const session = await getDb().collection('sessions').findOne({ _id: new ObjectId(req.params.id) });
  if (!session) return res.status(404).json({ detail: 'Session not found' });
  res.json({ interactions: session.interactions || [] });
});

module.exports = router;
