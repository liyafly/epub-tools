import { notImplemented } from "../utils/errors";
import { ensurePythonBridge } from "../bridge/python-runner";

export async function encryptFonts(epubPath: string, outDir?: string): Promise<void> {
  ensurePythonBridge();
  notImplemented(`encryptFonts(${epubPath}${outDir ? ` -> ${outDir}` : ""})`);
}
