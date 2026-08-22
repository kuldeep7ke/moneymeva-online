// Runtime config. Values are stored XOR-obfuscated + base64 so they do not appear as
// plain-text strings in the shipped bundle (no casual grep/extraction from APK or web JS).
// Decode happens in-memory at runtime. Note: a determined attacker monitoring network
// traffic can still recover these — this is obfuscation, not cryptographic secrecy.
// The Supabase anon key is a public client key by design — row-level security on the
// database protects the actual data.
const _K = 'moneymeva';
function _d(e: string): string {
  try {
    const bin = atob(e);
    let out = '';
    for (let i = 0; i < bin.length; i++) {
      out += String.fromCharCode(bin.charCodeAt(i) ^ _K.charCodeAt(i % _K.length));
    }
    return out;
  } catch {
    return '';
  }
}

export const SUPABASE_URL = _d('BRsaFQpXSlkOHx8JCBsfHBUPAAUZERgBEAYCCEEdEAkMBxcSCEENCg==');
export const SUPABASE_ANON_KEY = _d('CBYkDRsqBh8uBCUnMAMkVDgIJBwnCytYBjUoWyYFFSE7JjxYQwoXLwkOVjsIIgYkHx01Jx44ACkUPyokFj8PJwM0DDBbLBtYFAwpAQ00CzxUNF1bERgDAUY4OhdfBj4jCT8IGgYNCEAePyUoWyYDIwwPV0IIISwkFSA1NB8uBypdKj00UDglBl8jDyweLBs3WQwtLE8gDzMWIAU7HDc5NA8vNV9ASC0oKjgOHAoPLwMPNRUrNwEjCigpPwwPAAApBBMBKwY5IR09ICo+LABVOA==');
export const SITE_URL = 'https://moneymevaonline.pages.dev';

// jsonbin.io Bin IDs (broadcast & banner — edit via jsonbin.io dashboard, see docs/BROADCAST-GUIDE.md)
export const BROADCAST_BIN_ID = _d('Ww5WXB9dVk4HWAlaBB9YAERYXlldBk5U');
export const BANNER_BIN_ID = _d('Ww5WXB9dUEUHWAlaBB9YAERYXlldBhte');
export const JSONBIN_BASE = _d('BRsaFQpXSlkAHQZADwoCCxQIA0EHClYbVlkDQg==');
