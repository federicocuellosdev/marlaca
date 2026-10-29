#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Genera las páginas del sitio a partir de las plantillas de fuente/ + fuente/textos/<idioma>.json.

  python3 fuente/generar.py                # escribe en web/ (la carpeta que se publica)
  python3 fuente/generar.py --salida DIR   # escribe en otra carpeta (pruebas)

Páginas por idioma (es en la raíz del sitio, el resto bajo /<idioma>/):
  plantilla.html -> /            agendar.html -> /agendar/
  gracias.html   -> /gracias/    cookies.html -> /cookies/

- es.json  -> index.html (raíz)
- xx.json  -> xx/index.html (en, fr, it...)
Solo biblioteca estándar (Python 3.9+). Ver fuente/LEEME.md.
"""
import html, json, os, re, sys
from urllib.parse import quote

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)
SALIDA = os.path.join(RAIZ, "web")   # lo que publica el hosting
TEXTOS = os.path.join(AQUI, "textos")
PARCIALES = os.path.join(AQUI, "parciales")
DOMINIO = "https://marlacarealestate.com"
IDIOMAS = [("es", "ES", "Español"), ("en", "EN", "English"), ("fr", "FR", "Français"), ("it", "IT", "Italiano")]
BASE_LANG = "es"  # idioma de referencia (raíz del sitio)

# (clave de página, plantilla, carpeta dentro del idioma, sección de textos del script)
PAGINAS = [
    ("inicio", "plantilla.html", "", "js"),
    ("agendar", "agendar.html", "agendar", "agendar_js"),
    ("gracias", "gracias.html", "gracias", "gracias_js"),
    ("cookies", "cookies.html", "cookies", None),
]

# {{seccion.clave}} o {{seccion.clave|filtro}}; las reservadas no llevan punto
PH = re.compile(r"\{\{\s*([A-Za-z_][\w.]*)(?:\|(\w+))?\s*\}\}")
TXT = re.compile(r"\bTXT\.([A-Za-z_]\w*)")
TOKENS = re.compile(r"\{[a-z_]+\}")
INCLUIR = re.compile(r"<!--#incluir\s+([\w.\-]+)\s*-->")
RESERVADAS = {"lang", "locale", "url", "base", "inicio", "hreflang_tags", "og_alternos", "selector_idiomas",
              "idioma_sigla", "idioma_nombre", "formato_json", "js_json", "consent_json", "pagina",
              "url_inicio", "url_agendar", "url_gracias", "url_cookies"}
# Claves de la sección consentimiento que lee web/js/consentimiento.js (toda la sección viaja como JSON)
CLAVES_CONSENTIMIENTO = ["titulo", "texto", "aceptar", "rechazar", "configurar", "politica_enlace", "panel_titulo",
                         "panel_intro", "cat_tecnicas", "cat_tecnicas_desc", "cat_analitica", "cat_analitica_desc",
                         "cat_publicidad", "cat_publicidad_desc", "siempre_activas", "guardar"]


def hojas(d, pref=""):
    """Claves de hoja 'a.b.c' -> valor."""
    for k, v in d.items():
        if isinstance(v, dict):
            yield from hojas(v, pref + k + ".")
        else:
            yield pref + k, v


def carpeta(pagina, lang):
    """Carpeta de salida relativa a la raíz del sitio ('' = raíz)."""
    sub = next(c for p, _, c, _ in PAGINAS if p == pagina)
    return "/".join(x for x in ((lang if lang != BASE_LANG else ""), sub) if x)


def url_de(pagina, lang):
    c = carpeta(pagina, lang)
    return DOMINIO + "/" + (c + "/" if c else "")


def rel(desde, hacia):
    """Enlace relativo entre dos carpetas del sitio, con barra final."""
    r = os.path.relpath(hacia or ".", desde or ".")
    return "./" if r == "." else r + "/"


def prefijo_base(pagina, lang):
    c = carpeta(pagina, lang)
    return "../" * len([x for x in c.split("/") if x])


def js_json(obj):
    s = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    return s.replace("</", "<\\/").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def cargar(ruta):
    with open(ruta, encoding="utf-8") as f:
        return json.load(f)


LOC = {"es": "es_ES", "en": "en_GB", "fr": "fr_FR", "it": "it_IT"}


def loc_de(c):
    return LOC.get(c, c)


def reservadas(pagina, lang, datos):
    c0 = carpeta(pagina, lang)
    base = prefijo_base(pagina, lang)
    loc = datos.get("formato", {}).get("locale", "").replace("-", "_")
    hl = ['<link rel="alternate" hreflang="%s" href="%s">' % (c, url_de(pagina, c)) for c, _, _ in IDIOMAS]
    hl.append('<link rel="alternate" hreflang="x-default" href="%s">' % url_de(pagina, BASE_LANG))
    otros = ['<meta property="og:locale:alternate" content="%s">' % loc_de(c) for c, _, _ in IDIOMAS if c != lang]
    sel = []
    for c, sigla, nombre in IDIOMAS:
        href = rel(c0, carpeta(pagina, c))
        act = ' aria-current="true"' if c == lang else ""
        sel.append('<li><a href="%s" hreflang="%s" lang="%s"%s>%s<span aria-hidden="true">%s</span></a></li>' % (href, c, c, act, nombre, sigla))
    sigla_act, nombre_act = next((s, n) for c, s, n in IDIOMAS if c == lang)
    url_inicio = rel(c0, carpeta("inicio", lang))
    consent = dict(datos.get("consentimiento", {}))
    consent["politica_url"] = rel(c0, carpeta("cookies", lang))
    ns = next(j for p, _, _, j in PAGINAS if p == pagina)
    return {
        "lang": lang, "locale": loc, "url": url_de(pagina, lang), "base": base, "inicio": url_inicio, "pagina": pagina,
        "url_inicio": url_inicio,
        "url_agendar": rel(c0, carpeta("agendar", lang)),
        "url_gracias": rel(c0, carpeta("gracias", lang)),
        "url_cookies": rel(c0, carpeta("cookies", lang)),
        "hreflang_tags": "\n".join(hl),
        "og_alternos": "\n".join(otros),
        "selector_idiomas": "".join(sel),
        "idioma_sigla": sigla_act, "idioma_nombre": nombre_act,
        "formato_json": js_json(datos.get("formato", {})),
        "js_json": js_json(datos.get(ns, {})) if ns else "{}",
        "consent_json": js_json(consent),
    }


def buscar(datos, clave):
    cur = datos
    for p in clave.split("."):
        if not isinstance(cur, dict) or p not in cur:
            return None
        cur = cur[p]
    return cur


def expandir(texto):
    """Sustituye <!--#incluir x.css--> por el contenido de fuente/parciales/x.css."""
    def f(m):
        with open(os.path.join(PARCIALES, m.group(1)), encoding="utf-8") as fh:
            return fh.read().rstrip("\n")
    return INCLUIR.sub(f, texto)


