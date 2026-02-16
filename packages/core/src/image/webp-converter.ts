import { notImplemented } from "../utils/errors";

export async function convertWebpAssets(epubPath: string, outDir?: string): Promise<void> {
  notImplemented(`convertWebpAssets(${epubPath}${outDir ? ` -> ${outDir}` : ""})`);
}
