import { notImplemented } from "../utils/errors";

export async function upgradeEpub2To3(epubPath: string, outDir?: string): Promise<void> {
  notImplemented(`upgradeEpub2To3(${epubPath}${outDir ? ` -> ${outDir}` : ""})`);
}
