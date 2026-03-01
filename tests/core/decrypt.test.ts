/**
 * Decrypt 模块单元测试
 */
import { describe, it, expect } from 'vitest';
import { decryptEpub } from '../../packages/core/src/crypto/decrypt.js';

describe('Decrypt', () => {
  it('decryptEpub should be exported and be a function', () => {
    expect(decryptEpub).toBeDefined();
    expect(typeof decryptEpub).toBe('function');
  });
});
