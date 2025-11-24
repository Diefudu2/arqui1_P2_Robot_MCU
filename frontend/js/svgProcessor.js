// svgProcessor.js
// Toma el SVG (string), discretiza líneas, círculos, polilíneas y paths,
// aplica transformaciones, y exporta JSON + CSV.

const MAX_DIMENSION = 1000;

// ----- Utils de matriz (aplicar transformaciones SVG) -----
function applyCTM(x, y, el) {
  const m = el.getCTM?.();
  if (!m) return [x, y];
  const x2 = m.a * x + m.c * y + m.e;
  const y2 = m.b * x + m.d * y + m.f;
  return [x2, y2];
}

function dedupeCoords(coords) {
  const out = [];
  let last = null;
  for (const p of coords) {
    if (!last || p[0] !== last[0] || p[1] !== last[1]) {
      out.push(p);
      last = p;
    }
  }
  return out;
}

// ----- Crear SVG oculto para muestrear path en DOM real -----
function ensureHiddenSVG() {
  let hidden = document.getElementById("__hidden_svg_sampler__");
  if (!hidden) {
    hidden = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    hidden.setAttribute("id", "__hidden_svg_sampler__");
    hidden.setAttribute("width", "0");
    hidden.setAttribute("height", "0");
    hidden.style.position = "fixed";
    hidden.style.left = "-9999px";
    hidden.style.top = "-9999px";
    hidden.style.visibility = "hidden";
    document.body.appendChild(hidden);
  }
  return hidden;
}

// ----- Muestreo de path usando métodos nativos -----
function samplePathD(d, step = 5) {
  const hiddenSVG = ensureHiddenSVG();
  const pathEl = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pathEl.setAttribute("d", d);
  hiddenSVG.appendChild(pathEl);

  let coords = [];
  try {
    const total = pathEl.getTotalLength();
    if (Number.isFinite(total) && total > 0) {
      for (let l = 0; l <= total; l += step) {
        const pt = pathEl.getPointAtLength(l);
        coords.push(applyCTM(pt.x, pt.y, pathEl));
      }
      // Asegura último punto exacto
      const end = pathEl.getPointAtLength(total);
      coords.push(applyCTM(end.x, end.y, pathEl));
    } else {
      console.warn("Path con longitud 0 o no soportado:", d);
    }
  } catch (e) {
    console.warn("Error muestreando path:", e);
  } finally {
    hiddenSVG.removeChild(pathEl);
  }
  return coords;
}

