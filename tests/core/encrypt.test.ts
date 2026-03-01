/**
 * Encrypt 模块单元测试
 */
import { describe, it, expect, afterAll } from 'vitest';
import { encryptEpub } from '../../packages/core/src/crypto/encrypt.js';
import { createRequire } from 'node:module';
import { writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const JSZip = require('../../packages/core/node_modules/jszip') as typeof import('jszip').default;

describe('Encrypt', () => {
  it('encryptEpub should be exported and be a function', () => {
    expect(encryptEpub).toBeDefined();
    expect(typeof encryptEpub).toBe('function');
  });

  describe('integration: encrypt a minimal EPUB', () => {
    const inputPath = join(tmpdir(), `test-input-${Date.now()}.epub`);
    const outputPath = join(tmpdir(), `test-output-${Date.now()}.epub`);

    afterAll(async () => {
      await rm(inputPath, { force: true });
      await rm(outputPath, { force: true });
    });

    it('should encrypt file names in the EPUB', async () => {
      // Create minimal EPUB
      const zip = new JSZip();
      zip.file('mimetype', 'application/epub+zip');
      zip.file(
        'META-INF/container.xml',
        `<?xml version="1.0"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
      );
      zip.file(
        'OEBPS/content.opf',
        `<?xml version="1.0" encoding="UTF-8"?>
<package version="2.0" xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:title>Test Book</dc:title>
    <dc:language>en</dc:language>
    <dc:identifier id="BookId">test-123</dc:identifier>
  </metadata>
  <manifest>
    <item id="chapter1.xhtml" href="Text/chapter1.xhtml" media-type="application/xhtml+xml"/>
    <item id="style.css" href="Styles/style.css" media-type="text/css"/>
  </manifest>
  <spine>
    <itemref idref="chapter1.xhtml"/>
  </spine>
</package>`,
      );
      zip.file(
        'OEBPS/Text/chapter1.xhtml',
        `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><link href="../Styles/style.css" rel="stylesheet" type="text/css"/></head>
<body><p>Hello World</p></body>
</html>`,
      );
      zip.file('OEBPS/Styles/style.css', 'body { color: black; }');

      const buf = await zip.generateAsync({ type: 'nodebuffer' });
      await writeFile(inputPath, buf);

      const result = await encryptEpub(inputPath, { outputPath });

      expect(result.success).toBe(true);
      expect(result.filesEncrypted).toBeGreaterThan(0);

      // Read output and verify encrypted file names
      const outBuf = await readFile(outputPath);
      const outZip = await JSZip.loadAsync(outBuf);
      const filenames = Object.keys(outZip.files);

      // Encrypted names should contain * and : characters
      const encryptedFiles = filenames.filter(
        (f) => f.includes('*') || f.includes(':'),
      );
      expect(encryptedFiles.length).toBeGreaterThan(0);
    });
  });
});
