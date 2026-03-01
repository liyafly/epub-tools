/**
 * EPUB 格式规范化
 * TS 重写 reformat_epub.py — 重组为 Sigil 标准目录结构
 */
import path from 'node:path';
import type JSZip from 'jszip';
import type { ManifestItem, ParsedEpub } from './parser.js';
import { EpubWriter } from './writer.js';
import { logger } from '../utils/logger.js';

export interface ReformatOptions {
  /** 输出路径 */
  outputPath: string;
  /** 是否保留原始目录结构备份 */
  keepBackup?: boolean;
}

export interface ReformatResult {
  success: boolean;
  inputPath: string;
  outputPath: string;
  filesRenamed: number;
  referencesUpdated: number;
  errors: string[];
}

/* ---- Constants ---- */

type FileCategory = 'text' | 'css' | 'image' | 'font' | 'audio' | 'video' | 'other';

const CATEGORY_DIR: Record<FileCategory, string> = {
  text: 'Text',
  css: 'Styles',
  image: 'Images',
  font: 'Fonts',
  audio: 'Audio',
  video: 'Video',
  other: 'Misc',
};

/* ---- Helpers ---- */

function classifyItem(item: ManifestItem): FileCategory {
  const mt = item.mediaType;
  const href = item.href.toLowerCase();
  if (mt === 'application/xhtml+xml') return 'text';
  if (mt === 'text/css') return 'css';
  if (mt.startsWith('image/')) return 'image';
  if (mt.startsWith('font/') || href.endsWith('.ttf') || href.endsWith('.otf') || href.endsWith('.woff')) return 'font';
  if (mt.startsWith('audio/')) return 'audio';
  if (mt.startsWith('video/')) return 'video';
  return 'other';
}

/** Resolve a relative href against a base file's zip-path. */
function resolveBookPath(href: string, basePath: string): string {
  const parts = href.split(/[\\/]/);
  const baseParts = basePath.split(/[\\/]/);
  baseParts.pop(); // remove filename

  let backSteps = 0;
  while (parts.length > 0 && parts[0] === '..') { backSteps++; parts.shift(); }
  while (parts.length > 0 && parts[0] === '.') { parts.shift(); }

  if (backSteps >= baseParts.length) return parts.join('/');
  const base = baseParts.slice(0, baseParts.length - backSteps);
  return [...base, ...parts].join('/');
}

/** Auto-rename basename to avoid conflicts within a category. */
function autoRename(href: string, usedNames: Set<string>): string {
  const ext = path.extname(href);
  const stem = path.basename(href, ext);
  let candidate = stem + ext;
  let counter = 0;
  while (usedNames.has(candidate)) {
    counter++;
    candidate = `${stem}_${counter}${ext}`;
  }
  usedNames.add(candidate);
  return candidate;
}

/**
 * 重构 EPUB 为标准 Sigil 目录结构
 *
 * 目标结构:
 * - OEBPS/Text/     (XHTML 文档)
 * - OEBPS/Styles/   (CSS)
 * - OEBPS/Images/   (图片)
 * - OEBPS/Fonts/    (字体)
 * - OEBPS/Audio/    (音频)
 * - OEBPS/Video/    (视频)
 * - OEBPS/Misc/     (其他)
 */
