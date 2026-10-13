/**
 * Split long documents into overlapping chunks with stable character offsets.
 */

export interface TextChunk {
  text: string;
  startOffset: number;
  endOffset: number;
  index: number;
  totalChunks: number;
}

/**
 * Split text into overlapping chunks.
 * @param text - The full document text
 * @param chunkSize - Target size of each chunk in characters (default: 12000)
 * @param overlap - Overlap between chunks in characters (default: 500)
 */
export function chunkText(
  text: string,
  chunkSize: number = 12000,
  overlap: number = 500
): TextChunk[] {
  if (text.length <= chunkSize) {
    return [{
      text,
      startOffset: 0,
      endOffset: text.length,
      index: 0,
      totalChunks: 1,
    }];
  }

  const chunks: TextChunk[] = [];
  let startOffset = 0;

  while (startOffset < text.length) {
    let endOffset = Math.min(startOffset + chunkSize, text.length);

    // Try to break at a paragraph or sentence boundary
    if (endOffset < text.length) {
      const searchStart = endOffset - 200;
      const searchEnd = endOffset + 200;
      const searchRegion = text.substring(searchStart, Math.min(searchEnd, text.length));

      // Prefer paragraph break
      const paraBreak = searchRegion.lastIndexOf('\n\n');
      if (paraBreak !== -1) {
        endOffset = searchStart + paraBreak + 2;
      } else {
        // Fall back to sentence break
        const sentenceBreak = searchRegion.search(/\.\s+[A-Z]/);
        if (sentenceBreak !== -1) {
          endOffset = searchStart + sentenceBreak + 1;
        }
      }
    }

    chunks.push({
      text: text.substring(startOffset, endOffset),
      startOffset,
      endOffset,
      index: chunks.length,
      totalChunks: 0, // Will be set after
    });

    startOffset = endOffset - overlap;
    if (startOffset >= text.length) break;
  }

  // Set totalChunks
  for (const chunk of chunks) {
    chunk.totalChunks = chunks.length;
  }

  return chunks;
}
