# Textos y generador del sitio

Todo el HTML de `web/` (landing, `agendar/`, `gracias/`, `cookies/`, en los 4 idiomas) está **generado**. No lo edites a mano: se sobrescribe cada vez que se ejecuta el generador. `web/` es la carpeta que se publica y el HTML generado se sube al repositorio (el hosting no ejecuta ningún build).

## Qué se edita
- `fuente/plantilla.html` (landing), `fuente/agendar.html`, `fuente/gracias.html`, `fuente/cookies.html`: estructura, CSS y script de cada página, con marcadores `{{seccion.clave}}` en lugar de textos.
- `fuente/textos/<idioma>.json`: todos los textos de ese idioma (`es.json`, `en.json`, `fr.json`, `it.json`).

- `fuente/parciales/`: trozos compartidos que se insertan con `<!--#incluir nombre-->` (cabecera, pie, CSS base, @font-face, bloque de consentimiento).
- `web/js/consentimiento.js` y `web/css/consentimiento.css`: banner de cookies y carga condicionada de GA4/Meta Pixel. Se editan a mano (no son generados); sus textos vienen de la sección `consentimiento` de cada JSON.

## Generar
```
python3 fuente/generar.py
```
Solo necesita Python 3.9+ (biblioteca estándar). `es.json` produce `web/index.html`; cualquier otro `xx.json` produce `web/xx/index.html` (y lo mismo para `agendar/`, `gracias/`, `cookies/`). `--salida DIR` escribe en otra carpeta. Si falta un idioma, se omite y se avisa.

- **Error** (código de salida 1, ese idioma no se genera): la plantilla usa una clave que el JSON no tiene (se listan todas), un valor no es texto, falta algún campo de `formato`, o los marcadores `{n}`, `{nombre}`, `{interes}` de `js` no coinciden con los del español.
- **Aviso**: el JSON tiene claves que la plantilla no usa.

## Reglas de los marcadores
- `{{seccion.clave}}`: busca `clave` dentro de `seccion` en el JSON. Las secciones son `consentimiento, agendar, agendar_js, gracias, gracias_js, cookies, meta, nav, portada, pruebas, que_es, villas, bienestar, trayectoria, caso, numeros, gestion, compra, legal, lombok, equipo, visita, preguntas, contacto, pie, js` (más `formato`).
- **Los valores se insertan tal cual, sin escapar.** Pueden llevar HTML (`<b>`, `<em>`, `<br>`, `<a href="#contacto">`); no dejes etiquetas sin cerrar. Dentro de atributos (`alt`, `aria-label`, `placeholder`) no uses comillas dobles: escribe `&quot;`.
- Excepción: `meta.titulo` y `meta.descripcion` son texto plano y se escapan solos (`&`, `<`, `>`, `"`). `meta.ld_*` van al JSON-LD y también se escapan solos.
- Rutas, idioma, canonical, hreflang, Open Graph y el selector de idiomas los genera el script; no tienen clave.
- Los números que ve el usuario (precios, 76,9%, 9,3, 140.324, +19%) son texto de cada idioma: formatéalos como se hace en ese idioma. Los valores de `numeros.fila*` y `numeros.escenario*` se muestran antes de que el JS los recalcule.
- Las opciones del selector `contacto.interes_*` se usan a la vez como texto de `<option>` y como `data-interes` de los enlaces "Consultar": una sola clave por opción, así siempre coinciden.

## Bloque `formato`
```json
"formato": { "locale": "es-ES", "decimal": ",", "miles": ".", "euro": "{n} €" }
```
Lo usa el script para los números animados y los escenarios de `#numeros`. Los textos animados (`.cifra`) deben seguir este formato para que la animación termine exactamente en el texto escrito. `euro` debe contener `{n}`. En francés, `miles` es un espacio fino (U+202F).

## Sección `js`
Textos que usa el script (menú, formulario, `porcentaje`, `recupero`). `{n}`, `{total}` y `{lista}` son marcadores que el script sustituye: consérvalos tal cual.

## Añadir un idioma
Copia `es.json` a `en.json` (o `fr`, `it`), traduce los valores, ajusta `formato` y ejecuta el generador.

## Seguimiento y formulario
Los valores de las opciones de `agendar.html` (`Villa completa`, `Menos de 36.800 €`...) van siempre en español: son los que recibe Kommo. Solo se traducen las etiquetas. Los eventos (GA4, Meta Pixel, CAPI) solo se disparan con el consentimiento correspondiente; el envío a `/marlaca/form` y a la hoja de Google no dependen de él.
