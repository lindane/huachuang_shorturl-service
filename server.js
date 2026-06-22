const express = require('express');
const db = require('./db');
const { generateShortCode, isValidUrl, isValidCustomCode } = require('./utils');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.post('/api/shorten', (req, res, next) => {
  try {
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
  } catch (err) {
    next(err);
  }
});

app.get('/api/stats', (req, res, next) => {
  try {
    const total = db.countUrls();
    const recent = db.getRecentUrls(5);
    res.json({
      total,
      recent
    });
  } catch (err) {
    next(err);
  }
});

app.get('/:code', (req, res, next) => {
  try {
    const { code } = req.params;
    const result = db.findUrlByCode(code);

    if (result) {
      res.redirect(302, result.original_url);
    } else {
      res.status(404).send('404 Not Found');
    }
  } catch (err) {
    next(err);
  }
});

app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ error: 'Internal server error' });
});

db.createTable();

app.listen(PORT, () => {
  console.log(`Short URL service running on http://localhost:${PORT}`);
});
