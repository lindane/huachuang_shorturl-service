const express = require('express');
const crypto = require('crypto');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

function generateShortCode() {
  const bytes = crypto.randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS[bytes[i] % CHARS.length];
  }
  return code;
}

function isValidUrl(url) {
  return /^https?:\/\//.test(url);
}

function isValidCustomCode(code) {
  return /^[a-zA-Z0-9]{4,20}$/.test(code);
}

app.post('/api/shorten', (req, res) => {
  const { url, custom_code } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  if (!isValidUrl(url)) {
    return res.status(400).json({ error: 'Invalid URL format. URL must start with http:// or https://' });
  }

  if (custom_code !== undefined) {
    if (!isValidCustomCode(custom_code)) {
      return res.status(400).json({ error: 'Invalid custom code. Must be 4-20 characters, letters and numbers only' });
    }
    if (db.findUrlByCode(custom_code)) {
      return res.status(409).json({ error: 'Custom code already in use' });
    }
    db.insertUrl(custom_code, url);
    return res.json({
      short_url: `http://localhost:${PORT}/${custom_code}`
    });
  }

  const existing = db.findUrlByOriginalUrl(url);
  if (existing) {
    return res.json({
      short_url: `http://localhost:${PORT}/${existing.code}`
    });
  }

  let code;
  let attempts = 0;
  do {
    code = generateShortCode();
    attempts++;
  } while (db.findUrlByCode(code) && attempts < 10);

  if (attempts >= 10) {
    return res.status(500).json({ error: 'Failed to generate unique short code' });
  }

  db.insertUrl(code, url);

  res.json({
    short_url: `http://localhost:${PORT}/${code}`
  });
});

app.get('/api/stats', (req, res) => {
  const total = db.countUrls();
  const recent = db.getRecentUrls(5);
  res.json({
    total,
    recent
  });
});

app.get('/:code', (req, res) => {
  const { code } = req.params;
  const result = db.findUrlByCode(code);

  if (result) {
    res.redirect(302, result.original_url);
  } else {
    res.status(404).send('404 Not Found');
  }
});

db.createTable();

app.listen(PORT, () => {
  console.log(`Short URL service running on http://localhost:${PORT}`);
});
