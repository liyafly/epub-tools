/**
 * Tool Checker 单元测试
 */
import { describe, it, expect } from 'vitest';
import { checkTools } from '../../packages/core/src/utils/tool-checker.js';

describe('Tool Checker', () => {
  it('should return an array of tool statuses', async () => {
    const tools = await checkTools();
    expect(Array.isArray(tools)).toBe(true);
    expect(tools.length).toBeGreaterThan(0);
  });

  it('should detect Node.js as available', async () => {
    const tools = await checkTools();
    const node = tools.find((t) => t.name === 'Node.js');
    expect(node).toBeDefined();
    expect(node!.available).toBe(true);
  });
});
