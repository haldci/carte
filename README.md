# Carte de visite numérique (PWA)

Carte de visite installable sur Android : coordonnées, CV (français et anglais), LinkedIn
et QR codes générés sur le téléphone, **utilisables sans réseau**.

- **5 QR au choix** : Contact (fiche vCard lisible sans Internet), CV FR, CV EN, LinkedIn, Ma carte.
- **Envoi direct** : CV en PDF, coordonnées ou lien, par le menu de partage du téléphone.
- Fiche `.vcf` téléchargeable, écran maintenu allumé en mode salon, fonctionnement hors ligne.
- Aucune dépendance, aucune ressource tierce, aucun traceur.

Tous les fichiers sont à la racine (aucun sous-dossier) : ils se déposent en une fois depuis un smartphone.

## Personnaliser

Modifier uniquement `config.js`. Un champ vide masque l'élément correspondant.

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | Page et styles |
| `config.js` | Données de la carte |
| `app.js` | Logique (affichage, vCard, QR, partage, installation) |
| `qrcode.js` | Générateur QR (ISO/IEC 18004, hors ligne) |
| `vcard.js` | Générateur vCard 3.0 |
| `sw.js` | Fonctionnement hors ligne |
| `CV_*.pdf` | CV au format PDF |
| `manifest.webmanifest`, `*.png` | Installation sur l'écran d'accueil |

## Licence

MIT — voir `LICENSE`.
