/**
 * 文件名加密
 * TS 重写 encrypt_epub.py
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { EpubParser, type ManifestItem } from '../epub/parser.js';
import { EpubWriter } from '../epub/writer.js';
import { logger } from '../utils/logger.js';
import type JSZip from 'jszip';

export interface EncryptOptions {
  /** 输出路径 */
  outputPath: string;
}

export interface EncryptResult {
  success: boolean;
  filesEncrypted: number;
  mapping: Map<string, string>;
}

/** Media type categories and their OEBPS sub-directories */
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

/**
 * MD5(id) → 二进制 → 1→'*', 0→':' → 作为新文件名
 */
export function generateEncryptedName(id: string): string {
  const md5 = createHash('md5').update(id).digest('hex');
  const binary = BigInt(`0x${md5}`).toString(2).padStart(128, '0');
  return binary.replace(/1/g, '*').replace(/0/g, ':');
}

/** Classify a manifest item into a file category */
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

/** Build the encrypted filename for a manifest item.
 *  ID format: typically "filename.ext" — we split on first '.' to get the name part for hashing. */
function buildEncryptedFilename(id: string, href: string): string {
  const idName = id.split('.')[0];
  const lastDot = href.lastIndexOf('.');
  const ext = lastDot >= 0 ? href.slice(lastDot + 1).toLowerCase() : '';
  const filenameWithoutExt = path.basename(href, path.extname(href));

  let slimSuffix = '';
  let hashInput = idName;
  if (filenameWithoutExt.endsWith('slim') || idName.endsWith('slim')) {
    slimSuffix = '~slim';
    hashInput = idName
      .replace(/~slim$/, '')
      .replace(/-slim$/, '')
      .replace(/_slim$/, '')
      .replace(/slim$/, '');
  }

  const encrypted = generateEncryptedName(hashInput);
  return `_${encrypted}${slimSuffix}.${ext}`;
}

/**
 * Resolve a relative href against a base file path to get the book-path (zip path).
 * e.g. resolveBookPath('../Images/cover.jpg', 'OEBPS/Text/chapter1.xhtml')
 *      → 'OEBPS/Images/cover.jpg'
 */
function resolveBookPath(href: string, basePath: string): string {
  const parts = href.split(/[\\/]/);
  const baseParts = basePath.split(/[\\/]/);
  baseParts.pop(); // remove filename

  let backSteps = 0;
  while (parts.length > 0 && parts[0] === '..') {
    backSteps++;
    parts.shift();
  }
  // Remove '.' parts
  while (parts.length > 0 && parts[0] === '.') {
    parts.shift();
  }

  if (backSteps >= baseParts.length) {
    return parts.join('/');
  }
  const base = baseParts.slice(0, baseParts.length - backSteps);
  return [...base, ...parts].join('/');
}

/**
 * 对 EPUB 文件进行文件名加密
 */
