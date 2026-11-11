/*
 * config.js — LE SEUL FICHIER À MODIFIER.
 *
 * Sources : profil LinkedIn (lu le 11/11/2026), CV FR/EN corrigés le 11/11/2026,
 * coordonnées et choix fournis par Halim ALLAOUI le 11/11/2026 (e-mail Gmail partout).
 * ⚠️ BROUILLON : chaque valeur doit être validée avant la mise en ligne.
 * Un champ laissé vide ("") masque automatiquement l'élément correspondant.
 */
window.CARTE = {
  prenom: "Halim",
  nom: "ALLAOUI",
  titre: "Senior Datacenter Manager",
  accroche: "17 ans d'expertise · Infrastructures critiques · Run & Build",
  // Certifications (AOS, ITIL v3, PRINCE2) puis expertises, libellées comme telles
  badges: ["Uptime Institute AOS", "ITIL v3", "PRINCE2", "Expertise Tier III / IV", "Conformité PCI DSS"],

  // Chiffres clés repris du profil LinkedIn et des CV (STELLARIX, nov. 2022 – nov. 2025)
  chiffres: [
    { valeur: "99,9 %", libelle: "disponibilité" },
    { valeur: "17 ETP", libelle: "équipe 24/7" },
    { valeur: "12 M€", libelle: "CAPEX piloté" },
    { valeur: "−15 %", libelle: "PUE" }
  ],

  mobilite: "Basé en France · Mobilité internationale · Disponible immédiatement",
  photo: "photo.jpg",           // photo de profil LinkedIn (320 x 320)

  telephones: [
    { numero: "+33 7 82 57 87 78", libelle: "France" },
    { numero: "+261 38 72 908 15", libelle: "Madagascar" }
  ],
  whatsapp: "+33 7 82 57 87 78",
  email: "halim.allaoui@gmail.com",
  linkedin: "https://www.linkedin.com/in/halimallaoui",

  // CV publiés avec la carte, dans le même dossier. Pour mettre un CV à jour, déposez le nouveau
  // PDF sous le même nom : les QR codes ne changent pas.
  cvs: [
    { url: "CV_Halim_ALLAOUI_FR.pdf", libelle: "CV en français", code: "fr", court: "CV FR" },
    { url: "CV_Halim_ALLAOUI_EN.pdf", libelle: "CV in English", code: "en", court: "CV EN" }
  ],
  cvUrl: "",                    // ancien champ (un seul CV) : utilisé seulement si « cvs » est vide

  // Facultatif : adresse publique de la carte. Vide = détectée automatiquement une fois en ligne.
  urlPage: "",

  // Laissé vide volontairement : la carte présente un candidat, pas une société.
  organisation: "",

  // Texte ajouté dans la fiche contact (.vcf) téléchargée depuis la page.
  noteVcard: "Senior Datacenter Manager — 17 ans d'expertise en infrastructures critiques (Tier III/IV), Run & Build. Uptime Institute AOS."
};
