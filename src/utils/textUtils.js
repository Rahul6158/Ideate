/**
 * Strips markdown formatting to produce clean, natural human-readable plain text
 * for reply chips, previews, toasts, and input composer references.
 */
export function stripMarkdown(markdown = '') {
  if (!markdown || typeof markdown !== 'string') return '';

  let text = markdown;

  // 1. Remove code blocks
  text = text.replace(/```[\s\S]*?```/g, ' [code] ');

  // 2. Remove inline code
  text = text.replace(/`([^`]+)`/g, '$1');

  // 3. Remove markdown tables (lines starting and ending with |)
  text = text.replace(/^\|.*\|$/gm, '');
  text = text.replace(/\|/g, ' ');

  // 4. Remove headings (#, ##, ###)
  text = text.replace(/^#{1,6}\s+/gm, '');

  // 5. Remove blockquotes (> )
  text = text.replace(/^>\s+/gm, '');

  // 6. Remove horizontal dividers
  text = text.replace(/^---+$/gm, '');

  // 7. Remove bold and italic formatting (**bold**, *italic*, __bold__, _italic_)
  text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
  text = text.replace(/\*([^*]+)\*/g, '$1');
  text = text.replace(/__([^_]+)__/g, '$1');
  text = text.replace(/_([^_]+)_/g, '$1');

  // 8. Remove markdown links: [text](url) -> text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 9. Remove image tags: ![alt](url) -> [Image]
  text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

  // 10. Clean up bullet list markers (- , * , 1. )
  text = text.replace(/^[\s]*[-*+]\s+/gm, '');
  text = text.replace(/^[\s]*\d+\.\s+/gm, '');

  // 11. Collapse multiple newlines and spaces
  text = text.replace(/\n+/g, ' ');
  text = text.replace(/\s{2,}/g, ' ');

  // 12. Clean up any lingering isolated asterisks
  text = text.replace(/\*{2,}/g, '');

  return text.trim();
}

/**
 * Truncates text cleanly at word boundaries
 */
export function truncateClean(text = '', maxLength = 100) {
  if (!text || text.length <= maxLength) return text;
  const stripped = stripMarkdown(text);
  if (stripped.length <= maxLength) return stripped;
  const sub = stripped.slice(0, maxLength);
  const lastSpace = sub.lastIndexOf(' ');
  return (lastSpace > 30 ? sub.slice(0, lastSpace) : sub) + '...';
}
