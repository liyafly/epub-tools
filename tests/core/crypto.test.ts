/**
 * Crypto 模块单元测试
 */
import { describe, it, expect } from 'vitest';
import { generateEncryptedName } from '../../packages/core/src/crypto/encrypt.js';

describe('Crypto', () => {
  it('generateEncryptedName should produce deterministic output', () => {
    const name1 = generateEncryptedName('test-id');
    const name2 = generateEncryptedName('test-id');
    expect(name1).toBe(name2);
  });

  it('generateEncryptedName should only contain * and :', () => {
    const name = generateEncryptedName('some-id');
    expect(name).toMatch(/^[*:]+$/);
  });

  it('generateEncryptedName should produce 128-char output', () => {
    const name = generateEncryptedName('any-id');
    expect(name.length).toBe(128);
  });
});