export async function encryptEpub(
  epubPath: string,
  options: EncryptOptions,
): Promise<EncryptResult> {
  const parsed = await EpubParser.fromFile(epubPath);
  const { zip, manifest, spine, opfPath, opfDir, rawOpf } = parsed;

  // Detect NCX toc id from spine
  const opfXml = rawOpf;
  const tocIdMatch = opfXml.match(/<spine[^>]*toc="([^"]+)"/);
  const tocId = tocIdMatch ? tocIdMatch[1] : '';

  // Build categorized lists and path mapping
  // pathMap: old bookpath → { newBasename, category }
  const pathMap = new Map<string, { newBasename: string; category: FileCategory }>();
  // hrefToNew: old opf-relative href → new encrypted basename (for toc/reference rewriting)
  const hrefToNew = new Map<string, string>();
  const usedNames = new Map<FileCategory, Set<string>>();
  for (const cat of Object.keys(CATEGORY_DIR) as FileCategory[]) {
    usedNames.set(cat, new Set());
  }

  let tocBookPath = '';

  for (const [id, item] of manifest) {
    // Skip NCX toc file — handle separately
    if (tocId && id === tocId) {
      const tocHref = item.href;
      tocBookPath = opfDir ? `${opfDir}/${tocHref}` : tocHref;
      continue;
    }

    const category = classifyItem(item);
    let newName = buildEncryptedFilename(id, item.href);

    // Ensure uniqueness within category
    const nameSet = usedNames.get(category)!;
    if (nameSet.has(newName)) {
      const extIdx = newName.lastIndexOf('.');
      const base = newName.slice(0, extIdx);
      const ext = newName.slice(extIdx);
      let counter = 1;
      while (nameSet.has(`${base}_${counter}${ext}`)) counter++;
      newName = `${base}_${counter}${ext}`;
    }
    nameSet.add(newName);

    const bookPath = opfDir ? `${opfDir}/${item.href}` : item.href;
    pathMap.set(bookPath, { newBasename: newName, category });
    hrefToNew.set(item.href, newName);

    logger.debug(`encrypt: ${id}:${item.href} → ${newName}`);
  }

  // Build new zip
  const JSZipModule = (await import('jszip')).default;
  const newZip: JSZip = new JSZipModule();

  // mimetype (JSZip typing expects 'DEFLATE'|'STORE' but its type definition is narrow)
  newZip.file('mimetype', 'application/epub+zip');

  // container.xml — point to OEBPS/content.opf
  const containerXml = await zip.file('META-INF/container.xml')?.async('text');
  if (containerXml) {
    const updatedContainer = containerXml.replace(
      /<rootfile[^>]*media-type="application\/oebps-[^>]*\/>/,
      '<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>',
    );
    newZip.file('META-INF/container.xml', updatedContainer);
  }

  // Copy & rewrite content files
  for (const [bookPath, { newBasename, category }] of pathMap) {
    const file = zip.file(bookPath);
    if (!file) continue;

    const dir = CATEGORY_DIR[category];

    if (category === 'text') {
      let text = await file.async('text');
      text = rewriteXhtml(text, bookPath, pathMap);
      newZip.file(`OEBPS/${dir}/${newBasename}`, text);
    } else if (category === 'css') {
      let css = await file.async('text');
      css = rewriteCss(css, bookPath, pathMap);
      newZip.file(`OEBPS/${dir}/${newBasename}`, css);
    } else {
      const data = await file.async('nodebuffer');
      newZip.file(`OEBPS/${dir}/${newBasename}`, data);
    }
  }

  // NCX toc file
  if (tocBookPath) {
    const tocFile = zip.file(tocBookPath);
    if (tocFile) {
      let toc = await tocFile.async('text');
      toc = rewriteNcx(toc, tocBookPath, hrefToNew);
      newZip.file('OEBPS/toc.ncx', toc);
    }
  }

  // Rebuild OPF
  const newOpf = rebuildOpf(rawOpf, manifest, tocId, pathMap, opfDir);
  newZip.file('OEBPS/content.opf', newOpf);

  // Write output
  await EpubWriter.write(newZip, { outputPath: options.outputPath });

  logger.info(`Encrypted ${pathMap.size} files → ${options.outputPath}`);

  return {
    success: true,
    filesEncrypted: pathMap.size,
    mapping: new Map([...pathMap].map(([k, v]) => [k, `OEBPS/${CATEGORY_DIR[v.category]}/${v.newBasename}`])),
  };
}

// --------------- Rewrite helpers ---------------

