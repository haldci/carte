/*!
 * vcard.js — Génération d'une fiche contact vCard 3.0 (RFC 2426), sans dépendance.
 * Licence : MIT (voir LICENSE).
 *
 * VCardLite.build(config, {
 *   urls: [...],            // sites ajoutés en champs URL
 *   note: true|false,       // ajoute config.noteVcard
 *   photoBase64: "...",     // photo JPEG encodée en base64 (fichier .vcf uniquement)
 *   fold: true|false,       // plie les lignes à 75 octets (RFC 2425 §5.8.1)
 *   trailingNewline: true|false
 * })
 */
(function (global, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else global.VCardLite = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Échappement des valeurs de type texte (RFC 2426 §4) : \ , ; et retours à la ligne
  function esc(value) {
    return String(value)
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/,/g, "\\,")
      .replace(/;/g, "\\;");
  }

  function cleanTel(tel) {
    return String(tel).replace(/[^\d+]/g, "");
  }

  function phonesOf(c) {
    if (Array.isArray(c.telephones) && c.telephones.length) {
      return c.telephones.map(function (p) { return typeof p === "string" ? p : p.numero; }).filter(Boolean);
    }
    return c.telephone ? [c.telephone] : [];
  }

  function utf8Length(ch) {
    var cp = ch.codePointAt(0);
    return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
  }

  // Pliage : aucune ligne physique ne dépasse 75 octets ; les suites commencent par une espace.
  // Les caractères UTF-8 ne sont jamais coupés.
  function fold(line) {
    var out = [], cur = "", bytes = 0;
    for (var ch of line) {
      var n = utf8Length(ch);
      if (bytes + n > 75) {
        out.push(cur);
        cur = " " + ch;
        bytes = 1 + n;
      } else {
        cur += ch;
        bytes += n;
      }
    }
    out.push(cur);
    return out.join("\r\n");
  }

  function build(c, options) {
    var o = options || {};
    var lines = ["BEGIN:VCARD", "VERSION:3.0"];
    lines.push("N:" + [c.nom || "", c.prenom || "", "", "", ""].map(esc).join(";"));
    lines.push("FN:" + esc([c.prenom, c.nom].filter(Boolean).join(" ")));
    if (c.organisation) lines.push("ORG:" + esc(c.organisation));
    if (c.titre) lines.push("TITLE:" + esc(c.titre));
    phonesOf(c).forEach(function (t) { lines.push("TEL;TYPE=CELL:" + cleanTel(t)); });
    if (c.email) lines.push("EMAIL;TYPE=INTERNET:" + String(c.email).trim());
    (o.urls || []).filter(Boolean).forEach(function (u) {
      lines.push("URL:" + String(u).trim());
    });
    if (o.note && c.noteVcard) lines.push("NOTE:" + esc(c.noteVcard));
    if (o.photoBase64) lines.push("PHOTO;ENCODING=b;TYPE=JPEG:" + o.photoBase64);
    lines.push("END:VCARD");
    if (o.fold) lines = lines.map(fold);
    return lines.join("\r\n") + (o.trailingNewline === false ? "" : "\r\n");
  }

  return { build: build, escape: esc, cleanTel: cleanTel, phonesOf: phonesOf, fold: fold };
});
