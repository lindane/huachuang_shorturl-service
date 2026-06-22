const crypto = require('crypto');

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

module.exports = {
  CHARS,
  generateShortCode,
  isValidUrl,
  isValidCustomCode
};