export async function reformatEpub(
  epub: ParsedEpub,
  options: ReformatOptions,
): Promise<ReformatResult> {
  const { zip, manifest, opfPath, opfDir, rawOpf } = epub;
  const errors: string[] = [];
  let referencesUpdated = 0;

  // Detect NCX toc id from spine element
  const tocIdMatch = rawOpf.match(/<spine[^>]*toc="([^"]+)"/);
  const tocId = tocIdMatch ? tocIdMatch[1] : '';

  // ---- 1. Build path map ----
  const pathMap = new Map<string, { newBasename: string; category: FileCategory }>();
  const usedNames = new Map<FileCategory, Set<string>>();
  for (const cat of Object.keys(CATEGORY_DIR) as FileCategory[]) {
    usedNames.set(cat, new Set());
  }

  let tocBookPath = '';

  for (const [id, item] of manifest) {
    if (tocId && id === tocId) {
      tocBookPath = opfDir ? `${opfDir}/${item.href}` : item.href;
      continue;
    }

    const category = classifyItem(item);
    const newBasename = autoRename(item.href, usedNames.get(category)!);
    const bookPath = opfDir ? `${opfDir}/${item.href}` : item.href;

    pathMap.set(bookPath, { newBasename, category });
    logger.debug(`reformat: ${bookPath} → OEBPS/${CATEGORY_DIR[category]}/${newBasename}`);
  }

  // ---- 2. Build new zip ----
  const JSZipModule = (await import('jszip')).default;
  const newZip: JSZip = new JSZipModule();

  // mimetype
  newZip.file('mimetype', 'application/epub+zip');

  // container.xml — always point to OEBPS/content.opf
  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (containerXml) {
    const updatedContainer = containerXml.replace(
      /<rootfile[^>]*media-type="application\/oebps-[^>]*\/>/,
      '<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>',
    );
    newZip.file('META-INF/container.xml', updatedContainer);
  }

  // ---- 3. Copy & rewrite content files ----
  for (const [bookPath, { newBasename, category }] of pathMap) {
    const file = zip.file(bookPath);
    if (!file) {
      errors.push(`File not found in zip: ${bookPath}`);
      continue;
    }

    const dir = CATEGORY_DIR[category];

    if (category === 'text') {
      let text = await file.async('text');
      const before = text;
      text = rewriteXhtml(text, bookPath, pathMap);
      if (text !== before) referencesUpdated++;
      newZip.file(`OEBPS/${dir}/${newBasename}`, text);
    } else if (category === 'css') {
      let css = await file.async('text');
      const before = css;
      css = rewriteCss(css, bookPath, pathMap);
      if (css !== before) referencesUpdated++;
      newZip.file(`OEBPS/${dir}/${newBasename}`, css);
    } else {
      const data = await file.async('nodebuffer');
      newZip.file(`OEBPS/${dir}/${newBasename}`, data);
    }
  }

  // ---- 4. NCX toc ----
  if (tocBookPath) {
    const tocFile = zip.file(tocBookPath);
    if (tocFile) {
      let toc = await tocFile.async('text');
      const before = toc;
      toc = rewriteNcx(toc, tocBookPath, pathMap);
      if (toc !== before) referencesUpdated++;
      newZip.file('OEBPS/toc.ncx', toc);
    }
  }

  // ---- 5. Rebuild OPF ----
  const newOpf = rebuildOpf(rawOpf, manifest, tocId, pathMap, opfDir);
  newZip.file('OEBPS/content.opf', newOpf);

  // ---- 6. Write output ----
  await EpubWriter.write(newZip, { outputPath: options.outputPath });

  logger.info(`Reformatted ${pathMap.size} files → ${options.outputPath}`);

  return {
    success: true,
    inputPath: opfPath,
    outputPath: options.outputPath,
    filesRenamed: pathMap.size,
    referencesUpdated,
    errors,
  };
}

/* --------------- Rewrite helpers --------------- */

