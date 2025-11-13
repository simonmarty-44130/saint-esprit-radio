# Archive de Nettoyage - 13 Novembre 2025

Fichiers obsolètes archivés lors du nettoyage du projet Saint-Esprit Radio V3.

## Contenu

### Maquettes Design (160 KB - 7 fichiers)
Maquettes HTML de design conservées pour référence :
- maquette-v3.html
- maquette-news.html
- maquette-news-tableau.html
- maquette-journaux.html
- maquette-conducteur.html
- maquette-onair.html
- maquette-editeur-multipiste.html

### HTML Obsolètes (272 KB - 12 fichiers)
Anciennes versions et pages de test :
- index-backup.html, index-v2.html, index-local.html
- index-automation-test.html
- newsroom.html (ancienne interface)
- saint-esprit-1762251336.html
- amplify-test.html, fix-audio.html
- test-author.html, test-automation.html, test-balises.html, test-restoration.html

**Note** : benevoles.html et benevoles-email.html ont été CONSERVÉS (toujours utilisés)

### CSS Obsolètes (96 KB - 7 fichiers)
Anciennes versions de styles :
- v3.css, v3-1762425066.css, v3-1762426265.css
- saint-esprit-1762251336.css
- cognito-custom.css, cognito-custom-v2.css, cognito-custom-v3.css

**Actif** : v3-1762443141.css (seul CSS en production)

### JavaScript Obsolètes (1.0 MB - 14 fichiers)
Anciennes versions de l'application :
- v3-app.js (première version)
- v3-app-1762425066.js → v3-app-1762509632.js (7 versions intermédiaires)
- saint-esprit-1762251336.js, saint-esprit-v3.js
- archive-news-*.js (3 scripts d'archivage)
- clean-ghost-items.js, test-liaison-production.js

**Actif** : v3-app-1762510653.js (seul JS principal en production)

### Documentation Obsolète (52 KB - 5 fichiers)
Documentation technique ponctuelle :
- BUGS_ANALYSIS.md
- DEPLOIEMENT-AWS-DOCUMENTATION.md
- GUIDE-PRODUCTION-AMPLIFY.md
- RAPPORT-TECHNIQUE-SUPERVISEUR.md
- PROMPT-EDITEUR-MULTIPISTE.md

**Active** : README.md, MULTITRACK-EDITOR.md, SOLUTION-ROBUSTE.md, GUIDE-IMPLEMENTATION.md, MIGRATION-COMPLETE.md

### Scripts Obsolètes (12 KB - 2 fichiers)
Outils ponctuels :
- activate-optimizations.js
- check-metrics.sh

## Total Archivé

**~1.6 MB** de fichiers obsolètes

## Restauration

Pour restaurer un fichier :
```bash
cp archive-cleanup-20251113/[dossier]/[fichier] frontend/
```

## Suppression Définitive

Si après vérification (2-4 semaines), tout fonctionne correctement :
```bash
rm -rf archive-cleanup-20251113/
```

---
Archivé automatiquement avec Claude Code
