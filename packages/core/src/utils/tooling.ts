export type ToolchainConfig = {
  node: string;
  python: string;
  rust: string;
  typescript: string;
};

const fallback: ToolchainConfig = {
  node: process.versions.node,
  python: "3.12",
  rust: "stable",
  typescript: "5.9.3"
};

export function resolveToolchain(overrides: Partial<ToolchainConfig> = {}): ToolchainConfig {
  return { ...fallback, ...overrides };
}
