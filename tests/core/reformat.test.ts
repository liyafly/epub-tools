/**
 * Reformat 模块单元测试
 */
import { describe, it, expect } from 'vitest';
import { reformatEpub } from '../../packages/core/src/epub/reformat.js';

describe('Reformat', () => {
  it('reformatEpub should be exported and be a function', () => {
    expect(reformatEpub).toBeDefined();
    expect(typeof reformatEpub).toBe('function');
  });
});
