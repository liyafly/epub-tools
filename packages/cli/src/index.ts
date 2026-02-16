#!/usr/bin/env node
import { Command } from "commander";
import { resolveToolchain } from "@epub-tools/core";

const program = new Command();

program
  .name("epub-tools")
  .description("EPUB processing CLI (scaffold)")
  .version("0.0.0");

program
  .command("doctor")
  .description("Print configured toolchain versions from scaffold")
  .action(() => {
    const toolchain = resolveToolchain();
    console.log(JSON.stringify(toolchain, null, 2));
  });

program.parse(process.argv);
