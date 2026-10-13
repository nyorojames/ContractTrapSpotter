import { describe, it, expect } from 'vitest';
import { chunkText } from './chunker';

describe('Document Chunker', () => {
  it('returns a single chunk if document is shorter than chunkSize', () => {
    const text = 'This is a short Terms of Service document.';
    const chunks = chunkText(text, 1000, 100);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text).toBe(text);
    expect(chunks[0].startOffset).toBe(0);
    expect(chunks[0].endOffset).toBe(text.length);
    expect(chunks[0].totalChunks).toBe(1);
  });

  it('splits long documents into overlapping chunks with stable offsets', () => {
    const paragraph = 'Clause: User data collection and processing rules for analytics.\n\n';
    const longText = paragraph.repeat(50); // ~3300 chars
    const chunks = chunkText(longText, 1000, 200);

    expect(chunks.length).toBeGreaterThan(1);
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].index).toBe(i);
      expect(chunks[i].totalChunks).toBe(chunks.length);
      expect(chunks[i].text.length).toBeGreaterThan(0);
      if (i > 0) {
        // Confirm overlap
        expect(chunks[i].startOffset).toBeLessThan(chunks[i - 1].endOffset);
      }
    }
  });
});
