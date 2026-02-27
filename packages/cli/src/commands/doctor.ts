/**
 * doctor — 依赖环境检测
 */
import { Command } from 'commander';
import { checkTools } from '@epub-tools/core';

export const doctorCommand = new Command('doctor')
  .description('检查所有依赖工具和运行环境')
  .action(async () => {
    console.log('\n🔍 epub-tools doctor — 环境检测\n');

    const tools = await checkTools();

    for (const tool of tools) {
      const icon = tool.available ? '✅' : tool.required ? '❌' : '⚠️';
      const status = tool.available ? tool.version : '未安装';
      const req = tool.required ? '(必需)' : '(可选)';

      console.log(`  ${icon} ${tool.name} ${req}: ${status}`);
      if (!tool.available) {
        console.log(`     💡 ${tool.installHint}`);
      }
    }

    const missing = tools.filter((t) => t.required && !t.available);
    if (missing.length > 0) {
      console.log(`\n❌ 有 ${missing.length} 个必需工具未安装，请先安装后再使用。\n`);
      process.exit(1);
    } else {
      console.log('\n✅ 所有必需工具已就绪！\n');
    }
  });
