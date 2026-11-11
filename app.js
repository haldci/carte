/*!
 * app.js — Carte de visite numérique (PWA hors ligne), v4. Licence : MIT.
 * Aucune requête vers un tiers, aucun traceur : tout est calculé sur le téléphone.
 */
(function () {
  "use strict";

  var C = window.CARTE || {};
  var $ = function (sel) { return document.querySelector(sel); };
  var noop = function () {};

  // ------------------------------------------------------------ Données
  var fullName = [C.prenom, C.nom].filter(Boolean).join(" ");

  function detectPageUrl() {
    if (C.urlPage) return C.urlPage;
    if (!/^https?:$/.test(location.protocol)) return ""; // fichier local : pas d'URL publique
    return location.origin + location.pathname.replace(/index\.html$/, "");
  }
  var pageUrl = detectPageUrl();

  function cleanTel(t) { return String(t || "").replace(/[^\d+]/g, ""); }

  var phones = Array.isArray(C.telephones) && C.telephones.length
    ? C.telephones.map(function (p) { return typeof p === "string" ? { numero: p } : p; }).filter(function (p) { return p.numero; })
    : (C.telephone ? [{ numero: C.telephone }] : []);

  // CV : liste « cvs » (FR, EN…) ou, à défaut, l'ancien champ unique « cvUrl »
  var cvs = (Array.isArray(C.cvs) && C.cvs.length ? C.cvs : (C.cvUrl ? [{ url: C.cvUrl, libelle: "CV (PDF)" }] : []))
    .filter(function (c) { return c && c.url; });

  // Adresse complète (nécessaire dans un QR ou une fiche contact) ; vide si la carte n'est pas encore en ligne
  function absUrl(u) {
    if (/^https?:\/\//i.test(u)) return u;
    if (!pageUrl) return "";
    try { return new URL(u, pageUrl).href; } catch (e) { return ""; }
  }
  var cvAbs = cvs.map(function (c) { return absUrl(c.url); }).filter(Boolean);

  // QR « Contact » : fiche compacte (lisible sans réseau par le téléphone qui scanne)
  var vcardQr = VCardLite.build(C, { urls: [pageUrl || cvAbs[0], C.linkedin], note: false, trailingNewline: false });
  // Fichier .vcf complet (bouton « Enregistrer le contact ») ; la photo est ajoutée au clic
  var fileUrls = [pageUrl, C.linkedin].concat(cvAbs);
  var vcardFile = VCardLite.build(C, { urls: fileUrls, note: true, fold: true });

  function photoBase64() {
    if (!C.photo || !window.fetch) return Promise.resolve("");
    return fetch(C.photo)
      .then(function (r) { if (!r.ok) throw new Error("photo"); return r.blob(); })
      .then(function (blob) {
        return new Promise(function (resolve) {
          var reader = new FileReader();
          reader.onload = function () { resolve(String(reader.result).split(",")[1] || ""); };
          reader.onerror = function () { resolve(""); };
          reader.readAsDataURL(blob);
        });
      })
      .catch(function () { return ""; });
  }

  function buildVcardFile() {
    return photoBase64().then(function (b64) {
      return VCardLite.build(C, { urls: fileUrls, note: true, fold: true, photoBase64: b64 });
    });
  }

  // Coordonnées en texte, pour un envoi par message quand le scan est impossible
  function contactText() {
    var lines = [fullName + (C.titre ? " — " + C.titre : "")];
    phones.forEach(function (p) { lines.push("Tél." + (p.libelle ? " " + p.libelle : "") + " : " + p.numero); });
    if (C.email) lines.push("E-mail : " + C.email);
    if (C.linkedin) lines.push("LinkedIn : " + C.linkedin);
    if (pageUrl) lines.push("Ma carte et mes CV : " + pageUrl);
    return lines.join("\n");
  }

  // ---------------------------------------------------------- Affichage
  // Typographie : chaque segment « A · B · C » reste insécable et le « · » suit son segment
  function renderSegments(el, text) {
    var parts = String(text || "").split(/\s*·\s*/).filter(Boolean);
    el.textContent = "";
    parts.forEach(function (p, i) {
      var span = document.createElement("span");
      span.className = "seg";
      span.textContent = p + (i < parts.length - 1 ? " ·" : "");
      el.appendChild(span);
      if (i < parts.length - 1) el.appendChild(document.createTextNode(" "));
    });
  }

  document.title = fullName + (C.titre ? " — " + C.titre : "");
  $("#nom").textContent = fullName;
  $("#titre").textContent = C.titre || "";
  renderSegments($("#accroche"), C.accroche);
  renderSegments($("#mobilite"), C.mobilite);
  $("#salon-nom").textContent = fullName;
  $("#salon-titre").textContent = C.titre || "";

  var initials = ((C.prenom || " ")[0] + (C.nom || " ")[0]).trim().toUpperCase();
  var avatar = $("#avatar");
  if (C.photo) {
    var img = document.createElement("img");
    img.src = C.photo; img.alt = "";
    img.onerror = function () { avatar.textContent = initials; };
    avatar.appendChild(img);
    var sp = $("#salon-photo");
    sp.src = C.photo;
    sp.hidden = false;
    sp.onerror = function () { sp.hidden = true; };
  } else {
    avatar.textContent = initials;
  }

  var badges = $("#badges");
  (C.badges || []).forEach(function (b) {
    var li = document.createElement("li");
    li.textContent = b;
    badges.appendChild(li);
  });
  if (!badges.children.length) badges.hidden = true;

  var chiffres = $("#chiffres");
  (C.chiffres || []).forEach(function (k) {
    if (!k || !k.valeur) return;
    var tile = document.createElement("div");
    tile.className = "kpi";
    var v = document.createElement("strong");
    v.textContent = k.valeur;
    var l = document.createElement("span");
    l.textContent = k.libelle || "";
    tile.appendChild(v);
    tile.appendChild(l);
    chiffres.appendChild(tile);
  });
  if (!chiffres.children.length) chiffres.hidden = true;
  ["#titre", "#accroche", "#mobilite"].forEach(function (s) { if (!$(s).textContent) $(s).hidden = true; });

  function setLink(sel, href) {
    var el = $(sel);
    if (href) el.href = href; else el.hidden = true;
  }

  // Un bouton d'appel par numéro (le premier réutilise le modèle du HTML)
  var telTpl = $("#btn-tel");
  if (!phones.length) {
    telTpl.hidden = true;
  } else {
    var last = telTpl;
    phones.forEach(function (p, i) {
      var a = i === 0 ? telTpl : telTpl.cloneNode(true);
      a.id = i === 0 ? "btn-tel" : "btn-tel-" + (i + 1);
      a.href = "tel:" + cleanTel(p.numero);
      a.querySelector(".lbl").textContent = phones.length > 1 && p.libelle ? "Tél. " + p.libelle : "Appeler";
      a.setAttribute("aria-label", "Appeler le " + p.numero + (p.libelle ? " (" + p.libelle + ")" : ""));
      if (i > 0) { last.after(a); last = a; }
    });
  }
  setLink("#btn-mail", C.email ? "mailto:" + C.email : "");
  setLink("#btn-linkedin", C.linkedin || "");
  setLink("#btn-whatsapp", C.whatsapp ? "https://wa.me/" + cleanTel(C.whatsapp).replace(/^\+/, "") : "");

  // Un bouton par CV (le premier réutilise le modèle du HTML)
  var cvTpl = $("#btn-cv");
  if (!cvs.length) {
    $("#cv-grid").hidden = true;
    if (window.console) console.warn("config.js : aucun CV renseigné — les boutons CV sont masqués.");
  } else {
    var lastCv = cvTpl;
    cvs.forEach(function (c, i) {
      var a = i === 0 ? cvTpl : cvTpl.cloneNode(true);
      a.id = i === 0 ? "btn-cv" : "btn-cv-" + (i + 1);
      a.href = c.url;
      a.querySelector(".lbl").textContent = c.libelle || "CV (PDF)";
      a.setAttribute("aria-label", (c.libelle || "CV") + " — PDF");
      if (i > 0) { lastCv.after(a); lastCv = a; }
    });
  }

  // --------------------------------------------------------------- Outils
  var toastTimer = null;
  function toast(msg) {
    var t = $("#toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2800);
  }

  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url; a.download = filename; a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 15000);
  }

  function slug(s) {
    return String(s || "contact").normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "contact";
  }

  function copyText(text, okMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(okMsg || "Copié"); }, function () { toast(text); });
    } else {
      toast(text);
    }
  }

  // Partage natif (menu Android : WhatsApp, Gmail, Quick Share…) ; à défaut, copie dans le presse-papiers
  function shareLink(url, title) {
    if (!url) { toast("Disponible une fois la carte en ligne."); return; }
    if (navigator.share) { navigator.share({ title: title || fullName, url: url }).catch(noop); return; }
    copyText(url, "Lien copié");
  }

  function shareText(text) {
    if (navigator.share) { navigator.share({ title: fullName, text: text }).catch(noop); return; }
    copyText(text, "Coordonnées copiées");
  }

  // CV préchargés en fichiers, pour les envoyer en PDF depuis le menu de partage (même sans réseau)
  var cvFiles = [];
  function preloadCvFiles() {
    if (!window.fetch || !window.File) return;
    cvs.forEach(function (c, i) {
      if (cvFiles[i] || /^https?:\/\//i.test(c.url)) return; // un CV hébergé ailleurs est partagé par son lien
      fetch(c.url)
        .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.blob(); })
        .then(function (blob) {
          var name = c.url.split("/").pop().split("?")[0] || ("CV-" + (i + 1) + ".pdf");
          cvFiles[i] = new File([blob], name, { type: "application/pdf" });
        })
        .catch(noop);
    });
  }

  function shareCv(i) {
    var c = cvs[i];
    if (!c) return;
    var title = fullName + " — " + (c.libelle || "CV");
    var f = cvFiles[i];
    if (f && navigator.canShare) {
      var data = { files: [f], title: title, text: title + (C.titre ? " (" + C.titre + ")" : "") };
      var ok = false;
      try { ok = navigator.canShare(data); } catch (e) { ok = false; }
      if (ok) { navigator.share(data).catch(noop); return; }
    }
    shareLink(absUrl(c.url) || "", title);
  }

  // ------------------------------------------------------------ Actions
  $("#btn-vcf").addEventListener("click", function () {
    buildVcardFile().then(function (text) {
      triggerDownload(new Blob([text], { type: "text/vcard;charset=utf-8" }), slug(fullName) + ".vcf");
      toast("Fiche contact téléchargée : ouvrez-la pour l'ajouter.");
    });
  });

  $("#btn-share").addEventListener("click", function () {
    var url = pageUrl || C.linkedin || "";
    if (navigator.share) {
      navigator.share({ title: fullName, text: fullName + (C.titre ? " — " + C.titre : ""), url: url }).catch(noop);
      return;
    }
    copyText(url, "Lien copié");
  });

  // ---------------------------------------------------------- Mode salon
  // Cinq QR au choix : Contact (sans réseau), CV FR, CV EN, LinkedIn, Ma carte
  var MODES = [{
    id: "contact", court: "Contact", ecc: "M",
    text: function () { return vcardQr; },
    legende: "Scannez avec l'appareil photo, puis « Ajouter le contact ». Fonctionne sans réseau.",
    action: "Envoyer mes coordonnées",
    run: function () { shareText(contactText()); }
  }];
  cvs.forEach(function (c, i) {
    var en = c.code === "en";
    MODES.push({
      id: "cv-" + (c.code || i + 1), court: c.court || "CV " + (i + 1), ecc: "Q",
      text: function () { return absUrl(c.url); },
      legende: en
        ? "Scan with your phone camera: my CV in English opens (PDF). Internet needed on the scanning phone."
        : "Scannez avec l'appareil photo : mon " + (c.libelle || "CV") + " s'ouvre (PDF). Internet nécessaire sur le téléphone qui scanne.",
      action: en ? "Envoyer le CV anglais (PDF)" : "Envoyer le " + (c.libelle || "CV") + " (PDF)",
      run: function () { shareCv(i); }
    });
  });
  MODES.push({
    id: "linkedin", court: "LinkedIn", ecc: "Q",
    text: function () { return C.linkedin || ""; },
    legende: "Scannez avec l'appareil photo : mon profil LinkedIn s'ouvre. Internet nécessaire.",
    action: "Envoyer le lien LinkedIn",
    run: function () { shareLink(C.linkedin, fullName + " — LinkedIn"); }
  }, {
    id: "page", court: "Ma carte", ecc: "Q",
    text: function () { return pageUrl; },
    legende: "Scannez avec l'appareil photo : ma carte s'ouvre avec mes CV, mes coordonnées et LinkedIn. Internet nécessaire.",
    action: "Envoyer le lien de ma carte",
    run: function () { shareLink(pageUrl, fullName); }
  });
  function modeById(id) { return MODES.filter(function (m) { return m.id === id; })[0] || null; }

  var salon = $("#salon");
  var current = null;
  var wakeLock = null;
  var cache = {};

  // Onglets générés à partir des modes
  var tabs = $("#tabs");
  MODES.forEach(function (m) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "tab"; b.id = "tab-" + m.id;
    b.setAttribute("role", "tab"); b.setAttribute("aria-selected", "false");
    b.textContent = m.court;
    b.disabled = !m.text();
    b.addEventListener("click", function () { showQr(m.id); });
    tabs.appendChild(b);
  });
  tabs.style.setProperty("--n", String(MODES.length));

  function qrFor(m) {
    if (!cache[m.id]) cache[m.id] = QRCodeLite.encodeText(m.text(), m.ecc);
    return cache[m.id];
  }

  function defaultMode() { return pageUrl ? "page" : "contact"; }

  function showQr(kind) {
    var m = modeById(kind);
    if (!m || !m.text()) m = modeById(defaultMode());
    current = m;
    var label = "QR code « " + m.court + " » de " + fullName;
    $("#qr-box").innerHTML = QRCodeLite.toSvgString(qrFor(m), { border: 4, title: label });
    $("#qr-legende").textContent = m.legende;
    $("#btn-action-lbl").textContent = m.action;
    MODES.forEach(function (k) {
      $("#tab-" + k.id).setAttribute("aria-selected", String(k.id === m.id));
    });
  }

  function requestWakeLock() {
    if (!("wakeLock" in navigator) || salon.hidden) return;
    navigator.wakeLock.request("screen").then(function (lock) { wakeLock = lock; }, noop);
  }

  function openSalon(kind) {
    salon.hidden = false;
    document.body.classList.add("salon-open");
    showQr(kind || defaultMode());
    requestWakeLock();
    preloadCvFiles();
    if (!history.state || !history.state.salon) history.pushState({ salon: true }, "");
    var el = document.documentElement;
    if (el.requestFullscreen && !document.fullscreenElement) {
      el.requestFullscreen({ navigationUI: "hide" }).catch(noop);
    }
  }

  function hideSalon() {
    salon.hidden = true;
    document.body.classList.remove("salon-open");
    if (wakeLock) { wakeLock.release().catch(noop); wakeLock = null; }
    if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(noop);
  }

  function closeSalon() {
    if (history.state && history.state.salon) history.back(); // déclenche popstate -> hideSalon
    else hideSalon();
  }

  window.addEventListener("popstate", function () { if (!salon.hidden) hideSalon(); });
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") requestWakeLock();
  });

  $("#btn-salon").addEventListener("click", function () { openSalon(); });
  $("#btn-close").addEventListener("click", closeSalon);
  $("#btn-action").addEventListener("click", function () { if (current) current.run(); });

  $("#btn-png").addEventListener("click", function () {
    var qr = qrFor(current);
    var scale = Math.max(8, Math.ceil(1200 / (qr.size + 8)));
    var canvas = QRCodeLite.drawToCanvas(qr, document.createElement("canvas"), { scale: scale, border: 4 });
    canvas.toBlob(function (blob) {
      triggerDownload(blob, "qr-" + current.id + "-" + slug(fullName) + ".png");
      toast("Image enregistrée dans vos téléchargements.");
    }, "image/png");
  });

  // ------------------------------------------- Installation (aide en un geste)
  // Visible seulement avec l'adresse « ?installer » : vos interlocuteurs ne la voient jamais.
  var params = new URLSearchParams(location.search);
  var installBox = $("#install");
  var installBtn = $("#btn-install");
  var deferredPrompt = null;
  var standalone = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  if (params.has("installer")) {
    installBox.hidden = false;
    if (standalone) {
      $("#install-txt").textContent = "Application installée : ouvrez-la depuis l'icône « Ma carte ».";
      installBtn.hidden = true;
    }
  }
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
  });
  installBtn.addEventListener("click", function () {
    if (!deferredPrompt) {
      toast("Menu ⋮ de Chrome, puis « Installer l'application ».");
      return;
    }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function (choice) {
      deferredPrompt = null;
      if (choice && choice.outcome === "accepted") toast("Installation en cours : l'icône « Ma carte » arrive.");
    }, noop);
  });
  window.addEventListener("appinstalled", function () {
    $("#install-txt").textContent = "Application installée : l'icône « Ma carte » est sur votre écran d'accueil.";
    installBtn.hidden = true;
  });

  // Ouverture directe en mode salon (raccourcis de l'application installée)
  if (params.get("mode") === "salon") openSalon(params.get("qr"));

  // ------------------------------------------------------- Hors ligne
  function updateOnline() { $("#offline").hidden = navigator.onLine; }
  window.addEventListener("online", updateOnline);
  window.addEventListener("offline", updateOnline);
  updateOnline();

  if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(noop);
    });
  }

  // Exposé pour les tests automatisés
  window.__carte = {
    pageUrl: pageUrl, vcardQr: vcardQr, vcardFile: vcardFile, buildVcardFile: buildVcardFile,
    cvs: cvs, cvAbs: cvAbs, contactText: contactText,
    modes: MODES.map(function (m) { return { id: m.id, court: m.court, text: m.text(), action: m.action }; }),
    cvFilesReady: function () { return cvFiles.filter(Boolean).length; }
  };
})();
