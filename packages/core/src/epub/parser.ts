/**
 * EPUB 解析器
 * 使用 jszip + fast-xml-parser 解析 EPUB 文件
 */
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { readFile } from 'node:fs/promises';

export interface EpubMetadata {
  title?: string;
  creator?: string;
  language?: string;
  identifier?: string;
  publisher?: string;
  date?: string;
  version: string;
}

export interface ManifestItem {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
}

export interface SpineItem {
  idref: string;
  linear?: string;
}

export interface ParsedEpub {
  zip: JSZip;
  metadata: EpubMetadata;
  manifest: Map<string, ManifestItem>;
  spine: SpineItem[];
  opfPath: string;
  opfDir: string;
  rawOpf: string;
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['item', 'itemref', 'reference'].includes(name),
});

export class EpubParser {
  /**
   * 从文件路径解析 EPUB
   */
  static async fromFile(filePath: string): Promise<ParsedEpub> {
    const buffer = await readFile(filePath);
    return EpubParser.fromBuffer(buffer);
  }

  /**
   * 从 Buffer 解析 EPUB
   */
  static async fromBuffer(buffer: Buffer | Uint8Array): Promise<ParsedEpub> {
    const zip = await JSZip.loadAsync(buffer);

    // 1. 解析 container.xml 定位 OPF
    const containerXml = await zip.file('META-INF/container.xml')?.async('text');
    if (!containerXml) {
      throw new Error('无效的 EPUB: 缺少 META-INF/container.xml');
    }

    const container = xmlParser.parse(containerXml);
    const rootfile = container?.container?.rootfiles?.rootfile;
    const opfPath: string = Array.isArray(rootfile)
      ? rootfile[0]['@_full-path']
      : rootfile?.['@_full-path'];

    if (!opfPath) {
      throw new Error('无效的 EPUB: 无法定位 OPF 文件');
    }

    const opfDir = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/')) : '';

    // 2. 解析 OPF
    const rawOpf = await zip.file(opfPath)?.async('text');
    if (!rawOpf) {
      throw new Error(`无效的 EPUB: OPF 文件不存在 (${opfPath})`);
    }

    const opf = xmlParser.parse(rawOpf);
    const pkg = opf?.package || opf?.['opf:package'];

    // 3. 提取元数据
    const dc = pkg?.metadata || {};
    const metadata: EpubMetadata = {
      title: EpubParser.extractText(dc['dc:title']),
      creator: EpubParser.extractText(dc['dc:creator']),
      language: EpubParser.extractText(dc['dc:language']),
      identifier: EpubParser.extractText(dc['dc:identifier']),
      publisher: EpubParser.extractText(dc['dc:publisher']),
      date: EpubParser.extractText(dc['dc:date']),
      version: pkg?.['@_version'] || '2.0',
    };

    // 4. 提取 manifest
    const manifest = new Map<string, ManifestItem>();
    const items = pkg?.manifest?.item || [];
    for (const item of items) {
      const entry: ManifestItem = {
        id: item['@_id'],
        href: item['@_href'],
        mediaType: item['@_media-type'],
        properties: item['@_properties'],
      };
      manifest.set(entry.id, entry);
    }

    // 5. 提取 spine
    const spine: SpineItem[] = (pkg?.spine?.itemref || []).map(
      (ref: Record<string, string>) => ({
        idref: ref['@_idref'],
        linear: ref['@_linear'],
      }),
    );

    return { zip, metadata, manifest, spine, opfPath, opfDir, rawOpf };
  }

  private static extractText(value: unknown): string | undefined {
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value !== null) {
      return (value as Record<string, unknown>)['#text'] as string | undefined;
    }
    return undefined;
  }
}
