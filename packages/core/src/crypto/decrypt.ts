/**
 * 文件名解密（反混淆）
 * TS 重写 decrypt_epub.py
 */
import { createHash } from 'node:crypto';
import path from 'node:path';
import { EpubParser, type ManifestItem } from '../epub/parser.js';
import { EpubWriter } from '../epub/writer.js';
import { logger } from '../utils/logger.js';
import type JSZip from 'jszip';

export interface DecryptOptions {
  /** 输出路径 */
  outputPath: string;
  /** 模糊匹配阈值 (0-1, 默认 0.6) */
  similarityThreshold?: number;
}

export interface DecryptResult {
  success: boolean;
  filesDecrypted: number;
  mapping: Map<string, string>;
}

// ---- constants shared with encrypt.ts ----

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

const INVALID_CHARS = /[\\/:*?"<>|]/;

// ---- helpers ----

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

/**
 * Reverse the encrypted filename from the manifest item ID.
 *
 * Rules (mirroring the Python `creatNewHerf`):
 *  - If the ID has no '.' → use the whole ID as the name, keep extension from href.
 *  - If the ID has a '.' → split into idName + idExt; prefer idExt unless it
 *    disagrees with the href extension, in which case use href extension.
 *  - Handle "slim" suffix for multi-resolution images.
 *  - If the derived name contains invalid filesystem chars, fall back to MD5.
 */
function buildDecryptedFilename(id: string, href: string): string {
  const hrefExt = path.extname(href).toLowerCase(); // e.g. '.xhtml'

  const dotIdx = id.indexOf('.');
  if (dotIdx < 0) {
    // ID has no extension
    let idName = id;
    let slimSuffix = '';
    if (idName.toLowerCase().endsWith('slim')) {
      slimSuffix = '~slim';
      idName = stripSlimSuffix(idName);
    }
    return `${idName}${slimSuffix}${hrefExt}`;
  }

  // ID has extension, e.g. "chapter1.xhtml"
  const lastDot = id.lastIndexOf('.');
  let idName = id.slice(0, lastDot);
  let idExt = id.slice(lastDot); // includes dot

  // If ID ext disagrees with href ext, prefer href ext
  if (idExt.toLowerCase() !== hrefExt.toLowerCase()) {
    idExt = hrefExt;
  }

  // Handle slim suffix
  let slimSuffix = '';
  const hrefBase = path.basename(href, path.extname(href));
  if (hrefBase.toLowerCase().endsWith('slim') || idName.toLowerCase().endsWith('slim')) {
    slimSuffix = '~slim';
    idName = stripSlimSuffix(idName);
  }

  // If idName contains invalid characters, MD5-hash it
  if (INVALID_CHARS.test(idName)) {
    logger.debug(`ID "${id}" contains invalid filesystem characters, using MD5 fallback`);
    idName = createHash('md5').update(idName).digest('hex');
  }

  return `${idName}${slimSuffix}${idExt.toLowerCase()}`;
}

/** Remove various slim suffixes from the end of a string */
function stripSlimSuffix(s: string): string {
  return s
    .replace(/~slim$/i, '')
    .replace(/-slim$/i, '')
    .replace(/_slim$/i, '')
    .replace(/slim$/i, '');
}

/**
 * Resolve a relative href against a base file path to get the book-path.
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
  while (parts.length > 0 && parts[0] === '.') {
    parts.shift();
  }

  if (backSteps >= baseParts.length) {
    return parts.join('/');
  }
  const base = baseParts.slice(0, baseParts.length - backSteps);
  return [...base, ...parts].join('/');
}

// ---- main ----

/**
 * 对 EPUB 文件进行文件名解密（反混淆）
 */
export async function decryptEpub(
  epubPath: string,
  options: DecryptOptions,
): Promise<DecryptResult> {
  const parsed = await EpubParser.fromFile(epubPath);
  const { zip, manifest, spine, opfPath, opfDir, rawOpf } = parsed;

  // Detect NCX toc id from spine
  const tocIdMatch = rawOpf.match(/<spine[^>]*toc="([^"]+)"/);
  const tocId = tocIdMatch ? tocIdMatch[1] : '';

  // pathMap: old bookpath → { newBasename, category }
  const pathMap = new Map<string, { newBasename: string; category: FileCategory }>();
  // hrefToNew: old opf-relative href → new decrypted basename (for NCX rewriting)
  const hrefToNew = new Map<string, string>();

  const usedNames = new Map<FileCategory, Set<string>>();
  for (const cat of Object.keys(CATEGORY_DIR) as FileCategory[]) {
    usedNames.set(cat, new Set());
  }

  let tocBookPath = '';

  for (const [id, item] of manifest) {
    // Skip NCX toc — handle separately
    if (tocId && id === tocId) {
      tocBookPath = opfDir ? `${opfDir}/${item.href}` : item.href;
      continue;
    }

    const category = classifyItem(item);
    let newName = buildDecryptedFilename(id, item.href);

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

    logger.debug(`decrypt: ${id}:${item.href} → ${newName}`);
  }

  // Build new zip
  const JSZipModule = (await import('jszip')).default;
  const newZip: JSZip = new JSZipModule();

  // mimetype
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

  logger.info(`Decrypted ${pathMap.size} files → ${options.outputPath}`);

  return {
    success: true,
    filesDecrypted: pathMap.size,
    mapping: new Map(
      [...pathMap].map(([k, v]) => [k, `OEBPS/${CATEGORY_DIR[v.category]}/${v.newBasename}`]),
    ),
  };
}

// --------------- Rewrite helpers ---------------

/** Rewrite href/src/xlink:href references in XHTML content */
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
      rewriteUrl(match, pre, url.trim(), post, xhtmlBookPath, pathMap),
  );

  return text;
}

/** Rewrite a single HTML attribute value */
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
  if (!hrefBase) return original; // fragment-only

  const bookPath = resolveBookPath(hrefBase, basePath);
  const entry = pathMap.get(bookPath);
  if (!entry) return original;

  const dir = CATEGORY_DIR[entry.category];
  const relativePath = `../${dir}/${entry.newBasename}`;

  // CSS link tags
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
      rewriteUrl(match, pre, url.trim(), post, cssBookPath, pathMap),
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
