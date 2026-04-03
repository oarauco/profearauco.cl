/* ========================================================================== */
/* SISTEMA CARTESIANO INTERACTIVO PARA MOODLE                                 */
/* -------------------------------------------------------------------------- */
/* Características:                                                           */
/* - Escala 1:1 opcional por gráfico                                          */
/* - Ejes y grilla                                                            */
/* - Formato de pasos numéricos, en π y en e                                  */
/* - Zoom y arrastre                                                          */
/* - Leyenda                                                                  */
/* - Puntos explícitos, puntos en x y puntos en y                             */
/* - Clipping mejorado                                                        */
/* - Tratamiento especial para funciones problemáticas                        */
/* ========================================================================== */

(function (window, document) {
  'use strict';

  /* ======================================================================== */
  /* 1) CONFIGURACIÓN GENERAL                                                 */
  /* ======================================================================== */
  const GRAPH_SETTINGS = {
  clipRefineMaxDepth: 4,
  clipRefineMaxChecks: 160,
  clipRefineTimeBudgetMs: 10,
  minSamples: 800,

  axisFontSize: 8,
  legendFontSize: 8,
  pointLabelFontSize: 8,

  hugeYFactor: 3,
  visibleJumpFactor: 0.9,
  noClipJumpFactor: 0.35,

  // Densificación adaptativa de renderizado
  renderRefineMaxDepth: 6,
  renderChordTolerancePx: 1.25,
  renderMinScreenDx: 2,
  renderRefineMaxChecks: 600,
  renderRefineTimeBudgetMs: 12
  };

  /* ======================================================================== */
  /* 2) UTILIDADES GENERALES                                                  */
  /* ======================================================================== */
  const has = (s, k) => String(s || '').toLowerCase().includes(k);

  function trimNum(v, p = 6) {
    return Number(v.toFixed(p)).toString();
  }

  function nowMs() {
    if (typeof performance !== 'undefined' && performance.now) return performance.now();
    return Date.now();
  }

  function createSvgEl(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
  }

  function getSvgLogicalSize(svg) {
    const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
    const w = (vb && vb.width) || Number(svg.getAttribute('width')) || svg.clientWidth || 640;
    const h = (vb && vb.height) || Number(svg.getAttribute('height')) || svg.clientHeight || 420;
    return { w, h };
  }

  /* ======================================================================== */
  /* 3) PARSEO DE CONSTANTES, RANGOS Y PASOS                                  */
  /* ======================================================================== */
  function parseConstExpr(txt) {
    if (txt == null) return NaN;

    const s = String(txt)
      .trim()
      .toLowerCase()
      .replace(',', '.')
      .replace(/\s+/g, '');

    if (!s) return NaN;

    const m = s.match(/^([+-]?\d*\.?\d*)\*?(pi|π|e)(?:\/([+-]?\d*\.?\d*))?$/i);
    if (m) {
      const a =
        m[1] === '' || m[1] === '+' || m[1] === '-'
          ? (m[1] === '-' ? -1 : 1)
          : parseFloat(m[1]);

      const c = /pi|π/i.test(m[2]) ? Math.PI : Math.E;
      const b = m[3] ? parseFloat(m[3]) : 1;
      const val = (a * c) / b;

      return Number.isFinite(val) ? val : NaN;
    }

    if (s === 'pi' || s === '+pi' || s === 'π' || s === '+π') return Math.PI;
    if (s === '-pi' || s === '-π') return -Math.PI;
    if (s === 'e' || s === '+e') return Math.E;
    if (s === '-e') return -Math.E;

    const v = Number(s);
    return Number.isFinite(v) ? v : NaN;
  }

  function parseRange(s) {
    if (!s) return [-10, 10];
    const parts = String(s).split(',').map(t => parseConstExpr(t));
    return parts.length === 2 && parts.every(Number.isFinite) ? parts : [-10, 10];
  }

  function parseStep(s) {
    if (!s) return { val: null, mode: null };

    const raw = String(s).trim().toLowerCase();
    const val = parseConstExpr(raw);

    if (!Number.isFinite(val) || val <= 0) {
      return { val: null, mode: null };
    }

    return {
      val,
      mode: has(raw, 'pi') || has(raw, 'π')
        ? 'pi'
        : has(raw, 'e')
          ? 'e'
          : 'num'
    };
  }

  function niceStep(min, max, target) {
    const span = Math.abs(max - min);
    if (!isFinite(span) || span === 0) return 1;

    const raw = span / Math.max(1, target);
    const p10 = Math.pow(10, Math.floor(Math.log10(raw)));
    const frac = raw / p10;
    const nf = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;

    return nf * p10;
  }

  /* ======================================================================== */
  /* 4) FORMATEO DE ETIQUETAS EN π Y e                                        */
  /* ======================================================================== */
  function approxFrac(k) {
    const dens = [1, 2, 3, 4, 6, 8, 12];
    let best = {
      n: Math.round(k),
      d: 1,
      err: Math.abs(k - Math.round(k))
    };

    for (const d of dens) {
      const n = Math.round(k * d);
      const err = Math.abs(k - n / d);
      if (err < best.err - 1e-10) best = { n, d, err };
    }

    return best;
  }

  function formatMultiple(value, C, symbol) {
    const k = value / C;
    const frac = approxFrac(k);
    const n = frac.n;
    const d = frac.d;

    const sign = n < 0 ? '−' : '';
    const nn = Math.abs(n);

    if (nn === 0) return '0';
    if (d === 1) return nn === 1 ? sign + symbol : sign + nn + symbol;
    return (nn === 1 ? sign + symbol : sign + nn + symbol) + '/' + d;
  }

  function makeFormatter(stepMode) {
    if (stepMode === 'pi') return (v) => formatMultiple(v, Math.PI, 'π');
    if (stepMode === 'e') return (v) => formatMultiple(v, Math.E, 'e');
    return (v) => trimNum(v).replace(/\.0+$/, '');
  }

  /* ======================================================================== */
  /* 5) CLASIFICACIÓN SIMPLE DE EXPRESIONES                                   */
  /* ======================================================================== */
  function classifyExpr(expr) {
    const s = String(expr || '')
      .toLowerCase()
      .replace(/\s+/g, '');

    return {
      hasTan: /(^|[^a-z])tan\(/.test(s),
      hasLog: /(^|[^a-z])(log|ln)\(/.test(s),
      hasSqrt: /(^|[^a-z])sqrt\(/.test(s),
      looksRational: s.includes('/') && !/(https?:|\/\/)/.test(s)
    };
  }

  /* ======================================================================== */
  /* 6) EVALUADOR DE EXPRESIONES                                              */
  /* ======================================================================== */
  function makeSafeEvaluator() {
    const ctx = {
      sin: Math.sin,
      cos: Math.cos,
      tan: Math.tan,
      asin: Math.asin,
      acos: Math.acos,
      atan: Math.atan,
      log: Math.log,
      ln: Math.log,
      log10: Math.log10 ? Math.log10 : (x) => Math.log(x) / Math.LN10,
      log2: Math.log2 ? Math.log2 : (x) => Math.log(x) / Math.LN2,
      logb: (v, b) => Math.log(v) / Math.log(b),
      pow: Math.pow,
      sqrt: Math.sqrt,
      abs: Math.abs,
      exp: Math.exp,
      floor: Math.floor,
      ceil: Math.ceil,
      round: Math.round,
      sign: Math.sign || function (x) { return x === 0 ? 0 : x > 0 ? 1 : -1; },
      min: Math.min,
      max: Math.max,
      PI: Math.PI,
      E: Math.E
    };

    const FUNCTION_SPECS = {
      sin:   { fn: ctx.sin,   minArgs: 1, maxArgs: 1 },
      cos:   { fn: ctx.cos,   minArgs: 1, maxArgs: 1 },
      tan:   { fn: ctx.tan,   minArgs: 1, maxArgs: 1 },
      asin:  { fn: ctx.asin,  minArgs: 1, maxArgs: 1 },
      acos:  { fn: ctx.acos,  minArgs: 1, maxArgs: 1 },
      atan:  { fn: ctx.atan,  minArgs: 1, maxArgs: 1 },
      log:   { fn: ctx.log,   minArgs: 1, maxArgs: 1 },
      ln:    { fn: ctx.ln,    minArgs: 1, maxArgs: 1 },
      log10: { fn: ctx.log10, minArgs: 1, maxArgs: 1 },
      log2:  { fn: ctx.log2,  minArgs: 1, maxArgs: 1 },
      logb:  { fn: ctx.logb,  minArgs: 2, maxArgs: 2 },
      pow:   { fn: ctx.pow,   minArgs: 2, maxArgs: 2 },
      sqrt:  { fn: ctx.sqrt,  minArgs: 1, maxArgs: 1 },
      abs:   { fn: ctx.abs,   minArgs: 1, maxArgs: 1 },
      exp:   { fn: ctx.exp,   minArgs: 1, maxArgs: 1 },
      floor: { fn: ctx.floor, minArgs: 1, maxArgs: 1 },
      ceil:  { fn: ctx.ceil,  minArgs: 1, maxArgs: 1 },
      round: { fn: ctx.round, minArgs: 1, maxArgs: 1 },
      sign:  { fn: ctx.sign,  minArgs: 1, maxArgs: 1 },
      min:   { fn: ctx.min,   minArgs: 1, maxArgs: Infinity },
      max:   { fn: ctx.max,   minArgs: 1, maxArgs: Infinity }
    };

    const COMPILED_CACHE = new Map();
    const MAX_CACHE_SIZE = 256;

    function normalizeExpression(expr) {
      return String(expr == null ? '' : expr)
        .replace(/[−–—]/g, '-')
        .replace(/[×⋅·]/g, '*')
        .replace(/÷/g, '/')
        .replace(/π/g, 'pi')
        .replace(/\bsen\s*\(/gi, 'sin(')
        .replace(/\btg\s*\(/gi, 'tan(')
        .replace(/\bpi\b/gi, 'pi')
        .replace(/\bx\b/gi, 'x')
        .replace(/\be\b/g, 'e')
        .replace(/\u00A0/g, ' ')
        .trim();
    }

    function isDigit(ch) {
      return ch >= '0' && ch <= '9';
    }

    function isIdentStart(ch) {
      return !!ch && /[A-Za-z_]/.test(ch);
    }

    function isIdentPart(ch) {
      return !!ch && /[A-Za-z0-9_]/.test(ch);
    }

    function tokenize(src) {
      const tokens = [];
      let i = 0;

      while (i < src.length) {
        const ch = src[i];

        if (/\s/.test(ch)) {
          i++;
          continue;
        }

        if (isDigit(ch) || (ch === '.' && isDigit(src[i + 1]))) {
          const start = i;
          let j = i;

          while (j < src.length && isDigit(src[j])) j++;
          if (src[j] === '.') {
            j++;
            while (j < src.length && isDigit(src[j])) j++;
          }

          if (src[j] === 'e' || src[j] === 'E') {
            const expPos = j;
            let k = j + 1;
            if (src[k] === '+' || src[k] === '-') k++;
            const expDigitsStart = k;
            while (k < src.length && isDigit(src[k])) k++;
            if (k > expDigitsStart) {
              j = k;
            } else {
              j = expPos;
            }
          }

          const raw = src.slice(start, j);
          const value = Number(raw);
          if (!Number.isFinite(value)) throw new Error('Número inválido: ' + raw);
          tokens.push({ type: 'number', value: raw });
          i = j;
          continue;
        }

        if (isIdentStart(ch)) {
          let j = i + 1;
          while (j < src.length && isIdentPart(src[j])) j++;
          const raw = src.slice(i, j);
          tokens.push({ type: 'ident', value: raw.toLowerCase() });
          i = j;
          continue;
        }

        if ('+-*/^(),'.includes(ch)) {
          tokens.push({ type: ch, value: ch });
          i++;
          continue;
        }

        throw new Error('Símbolo no permitido: ' + ch);
      }

      return insertImplicitMultiplication(tokens);
    }

    function isFunctionName(name) {
      return Object.prototype.hasOwnProperty.call(FUNCTION_SPECS, name);
    }

    function canEndImplicit(tok) {
      return tok && (tok.type === 'number' || tok.type === 'ident' || tok.type === ')');
    }

    function canStartImplicit(tok) {
      return tok && (tok.type === 'number' || tok.type === 'ident' || tok.type === '(');
    }

    function insertImplicitMultiplication(tokens) {
      const out = [];

      for (let i = 0; i < tokens.length; i++) {
        const cur = tokens[i];
        const next = tokens[i + 1];
        out.push(cur);
        if (!next) continue;

        const isFuncCall = cur.type === 'ident' && next.type === '(' && isFunctionName(cur.value);
        if (isFuncCall) continue;

        if (canEndImplicit(cur) && canStartImplicit(next)) {
          out.push({ type: '*', value: '*' });
        }
      }

      return out;
    }

    function parseTokens(tokens) {
      let pos = 0;

      function peek() {
        return tokens[pos] || null;
      }

      function consume(type) {
        const tok = peek();
        if (tok && tok.type === type) {
          pos++;
          return tok;
        }
        return null;
      }

      function expect(type) {
        const tok = consume(type);
        if (!tok) {
          const got = peek() ? peek().type : 'fin';
          throw new Error('Se esperaba "' + type + '", pero llegó "' + got + '"');
        }
        return tok;
      }

      function parseExpression() {
        return parseAddSub();
      }

      function parseAddSub() {
        let node = parseMulDiv();

        while (true) {
          const tok = peek();
          if (!tok || (tok.type !== '+' && tok.type !== '-')) break;
          pos++;
          node = { type: 'binary', op: tok.type, left: node, right: parseMulDiv() };
        }

        return node;
      }

      function parseMulDiv() {
        let node = parseUnary();

        while (true) {
          const tok = peek();
          if (!tok || (tok.type !== '*' && tok.type !== '/')) break;
          pos++;
          node = { type: 'binary', op: tok.type, left: node, right: parseUnary() };
        }

        return node;
      }

      function parseUnary() {
        const tok = peek();
        if (tok && (tok.type === '+' || tok.type === '-')) {
          pos++;
          return { type: 'unary', op: tok.type, arg: parseUnary() };
        }
        return parsePower();
      }

      function parsePower() {
        let node = parsePrimary();
        if (consume('^')) {
          node = { type: 'binary', op: '^', left: node, right: parseUnary() };
        }
        return node;
      }

      function parsePrimary() {
        const tok = peek();
        if (!tok) throw new Error('Expresión incompleta');

        if (tok.type === 'number') {
          pos++;
          return { type: 'number', value: tok.value };
        }

        if (tok.type === '(') {
          pos++;
          const node = parseExpression();
          expect(')');
          return node;
        }

        if (tok.type === 'ident') {
          pos++;
          const name = tok.value;

          if (consume('(')) {
            if (!isFunctionName(name)) {
              throw new Error('Función no permitida: ' + name);
            }

            const args = [];
            if (!consume(')')) {
              do {
                args.push(parseExpression());
              } while (consume(','));
              expect(')');
            }

            const spec = FUNCTION_SPECS[name];
            if (args.length < spec.minArgs || args.length > spec.maxArgs) {
              throw new Error('Cantidad incorrecta de argumentos en ' + name);
            }

            return { type: 'call', name, args };
          }

          if (name === 'x') return { type: 'variable' };
          if (name === 'pi') return { type: 'constant', name: 'pi' };
          if (name === 'e') return { type: 'constant', name: 'e' };
          if (isFunctionName(name)) {
            throw new Error('La función ' + name + ' requiere paréntesis');
          }

          throw new Error('Identificador no permitido: ' + name);
        }

        throw new Error('Token inesperado: ' + tok.type);
      }

      const ast = parseExpression();
      if (pos < tokens.length) {
        throw new Error('Sobran tokens al final de la expresión');
      }
      return ast;
    }

    function buildEvaluator(ast) {
      switch (ast.type) {
        case 'number': {
          const n = Number(ast.value);
          return function () { return n; };
        }
        case 'variable':
          return function (x) { return x; };
        case 'constant':
          return ast.name === 'pi'
            ? function () { return Math.PI; }
            : function () { return Math.E; };
        case 'unary': {
          const evalArg = buildEvaluator(ast.arg);
          if (ast.op === '+') return function (x) { return +evalArg(x); };
          return function (x) { return -evalArg(x); };
        }
        case 'binary': {
          const evalLeft = buildEvaluator(ast.left);
          const evalRight = buildEvaluator(ast.right);

          if (ast.op === '+') return function (x) { return evalLeft(x) + evalRight(x); };
          if (ast.op === '-') return function (x) { return evalLeft(x) - evalRight(x); };
          if (ast.op === '*') return function (x) { return evalLeft(x) * evalRight(x); };
          if (ast.op === '/') return function (x) { return evalLeft(x) / evalRight(x); };
          if (ast.op === '^') return function (x) { return Math.pow(evalLeft(x), evalRight(x)); };

          throw new Error('Operador no soportado: ' + ast.op);
        }
        case 'call': {
          const spec = FUNCTION_SPECS[ast.name];
          const argEvals = ast.args.map(buildEvaluator);
          return function (x) {
            const args = argEvals.map(fn => fn(x));
            return spec.fn.apply(null, args);
          };
        }
        default:
          throw new Error('Nodo AST desconocido: ' + ast.type);
      }
    }

    function rememberCompiled(key, compiled) {
      if (COMPILED_CACHE.has(key)) return compiled;
      COMPILED_CACHE.set(key, compiled);
      if (COMPILED_CACHE.size > MAX_CACHE_SIZE) {
        const oldest = COMPILED_CACHE.keys().next().value;
        COMPILED_CACHE.delete(oldest);
      }
      return compiled;
    }

    function compileExpression(expr) {
      const normalized = normalizeExpression(expr);
      if (!normalized) throw new Error('Expresión vacía');

      if (COMPILED_CACHE.has(normalized)) {
        return COMPILED_CACHE.get(normalized);
      }

      const tokens = tokenize(normalized);
      const ast = parseTokens(tokens);
      const compiled = buildEvaluator(ast);
      return rememberCompiled(normalized, compiled);
    }

    return function (expr, x) {
      try {
        const fn = compileExpression(expr);
        const y = fn(x);
        return Number.isFinite(y) ? y : NaN;
      } catch (err) {
        return NaN;
      }
    };
  }

  const evalWithX = makeSafeEvaluator();

  /* ======================================================================== */
  /* 7) ESCALA 1:1                                                            */
  /* ======================================================================== */
  function lockAspect(state, w, h) {
    if (!w || !h) return;

    const cx = (state.xmin + state.xmax) / 2;
    const cy = (state.ymin + state.ymax) / 2;
    const spanX = state.xmax - state.xmin;
    const spanY = state.ymax - state.ymin;

    const upxX = spanX / w;
    const upxY = spanY / h;

    if (Math.abs(upxX - upxY) < 1e-12) return;

    if (upxX > upxY) {
      const halfY = (h * upxX) / 2;
      state.ymin = cy - halfY;
      state.ymax = cy + halfY;
    } else {
      const halfX = (w * upxY) / 2;
      state.xmin = cx - halfX;
      state.xmax = cx + halfX;
    }
  }

  /* ======================================================================== */
  /* 8) DIBUJO DE GRILLA Y EJES                                               */
  /* ======================================================================== */
  function drawGrid(svg, xmin, xmax, ymin, ymax, sx, sy, modeX, modeY) {
    const size = getSvgLogicalSize(svg);
    const w = size.w;
    const h = size.h;

    svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
    svg.innerHTML = '';

    const x2px = (x) => ((x - xmin) / (xmax - xmin)) * w;
    const y2px = (y) => h - ((y - ymin) / (ymax - ymin)) * h;

    const bg = createSvgEl('rect');
    bg.setAttribute('x', 0);
    bg.setAttribute('y', 0);
    bg.setAttribute('width', w);
    bg.setAttribute('height', h);
    bg.setAttribute('fill', '#fff');
    svg.appendChild(bg);

    const xt = sx || niceStep(xmin, xmax, 10);
    const yt = sy || niceStep(ymin, ymax, 10);

    for (let x = Math.ceil(xmin / xt) * xt; x <= xmax + 1e-12; x += xt) {
      const line = createSvgEl('line');
      line.setAttribute('x1', x2px(x));
      line.setAttribute('y1', 0);
      line.setAttribute('x2', x2px(x));
      line.setAttribute('y2', h);
      line.setAttribute('stroke', '#e6e6e6');
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(line);
    }

    for (let y = Math.ceil(ymin / yt) * yt; y <= ymax + 1e-12; y += yt) {
      const line = createSvgEl('line');
      line.setAttribute('x1', 0);
      line.setAttribute('y1', y2px(y));
      line.setAttribute('x2', w);
      line.setAttribute('y2', y2px(y));
      line.setAttribute('stroke', '#e6e6e6');
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(line);
    }

    function drawAxis(x1, y1, x2, y2) {
      const axis = createSvgEl('line');
      axis.setAttribute('x1', x1);
      axis.setAttribute('y1', y1);
      axis.setAttribute('x2', x2);
      axis.setAttribute('y2', y2);
      axis.setAttribute('stroke', '#000');
      axis.setAttribute('stroke-width', '1.5');
      axis.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(axis);
    }

    if (xmin <= 0 && xmax >= 0) drawAxis(x2px(0), 0, x2px(0), h);
    if (ymin <= 0 && ymax >= 0) drawAxis(0, y2px(0), w, y2px(0));

    let xAxisPx;
    if (ymin <= 0 && ymax >= 0) xAxisPx = y2px(0);
    else if (ymin > 0) xAxisPx = h;
    else xAxisPx = 0;

    let yAxisPx;
    if (xmin <= 0 && xmax >= 0) yAxisPx = x2px(0);
    else if (xmin > 0) yAxisPx = 0;
    else yAxisPx = w;

    const tickStyle = {
      stroke: '#999',
      len: 6,
      fs: GRAPH_SETTINGS.axisFontSize,
      fill: '#555'
    };

    const fmtX = makeFormatter(modeX);
    const fmtY = makeFormatter(modeY);

    for (let x = Math.ceil(xmin / xt) * xt; x <= xmax + 1e-12; x += xt) {
      const px = x2px(x);

      const tick = createSvgEl('line');
      tick.setAttribute('x1', px);
      tick.setAttribute('x2', px);
      tick.setAttribute('y1', xAxisPx - tickStyle.len);
      tick.setAttribute('y2', xAxisPx + tickStyle.len);
      tick.setAttribute('stroke', tickStyle.stroke);
      tick.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(tick);

      if (Math.abs(x) > 1e-12) {
        const label = createSvgEl('text');
        label.setAttribute('x', px);
        label.setAttribute('y', xAxisPx + tickStyle.len + 2);
        label.setAttribute('dominant-baseline', 'hanging');
        label.setAttribute('font-size', tickStyle.fs);
        label.setAttribute('fill', tickStyle.fill);
        label.setAttribute('text-anchor', 'middle');
        label.textContent = fmtX(x);
        svg.appendChild(label);
      }
    }

    for (let y = Math.ceil(ymin / yt) * yt; y <= ymax + 1e-12; y += yt) {
      const py = y2px(y);

      const tick = createSvgEl('line');
      tick.setAttribute('y1', py);
      tick.setAttribute('y2', py);
      tick.setAttribute('x1', yAxisPx - tickStyle.len);
      tick.setAttribute('x2', yAxisPx + tickStyle.len);
      tick.setAttribute('stroke', tickStyle.stroke);
      tick.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(tick);

      if (Math.abs(y) > 1e-12) {
        const label = createSvgEl('text');
        label.setAttribute('x', yAxisPx - tickStyle.len - 2);
        label.setAttribute('text-anchor', 'end');
        label.setAttribute('y', py);
        label.setAttribute('font-size', tickStyle.fs);
        label.setAttribute('fill', tickStyle.fill);
        label.setAttribute('dominant-baseline', 'middle');
        label.textContent = fmtY(y);
        svg.appendChild(label);
      }
    }

    return { x2px, y2px, w, h, xt, yt };
  }

  /* ======================================================================== */
  /* 9) LEYENDA                                                               */
  /* ======================================================================== */
  function drawLegend(svg, funcs) {
    if (!Array.isArray(funcs) || !funcs.length) return;

    const box = {
      x: 10,
      y: 10,
      pad: 8,
      dy: 20,
      sw: 18,
      sh: 3,
      fs: GRAPH_SETTINGS.legendFontSize
    };

    const g = createSvgEl('g');
    g.setAttribute('pointer-events', 'none');
    g.style.userSelect = 'none';

    let maxW = 0;

    funcs.forEach((f, i) => {
      const y = box.y + box.pad + i * box.dy + 2;

      const line = createSvgEl('line');
      line.setAttribute('x1', box.x + box.pad);
      line.setAttribute('y1', y);
      line.setAttribute('x2', box.x + box.pad + box.sw);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', f.color || '#1976d2');
      line.setAttribute('stroke-width', box.sh);
      line.setAttribute('vector-effect', 'non-scaling-stroke');
      line.setAttribute('pointer-events', 'none');
      g.appendChild(line);

      const text = createSvgEl('text');
      text.setAttribute('x', box.x + box.pad + box.sw + 6);
      text.setAttribute('y', y + 4);
      text.setAttribute('font-size', box.fs);
      text.setAttribute('fill', '#333');
      text.setAttribute('pointer-events', 'none');
      text.textContent = f.label || f.expr;
      g.appendChild(text);

      let est = text.textContent.length * box.fs * 0.58;
      if (text.textLength && text.textLength.baseVal) {
        const real = text.textLength.baseVal.value;
        if (real > 0) est = real;
      }

      maxW = Math.max(maxW, est + box.sw + 24);
    });

    const bg = createSvgEl('rect');
    const h = box.pad * 2 + funcs.length * box.dy;
    const w = box.pad * 2 + maxW;

    bg.setAttribute('x', box.x);
    bg.setAttribute('y', box.y);
    bg.setAttribute('width', w);
    bg.setAttribute('height', h);
    bg.setAttribute('rx', 8);
    bg.setAttribute('ry', 8);
    bg.setAttribute('fill', 'rgba(255,255,255,0.9)');
    bg.setAttribute('stroke', '#ccc');
    bg.setAttribute('pointer-events', 'none');

    g.insertBefore(bg, g.firstChild);
    svg.appendChild(g);
  }

  /* ======================================================================== */
  /* 10) PUNTOS: PARSEO                                                       */
  /* ======================================================================== */
  function parsePointList(s) {
    if (!s) return [];

    return s
      .split(';')
      .map(t => t.trim())
      .filter(Boolean)
      .map(tok => {
        const m = tok.replace(/[()]/g, '').split(',').map(x => x.trim());
        if (m.length !== 2) return null;

        const x = parseConstExpr(m[0]);
        const y = parseConstExpr(m[1]);

        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
      })
      .filter(Boolean)
      .slice(0, 16);
  }

  function parsePointXSpec(s) {
    if (!s) return [];

    const toks = s.split(';').map(t => t.trim()).filter(Boolean);
    const out = [];

    for (let i = 0; i + 1 < toks.length && out.length < 16; i += 2) {
      const x0 = parseConstExpr(toks[i]);
      const expr = toks[i + 1];
      if (Number.isFinite(x0) && expr) out.push({ x0, expr });
    }

    return out;
  }

  function parsePointYSpec(s) {
    if (!s) return [];

    const toks = s.split(';').map(t => t.trim()).filter(Boolean);
    const out = [];

    for (let i = 0; i + 1 < toks.length && out.length < 16; i += 2) {
      const y0 = parseConstExpr(toks[i]);
      const expr = toks[i + 1];
      if (Number.isFinite(y0) && expr) out.push({ y0, expr });
    }

    return out;
  }

  /* ======================================================================== */
  /* 11) PUNTOS: DIBUJO                                                       */
  /* ======================================================================== */
  function fmtPair(x, y) {
    const trim = (v) => Number(v.toFixed(6)).toString().replace(/\.0+$/, '');
    return '(' + trim(x) + ', ' + trim(y) + ')';
  }

  function drawDot(svg, map, x, y, color) {
    const c = createSvgEl('circle');
    c.setAttribute('cx', map.x2px(x));
    c.setAttribute('cy', map.y2px(y));
    c.setAttribute('r', 3.5);
    c.setAttribute('fill', color || '#111');
    c.setAttribute('stroke', '#fff');
    c.setAttribute('stroke-width', '1.2');
    c.setAttribute('vector-effect', 'non-scaling-stroke');
    c.setAttribute('pointer-events', 'none');
    svg.appendChild(c);

    const t = createSvgEl('text');
    t.setAttribute('x', map.x2px(x) + 6);
    t.setAttribute('y', map.y2px(y) - 6);
    t.setAttribute('font-size', GRAPH_SETTINGS.pointLabelFontSize);
    t.setAttribute('fill', '#111');
    t.setAttribute('pointer-events', 'none');
    t.textContent = fmtPair(x, y);
    svg.appendChild(t);
  }

  function drawExplicitPoints(svg, map, state) {
    const pts = state.pointsExplicit || [];
    pts.forEach(p => {
      if (
        p.x >= state.xmin && p.x <= state.xmax &&
        p.y >= state.ymin && p.y <= state.ymax
      ) {
        drawDot(svg, map, p.x, p.y, '#111');
      }
    });
  }

  function drawPointsAtX(svg, map, state) {
    const spec = state.pointsAtX || [];

    spec.slice(0, 16).forEach(s => {
      const y = evalWithX(s.expr, s.x0);
      if (
        Number.isFinite(y) &&
        s.x0 >= state.xmin && s.x0 <= state.xmax &&
        y >= state.ymin && y <= state.ymax
      ) {
        drawDot(svg, map, s.x0, y, '#111');
      }
    });
  }

  function findIntersectionsY(expr, y0, xmin, xmax, mapW) {
    const step = (xmax - xmin) / Math.max(
      GRAPH_SETTINGS.minSamples,
      Math.floor(mapW * 1.5)
    );

    const xs = [];
    let xPrev = null;
    let vPrev = null;

    for (let x = xmin; x <= xmax + 1e-12; x += step) {
      const y = evalWithX(expr, x);
      const v = y - y0;

      if (!Number.isFinite(v)) {
        xPrev = null;
        vPrev = null;
        continue;
      }

      if (xPrev !== null) {
        if (vPrev === 0) {
          xs.push(xPrev);
        } else if (v === 0) {
          xs.push(x);
        } else if (vPrev * v < 0) {
          const t = -vPrev / (v - vPrev);
          if (t >= 0 && t <= 1 && Number.isFinite(t)) {
            const xi = xPrev + t * (x - xPrev);
            xs.push(xi);
          }
        }
      }

      xPrev = x;
      vPrev = v;

      if (xs.length >= 16) break;
    }

    const uniq = [];
    xs.sort((a, b) => a - b).forEach(x => {
      if (!uniq.length || Math.abs(x - uniq[uniq.length - 1]) > step * 0.75) {
        uniq.push(x);
      }
    });

    return uniq.slice(0, 16);
  }

  function drawPointsAtY(svg, map, state) {
    const spec = state.pointsAtY || [];

    spec.forEach(s => {
      const xs = findIntersectionsY(s.expr, s.y0, state.xmin, state.xmax, map.w);
      xs.forEach(xi => {
        if (s.y0 >= state.ymin && s.y0 <= state.ymax) {
          drawDot(svg, map, xi, s.y0, '#111');
        }
      });
    });
  }

  /* ======================================================================== */
  /* 12) DIBUJO DE FUNCIONES                                                  */
  /* ======================================================================== */
function drawFunctionFromExpr(svg, expr, map, xmin, xmax, ymin, ymax, color, doClip) {
  if (!expr) return;
  if (doClip == null) doClip = true;

  const exprInfo = classifyExpr(expr);
  const visibleYAbs = Math.max(Math.abs(ymin), Math.abs(ymax), 1);
  const offscreenPadPx = map.h * 2.5;

  function yToScreen(y) {
    return map.y2px(y);
  }

  function screenJump(y1, y2) {
    return Math.abs(yToScreen(y2) - yToScreen(y1));
  }

  function isHuge(y) {
    if (!Number.isFinite(y)) return true;
    if (Math.abs(y) > 1e8) return true;
    const py = yToScreen(y);
    return py < -offscreenPadPx || py > map.h + offscreenPadPx;
  }

  function safeEvalLocal(xx) {
    const yy = evalWithX(expr, xx);
    return Number.isFinite(yy) ? yy : null;
  }

  function shouldForceBreak(y1, y2) {
    const signFlip = (y1 !== 0 && y2 !== 0) && Math.sign(y1) !== Math.sign(y2);
    const jumpPx = screenJump(y1, y2);

    if (exprInfo.hasTan) {
      const angleGap = Math.abs(Math.atan(y2) - Math.atan(y1));
      const maxAbs = Math.max(Math.abs(y1), Math.abs(y2));
      const steepZone = visibleYAbs * 0.55;

      return (
        angleGap > 1.2 ||
        (signFlip && jumpPx > map.h * 0.18) ||
        (signFlip && maxAbs > steepZone) ||
        (maxAbs > visibleYAbs * 0.85 && jumpPx > map.h * 0.28)
      );
    }

    if (exprInfo.looksRational) {
      const angleGap = Math.abs(Math.atan(y2) - Math.atan(y1));
      const maxAbs = Math.max(Math.abs(y1), Math.abs(y2));
      const steepZone = visibleYAbs * 0.55;

      return (
        angleGap > 1.2 ||
        (signFlip && jumpPx > map.h * 0.18) ||
        (signFlip && maxAbs > steepZone) ||
        (maxAbs > visibleYAbs * 0.85 && jumpPx > map.h * 0.28) ||
        isHuge(y1) ||
        isHuge(y2)
      );
    }

    return false;
  }

  const baseSamples = Math.max(
    GRAPH_SETTINGS.minSamples,
    Math.floor(map.w * 1.5)
  );

  let step = (xmax - xmin) / baseSamples;

  if (exprInfo.hasTan) {
    const tanEdgeGap = Math.atan(1 / Math.max(2, visibleYAbs));
    const tanAdaptiveMaxStep = Math.min(
      Math.PI / 32,
      Math.max((xmax - xmin) / 18000, tanEdgeGap * 0.7)
    );
    step = Math.min(step, tanAdaptiveMaxStep);
  }

  if (exprInfo.looksRational) {
    const rationalEdgeGap = 1 / Math.max(4, visibleYAbs);
    const rationalAdaptiveMaxStep = Math.min(
      0.5,
      Math.max((xmax - xmin) / 15000, rationalEdgeGap * 0.6)
    );
    step = Math.min(step, rationalAdaptiveMaxStep);
  }

  const refineStartTime = nowMs();
  let refineChecks = 0;

  function stillHasBudget() {
    return (
      refineChecks < GRAPH_SETTINGS.clipRefineMaxChecks &&
      (nowMs() - refineStartTime) < GRAPH_SETTINGS.clipRefineTimeBudgetMs
    );
  }

  function insideY(y) {
    return y >= ymin && y <= ymax;
  }

  function intersectY(x0, y0, x1, y1, c) {
    const dy = y1 - y0;
    if (dy === 0) return null;

    const t = (c - y0) / dy;
    if (t < 0 || t > 1 || !Number.isFinite(t)) return null;

    const xi = x0 + t * (x1 - x0);
    return [xi, c];
  }

  function intervalLooksContinuous(x1, x2, depth = 0) {
    if (!stillHasBudget()) return false;

    const y1 = safeEvalLocal(x1);
    const y2 = safeEvalLocal(x2);
    const xm = (x1 + x2) / 2;
    const ym = safeEvalLocal(xm);
    refineChecks++;

    if (y1 === null || y2 === null || ym === null) return false;
    if (isHuge(ym)) return false;

    if ((exprInfo.hasTan || exprInfo.looksRational) &&
        (isHuge(y1) || isHuge(y2) || isHuge(ym))) {
      return false;
    }

    if (shouldForceBreak(y1, y2)) return false;

    if (exprInfo.looksRational) {
      const endAbs = Math.max(Math.abs(y1), Math.abs(y2), 1e-9);
      const midAbs = Math.abs(ym);
      const angleMidLeft = Math.abs(Math.atan(ym) - Math.atan(y1));
      const angleMidRight = Math.abs(Math.atan(y2) - Math.atan(ym));

      if (
        (midAbs > endAbs * 3 && midAbs > visibleYAbs * 0.35) ||
        (angleMidLeft > 1.0 && angleMidRight > 1.0)
      ) {
        return false;
      }
    }

    if (depth >= GRAPH_SETTINGS.clipRefineMaxDepth) return true;

    return (
      intervalLooksContinuous(x1, xm, depth + 1) &&
      intervalLooksContinuous(xm, x2, depth + 1)
    );
  }

  // ============================================================
  // DENSIFICACIÓN ADAPTATIVA POR DESVIACIÓN DE LA CUERDA
  // ============================================================
  const renderStartTime = nowMs();
  let renderChecks = 0;

  function stillHasRenderBudget() {
    return (
      renderChecks < GRAPH_SETTINGS.renderRefineMaxChecks &&
      (nowMs() - renderStartTime) < GRAPH_SETTINGS.renderRefineTimeBudgetMs
    );
  }

  function pointLineDistancePx(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;

    if (len2 < 1e-12) {
      return Math.hypot(px - ax, py - ay);
    }

    const t = ((px - ax) * dx + (py - ay) * dy) / len2;
    const qx = ax + t * dx;
    const qy = ay + t * dy;
    return Math.hypot(px - qx, py - qy);
  }

  function chordDeviationPx(x1, y1, xm, ym, x2, y2) {
    const ax = map.x2px(x1);
    const ay = map.y2px(y1);
    const mx = map.x2px(xm);
    const my = map.y2px(ym);
    const bx = map.x2px(x2);
    const by = map.y2px(y2);

    return pointLineDistancePx(mx, my, ax, ay, bx, by);
  }

  function appendAdaptiveInterval(x1, y1, x2, y2, out, depth = 0, strictClipCheck = false) {
    if (Math.abs(x2 - x1) < 1e-15) {
      out.push([x2, y2]);
      return true;
    }

    const dxScreen = Math.abs(map.x2px(x2) - map.x2px(x1));

    if (
      depth >= GRAPH_SETTINGS.renderRefineMaxDepth ||
      dxScreen <= GRAPH_SETTINGS.renderMinScreenDx
    ) {
      out.push([x2, y2]);
      return true;
    }

    if (!stillHasRenderBudget()) {
      out.push([x2, y2]);
      return true;
    }

    const xm = (x1 + x2) / 2;
    const ym = safeEvalLocal(xm);
    renderChecks++;

    if (ym === null || isHuge(ym)) return false;

    if (shouldForceBreak(y1, ym) || shouldForceBreak(ym, y2)) {
      return false;
    }

    if (doClip && strictClipCheck) {
  if (!insideY(ym)) return false;
  if (depth === 0 && !intervalLooksContinuous(x1, x2, 0)) {
    return false;
  }
}

    const devPx = chordDeviationPx(x1, y1, xm, ym, x2, y2);

    if (devPx <= GRAPH_SETTINGS.renderChordTolerancePx) {
      out.push([x2, y2]);
      return true;
    }

if (!appendAdaptiveInterval(x1, y1, xm, ym, out, depth + 1, strictClipCheck)) return false;
if (!appendAdaptiveInterval(xm, ym, x2, y2, out, depth + 1, strictClipCheck)) return false;

    return true;
  }

  let seg = [];
  let xPrev = null;
  let yPrev = null;
  let inPrev = false;
  let hadPrev = false;

  function flush() {
    if (seg.length > 1) {
      const poly = createSvgEl('polyline');
      poly.setAttribute(
        'points',
        seg.map(p => map.x2px(p[0]) + ',' + map.y2px(p[1])).join(' ')
      );
      poly.setAttribute('stroke', color || '#d32f2f');
      poly.setAttribute('stroke-width', '2');
      poly.setAttribute('fill', 'none');
      poly.setAttribute('vector-effect', 'non-scaling-stroke');
      svg.appendChild(poly);
    }
    seg = [];
  }

  for (let x = xmin; x <= xmax + 1e-12; x += step) {
    const y = evalWithX(expr, x);
    const fin = Number.isFinite(y);

    if (!fin) {
      flush();
      hadPrev = false;
      xPrev = null;
      yPrev = null;
      continue;
    }

    // ------------------------------------------------------------
    // Modo sin clipping
    // ------------------------------------------------------------
    if (!doClip) {
      if (xPrev === null || yPrev === null) {
        seg.push([x, y]);
        xPrev = x;
        yPrev = y;
        continue;
      }

      if (screenJump(y, yPrev) > GRAPH_SETTINGS.noClipJumpFactor * map.h) {
        flush();
        seg.push([x, y]);
        xPrev = x;
        yPrev = y;
        continue;
      }

      if (seg.length === 0) {
        seg.push([xPrev, yPrev]);
      }

      const ok = appendAdaptiveInterval(xPrev, yPrev, x, y, seg, 0, false);

      if (!ok) {
        flush();
        seg.push([x, y]);
      }

      xPrev = x;
      yPrev = y;
      continue;
    }

    // ------------------------------------------------------------
    // Modo con clipping
    // ------------------------------------------------------------
    const inNow = insideY(y);

    if (!hadPrev) {
      if (inNow) seg.push([x, y]);
      hadPrev = true;
      xPrev = x;
      yPrev = y;
      inPrev = inNow;
      continue;
    }

    if (inPrev && inNow) {
  if (shouldForceBreak(yPrev, y)) {
    flush();
    seg.push([x, y]);
  } else if (screenJump(y, yPrev) > GRAPH_SETTINGS.visibleJumpFactor * map.h) {
    flush();
    seg.push([x, y]);
  } else {
    if (seg.length === 0) {
      seg.push([xPrev, yPrev]);
    }

    const ok = appendAdaptiveInterval(xPrev, yPrev, x, y, seg, 0, false);

    if (!ok) {
      flush();
      seg.push([x, y]);
    }
  }
} else if (inPrev && !inNow) {
  let pInt =
    intersectY(xPrev, yPrev, x, y, y > ymax ? ymax : ymin) ||
    intersectY(xPrev, yPrev, x, y, ymax) ||
    intersectY(xPrev, yPrev, x, y, ymin);

  if (pInt) {
    if (seg.length === 0) seg.push([xPrev, yPrev]);
    const ok = appendAdaptiveInterval(xPrev, yPrev, pInt[0], pInt[1], seg, 0, true);
    if (!ok) seg.push(pInt);
  }

      flush();
    } else if (!inPrev && inNow) {
      let pInt =
        intersectY(xPrev, yPrev, x, y, yPrev > ymax ? ymax : ymin) ||
        intersectY(xPrev, yPrev, x, y, ymax) ||
        intersectY(xPrev, yPrev, x, y, ymin);

      if (pInt) {
        seg.push(pInt);
       const ok = appendAdaptiveInterval(pInt[0], pInt[1], x, y, seg, 0, true);
        if (!ok) seg.push([x, y]);
      } else {
        seg.push([x, y]);
      }
    } else {
      const bothAbove = (yPrev > ymax) && (y > ymax);
      const bothBelow = (yPrev < ymin) && (y < ymin);

      if (bothAbove || bothBelow) {
        const p1 = intersectY(xPrev, yPrev, x, y, ymin);
        const p2 = intersectY(xPrev, yPrev, x, y, ymax);

        if (p1 && p2) {
          const a = p1[0] <= p2[0] ? p1 : p2;
          const b = p1[0] <= p2[0] ? p2 : p1;

          flush();
          seg.push(a);

          const ok = appendAdaptiveInterval(a[0], a[1], b[0], b[1], seg, 0, true);
          if (!ok) seg.push(b);

          flush();
        }
      } else {
        const forceBreak = shouldForceBreak(yPrev, y);
        const continuous = !forceBreak && intervalLooksContinuous(xPrev, x, 0);

        if (continuous) {
          const p1 = intersectY(xPrev, yPrev, x, y, ymin);
          const p2 = intersectY(xPrev, yPrev, x, y, ymax);

          if (p1 && p2) {
            const a = p1[0] <= p2[0] ? p1 : p2;
            const b = p1[0] <= p2[0] ? p2 : p1;

            flush();
            seg.push(a);

            const ok = appendAdaptiveInterval(a[0], a[1], b[0], b[1], seg, 0, true);
            if (!ok) seg.push(b);
          }
        }

        flush();
      }
    }

    xPrev = x;
    yPrev = y;
    inPrev = inNow;
  }

  flush();
}

  /* ======================================================================== */
  /* 13) REDIBUJO                                                             */
  /* ======================================================================== */
  function redrawOne(svg, state) {
    if (
      ![state.xmin, state.xmax, state.ymin, state.ymax].every(Number.isFinite) ||
      state.xmin === state.xmax ||
      state.ymin === state.ymax
    ) {
      return;
    }

    const size = getSvgLogicalSize(svg);
    if (state.lockAspect) {
      lockAspect(state, size.w, size.h);
    }

    const map = drawGrid(
      svg,
      state.xmin,
      state.xmax,
      state.ymin,
      state.ymax,
      state.stepX.val,
      state.stepY.val,
      state.stepX.mode,
      state.stepY.mode
    );

    state.map = map;

    (state.funcs || []).forEach(f => {
      drawFunctionFromExpr(
        svg,
        f.expr,
        map,
        state.xmin,
        state.xmax,
        state.ymin,
        state.ymax,
        f.color,
        state.clip
      );
    });

    if (svg.getAttribute('data-legend') === 'true') {
      drawLegend(svg, state.funcs);
    }

    drawExplicitPoints(svg, state.map, state);
    drawPointsAtX(svg, state.map, state);
    drawPointsAtY(svg, state.map, state);
  }

  /* ======================================================================== */
  /* 14) INTERACCIONES: PAN Y ZOOM                                            */
  /* ======================================================================== */
 
function attachInteractions(svg, state, onChange) {
  const isInteractive = (state.mode || 'interactive') !== 'snapshot';
  svg.style.cursor = isInteractive ? 'grab' : 'default';

  if (typeof svg.__cartesianoCleanup === 'function') {
    svg.__cartesianoCleanup();
    svg.__cartesianoCleanup = null;
  }

  const disposers = [];

  function add(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    disposers.push(() => target.removeEventListener(type, handler, options));
  }

  function cleanup() {
    while (disposers.length) {
      const dispose = disposers.pop();
      try {
        dispose();
      } catch (err) {}
    }
  }

  svg.__cartesianoCleanup = cleanup;

  const onContextMenu = (e) => e.preventDefault();
  add(svg, 'contextmenu', onContextMenu);

  if (!isInteractive) return;

  function rectWH() {
    return svg.getBoundingClientRect();
  }

  function panBy(dx, dy, rect) {
    const spanX = state.xmax - state.xmin;
    const spanY = state.ymax - state.ymin;

    state.xmin -= dx * (spanX / rect.width);
    state.xmax -= dx * (spanX / rect.width);
    state.ymin += dy * (spanY / rect.height);
    state.ymax += dy * (spanY / rect.height);

    const size = getSvgLogicalSize(svg);
    if (state.lockAspect) {
      lockAspect(state, size.w, size.h);
    }
    onChange();
  }

  function zoomAroundClientPoint(clientX, clientY, scale) {
    const rect = rectWH();
    const ox = clientX - rect.left;
    const oy = clientY - rect.top;

    const spanX = state.xmax - state.xmin;
    const spanY = state.ymax - state.ymin;

    const mx = state.xmin + (ox / rect.width) * spanX;
    const my = state.ymin + (1 - oy / rect.height) * spanY;

    state.xmin = mx + (state.xmin - mx) * scale;
    state.xmax = mx + (state.xmax - mx) * scale;
    state.ymin = my + (state.ymin - my) * scale;
    state.ymax = my + (state.ymax - my) * scale;

    const size = getSvgLogicalSize(svg);
    if (state.lockAspect) {
      lockAspect(state, size.w, size.h);
    }
    onChange();
  }

  add(svg, 'wheel', function (e) {
    e.preventDefault();
    const scale = e.deltaY > 0 ? 1.1 : 1 / 1.1;
    zoomAroundClientPoint(e.clientX, e.clientY, scale);
  }, { passive: false, capture: true });

  if ('PointerEvent' in window) {
    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (type) {
      add(svg, type, function (e) {
        e.preventDefault();
      }, { passive: false });
    });

    const active = new Map();
    let panId = null;
    let panLast = null;
    let pinchLastDist = null;

    function getTwoPoints() {
      const ids = Array.from(active.keys());
      if (ids.length < 2) return null;
      return {
        p1: active.get(ids[0]),
        p2: active.get(ids[1])
      };
    }

    add(svg, 'pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;

      active.set(e.pointerId, { x: e.clientX, y: e.clientY });

      try {
        svg.setPointerCapture(e.pointerId);
      } catch (err) {}

      if (active.size === 1) {
        panId = e.pointerId;
        panLast = { x: e.clientX, y: e.clientY };
        svg.style.cursor = 'grabbing';
      } else {
        panId = null;
        panLast = null;
      }

      e.preventDefault();
    }, { passive: false });

    add(svg, 'pointermove', function (e) {
      if (!active.has(e.pointerId)) return;

      active.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (active.size >= 2) {
        const pts = getTwoPoints();
        const newDist = Math.hypot(pts.p1.x - pts.p2.x, pts.p1.y - pts.p2.y);

        if (pinchLastDist && isFinite(newDist) && newDist > 0) {
          const midX = (pts.p1.x + pts.p2.x) / 2;
          const midY = (pts.p1.y + pts.p2.y) / 2;
          const scale = pinchLastDist / newDist;
          zoomAroundClientPoint(midX, midY, scale);
        }

        pinchLastDist = newDist;
        e.preventDefault();
        return;
      }

      if (panId === e.pointerId && panLast) {
        const dx = e.clientX - panLast.x;
        const dy = e.clientY - panLast.y;
        panLast = { x: e.clientX, y: e.clientY };
        panBy(dx, dy, rectWH());
        e.preventDefault();
      }
    }, { passive: false });

    function endPointer(e) {
      if (!active.has(e.pointerId)) return;

      try {
        svg.releasePointerCapture(e.pointerId);
      } catch (err) {}

      active.delete(e.pointerId);

      if (active.size < 2) pinchLastDist = null;

      if (active.size === 1) {
        const id = Array.from(active.keys())[0];
        panId = id;
        const p = active.get(id);
        panLast = { x: p.x, y: p.y };
        svg.style.cursor = 'grabbing';
      } else if (active.size === 0) {
        panId = null;
        panLast = null;
        svg.style.cursor = 'grab';
      }
    }

    add(svg, 'pointerup', endPointer);
    add(svg, 'pointercancel', endPointer);
    return;
  }

  let mouseDown = false;
  let mouseLast = null;

  add(svg, 'mousedown', function (e) {
    if (e.button !== 0) return;
    mouseDown = true;
    mouseLast = { x: e.clientX, y: e.clientY };
    svg.style.cursor = 'grabbing';
    e.preventDefault();
  });

  add(window, 'mousemove', function (e) {
    if (!mouseDown || !mouseLast) return;
    const dx = e.clientX - mouseLast.x;
    const dy = e.clientY - mouseLast.y;
    mouseLast = { x: e.clientX, y: e.clientY };
    panBy(dx, dy, rectWH());
  });

  add(window, 'mouseup', function () {
    mouseDown = false;
    mouseLast = null;
    svg.style.cursor = 'grab';
  });

  let touchMode = null;
  let lastPanTouch = null;
  let lastPinchDist = null;

  add(svg, 'touchstart', function (e) {
    if (e.touches.length === 1) {
      touchMode = 'pan';
      lastPanTouch = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
      svg.style.cursor = 'grabbing';
    } else if (e.touches.length >= 2) {
      touchMode = 'pinch';
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDist = Math.hypot(dx, dy);
    }
    e.preventDefault();
  }, { passive: false });

  add(svg, 'touchmove', function (e) {
    if (touchMode === 'pan' && e.touches.length === 1 && lastPanTouch) {
      const dx = e.touches[0].clientX - lastPanTouch.x;
      const dy = e.touches[0].clientY - lastPanTouch.y;
      lastPanTouch = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
      panBy(dx, dy, rectWH());
    } else if (touchMode === 'pinch' && e.touches.length >= 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);

      if (lastPinchDist && isFinite(newDist) && newDist > 0) {
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const scale = lastPinchDist / newDist;
        zoomAroundClientPoint(midX, midY, scale);
      }

      lastPinchDist = newDist;
    }

    e.preventDefault();
  }, { passive: false });

  add(svg, 'touchend', function (e) {
    if (e.touches.length === 0) {
      touchMode = null;
      lastPanTouch = null;
      lastPinchDist = null;
      svg.style.cursor = 'grab';
    } else if (e.touches.length === 1) {
      touchMode = 'pan';
      lastPanTouch = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY
      };
      lastPinchDist = null;
    }
  }, { passive: false });

  add(svg, 'touchcancel', function () {
    touchMode = null;
    lastPanTouch = null;
    lastPinchDist = null;
    svg.style.cursor = 'grab';
  }, { passive: false });
}






  /* ======================================================================== */
  /* 15) INICIALIZACIÓN DE CADA SVG                                           */
  /* ======================================================================== */
  function initOne(svg) {
    const rangeX = parseRange(svg.getAttribute('data-range-x'));
    const rangeY = parseRange(svg.getAttribute('data-range-y'));
    const stepX = parseStep(svg.getAttribute('data-step-x'));
    const stepY = parseStep(svg.getAttribute('data-step-y'));

    const exprs = (svg.getAttribute('data-funcs') || '')
      .split(';')
      .map(t => t.trim())
      .filter(Boolean);

    const labels = (svg.getAttribute('data-labels') || '')
      .split(';')
      .map(t => t.trim());

    const colors = (svg.getAttribute('data-colors') || '')
      .split(';')
      .map(t => t.trim());

    const clipAttr = (svg.getAttribute('data-clip') || 'true').toLowerCase() !== 'false';
    const modeAttr = (svg.getAttribute('data-mode') || 'interactive').toLowerCase();

    svg.style.touchAction = modeAttr === 'snapshot' ? 'auto' : 'none';

    const funcs = exprs.map((expr, i) => ({
      expr,
      label: labels[i] || expr,
      color: colors[i] || undefined
    }));

    const pointsRaw =
      svg.getAttribute('data-point') ||
      svg.getAttribute('data-points') ||
      '';

    const pxRaw =
      svg.getAttribute('data-point-x') ||
      svg.getAttribute('data-point_x') ||
      '';

    const pyRaw =
      svg.getAttribute('data-point-y') ||
      svg.getAttribute('data-point_y') ||
      '';

    const state = {
      xmin: rangeX[0],
      xmax: rangeX[1],
      ymin: rangeY[0],
      ymax: rangeY[1],
      stepX,
      stepY,
      funcs,
      map: null,
      clip: clipAttr,
      mode: modeAttr,
      lockAspect: (svg.getAttribute('data-lock-aspect') || 'true').toLowerCase() !== 'false',
      pointsExplicit: parsePointList(pointsRaw),
      pointsAtX: parsePointXSpec(pxRaw),
      pointsAtY: parsePointYSpec(pyRaw)
    };

    svg.__state__ = state;

    let rafId = null;

    function onChangeRAF() {
      if (rafId != null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        redrawOne(svg, state);
      });
    }

    redrawOne(svg, state);
    attachInteractions(svg, state, onChangeRAF);
  }

 /* ======================================================================== */
  /* 16) INICIO / API PÚBLICA                                                 */
  /* ======================================================================== */

  function init(root = document) {
    const base = root && typeof root.querySelectorAll === 'function'
      ? root
      : document;

    const svgsToProcess = base.querySelectorAll('svg[id^="grid-"]');
    if (svgsToProcess.length > 0) {
      svgsToProcess.forEach(initOne);
    }
    return svgsToProcess.length;
  }

  function getState(ref) {
    const svg =
      typeof ref === 'string'
        ? document.getElementById(ref)
        : ref;

    if (!svg) return null;
    return svg.__state__ || null;
  }

  function redraw(ref) {
    const svg =
      typeof ref === 'string'
        ? document.getElementById(ref)
        : ref;

    if (!svg || !svg.__state__) return false;
    redrawOne(svg, svg.__state__);
    return true;
  }

  function reinicializar(ref) {
    const svg =
      typeof ref === 'string'
        ? document.getElementById(ref)
        : ref;

    if (!svg) return false;
    initOne(svg);
    return true;
  }

  const api = Object.freeze({
    init,
    initOne,
    redraw,
    redrawOne,
    reinicializar,
    getState,
    parseConstExpr,
    parseRange,
    parseStep,
    lockAspect
  });

  window.CartesianoV6 = Object.assign(
    {},
    window.CartesianoV6 || {},
    api
  );

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      init(document);
    });
  } else {
    init(document);
  }

})(window, document);
