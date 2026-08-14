/**
 * Tests for sanitizeUserContent: the sanitizer backing task titles,
 * descriptions and comments.
 *
 * Two obligations pull against each other here. Vikunja stores these fields as
 * raw HTML and sanitizes nothing of its own, so active markup must not survive.
 * But they are also free text, and the previous filter — built for filter
 * values — rejected entire calls over a '#' or the word "update", which made
 * writing an ordinary bug report impossible.
 */

import {
  sanitizeUserContent,
  MAX_TITLE_LENGTH,
  MAX_USER_CONTENT_LENGTH,
} from '../../src/utils/validation';
import { MCPError } from '../../src/types/errors';

describe('sanitizeUserContent', () => {
  describe('ordinary prose survives untouched', () => {
    // Every one of these was rejected outright by the previous filter.
    const prose = [
      'incidencia #123 pendiente',
      'ejecutar con la opcion --verbose',
      'usar `npm install` antes de compilar',
      'update del pipeline nocturno',
      'create de la tabla de hechos',
      'revisar el constructor de la clase',
      'ruta relativa ../config/ajustes.yml',
      'aviso ⚠️ y visto ✅',
      'condicion a || b',
      'la variable $env: no esta definida',
      'ver url(https://ejemplo.com) en la hoja',
      'conexion SSH al servidor de produccion',
      'descargar con curl y wget',
    ];

    it.each(prose)('leaves %p exactly as written', (text) => {
      expect(sanitizeUserContent(text)).toBe(text);
    });
  });

  describe('formatting HTML is preserved', () => {
    it('keeps the markup Vikunja itself renders', () => {
      const html =
        '<p>Con <strong>negrita</strong>, <em>cursiva</em> y <code>codigo</code>.</p>' +
        '<ul><li>Uno</li><li>Dos</li></ul>' +
        '<a href="https://ejemplo.com/ruta?a=1">enlace</a>' +
        '<pre><code>curl -s https://api.ejemplo.com</code></pre>';

      expect(sanitizeUserContent(html)).toBe(html);
    });
  });

  describe('active markup is stripped', () => {
    it('removes script elements along with their contents', () => {
      const result = sanitizeUserContent('<p>antes</p><script>alert(1)</script><p>despues</p>');
      expect(result).toBe('<p>antes</p><p>despues</p>');
      expect(result).not.toContain('alert');
    });

    it('removes inline event handlers but keeps the element', () => {
      expect(sanitizeUserContent('<img src="foto.png" onerror="alert(1)">')).toBe(
        '<img src="foto.png">'
      );
      expect(sanitizeUserContent("<p onclick='malo()'>texto</p>")).toBe('<p>texto</p>');
    });

    it('removes iframe, object, style and resource-loading tags', () => {
      expect(sanitizeUserContent('<iframe src="http://malo"></iframe>ok')).toBe('ok');
      expect(sanitizeUserContent('<style>body{display:none}</style>ok')).toBe('ok');
      expect(sanitizeUserContent('<link rel="stylesheet" href="http://malo">ok')).toBe('ok');
    });

    it('strips script schemes inside URL attributes', () => {
      expect(sanitizeUserContent('<a href="javascript:alert(1)">x</a>')).toBe('<a href="">x</a>');
    });

    it('but leaves the same word alone in prose', () => {
      const text = 'el esquema javascript: no se puede usar en enlaces';
      expect(sanitizeUserContent(text)).toBe(text);
    });
  });

  describe('length limits', () => {
    it('accepts content up to the maximum', () => {
      expect(sanitizeUserContent('a'.repeat(MAX_USER_CONTENT_LENGTH))).toHaveLength(
        MAX_USER_CONTENT_LENGTH
      );
    });

    it('rejects content beyond the maximum', () => {
      expect(() => sanitizeUserContent('a'.repeat(MAX_USER_CONTENT_LENGTH + 1))).toThrow(MCPError);
    });

    it('applies the stricter title limit when asked', () => {
      expect(() => sanitizeUserContent('a'.repeat(MAX_TITLE_LENGTH + 1), MAX_TITLE_LENGTH)).toThrow(
        MCPError
      );
      // ...and the same text is fine as a description
      expect(sanitizeUserContent('a'.repeat(MAX_TITLE_LENGTH + 1))).toHaveLength(
        MAX_TITLE_LENGTH + 1
      );
    });
  });

  it('rejects non-string input', () => {
    expect(() => sanitizeUserContent(42 as unknown as string)).toThrow(MCPError);
  });
});
