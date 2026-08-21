export interface ImportedDocument {
  title?: string;
  text: string;
  wordCount: number;
}

export async function parseDocumentFile(file: File): Promise<ImportedDocument> {
  const extension = file.name.split('.').pop()?.toLowerCase() || '';

  if (extension === 'txt' || extension === 'md' || extension === 'markdown') {
    const text = await file.text();
    return {
      title: file.name.replace(/\.[^/.]+$/, ''),
      text: cleanPastedText(text),
      wordCount: countWords(text),
    };
  }

  if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const text = await extractTextFromDocx(arrayBuffer);
    return {
      title: file.name.replace(/\.[^/.]+$/, ''),
      text: cleanPastedText(text),
      wordCount: countWords(text),
    };
  }

  // Fallback as plain text
  const rawText = await file.text();
  return {
    title: file.name,
    text: cleanPastedText(rawText),
    wordCount: countWords(rawText),
  };
}

export function cleanPastedText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Minimal zero-dependency docx XML text extraction
async function extractTextFromDocx(buffer: ArrayBuffer): Promise<string> {
  try {
    // DOCX files are zip archives containing word/document.xml
    const bytes = new Uint8Array(buffer);
    const textDecoder = new TextDecoder('utf-8');
    const content = textDecoder.decode(bytes);

    // Search for XML paragraph tags (<w:p>) and text tags (<w:t>)
    const textMatches = content.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
    if (textMatches && textMatches.length > 0) {
      return textMatches
        .map((m) => m.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, ''))
        .join(' ')
        .replace(/\s+/g, ' ');
    }
    return '';
  } catch {
    return '';
  }
}
