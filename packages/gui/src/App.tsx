import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

type ToolInfo = {
  node: string;
  typescript: string;
  python: string;
  rust: string;
};

const INITIAL_TOOL_INFO: ToolInfo = {
  node: typeof process !== "undefined" && process.versions?.node ? process.versions.node : "lts",
  typescript: "5.9.3",
  python: "3.12",
  rust: "stable"
};

export default function App() {
  const [appVersion, setAppVersion] = useState<string>("dev");

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => setAppVersion("dev"));
  }, []);

  return (
    <main className="app-shell">
      <header className="app-header">
        <p className="eyebrow">EPUB Tools · Scaffold</p>
        <h1>Ready for new-tools</h1>
        <p className="lede">
          React + Tauri shell with TypeScript {INITIAL_TOOL_INFO.typescript} and Python {INITIAL_TOOL_INFO.python}.
        </p>
        <div className="badge-row">
          <span className="badge">App {appVersion}</span>
          <span className="badge">Node {INITIAL_TOOL_INFO.node}</span>
          <span className="badge">Rust {INITIAL_TOOL_INFO.rust}</span>
        </div>
      </header>
      <section className="panel">
        <h2>What&apos;s next</h2>
        <ol>
          <li>Wire core processing APIs once modules land.</li>
          <li>Expose commands via Tauri invokes and CLI sidecar.</li>
          <li>Hook Python font sidecar through the planned bridge.</li>
        </ol>
      </section>
    </main>
  );
}