/** Rewrite href/src/xlink:href/poster and inline url() in XHTML. */
function rewriteXhtml(
  text: string,
  xhtmlBookPath: string,
  pathMap: Map<string, { newBasename: string; category: FileCategory }>,
): string {
  // href="..."
  text = text.replace(
    /(<[^>]*href=(["']))(.*?)(\2[^>]*>)/g,
    (match, prefix, _q, href, suffix) =>
      rewriteHtmlAttr(match, prefix, href, suffix, xhtmlBookPath, pathMap, true),
  );

  // src="..."
  text = text.replace(
    /(<[^>]*\ssrc=(["']))(.*?)(\2[^>]*>)/g,
    (match, prefix, _q, href, suffix) =>
      rewriteHtmlAttr(match, prefix, href, suffix, xhtmlBookPath, pathMap, false),
  );

  // xlink:href="..."
  text = text.replace(
    /(<[^>]*xlink:href=(["']))(.*?)(\2[^>]*>)/g,
    (match, prefix, _q, href, suffix) =>
      rewriteHtmlAttr(match, prefix, href, suffix, xhtmlBookPath, pathMap, false),
  );

  // poster="..."
  text = text.replace(
    /(<[^>]*\sposter=(["']))(.*?)(\2[^>]*>)/g,
    (match, prefix, _q, href, suffix) =>
      rewriteHtmlAttr(match, prefix, href, suffix, xhtmlBookPath, pathMap, false),
  );

  // url() in inline styles
  text = text.replace(
    /(url\(["']?)(.*?)(["']?\))/g,
    (match, pre, url, post) =>
      rewriteUrlRef(match, pre, url.trim(), post, xhtmlBookPath, pathMap),
  );

  return text;
}

/** Rewrite a single HTML attribute (href or src). */
function rewriteHtmlAttr(
  original: string,
  prefix: string,
  rawHref: string,
  suffix: string,
  basePath: string,
  pathMap: Map<string, { newBasename: string; category: FileCategory }>,
  isHref: boolean,
): string {
  const href = decodeURIComponent(rawHref).trim();
  if (!href || /^(?:https?:|data:|mailto:|res:|file:)/.test(href)) return original;

  let hrefBase = href;
  let fragment = '';
  const hashIdx = href.indexOf('#');
  if (hashIdx >= 0) {
    hrefBase = href.slice(0, hashIdx);
    fragment = href.slice(hashIdx);
  }
  if (!hrefBase) return original; // fragment-only

  const bookPath = resolveBookPath(hrefBase, basePath);
  const entry = pathMap.get(bookPath);
  if (!entry) return original;

  const dir = CATEGORY_DIR[entry.category];

  // CSS link tags get fully rewritten
  if (isHref && entry.category === 'css') {
    return `<link href="../Styles/${entry.newBasename}" type="text/css" rel="stylesheet"/>`;
  }

  // Same-directory text references use bare filename
  if (entry.category === 'text') {
    return prefix + entry.newBasename + fragment + suffix;
  }

  return prefix + `../${dir}/${entry.newBasename}` + fragment + suffix;
}

/** Rewrite url() references in CSS or inline styles. */
function rewriteUrlRef(
  original: string,
  pre: string,
  url: string,
  post: string,
  basePath: string,
  pathMap: Map<string, { newBasename: string; category: FileCategory }>,
): string {
  const decoded = decodeURIComponent(url).trim();
  if (!decoded || /^(?:https?:|data:|res:|file:)/.test(decoded)) return original;

  const bookPath = resolveBookPath(decoded, basePath);
  const entry = pathMap.get(bookPath);
  if (!entry) return original;

  const dir = CATEGORY_DIR[entry.category];
  return `${pre}../${dir}/${entry.newBasename}${post}`;
}

/** Rewrite CSS @import and url() references. */
function rewriteCss(
  css: string,
  cssBookPath: string,
  pathMap: Map<string, { newBasename: string; category: FileCategory }>,
): string {
  // @import
  css = css.replace(
    /@import\s+(?:(?:(["'])(.*?)\1)|(?:url\(["']?(.*?)["']?\)))/g,
    (match, _q, hrefQuoted, hrefUrl) => {
      const href = (hrefQuoted || hrefUrl || '').trim();
      if (!href.toLowerCase().endsWith('.css')) return match;
      const decoded = decodeURIComponent(href);
      const bookPath = resolveBookPath(decoded, cssBookPath);
      const entry = pathMap.get(bookPath);
      if (!entry) return match;
      return hrefQuoted !== undefined
        ? `@import "${entry.newBasename}"`
        : `@import url("${entry.newBasename}")`;
    },
  );

  // url()
  css = css.replace(
    /(url\(["']?)(.*?)(["']?\))/g,
    (match, pre, url, post) =>
      rewriteUrlRef(match, pre, url.trim(), post, cssBookPath, pathMap),
  );

  return css;
}

/** Rewrite NCX src references. */
function rewriteNcx(
  toc: string,
  tocBookPath: string,
  pathMap: Map<string, { newBasename: string; category: FileCategory }>,
): string {
  return toc.replace(
    /src=(["'])(.*?)\1/g,
    (match, _quote, rawHref) => {
      const href = decodeURIComponent(rawHref).trim();
      const hashIdx = href.indexOf('#');
      const hrefBase = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
      const fragment = hashIdx >= 0 ? href.slice(hashIdx) : '';

      if (!hrefBase) return match;

      const bookPath = resolveBookPath(hrefBase, tocBookPath);
      const entry = pathMap.get(bookPath);
      if (!entry) return match;

      return `src="Text/${entry.newBasename}${fragment}"`;
    },
  );
}

/** Rebuild OPF with updated manifest hrefs. */
function rebuildOpf(
  opf: string,
  manifest: Map<string, ManifestItem>,
  tocId: string,
  pathMap: Map<string, { newBasename: string; category: FileCategory }>,
  opfDir: string,
): string {
  let manifestText = '<manifest>';

  for (const [id, item] of manifest) {
    const props = item.properties ? ` properties="${item.properties}"` : '';

    if (tocId && id === tocId) {
      manifestText += `\n    <item id="${id}" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`;
      continue;
    }

    const bookPath = opfDir ? `${opfDir}/${item.href}` : item.href;
    const entry = pathMap.get(bookPath);
    if (!entry) {
      manifestText += `\n    <item id="${id}" href="${item.href}" media-type="${item.mediaType}"${props}/>`;
      continue;
    }

    const dir = CATEGORY_DIR[entry.category];
    manifestText += `\n    <item id="${id}" href="${dir}/${entry.newBasename}" media-type="${item.mediaType}"${props}/>`;
  }

  manifestText += '\n  </manifest>';

  let newOpf = opf.replace(/(?:<manifest[\s\S]*?<\/manifest>)/i, manifestText);

  // Update <reference> hrefs in guide section
  newOpf = newOpf.replace(
    /(<reference[^>]*href=(["']))(.*?)(\2[^>]*\/>)/g,
    (match, prefix, _q, href, suffix) => {
      const decoded = decodeURIComponent(href).trim();
      if (decoded.endsWith('.ncx')) return match;

      let cleaned = decoded;
      if (cleaned.startsWith('/')) cleaned = cleaned.slice(1);
      while (cleaned.startsWith('../')) cleaned = cleaned.slice(3);
      if (cleaned.startsWith('./')) cleaned = cleaned.slice(2);

      const bookPath = opfDir ? `${opfDir}/${cleaned}` : cleaned;
      const entry = pathMap.get(bookPath);
      if (!entry) return match;
      return `${prefix}Text/${entry.newBasename}${suffix}`;
    },
  );

  return newOpf;
}
