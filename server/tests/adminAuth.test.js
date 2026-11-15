import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createAdminToken,
  verifyAdminCredentials,
  verifyAdminToken,
} from '../src/auth/adminAuth.js';

describe('adminAuth helper', () => {
  it('validates default credentials admin / admin123 and rejects invalid ones', () => {
    assert.equal(verifyAdminCredentials('admin', 'admin123'), true);
    assert.equal(verifyAdminCredentials(' admin ', 'admin123'), true);
    assert.equal(verifyAdminCredentials('admin', 'wrong'), false);
    assert.equal(verifyAdminCredentials('other', 'admin123'), false);
    assert.equal(verifyAdminCredentials('', ''), false);
  });

  it('creates and verifies signed admin tokens and rejects tampered or expired tokens', () => {
    const session = createAdminToken('admin');
    assert.ok(session.token.includes('.'));
    assert.equal(session.user.username, 'admin');

    const verified = verifyAdminToken(session.token);
    assert.ok(verified);
    assert.equal(verified.sub, 'admin');
    assert.equal(verified.role, 'admin');

    const [payloadB64, sigB64] = session.token.split('.');
    const tamperedSig = `${sigB64.slice(0, -1)}${sigB64.endsWith('A') ? 'B' : 'A'}`;
    assert.equal(verifyAdminToken(`${payloadB64}.${tamperedSig}`), null);
    assert.equal(verifyAdminToken('invalid.token.value'), null);

    // Expired token simulation via short-lived payload check
    const expiredPayloadB64 = Buffer.from(
      JSON.stringify({ sub: 'admin', role: 'admin', iat: 1000, exp: Date.now() - 1000 }),
      'utf8'
    ).toString('base64url');
    assert.equal(verifyAdminToken(`${expiredPayloadB64}.${sigB64}`), null);
  });
});
