import sanitizeHtml from 'sanitize-html';

const ALLOWED_TAGS = [
  'html', 'head', 'body', 'title', 'style',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr', 'div', 'span',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
  'b', 'i', 'u', 'strong', 'em', 'mark', 'small', 'del', 'ins', 'sub', 'sup',
  'a', 'img', 'blockquote', 'q', 'cite',
  'header', 'footer', 'main', 'section', 'article', 'aside', 'nav', 'figure', 'figcaption',
];

const ALLOWED_ATTRIBUTES = {
  '*': ['class', 'id', 'style', 'dir', 'lang', 'title'],
  'a': ['href', 'name', 'target', 'rel'],
  'img': ['src', 'alt', 'width', 'height', 'loading'],
  'table': ['border', 'cellpadding', 'cellspacing', 'width'],
  'th': ['colspan', 'rowspan', 'scope'],
  'td': ['colspan', 'rowspan'],
};

/**
 * Sanitizes HTML to prevent XSS while allowing styling and layout tags.
 * This is used for the HTML Document Builder to safely preview and render user HTML.
 */
export function sanitizeUserHtml(dirtyHtml: string): string {
  return sanitizeHtml(dirtyHtml, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowVulnerableTags: true, // Needed to allow <style> tags
    nonTextTags: ['script', 'textarea', 'option', 'noscript'], // Removed 'style' to preserve its content
  });
}