/** Rewrite href/src/xlink:href references in XHTML content */
function rewriteXhtml(
  text: string,
  xhtmlBookPath: string,
  pathMap: Map<string, { newBasename: string; category: FileCategory }>,
): string {
  // Rewrite href="..." attributes
  text = text.replace(
    /(<[^>]*href=(["']))(.*?)(\2[^>]*>)/g,
    (match, prefix, _q, href, suffix) => {
      return rewriteHtmlAttr(match, prefix, href, suffix, xhtmlBookPath, pathMap, true);
    },
  );

  // Rewrite src="..." attributes
  text = text.replace(
    /(<[^>]*\ssrc=(["']))(.*?)(\2[^>]*>)/g,
    (match, prefix, _q, href, suffix) => {
      return rewriteHtmlAttr(match, prefix, href, suffix, xhtmlBookPath, pathMap, false);
    },
  );

  // Rewrite xlink:href="..." attributes (SVG images etc.)
  text = text.replace(
    /(<[^>]*xlink:href=(["']))(.*?)(\2[^>]*>)/g,
    (match, prefix, _q, href, suffix) => {
      return rewriteHtmlAttr(match, prefix, href, suffix, xhtmlBookPath, pathMap, false);
    },
  );

  // Rewrite poster="..." attributes
  text = text.replace(
    /(<[^>]*\sposter=(["']))(.*?)(\2[^>]*>)/g,
    (match, prefix, _q, href, suffix) => {
      return rewriteHtmlAttr(match, prefix, href, suffix, xhtmlBookPath, pathMap, false);
    },
  );

  // Rewrite url() in inline styles
  text = text.replace(
    /(url\(["']?)(.*?)(["']?\))/g,
    (match, pre, url, post) => {
      return rewriteUrl(match, pre, url.trim(), post, xhtmlBookPath, pathMap);
    },
  );

  return text;
}

/** Rewrite a single HTML attribute value (href or src) */
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
  if (!href || href.startsWith('http://') || href.startsWith('https://') || href.startsWith('data:') || href.startsWith('mailto:')) {
    return original;
  }

  let hrefBase = href;
  let fragment = '';
  const hashIdx = href.indexOf('#');
  if (hashIdx >= 0) {
    hrefBase = href.slice(0, hashIdx);
    fragment = href.slice(hashIdx);
  }

  if (!hrefBase) return original; // fragment-only link

  const bookPath = resolveBookPath(hrefBase, basePath);
  const entry = pathMap.get(bookPath);
  if (!entry) return original;

  const dir = CATEGORY_DIR[entry.category];
  const relativePath = `../${dir}/${entry.newBasename}`;

  // For CSS link tags, rewrite the full tag
  if (isHref && hrefBase.toLowerCase().endsWith('.css')) {
    return `<link href="../Styles/${entry.newBasename}" type="text/css" rel="stylesheet"/>`;
  }

  return prefix + relativePath + fragment + suffix;
}

/** Rewrite url() references in CSS or inline styles */
function rewriteUrl(
  original: string,
  pre: string,
  url: string,
  post: string,
  basePath: string,
  pathMap: Map<string, { newBasename: string; category: FileCategory }>,
): string {
  const decoded = decodeURIComponent(url).trim();
  if (!decoded || decoded.startsWith('http://') || decoded.startsWith('https://') || decoded.startsWith('data:')) {
    return original;
  }
  const bookPath = resolveBookPath(decoded, basePath);
  const entry = pathMap.get(bookPath);
  if (!entry) return original;

  const dir = CATEGORY_DIR[entry.category];
  return `${pre}../${dir}/${entry.newBasename}${post}`;
}

/** Rewrite CSS file content — @import and url() references */
function rewriteCss(
  css: string,
  cssBookPath: string,
  pathMap: Map<string, { newBasename: string; category: FileCategory }>,
): string {
  // Rewrite @import
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

  // Rewrite url()
  css = css.replace(
    /(url\(["']?)(.*?)(["']?\))/g,
    (match, pre, url, post) => {
      return rewriteUrl(match, pre, url.trim(), post, cssBookPath, pathMap);
    },
  );

  return css;
}

/** Rewrite NCX toc content references */
function rewriteNcx(
  toc: string,
  tocBookPath: string,
  hrefToNew: Map<string, string>,
): string {
  return toc.replace(
    /src=(["'])(.*?)\1/g,
    (match, quote, rawHref) => {
      const href = decodeURIComponent(rawHref).trim();
      const hashIdx = href.indexOf('#');
      const hrefBase = hashIdx >= 0 ? href.slice(0, hashIdx) : href;
      const fragment = hashIdx >= 0 ? href.slice(hashIdx) : '';

      // NCX src values are relative to the toc file; resolve to bookpath for matching.
      // We build a synthetic OPF reference path based on the toc's directory to resolve
      // opf-relative hrefs from hrefToNew against the same directory tree.
      const tocDir = tocBookPath.slice(0, tocBookPath.lastIndexOf('/') + 1);
      for (const [oldHref, newName] of hrefToNew) {
        const oldBookPath = resolveBookPath(oldHref, tocDir + '_opf_ref');
        const resolvedHref = resolveBookPath(hrefBase, tocBookPath);
        if (oldBookPath === resolvedHref) {
          return `src="Text/${newName}${fragment}"`;
        }
      }
      return match;
    },
  );
}

/** Rebuild OPF with updated manifest hrefs */
function rebuildOpf(
  opf: string,
  manifest: Map<string, ManifestItem>,
  tocId: string,
  pathMap: Map<string, { newBasename: string; category: FileCategory }>,
  opfDir: string,
): string {
  // Build new manifest block
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
      // Keep original href for unmapped items
      manifestText += `\n    <item id="${id}" href="${item.href}" media-type="${item.mediaType}"${props}/>`;
      continue;
    }

    const dir = CATEGORY_DIR[entry.category];
    manifestText += `\n    <item id="${id}" href="${dir}/${entry.newBasename}" media-type="${item.mediaType}"${props}/>`;
  }

  manifestText += '\n  </manifest>';

  // Replace manifest in OPF
  let newOpf = opf.replace(/(?:<manifest[\s\S]*?<\/manifest>)/i, manifestText);

  // Update <reference> hrefs in guide section
  newOpf = newOpf.replace(
    /(<reference[^>]*href=(["']))(.*?)(\2[^>]*\/>)/g,
    (match, prefix, _q, href, suffix) => {
      const decoded = decodeURIComponent(href).trim();
      if (decoded.endsWith('.ncx')) return match;

      // Strip leading relative path segments (./, ../, /)
      let cleaned = decoded;
      if (cleaned.startsWith('/')) cleaned = cleaned.slice(1);
      while (cleaned.startsWith('../')) cleaned = cleaned.slice(3);
      if (cleaned.startsWith('./')) cleaned = cleaned.slice(2);

      // Find in pathMap via opf-relative resolution
      const bookPath = opfDir ? `${opfDir}/${cleaned}` : cleaned;
      const entry = pathMap.get(bookPath);
      if (!entry) return match;
      return `${prefix}Text/${entry.newBasename}${suffix}`;
    },
  );

  return newOpf;
}