// ----- Parser principal -----
function parseSVG(svgString, step = 5, arcStepsDeg = 10) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");

  // Si el SVG tiene viewBox, podría ayudar a validaciones (opcional)
  // const svgRoot = doc.querySelector("svg");

  let coords = [];

  // <line>
  doc.querySelectorAll("line").forEach(line => {
    const x1 = parseFloat(line.getAttribute("x1"));
    const y1 = parseFloat(line.getAttribute("y1"));
    const x2 = parseFloat(line.getAttribute("x2"));
    const y2 = parseFloat(line.getAttribute("y2"));
    if ([x1, y1, x2, y2].every(n => Number.isFinite(n))) {
      coords.push(applyCTM(x1, y1, line), applyCTM(x2, y2, line));
    }
  });

  // <polyline>
  doc.querySelectorAll("polyline").forEach(pl => {
    const pts = (pl.getAttribute("points") || "").trim();
    if (!pts) return;
    pts.split(/[\s,]+/).reduce((acc, val, idx, arr) => {
      if (idx % 2 === 0 && arr[idx + 1] !== undefined) {
        const x = parseFloat(val);
        const y = parseFloat(arr[idx + 1]);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          acc.push(applyCTM(x, y, pl));
        }
      }
      return acc;
    }, coords);
  });

  // <rect> (muestreo de borde en pasos, no solo esquinas)
  doc.querySelectorAll("rect").forEach(rect => {
    const x = parseFloat(rect.getAttribute("x")) || 0;
    const y = parseFloat(rect.getAttribute("y")) || 0;
    const w = parseFloat(rect.getAttribute("width"));
    const h = parseFloat(rect.getAttribute("height"));
    if (!Number.isFinite(w) || !Number.isFinite(h)) return;

    const sampleEdge = (x1, y1, x2, y2) => {
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy);
      const n = Math.max(1, Math.ceil(len / step));
      for (let i = 0; i <= n; i++) {
        const px = x1 + (dx * i) / n;
        const py = y1 + (dy * i) / n;
        coords.push(applyCTM(px, py, rect));
      }
    };

    sampleEdge(x, y, x + w, y);         // top
    sampleEdge(x + w, y, x + w, y + h); // right
    sampleEdge(x + w, y + h, x, y + h); // bottom
    sampleEdge(x, y + h, x, y);         // left
  });

  // <circle> (muestreo por ángulo)
  doc.querySelectorAll("circle").forEach(circle => {
    const cx = parseFloat(circle.getAttribute("cx")) || 0;
    const cy = parseFloat(circle.getAttribute("cy")) || 0;
    const r = parseFloat(circle.getAttribute("r"));
    if (!Number.isFinite(r) || r <= 0) return;

    const steps = Math.max(12, Math.round(360 / arcStepsDeg)); // mínimo 12
    for (let i = 0; i <= steps; i++) {
      const theta = (2 * Math.PI * i) / steps;
      const x = cx + r * Math.cos(theta);
      const y = cy + r * Math.sin(theta);
      coords.push(applyCTM(x, y, circle));
    }
  });

  // <ellipse> (similar a circle)
  doc.querySelectorAll("ellipse").forEach(el => {
    const cx = parseFloat(el.getAttribute("cx")) || 0;
    const cy = parseFloat(el.getAttribute("cy")) || 0;
    const rx = parseFloat(el.getAttribute("rx"));
    const ry = parseFloat(el.getAttribute("ry"));
    if (!Number.isFinite(rx) || !Number.isFinite(ry) || rx <= 0 || ry <= 0) return;

    const steps = Math.max(12, Math.round(360 / arcStepsDeg));
    for (let i = 0; i <= steps; i++) {
      const theta = (2 * Math.PI * i) / steps;
      const x = cx + rx * Math.cos(theta);
      const y = cy + ry * Math.sin(theta);
      coords.push(applyCTM(x, y, el));
    }
  });

  // <path> (clave): muestreo uniforme por longitud
  doc.querySelectorAll("path").forEach(path => {
    const d = path.getAttribute("d");
    if (!d) return;
    const sampled = samplePathD(d, step);
    coords.push(...sampled);
  });

  // Limpieza: quitar duplicados consecutivos
  coords = dedupeCoords(coords);

  return coords;
}

// ----- Transformaciones globales (normalizar al primer cuadrante) -----
function transformCoords(coords, opts = {}) {
  if (!coords.length) return coords;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of coords) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxY - minY);

  const translated = coords.map(([x, y]) => {
    const nx = x - minX;
    const ny = maxY - y;
    return [nx, ny];
  });

  const largestSide = Math.max(width, height);
  if (largestSide <= MAX_DIMENSION) {
    return translated;
  }

  const scale = MAX_DIMENSION / largestSide;
  return translated.map(([nx, ny]) => [nx * scale, ny * scale]);
}

// Nuevo helper: convierte a string sin prefijo
function coordsToTupleString(coords) {
  const fmt = (n) => Math.round(n).toString();
  return `[${coords.map(([x, y]) => `(${fmt(x)},${fmt(y)})`).join(",")}]`;
}

// ----- Función principal -----
export function processSVG(svgString, options = {}) {
  const { step = 5, arcStepsDeg = 10 } = options;
  const coords = parseSVG(svgString, step, arcStepsDeg);

  if (!coords.length) {
    console.warn("No se encontraron coordenadas en el SVG. Verifica elementos vectoriales soportados.");
    return "";
  }

  const transformed = transformCoords(coords);
  const tupleString = coordsToTupleString(transformed);

  console.log(`[processSVG] Procesadas ${transformed.length} coordenadas, normalizadas al primer cuadrante`);
  return tupleString;
}