def cargar_plantillas():
    out = {}
    for pagina, archivo, _, ns in PAGINAS:
        with open(os.path.join(AQUI, archivo), encoding="utf-8") as f:
            out[pagina] = expandir(f.read())
    return out


def pedidas_de(plantilla, ns):
    pedidas = set()
    for m in PH.finditer(plantilla):
        if m.group(1) not in RESERVADAS:
            pedidas.add(m.group(1))
    if ns:
        for m in TXT.finditer(plantilla):
            pedidas.add(ns + "." + m.group(1))
    return pedidas


def generar(pagina, lang, datos, plantilla):
    """Devuelve (html, errores). Los avisos se calculan aparte, sobre la unión de todas las páginas."""
    errores = []
    ns = next(j for p, _, _, j in PAGINAS if p == pagina)
    res = reservadas(pagina, lang, datos)
    pedidas = pedidas_de(plantilla, ns)

    faltan = []
    for k in sorted(pedidas):
        v = buscar(datos, k)
        if v is None:
            faltan.append(k)
        elif not isinstance(v, str):
            errores.append("valor no es texto: " + k)
    if faltan:
        errores.append("%s: faltan %d claves usadas por la plantilla:\n    " % (pagina, len(faltan)) + "\n    ".join(faltan))
    if errores:
        return None, errores

    def sub(m):
        k, filtro = m.group(1), m.group(2)
        if k in RESERVADAS:
            return res[k]
        v = buscar(datos, k)
        if filtro == "attr":
            return html.escape(v, quote=True)
        if filtro == "url":
            return quote(v, safe="")
        if filtro == "json":
            return json.dumps(v, ensure_ascii=False)[1:-1]
        if filtro:
            raise ValueError("filtro desconocido: " + filtro)
        return v  # texto crudo: puede llevar HTML (ver LEEME.md)

    return PH.sub(sub, plantilla), errores


