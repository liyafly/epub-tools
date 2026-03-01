/**
 * WebP Converter 模块单元测试
 */
import { describe, it, expect } from 'vitest';
import { convertWebp } from '../../packages/core/src/image/webp-converter.js';

describe('WebP Converter', () => {
  it('convertWebp should be exported and be a function', () => {
    expect(convertWebp).toBeDefined();
    expect(typeof convertWebp).toBe('function');
  });
});
