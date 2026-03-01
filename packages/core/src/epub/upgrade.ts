/**
 * EPUB2 → EPUB3 升级
 * 生成 nav.xhtml，保留原始 EPUB2 备份
 */
import { XMLParser } from 'fast-xml-parser';
import type { ParsedEpub } from './parser.js';
import { EpubParser } from './parser.js';
import { EpubWriter } from './writer.js';
import { logger } from '../utils/logger.js';

export interface UpgradeOptions {
  /** 输出路径 */
  outputPath: string;
  /** 目标版本 (默认 '3.3') */
  targetVersion?: '3.2' | '3.3';
  /** 是否保留 NCX 以兼容旧阅读器 */
  keepNcx?: boolean;
}

export interface UpgradeResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  navGenerated: boolean;
  ncxKept: boolean;
}

interface NavPoint {
  label: string;
  src: string;
  children: NavPoint[];
}

const ncxParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'navPoint',
});

/**
 * 将 EPUB 2.0 升级到 EPUB 3.2/3.3
 */
export async function upgradeEpub(
  _epubPath: string,
  _options: UpgradeOptions,
): Promise<UpgradeResult> {
  const targetVersion = _options.targetVersion ?? '3.3';
  const keepNcx = _options.keepNcx ?? true;

  // 1. Parse the EPUB
  const epub = await EpubParser.fromFile(_epubPath);
  const fromVersion = epub.metadata.version;

  // 2. If already 3.x, skip
  if (fromVersion.startsWith('3')) {
    logger.info(`EPUB is already version ${fromVersion}, skipping upgrade`);
    return {
      success: true,
      fromVersion,
      toVersion: fromVersion,
      navGenerated: false,
      ncxKept: true,
    };
  }

  // 3. Find and parse NCX
  const navPoints = await parseNcx(epub);

  // 4. Generate nav.xhtml
  const navXhtml = generateNavXhtml(navPoints, epub.metadata.title);
  const navHref = 'nav.xhtml';
  const navZipPath = epub.opfDir ? `${epub.opfDir}/${navHref}` : navHref;
  epub.zip.file(navZipPath, navXhtml);
  logger.debug(`Generated ${navZipPath}`);

  // 5. Update OPF
  let opf = epub.rawOpf;

  // 5a. Update version attribute
  opf = opf.replace(
    /(<package[^>]*\sversion=)(["']).*?\2/,
    `$1$2${targetVersion}$2`,
  );

  // 5b. Add nav.xhtml to manifest
  const navManifestItem = `<item id="nav" href="${navHref}" media-type="application/xhtml+xml" properties="nav"/>`;
  opf = opf.replace(
    /(<\/manifest>)/,
    `    ${navManifestItem}\n  $1`,
  );

  // 5c. Add nav.xhtml to spine as first item (non-linear)
  const navSpineItem = `<itemref idref="nav" linear="no"/>`;
  opf = opf.replace(
    /(<spine[^>]*>)/,
    `$1\n    ${navSpineItem}`,
  );

  // 5d. If !keepNcx, remove NCX from manifest and toc attribute from spine
  if (!keepNcx) {
    // Remove NCX manifest item(s)
    opf = opf.replace(
      /\s*<item[^>]*media-type="application\/x-dtbncx\+xml"[^>]*\/>/g,
      '',
    );
    // Remove toc attribute from <spine>
    opf = opf.replace(
      /(<spine[^>]*)\s+toc="[^"]*"/,
      '$1',
    );
    // Remove NCX file from zip
    for (const [, item] of epub.manifest) {
      if (item.mediaType === 'application/x-dtbncx+xml') {
        const ncxZipPath = epub.opfDir ? `${epub.opfDir}/${item.href}` : item.href;
        epub.zip.remove(ncxZipPath);
        logger.debug(`Removed NCX: ${ncxZipPath}`);
      }
    }
  }

  // 6. Write updated OPF back into zip
  epub.zip.file(epub.opfPath, opf);

  // 7. Write output
  await EpubWriter.write(epub.zip, { outputPath: _options.outputPath });
  logger.info(`Upgraded EPUB ${fromVersion} → ${targetVersion}: ${_options.outputPath}`);

  return {
    success: true,
    fromVersion,
    toVersion: targetVersion,
    navGenerated: true,
    ncxKept: keepNcx,
  };
}

/** Parse the NCX file and extract navPoints. */
async function parseNcx(epub: ParsedEpub): Promise<NavPoint[]> {
  // Find NCX in manifest
  let ncxHref: string | undefined;
  for (const [, item] of epub.manifest) {
    if (item.mediaType === 'application/x-dtbncx+xml') {
      ncxHref = item.href;
      break;
    }
  }

  if (!ncxHref) {
    logger.warn('No NCX file found in manifest, generating empty nav');
    return [];
  }

  const ncxZipPath = epub.opfDir ? `${epub.opfDir}/${ncxHref}` : ncxHref;
  const ncxContent = await epub.zip.file(ncxZipPath)?.async('text');
  if (!ncxContent) {
    logger.warn(`NCX file not found in zip: ${ncxZipPath}`);
    return [];
  }

  const parsed = ncxParser.parse(ncxContent);
  const navMap = parsed?.ncx?.navMap;
  if (!navMap?.navPoint) return [];

  return extractNavPoints(navMap.navPoint);
}

/** Recursively extract navPoints from parsed NCX. */
function extractNavPoints(points: unknown[]): NavPoint[] {
  return points.map((np) => {
    const point = np as Record<string, unknown>;
    const navLabel = point.navLabel as Record<string, unknown> | undefined;
    const label = typeof navLabel?.text === 'string'
      ? navLabel.text
      : String(navLabel?.text ?? '');
    const content = point.content as Record<string, string> | undefined;
    const src = content?.['@_src'] ?? '';
    const children = point.navPoint ? extractNavPoints(point.navPoint as unknown[]) : [];
    return { label, src, children };
  });
}

/** Generate EPUB3 nav.xhtml from navPoints. */
function generateNavXhtml(navPoints: NavPoint[], title?: string): string {
  const docTitle = escapeXml(title ?? 'Table of Contents');

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head>
  <title>${docTitle}</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${docTitle}</h1>
${renderNavList(navPoints, 4)}
  </nav>
</body>
</html>
`;
}

/** Recursively render navPoints as <ol>/<li>/<a>. */
function renderNavList(points: NavPoint[], indent: number): string {
  if (points.length === 0) return `${pad(indent)}<ol></ol>`;

  const lines: string[] = [];
  lines.push(`${pad(indent)}<ol>`);
  for (const pt of points) {
    const href = escapeXml(pt.src);
    const text = escapeXml(pt.label);
    if (pt.children.length > 0) {
      lines.push(`${pad(indent + 1)}<li>`);
      lines.push(`${pad(indent + 2)}<a href="${href}">${text}</a>`);
      lines.push(renderNavList(pt.children, indent + 2));
      lines.push(`${pad(indent + 1)}</li>`);
    } else {
      lines.push(`${pad(indent + 1)}<li><a href="${href}">${text}</a></li>`);
    }
  }
  lines.push(`${pad(indent)}</ol>`);
  return lines.join('\n');
}

function pad(level: number): string {
  return '  '.repeat(level);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
