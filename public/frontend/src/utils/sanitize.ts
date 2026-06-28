const ALLOWED = new Set([
  'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li',
  'a', 'br', 'p', 'div', 'span',
]);

function sanitizeNode(node: Node): void {
  const children = [...node.childNodes];
  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const tag = el.tagName.toLowerCase();

      if (!ALLOWED.has(tag)) {
        while (el.firstChild) node.insertBefore(el.firstChild, el);
        node.removeChild(el);
        continue;
      }

      // Strip all attributes except allowed ones
      const allowedAttrs = tag === 'a' ? ['href', 'target', 'rel'] : [];
      for (const attr of [...el.attributes]) {
        if (!allowedAttrs.includes(attr.name)) el.removeAttribute(attr.name);
      }

      if (tag === 'a') {
        const href = el.getAttribute('href') ?? '';
        if (/^javascript:/i.test(href)) el.removeAttribute('href');
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      }

      sanitizeNode(el);
    }
  }
}

export function sanitizeHtml(html: string): string {
  if (!html || !html.trim()) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  sanitizeNode(doc.body);
  return doc.body.innerHTML;
}