def validar_idioma(lang, datos, ref):
    """Comprobaciones por idioma (no por página)."""
    errores = []
    f = datos.get("formato", {})
    for c in ("locale", "decimal", "miles", "euro"):
        if not isinstance(f.get(c), str) or not f.get(c):
            errores.append("formato.%s ausente o vacío" % c)
    if "{n}" not in str(f.get("euro", "")):
        errores.append("formato.euro debe contener {n}")
    for k in CLAVES_CONSENTIMIENTO:
        if not isinstance(buscar(datos, "consentimiento." + k), str):
            errores.append("falta consentimiento." + k)
    # marcadores {nombre} {n} {total} de los textos de script: deben coincidir con los del idioma base
    if ref and lang != BASE_LANG:
        for ns in ("js", "agendar_js", "gracias_js"):
            for k, v in hojas(ref.get(ns, {})):
                w = buscar(datos, ns + "." + k)
                if isinstance(w, str) and set(TOKENS.findall(v)) != set(TOKENS.findall(w)):
                    errores.append("%s.%s: marcadores distintos al idioma base (%s)" % (ns, k, " ".join(sorted(set(TOKENS.findall(v))))))
    return errores


def main():
    args = sys.argv[1:]
    salida = SALIDA
    if "--salida" in args:
        salida = os.path.abspath(args[args.index("--salida") + 1])
    plantillas = cargar_plantillas()
    presentes = sorted(f[:-5] for f in os.listdir(TEXTOS) if f.endswith(".json"))
    if BASE_LANG not in presentes:
        print("ERROR: falta fuente/textos/%s.json (idioma base)" % BASE_LANG, file=sys.stderr)
        return 1
    ref = cargar(os.path.join(TEXTOS, BASE_LANG + ".json"))
    codigos = [c for c, _, _ in IDIOMAS]
    for c in codigos:
        if c not in presentes:
            print("- %s: sin %s.json, se omite" % (c, c))
    fallo = False
    for lang in [BASE_LANG] + [c for c in presentes if c != BASE_LANG]:
        try:
            datos = cargar(os.path.join(TEXTOS, lang + ".json"))
        except ValueError as e:
            print("ERROR %s.json: JSON inválido: %s" % (lang, e), file=sys.stderr)
            fallo = True
            continue
        errores = validar_idioma(lang, datos, ref)
        salidas, usadas = [], set()
        for pagina, archivo, _, ns in PAGINAS:
            usadas |= pedidas_de(plantillas[pagina], ns)
            out, errs = generar(pagina, lang, datos, plantillas[pagina])
            errores += errs
            if out is not None:
                salidas.append((pagina, out))
        # claves sin usar -> aviso (la sección consentimiento viaja entera como JSON al script)
        for k, _ in hojas(datos):
            if k.startswith("formato.") or k.startswith("consentimiento."):
                continue
            if k not in usadas:
                print("AVISO [%s] clave sin usar: %s" % (lang, k), file=sys.stderr)
        if errores:
            fallo = True
            for e in errores:
                print("ERROR [%s] %s" % (lang, e), file=sys.stderr)
            print("- %s: NO generado" % lang, file=sys.stderr)
            continue
        for pagina, out in salidas:
            ruta = os.path.join(salida, carpeta(pagina, lang), "index.html")
            os.makedirs(os.path.dirname(ruta), exist_ok=True)
            with open(ruta, "w", encoding="utf-8", newline="") as f:
                f.write(out)
            print("- %s/%s: %s (%d bytes)" % (lang, pagina, os.path.relpath(ruta, RAIZ), len(out.encode("utf-8"))))
    return 1 if fallo else 0


if __name__ == "__main__":
    sys.exit(main())
