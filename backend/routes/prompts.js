const { Router }   = require('express');
const { ObjectId } = require('mongodb');
const { getDb }    = require('../db');

const router = Router();

function buildPromptsPrompt(gh, docText) {
  const fileList = (gh.files || [])
    .map(f => `  - ${f.filename} (${f.status}, +${f.additions}/-${f.deletions})`)
    .join('\n');

  const patchSamples = (gh.files || [])
    .filter(f => f.patch)
    .map(f => `File: ${f.filename}\n${f.patch}`)
    .join('\n\n---\n\n')
    .slice(0, 2000);

  let contextLine = '';
  if (gh.sha)    contextLine = `- Commit: ${gh.sha}`;
  else if (gh.number) contextLine = `- PR #${gh.number}, Branch: ${gh.head_branch || ''} -> ${gh.base_branch || ''}`;
  else           contextLine = `- Repo: ${gh.repo}`;

  const docSection = docText
    ? `\n\nRequirement documentation (uploaded):\n${docText.slice(0, 3000)}\n`
    : '';

  return `I'm working on a code debugging task where I interact with an AI coding agent to find and fix bugs.

Info:
- Repo: ${gh.repo}
- Title: "${gh.title}"
${contextLine}
- Description: ${(gh.body || '').slice(0, 400)}${docSection}

Changed files:
${fileList || '(no files listed)'}

Code patches (sample):
${patchSamples || '(no patches available)'}

Generate 10 prompts I'll use to interact with the AI agent. The conversation should go through these phases:
- Prompts 1-2: Look at the issue, understand what's broken, don't fix yet
- Prompts 3-4: Confirm the root cause with evidence from the code
- Prompts 5-6: Implement the fix + write tests
- Prompts 7-8: Verify and handle edge cases
- Prompts 9-10: Improve error handling or docs, wrap up

Style rules:
- Short sentences, max 3-4 sentences per prompt
- Sound like a real developer, not an AI
- No words like "certainly", "absolutely", "I'd be happy", "let's", "please note", "I'd like"
- Use simple words - say "look at" not "examine", "fix" not "rectify", "check" not "verify"
- Each prompt builds naturally on the previous
- Reference actual files or behaviors from the changes when possible

Return only a JSON array, no extra text:
[{"number": 1, "prompt": "...", "phase": "investigation"}, ...]`;
}

router.post('/generate', async (req, res) => {
  const { github_data_id, document_id } = req.body;
  if (!github_data_id) return res.status(400).json({ detail: 'github_data_id required' });

  const gh = await getDb().collection('github_data').findOne({ _id: new ObjectId(github_data_id) });
  if (!gh) return res.status(404).json({ detail: 'GitHub data not found' });

  let docText = null;
  if (document_id) {
    const doc = await getDb().collection('documents').findOne({ _id: new ObjectId(document_id) });
    if (doc) docText = doc.text_content;
  }

  const promptText = buildPromptsPrompt(gh, docText);
  const session = {
    github_data_id, document_id, prompts: [], interactions: [],
    prompt_text: promptText, created_at: new Date().toISOString(),
  };

  const result = await getDb().collection('sessions').insertOne(session);
  res.json({ session_id: result.insertedId.toString(), prompt_text: promptText });
});

router.post('/parse', async (req, res) => {
  const { session_id, response_text } = req.body;
  if (!session_id || !response_text)
    return res.status(400).json({ detail: 'session_id and response_text required' });

  const match = response_text.match(/\[[\s\S]*\]/);
  if (!match)
    return res.status(400).json({ detail: 'No JSON array found in response. Make sure Claude returned [...] format.' });

  let prompts;
  try { prompts = JSON.parse(match[0]); }
  catch (e) { return res.status(400).json({ detail: `Invalid JSON: ${e.message}` }); }

  if (!Array.isArray(prompts) || prompts.length === 0)
    return res.status(400).json({ detail: 'Expected a non-empty JSON array of prompts.' });

  await getDb().collection('sessions').updateOne(
    { _id: new ObjectId(session_id) },
    { $set: { prompts } }
  );
  res.json({ prompts });
});

router.get('/session/:id', async (req, res) => {
  const session = await getDb().collection('sessions').findOne({ _id: new ObjectId(req.params.id) });
  if (!session) return res.status(404).json({ detail: 'Session not found' });
  session.id = session._id.toString();
  delete session._id;
  res.json(session);
});

module.exports = router;
