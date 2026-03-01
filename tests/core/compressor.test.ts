/**
 * Compressor 模块单元测试
 */
import { describe, it, expect } from 'vitest';
import { compressImages } from '../../packages/core/src/image/compressor.js';

describe('Compressor', () => {
  it('compressImages should be exported and be a function', () => {
    expect(compressImages).toBeDefined();
    expect(typeof compressImages).toBe('function');
  });
});
