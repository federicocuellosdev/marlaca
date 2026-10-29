# Marlaca Real Estate · landing

Landing de Marlaca Real Estate en 4 idiomas (es, en, fr, it), con su flujo de captación de leads (`agendar` → Kommo) y política de cookies con consentimiento.

## Qué se publica
**`web/` es lo que se publica**, tal cual, como ficheros estáticos. El HTML generado se sube al repositorio: el hosting no ejecuta ningún build. Lo que hay en `main` es lo que está en vivo.

## Cómo editar
- **Textos**: `fuente/textos/{es,en,fr,it}.json`. Un archivo por idioma, mismas claves.
- **Estructura y estilos**: `fuente/plantilla.html` (landing), `fuente/agendar.html`, `fuente/gracias.html`, `fuente/cookies.html` y `fuente/parciales/`.
- **Banner de cookies y seguimiento**: `web/js/consentimiento.js` y `web/css/consentimiento.css` (se editan directamente).

Después de cambiar cualquier cosa de `fuente/`, regenera el sitio:

```
python3 fuente/generar.py
```

Solo hace falta Python 3.9+. Debe terminar sin avisos. Revisa el cambio en `web/` y haz commit de `fuente/` y `web/` juntos. No edites a mano los `index.html` de `web/`: se sobrescriben.

Más detalle sobre marcadores, claves y reglas en `fuente/LEEME.md`.

## Vista previa local
```
python3 -m http.server 8000 --directory web
```
