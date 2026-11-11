/*!
 * qrcode.js — Générateur de QR Code autonome, sans dépendance, utilisable hors ligne.
 *
 * Conforme à la norme ISO/IEC 18004 (QR Code modèle 2) :
 *   - mode octet (texte encodé en UTF-8) ;
 *   - versions 1 à 40 ;
 *   - niveaux de correction d'erreur L, M, Q, H (Reed-Solomon sur GF(256)) ;
 *   - choix automatique du masque selon les 4 règles de pénalité de la norme.
 *
 * Structure inspirée de la bibliothèque « QR Code generator » de Project Nayuki
 * (licence MIT). Licence de ce fichier : MIT (voir LICENSE).
 *
 * API :
 *   QRCodeLite.encodeText(texte, "M", { minVersion, maxVersion, boostEcl, mask })
 *     -> { version, size, ecl, mask, modules: boolean[size][size] }
 *   QRCodeLite.toSvgString(qr, { border, dark, light, title })
 *   QRCodeLite.drawToCanvas(qr, canvas, { scale, border, dark, light })
 */
(function (global, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else global.QRCodeLite = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var ECL_INDEX = { L: 0, M: 1, Q: 2, H: 3 };
  var ECL_NAMES = ["L", "M", "Q", "H"];
  var ECL_FORMAT_BITS = [1, 0, 3, 2]; // valeurs normalisées de L, M, Q, H

  // Nombre de codewords de correction par bloc [niveau][version] (index 0 inutilisé)
  var ECC_CODEWORDS_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
  ];

  // Nombre de blocs de correction d'erreur [niveau][version] (index 0 inutilisé)
  var NUM_ERROR_CORRECTION_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
  ];

  var PENALTY_N1 = 3, PENALTY_N2 = 3, PENALTY_N3 = 40, PENALTY_N4 = 10;

  // ---------------------------------------------------------------- Capacités
  function getNumRawDataModules(ver) {
    var result = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      var numAlign = Math.floor(ver / 7) + 2;
      result -= (25 * numAlign - 10) * numAlign - 55;
      if (ver >= 7) result -= 36;
    }
    return result;
  }

  function getNumDataCodewords(ver, ecl) {
    return Math.floor(getNumRawDataModules(ver) / 8) -
      ECC_CODEWORDS_PER_BLOCK[ecl][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl][ver];
  }

  function getAlignmentPatternPositions(ver) {
    if (ver === 1) return [];
    var size = ver * 4 + 17;
    var numAlign = Math.floor(ver / 7) + 2;
    var step = Math.floor((ver * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
    var result = [6];
    for (var pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  // ------------------------------------------------------------ Reed-Solomon
  function rsMultiply(x, y) { // multiplication dans GF(2^8), polynôme 0x11D
    var z = 0;
    for (var i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }

  function rsComputeDivisor(degree) {
    var result = [];
    for (var i = 0; i < degree - 1; i++) result.push(0);
    result.push(1);
    var root = 1;
    for (var k = 0; k < degree; k++) {
      for (var j = 0; j < result.length; j++) {
        result[j] = rsMultiply(result[j], root);
        if (j + 1 < result.length) result[j] ^= result[j + 1];
      }
      root = rsMultiply(root, 0x02);
    }
    return result;
  }

  function rsComputeRemainder(data, divisor) {
    var result = divisor.map(function () { return 0; });
    for (var n = 0; n < data.length; n++) {
      var factor = data[n] ^ result.shift();
      result.push(0);
      for (var i = 0; i < divisor.length; i++) result[i] ^= rsMultiply(divisor[i], factor);
    }
    return result;
  }

  function addEccAndInterleave(data, version, ecl) {
    var numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl][version];
    var blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl][version];
    var rawCodewords = Math.floor(getNumRawDataModules(version) / 8);
    var numShortBlocks = numBlocks - rawCodewords % numBlocks;
    var shortBlockLen = Math.floor(rawCodewords / numBlocks);
    var divisor = rsComputeDivisor(blockEccLen);
    var blocks = [];
    for (var i = 0, k = 0; i < numBlocks; i++) {
      var dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
      k += dat.length;
      var ecc = rsComputeRemainder(dat, divisor);
      if (i < numShortBlocks) dat.push(0); // emplacement fictif, ignoré à l'entrelacement
      blocks.push(dat.concat(ecc));
    }
    var result = [];
    for (var c = 0; c < blocks[0].length; c++) {
      for (var b = 0; b < blocks.length; b++) {
        if (c !== shortBlockLen - blockEccLen || b >= numShortBlocks) result.push(blocks[b][c]);
      }
    }
    return result;
  }

  // ------------------------------------------------------------------ Masques
  function maskBit(mask, x, y) {
    switch (mask) {
      case 0: return (x + y) % 2 === 0;
      case 1: return y % 2 === 0;
      case 2: return x % 3 === 0;
      case 3: return (x + y) % 3 === 0;
      case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
      case 5: return (x * y) % 2 + (x * y) % 3 === 0;
      case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
      case 7: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
      default: throw new RangeError("Masque invalide");
    }
  }

  var FINDER_LIKE_1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
  var FINDER_LIKE_2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];

  function countFinderLike(get, len) {
    var count = 0;
    for (var k = 0; k + 11 <= len; k++) {
      var m1 = true, m2 = true;
      for (var t = 0; t < 11 && (m1 || m2); t++) {
        var v = get(k + t) ? 1 : 0;
        if (v !== FINDER_LIKE_1[t]) m1 = false;
        if (v !== FINDER_LIKE_2[t]) m2 = false;
      }
      if (m1) count++;
      if (m2) count++;
    }
    return count;
  }

  function penaltyScore(modules, size) {
    var result = 0, x, y, run, color;
    // Règle 1 : séries de 5 modules ou plus de même couleur (lignes puis colonnes)
    for (y = 0; y < size; y++) {
      color = modules[y][0]; run = 1;
      for (x = 1; x < size; x++) {
        if (modules[y][x] === color) { run++; if (run === 5) result += PENALTY_N1; else if (run > 5) result++; }
        else { color = modules[y][x]; run = 1; }
      }
    }
    for (x = 0; x < size; x++) {
      color = modules[0][x]; run = 1;
      for (y = 1; y < size; y++) {
        if (modules[y][x] === color) { run++; if (run === 5) result += PENALTY_N1; else if (run > 5) result++; }
        else { color = modules[y][x]; run = 1; }
      }
    }
    // Règle 2 : blocs 2x2 de même couleur
    for (y = 0; y < size - 1; y++) {
      for (x = 0; x < size - 1; x++) {
        var c = modules[y][x];
        if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) result += PENALTY_N2;
      }
    }
    // Règle 3 : motifs ressemblant aux repères (1:1:3:1:1 + 4 modules clairs)
    for (y = 0; y < size; y++) {
      (function (row) { result += PENALTY_N3 * countFinderLike(function (i) { return row[i]; }, size); })(modules[y]);
    }
    for (x = 0; x < size; x++) {
      (function (col) { result += PENALTY_N3 * countFinderLike(function (i) { return modules[i][col]; }, size); })(x);
    }
    // Règle 4 : équilibre clair/sombre
    var dark = 0;
    for (y = 0; y < size; y++) for (x = 0; x < size; x++) if (modules[y][x]) dark++;
    var total = size * size;
    var k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += k * PENALTY_N4;
    return result;
  }

  // --------------------------------------------------------- Construction
  function buildSymbol(version, ecl, dataCodewords, forcedMask) {
    var size = version * 4 + 17;
    var modules = [], isFunction = [], i, j;
    for (i = 0; i < size; i++) {
      modules.push(new Array(size).fill(false));
      isFunction.push(new Array(size).fill(false));
    }
    function setFunctionModule(x, y, dark) { modules[y][x] = dark; isFunction[y][x] = true; }

    // Motifs de synchronisation
    for (i = 0; i < size; i++) {
      setFunctionModule(6, i, i % 2 === 0);
      setFunctionModule(i, 6, i % 2 === 0);
    }
    // Motifs de repérage et séparateurs
    function drawFinder(cx, cy) {
      for (var dy = -4; dy <= 4; dy++) {
        for (var dx = -4; dx <= 4; dx++) {
          var dist = Math.max(Math.abs(dx), Math.abs(dy));
          var xx = cx + dx, yy = cy + dy;
          if (xx >= 0 && xx < size && yy >= 0 && yy < size) setFunctionModule(xx, yy, dist !== 2 && dist !== 4);
        }
      }
    }
    drawFinder(3, 3); drawFinder(size - 4, 3); drawFinder(3, size - 4);
    // Motifs d'alignement
    var pos = getAlignmentPatternPositions(version), n = pos.length;
    for (i = 0; i < n; i++) {
      for (j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        for (var ay = -2; ay <= 2; ay++) {
          for (var ax = -2; ax <= 2; ax++) {
            setFunctionModule(pos[i] + ax, pos[j] + ay, Math.max(Math.abs(ax), Math.abs(ay)) !== 1);
          }
        }
      }
    }
    // Informations de format (deux copies) — réservées ici, valeurs finales après le masque
    function drawFormatBits(mask) {
      var data = (ECL_FORMAT_BITS[ecl] << 3) | mask;
      var rem = data;
      for (var r = 0; r < 10; r++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var bits = ((data << 10) | rem) ^ 0x5412;
      function bit(b) { return ((bits >>> b) & 1) !== 0; }
      var t;
      for (t = 0; t <= 5; t++) setFunctionModule(8, t, bit(t));
      setFunctionModule(8, 7, bit(6));
      setFunctionModule(8, 8, bit(7));
      setFunctionModule(7, 8, bit(8));
      for (t = 9; t < 15; t++) setFunctionModule(14 - t, 8, bit(t));
      for (t = 0; t < 8; t++) setFunctionModule(size - 1 - t, 8, bit(t));
      for (t = 8; t < 15; t++) setFunctionModule(8, size - 15 + t, bit(t));
      setFunctionModule(8, size - 8, true); // module sombre fixe
    }
    drawFormatBits(0);
    // Informations de version (versions 7 et plus)
    if (version >= 7) {
      var vrem = version;
      for (i = 0; i < 12; i++) vrem = (vrem << 1) ^ ((vrem >>> 11) * 0x1F25);
      var vbits = (version << 12) | vrem;
      for (i = 0; i < 18; i++) {
        var on = ((vbits >>> i) & 1) !== 0;
        var a = size - 11 + (i % 3), b = Math.floor(i / 3);
        setFunctionModule(a, b, on);
        setFunctionModule(b, a, on);
      }
    }

    // Placement des codewords en zigzag
    var allCodewords = addEccAndInterleave(dataCodewords, version, ecl);
    var bitIndex = 0, totalBits = allCodewords.length * 8;
    for (var right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      var upward = ((right + 1) & 2) === 0;
      for (var vert = 0; vert < size; vert++) {
        for (j = 0; j < 2; j++) {
          var x = right - j;
          var y = upward ? size - 1 - vert : vert;
          if (!isFunction[y][x] && bitIndex < totalBits) {
            modules[y][x] = ((allCodewords[bitIndex >>> 3] >>> (7 - (bitIndex & 7))) & 1) !== 0;
            bitIndex++;
          }
        }
      }
    }

    function applyMask(mask) {
      for (var yy = 0; yy < size; yy++) {
        for (var xx = 0; xx < size; xx++) {
          if (!isFunction[yy][xx] && maskBit(mask, xx, yy)) modules[yy][xx] = !modules[yy][xx];
        }
      }
    }

    var mask = forcedMask;
    if (mask === -1) {
      var best = Infinity;
      for (var m = 0; m < 8; m++) {
        applyMask(m);
        drawFormatBits(m);
        var p = penaltyScore(modules, size);
        if (p < best) { best = p; mask = m; }
        applyMask(m); // annule (XOR)
      }
    }
    applyMask(mask);
    drawFormatBits(mask);

    return {
      version: version,
      size: size,
      ecl: ECL_NAMES[ecl],
      mask: mask,
      modules: modules,
      isDark: function (px, py) { return px >= 0 && py >= 0 && px < size && py < size && modules[py][px]; }
    };
  }

  // -------------------------------------------------------------- Encodage
  function utf8Bytes(text) {
    if (typeof TextEncoder !== "undefined") return Array.prototype.slice.call(new TextEncoder().encode(text));
    var s = unescape(encodeURIComponent(text)), out = [];
    for (var i = 0; i < s.length; i++) out.push(s.charCodeAt(i));
    return out;
  }

  function encodeBytes(bytes, eclName, options) {
    var opts = options || {};
    var ecl = ECL_INDEX[String(eclName || "M").toUpperCase()];
    if (ecl === undefined) throw new RangeError("Niveau de correction invalide : " + eclName);
    var minVersion = opts.minVersion || 1, maxVersion = opts.maxVersion || 40;
    var boostEcl = opts.boostEcl !== false;
    var forcedMask = typeof opts.mask === "number" ? opts.mask : -1;
    if (!(minVersion >= 1 && minVersion <= maxVersion && maxVersion <= 40)) throw new RangeError("Plage de versions invalide");
    if (forcedMask < -1 || forcedMask > 7) throw new RangeError("Masque invalide");

    var version, usedBits;
    for (version = minVersion; ; version++) {
      var ccBits = version < 10 ? 8 : 16;
      usedBits = 4 + ccBits + bytes.length * 8;
      if (bytes.length < (1 << ccBits) && usedBits <= getNumDataCodewords(version, ecl) * 8) break;
      if (version >= maxVersion) throw new RangeError("Données trop longues pour un QR code (" + bytes.length + " octets)");
    }
    if (boostEcl) {
      for (var e = ecl + 1; e <= 3; e++) if (usedBits <= getNumDataCodewords(version, e) * 8) ecl = e;
    }

    var bits = [];
    function appendBits(val, len) { for (var i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    appendBits(0x4, 4); // indicateur de mode « octet »
    appendBits(bytes.length, version < 10 ? 8 : 16);
    for (var bi = 0; bi < bytes.length; bi++) appendBits(bytes[bi], 8);
    var capacityBits = getNumDataCodewords(version, ecl) * 8;
    appendBits(0, Math.min(4, capacityBits - bits.length)); // terminateur
    appendBits(0, (8 - bits.length % 8) % 8);
    for (var pad = 0xEC; bits.length < capacityBits; pad ^= 0xEC ^ 0x11) appendBits(pad, 8);

    var dataCodewords = new Array(bits.length / 8).fill(0);
    for (var k = 0; k < bits.length; k++) dataCodewords[k >>> 3] |= bits[k] << (7 - (k & 7));
    return buildSymbol(version, ecl, dataCodewords, forcedMask);
  }

  function encodeText(text, eclName, options) {
    return encodeBytes(utf8Bytes(String(text)), eclName, options);
  }

  // ---------------------------------------------------------------- Rendu
  function escapeXml(s) {
    return String(s).replace(/[&<>"']/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[ch];
    });
  }

  function toSvgString(qr, options) {
    var o = options || {};
    var border = o.border === undefined ? 4 : o.border;
    var dark = o.dark || "#000000", light = o.light || "#FFFFFF";
    var path = [];
    for (var y = 0; y < qr.size; y++) {
      var x = 0;
      while (x < qr.size) {
        if (!qr.modules[y][x]) { x++; continue; }
        var start = x;
        while (x < qr.size && qr.modules[y][x]) x++;
        path.push("M" + (start + border) + " " + (y + border) + "h" + (x - start) + "v1h-" + (x - start) + "z");
      }
    }
    var dim = qr.size + border * 2;
    var title = o.title ? "<title>" + escapeXml(o.title) + "</title>" : "";
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + dim + " " + dim +
      '" shape-rendering="crispEdges" role="img"' + (o.title ? ' aria-label="' + escapeXml(o.title) + '"' : "") + ">" + title +
      '<rect width="' + dim + '" height="' + dim + '" fill="' + light + '"/>' +
      '<path d="' + path.join("") + '" fill="' + dark + '"/></svg>';
  }

  function drawToCanvas(qr, canvas, options) {
    var o = options || {};
    var border = o.border === undefined ? 4 : o.border;
    var scale = o.scale || 10;
    var dim = (qr.size + border * 2) * scale;
    canvas.width = dim;
    canvas.height = dim;
    var ctx = canvas.getContext("2d");
    ctx.fillStyle = o.light || "#FFFFFF";
    ctx.fillRect(0, 0, dim, dim);
    ctx.fillStyle = o.dark || "#000000";
    for (var y = 0; y < qr.size; y++) {
      for (var x = 0; x < qr.size; x++) {
        if (qr.modules[y][x]) ctx.fillRect((x + border) * scale, (y + border) * scale, scale, scale);
      }
    }
    return canvas;
  }

  return {
    encodeText: encodeText,
    encodeBytes: encodeBytes,
    toSvgString: toSvgString,
    drawToCanvas: drawToCanvas,
    // exposés pour les tests de conformité
    _internals: {
      getNumDataCodewords: getNumDataCodewords,
      getNumRawDataModules: getNumRawDataModules,
      getAlignmentPatternPositions: getAlignmentPatternPositions,
      ECL_INDEX: ECL_INDEX
    }
  };
});
