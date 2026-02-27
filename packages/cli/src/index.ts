#!/usr/bin/env node
/**
 * epub-tools CLI 入口
 */
import { Command } from 'commander';
import { processCommand } from './commands/process.js';
import { reformatCommand } from './commands/reformat.js';
import { convertWebpCommand } from './commands/convert-webp.js';
import { compressCommand } from './commands/compress.js';
import { encryptCommand } from './commands/encrypt.js';
import { decryptCommand } from './commands/decrypt.js';
import { encryptFontCommand } from './commands/encrypt-font.js';
import { subsetFontsCommand } from './commands/subset-fonts.js';
import { editCommand } from './commands/edit.js';
import { doctorCommand } from './commands/doctor.js';

const program = new Command();

program
  .name('epub-tools')
  .description('EPUB 跨平台处理工具 — CLI 界面')
  .version('2.0.0');

// 注册子命令
program.addCommand(processCommand);
program.addCommand(reformatCommand);
program.addCommand(convertWebpCommand);
program.addCommand(compressCommand);
program.addCommand(encryptCommand);
program.addCommand(decryptCommand);
program.addCommand(encryptFontCommand);
program.addCommand(subsetFontsCommand);
program.addCommand(editCommand);
program.addCommand(doctorCommand);

program.parse();
