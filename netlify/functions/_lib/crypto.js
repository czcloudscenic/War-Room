const crypto = require("crypto");

const PREFIX = "v1";
let warnedMissingKey = false;

function getKey() {
  const raw = process.env.TOKEN_ENC_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("TOKEN_ENC_KEY must be a 32-byte base64 value");
  }
  return key;
}

function encrypt(text) {
  if (text == null) return null;
  const key = getKey();
  if (!key) {
    if (!warnedMissingKey) {
      console.warn("[token-crypto] TOKEN_ENC_KEY unset; storing OAuth tokens as plaintext");
      warnedMissingKey = true;
    }
    return text;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(text), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    PREFIX,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

function decrypt(text) {
  if (text == null || !String(text).startsWith(`${PREFIX}:`)) return text;
  const key = getKey();
  if (!key) {
    throw new Error("TOKEN_ENC_KEY required to decrypt OAuth token");
  }

  const parts = String(text).split(":");
  if (parts.length !== 4 || parts[0] !== PREFIX) {
    throw new Error("Invalid encrypted token format");
  }
  const [, ivB64, tagB64, cipherB64] = parts;
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(cipherB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

module.exports = { encrypt, decrypt };
