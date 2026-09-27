import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitiza HTML que proviene del usuario (descripciones de tarjetas, etc.).
 * Elimina scripts, manejadores de eventos (onerror, onclick…), iframes y
 * cualquier contenido peligroso, conservando el formato permitido.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p",
      "br",
      "strong",
      "b",
      "em",
      "i",
      "s",
      "strike",
      "u",
      "code",
      "pre",
      "h1",
      "h2",
      "h3",
      "ul",
      "ol",
      "li",
      "blockquote",
      "a",
      "hr",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "class"],
    ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
  });
}

/** ¿El HTML sanitizado cambia respecto al original (contenido peligroso)? */
export function hasUnsafeHtml(html: string | null | undefined): boolean {
  if (!html) return false;
  return sanitizeHtml(html) !== html;
}
