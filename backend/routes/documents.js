const { Router } = require('express');
const multer     = require('multer');
const { ObjectId } = require('mongodb');
const { getDb }  = require('../db');

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ detail: 'No file uploaded' });

  let textContent = null;
  try       { textContent = file.buffer.toString('utf-8'); }
  catch (_) { try { textContent = file.buffer.toString('latin1'); } catch (_) {} }

  const doc = {
    filename:     file.originalname,
    content_type: file.mimetype || 'application/octet-stream',
    size:         file.size,
    raw_data:     file.buffer,
    text_content: textContent,
    uploaded_at:  new Date().toISOString(),
  };

  const result = await getDb().collection('documents').insertOne(doc);
  res.json({
    id:           result.insertedId.toString(),
    filename:     doc.filename,
    content_type: doc.content_type,
    size:         doc.size,
    has_text:     textContent !== null,
    uploaded_at:  doc.uploaded_at,
  });
});

router.get('/', async (_req, res) => {
  const docs = await getDb().collection('documents')
    .find({}, { projection: { raw_data: 0 } })
    .sort({ uploaded_at: -1 })
    .toArray();
  res.json(docs.map(d => ({
    id:           d._id.toString(),
    filename:     d.filename,
    content_type: d.content_type,
    size:         d.size,
    has_text:     d.text_content != null,
    uploaded_at:  d.uploaded_at,
  })));
});

router.get('/:id', async (req, res) => {
  const doc = await getDb().collection('documents').findOne(
    { _id: new ObjectId(req.params.id) },
    { projection: { raw_data: 0 } }
  );
  if (!doc) return res.status(404).json({ detail: 'Document not found' });
  res.json({
    id:           doc._id.toString(),
    filename:     doc.filename,
    content_type: doc.content_type,
    size:         doc.size,
    text_content: doc.text_content,
    uploaded_at:  doc.uploaded_at,
  });
});

router.delete('/:id', async (req, res) => {
  const result = await getDb().collection('documents').deleteOne({ _id: new ObjectId(req.params.id) });
  if (result.deletedCount === 0) return res.status(404).json({ detail: 'Document not found' });
  res.json({ deleted: true });
});

module.exports = router;
