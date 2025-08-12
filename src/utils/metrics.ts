export interface TextMetrics {
  words: number;
  characters: number;
  charactersNoSpaces: number;
  paragraphs: number;
  readingTime: number; // in minutes
}

export function calculateMetrics(text: string): TextMetrics {
  if (!text.trim()) {
    return {
      words: 0,
      characters: 0,
      charactersNoSpaces: 0,
      paragraphs: 0,
      readingTime: 0
    };
  }

  // Word count - split by whitespace and filter empty strings
  const words = text.trim().split(/\s+/).filter(word => word.length > 0).length;
  
  // Character counts
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, '').length;
  
  // Paragraph count - split by double newlines (markdown paragraphs)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0).length;
  
  // Reading time - average 200 words per minute
  const readingTime = Math.ceil(words / 200);
  
  return {
    words,
    characters,
    charactersNoSpaces,
    paragraphs,
    readingTime
  };
}