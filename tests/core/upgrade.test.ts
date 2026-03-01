/**
 * Upgrade 模块单元测试
 */
import { describe, it, expect } from 'vitest';
import { upgradeEpub } from '../../packages/core/src/epub/upgrade.js';

describe('Upgrade', () => {
  it('upgradeEpub should be exported and be a function', () => {
    expect(upgradeEpub).toBeDefined();
    expect(typeof upgradeEpub).toBe('function');
  });
});
