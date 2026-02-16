import { notImplemented } from "../utils/errors";
import { resolveToolchain } from "../utils/tooling";
import type { ToolchainConfig } from "../utils/tooling";

export function ensurePythonBridge(overrides: Partial<ToolchainConfig> = {}): ToolchainConfig {
  return resolveToolchain(overrides);
}

export async function runPythonScript(script: string, args: string[] = []): Promise<void> {
  notImplemented(`runPythonScript(${script} ${args.join(" ")})`);
}
