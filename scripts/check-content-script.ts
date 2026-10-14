import fs from 'fs';
import path from 'path';

export function checkContentScriptText(content: string): { valid: boolean; errors: string[] } {
  const lines = content.split('\n');
  const errors: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('import ') || trimmed.startsWith('export ')) {
      errors.push(`Line ${i + 1} starts with module statement: "${trimmed.slice(0, 80)}"`);
    }
  }

  if (content.includes('import(')) {
    errors.push('File contains dynamic import "import("');
  }

  return { valid: errors.length === 0, errors };
}

export function validateContentScriptFile(filePath: string): { valid: boolean; errors: string[] } {
  if (!fs.existsSync(filePath)) {
    return { valid: false, errors: [`File does not exist: ${filePath}`] };
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  return checkContentScriptText(content);
}

// CLI execution
if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.includes('check-content-script')) {
  const targetPath = path.resolve(process.cwd(), 'dist/content.js');
  console.log(`[check-content-script] Inspecting ${targetPath}...`);
  const result = validateContentScriptFile(targetPath);

  if (!result.valid) {
    console.error('[check-content-script] ERROR: dist/content.js contains forbidden module syntax:');
    result.errors.forEach(err => console.error(`  ${err}`));
    process.exit(1);
  }

  console.log('[check-content-script] SUCCESS: dist/content.js is a self-contained IIFE bundle with 0 import/export statements.');
}
