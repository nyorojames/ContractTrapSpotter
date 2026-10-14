import { describe, it, expect } from 'vitest';
import { checkContentScriptText, validateContentScriptFile } from '../scripts/check-content-script';
import path from 'path';
import fs from 'fs';

describe('Content script bundle checker', () => {
  it('fails if content script text contains import or export statements or dynamic import()', () => {
    expect(checkContentScriptText('import { foo } from "./chunk.js";\nconsole.log(foo);').valid).toBe(false);
    expect(checkContentScriptText('export default function() {}').valid).toBe(false);
    expect(checkContentScriptText('const x = import("./dynamic.js");').valid).toBe(false);
  });

  it('passes on valid self-contained IIFE bundle without imports or exports', () => {
    expect(checkContentScriptText('(function() {\n  "use strict";\n  console.log("self-contained");\n})();').valid).toBe(true);
  });

  it('validates built dist/content.js has zero import/export statements', () => {
    const distPath = path.resolve(process.cwd(), 'dist/content.js');
    if (fs.existsSync(distPath)) {
      const result = validateContentScriptFile(distPath);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    }
  });
});
