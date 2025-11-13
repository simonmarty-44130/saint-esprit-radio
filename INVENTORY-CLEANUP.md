# 📋 Inventaire du Projet Saint-Esprit Radio

**Date** : 13 novembre 2025
**Objectif** : Identifier les fichiers obsolètes pour ne conserver que les parties fonctionnelles

---

## ✅ FICHIERS ACTUELLEMENT UTILISÉS (V3 Production)

### 🌐 HTML Principal
- **frontend/v3.html** → copié vers index.html (page d'accueil)
- **frontend/index.html** (version déployée = v3.html)
- **frontend/logout.html** (page de déconnexion)

### 🎨 CSS Actif
- **frontend/v3-1762443141.css** (40.5 KB) - Styles V3 complets avec multitrack moderne

### 💻 JavaScript Principal
- **frontend/v3-app-1762510653.js** (199 KB) - Application V3 principale

### 📦 Modules JavaScript Actifs (chargés par v3.html)
```
js/config/aws-config.js
js/core/utils.js
js/core/cognito-auth.js
js/core/dynamodb-client.js
js/core/storage-dynamodb-v2.js
js/core/audio-storage.js
js/managers/ContentManager.js
js/components/NewsDurationManager.js
js/components/AudioEditor.js
js/components/MultitrackEditor.js
```

### 🖼️ Assets Actifs
- **frontend/logo-saint-esprit-clair-icon-hd.png** (utilisé dans v3.html sidebar)

### 📚 Documentation Active
- **README.md** - Documentation principale du projet
- **frontend/MULTITRACK-EDITOR.md** - Guide de l'éditeur multipiste
- **SOLUTION-ROBUSTE.md** - Architecture complète
- **GUIDE-IMPLEMENTATION.md** - Guide de déploiement
- **MIGRATION-COMPLETE.md** - Historique de migration

### ⚙️ Configuration AWS (Indispensable)
- **amplify/** - Configuration Amplify Gen 2
- **amplify_outputs.json** - Outputs Amplify
- **package.json** - Dépendances
- **node_modules/** - Dépendances installées

### 🔧 Scripts Utiles
- **scripts/fix-cloudfront-cache.sh**
- **scripts/deploy-appsync.sh**
- **scripts/audit-unused-resources.sh**
- **scripts/cleanup-unused-resources.sh**

---

## 🗑️ FICHIERS OBSOLÈTES IDENTIFIÉS

### 🌐 HTML Obsolètes (~500 KB)

**Anciennes versions :**
- frontend/index-old-backup.html (78 KB) - backup ancienne version
- frontend/index-backup.html (78 KB) - doublon backup
- frontend/index-v2.html (12 KB) - ancienne v2
- frontend/index-local.html (11 KB) - version locale test

**Interfaces obsolètes :**
- frontend/newsroom.html (11 KB) - ancienne interface
- frontend/saint-esprit-1762251336.html (11 KB) - version obsolète
- frontend/benevoles.html (67 KB) - interface bénévoles (abandonné?)
- frontend/benevoles-email.html (21 KB) - interface email bénévoles

**Pages de test :**
- frontend/index-automation-test.html (79 KB)
- frontend/amplify-test.html (17 KB)
- frontend/fix-audio.html (5.3 KB)
- frontend/test-author.html (4.2 KB)
- frontend/test-automation.html (6.2 KB)
- frontend/test-balises.html (6.2 KB)
- frontend/test-restoration.html (7.3 KB)

**Maquettes design :**
- frontend/maquette-v3.html (19 KB)
- frontend/maquette-news.html (17 KB)
- frontend/maquette-news-tableau.html (28 KB)
- frontend/maquette-journaux.html (25 KB)
- frontend/maquette-conducteur.html (17 KB)
- frontend/maquette-onair.html (13 KB)
- frontend/maquette-editeur-multipiste.html (26 KB)

### 🎨 CSS Obsolètes (~300 KB)

**Anciennes versions V3 :**
- frontend/v3.css (24 KB) - première version
- frontend/v3-1762425066.css (21 KB)
- frontend/v3-1762426265.css (23 KB)

**Anciennes versions complètes :**
- frontend/saint-esprit-1762251336.css (9.9 KB)

**Fichiers Cognito custom :**
- frontend/cognito-custom.css (1.4 KB)
- frontend/cognito-custom-v2.css (2.0 KB)
- frontend/cognito-custom-v3.css (1.3 KB)

**Dossier CSS modulaire (si non utilisé) :**
- frontend/css/* - À vérifier si v3-1762443141.css est monolithique

### 💻 JavaScript Obsolètes (~1.5 MB)

**Anciennes versions v3-app :**
- frontend/v3-app.js (152 KB) - première version
- frontend/v3-app-1762425066.js (99 KB)
- frontend/v3-app-1762426265.js (100 KB)
- frontend/v3-app-1762443141.js (128 KB)
- frontend/v3-app-1762507224.js (128 KB)
- frontend/v3-app-1762509364.js (129 KB)
- frontend/v3-app-1762509632.js (129 KB)

**Anciennes versions complètes :**
- frontend/saint-esprit-1762251336.js (59 KB)
- frontend/saint-esprit-v3.js (59 KB)

**Scripts ponctuels :**
- frontend/archive-news-amplify.js (5.2 KB)
- frontend/archive-news-manual.js (4.5 KB)
- frontend/archive-news-script.js (2.6 KB)
- frontend/clean-ghost-items.js (6.4 KB)
- frontend/test-liaison-production.js (2.0 KB)

**Mode bénévoles (à confirmer si abandonné) :**
- frontend/js/benevoles-appsync.js

### 📦 Modules JS Potentiellement Obsolètes (à vérifier)

**Anciennes versions storage :**
- js/core/storage-dynamodb.js (remplacé par v2)
- js/core/storage-dynamodb-optimized.js (version intermédiaire)
- js/core/storage-appsync.js (si AppSync pas utilisé directement)

**Outils de migration :**
- js/core/migrate-to-optimized.js (migration terminée)

**Modules à vérifier :**
- js/core/conductor-storage.js (vérifié si dupliqué avec storage-dynamodb-v2)
- js/core/sync-wrapper.js (vérifié s'il est chargé)
- js/core/cache-manager.js (vérifié s'il est chargé)
- js/core/cross-user-manager.js (vérifié s'il est chargé)

### 📚 Documentation Obsolète (~100 KB)

**Documentation technique ponctuelle :**
- BUGS_ANALYSIS.md
- DEPLOIEMENT-AWS-DOCUMENTATION.md
- GUIDE-PRODUCTION-AMPLIFY.md
- RAPPORT-TECHNIQUE-SUPERVISEUR.md
- PROMPT-EDITEUR-MULTIPISTE.md (prompt de développement)

**Documentation fonctionnalité abandonnée :**
- VOLUNTEER_MODE_DOC.md (si mode bénévole abandonné)

### 🔧 Scripts/Outils Obsolètes

- activate-optimizations.js (optimisations appliquées)
- check-metrics.sh (script ponctuel)

### 🖼️ Assets Potentiellement Obsolètes

- frontend/logo-saint-esprit.jpeg (remplacé par PNG HD?)
- frontend/logo-saint-esprit-compressed.jpeg (doublon?)
- frontend/logo-saint-esprit-blanc.png (si non utilisé)
- frontend/logo-saint-esprit-sombre-icon.png (si non utilisé)

### 📁 Données de test
- frontend/user-data.json (données test?)

---

## 📊 RÉSUMÉ DU NETTOYAGE

### Gains estimés
- **HTML obsolètes** : ~500 KB (17 fichiers)
- **CSS obsolètes** : ~300 KB (8+ fichiers)
- **JS obsolètes** : ~1.5 MB (14+ fichiers)
- **Documentation** : ~100 KB (6 fichiers)
- **Total minimum** : **~2.5 MB** de fichiers identifiés obsolètes

### Impact
- Projet plus lisible
- Moins de confusion sur les fichiers à modifier
- Déploiements S3 plus rapides
- Maintenance simplifiée

---

## ⚠️ PRÉCAUTIONS AVANT SUPPRESSION

### 1. Créer un backup complet
```bash
cd /Users/directionradiofidelite/saint-esprit-aws
tar -czf ../saint-esprit-backup-$(date +%Y%m%d).tar.gz .
```

### 2. Vérifier les modules JS dans js/
Certains peuvent être chargés dynamiquement par v3-app-1762510653.js

### 3. Archiver les maquettes
Les maquettes HTML peuvent servir de référence design :
```bash
mkdir -p archive/maquettes
mv frontend/maquette-*.html archive/maquettes/
```

### 4. Conserver temporairement
Garder `index-old-backup.html` quelques semaines pour rollback rapide si besoin

---

## 🎯 PLAN D'ACTION RECOMMANDÉ

### Phase 1 : Backup Sécurité (OBLIGATOIRE)
```bash
# Créer archive complète
tar -czf ../saint-esprit-backup-$(date +%Y%m%d).tar.gz .

# Créer dossier archive dans le projet
mkdir -p archive-cleanup-$(date +%Y%m%d)
```

### Phase 2 : Archiver les maquettes (conservation référence)
```bash
mkdir -p archive/maquettes
mv frontend/maquette-*.html archive/maquettes/
git add archive/
git commit -m "Archive: déplacement maquettes design"
```

### Phase 3 : Supprimer HTML/CSS/JS obsolètes
```bash
# Supprimer anciennes versions HTML
rm frontend/index-backup.html
rm frontend/index-v2.html
rm frontend/index-local.html
rm frontend/index-automation-test.html
rm frontend/newsroom.html
rm frontend/saint-esprit-*.html
rm frontend/benevoles*.html
rm frontend/amplify-test.html
rm frontend/fix-audio.html
rm frontend/test-*.html

# Supprimer anciennes versions CSS
rm frontend/v3.css
rm frontend/v3-1762425066.css
rm frontend/v3-1762426265.css
rm frontend/saint-esprit-*.css
rm frontend/cognito-custom*.css

# Supprimer anciennes versions JS
rm frontend/v3-app.js
rm frontend/v3-app-1762425066.js
rm frontend/v3-app-1762426265.js
rm frontend/v3-app-1762443141.js
rm frontend/v3-app-1762507224.js
rm frontend/v3-app-1762509364.js
rm frontend/v3-app-1762509632.js
rm frontend/saint-esprit-*.js
rm frontend/archive-news-*.js
rm frontend/clean-ghost-items.js
rm frontend/test-liaison-production.js

git add -A
git commit -m "Nettoyage: suppression versions HTML/CSS/JS obsolètes"
```

### Phase 4 : Nettoyer documentation obsolète
```bash
mkdir -p archive/docs-obsoletes
mv BUGS_ANALYSIS.md archive/docs-obsoletes/
mv DEPLOIEMENT-AWS-DOCUMENTATION.md archive/docs-obsoletes/
mv GUIDE-PRODUCTION-AMPLIFY.md archive/docs-obsoletes/
mv RAPPORT-TECHNIQUE-SUPERVISEUR.md archive/docs-obsoletes/
mv PROMPT-EDITEUR-MULTIPISTE.md archive/docs-obsoletes/

git add -A
git commit -m "Nettoyage: archivage documentation technique obsolète"
```

### Phase 5 : Vérifier et nettoyer modules JS (PRUDENCE)
```bash
# Analyser d'abord les imports dans v3-app-1762510653.js
grep -r "import\|require" frontend/v3-app-1762510653.js

# Puis supprimer UNIQUEMENT les modules confirmés non utilisés
# À faire manuellement après analyse
```

### Phase 6 : Push final
```bash
git push
```

### Phase 7 : Synchroniser S3 (OPTIONNEL)
Si vous voulez aussi nettoyer S3 :
```bash
# Liste des fichiers sur S3
aws s3 ls s3://amplify-saintespritaws-di-saintespritstoragebucket-91ui2ognukke/ --recursive

# Supprimer fichiers obsolètes un par un (PRUDENCE)
aws s3 rm s3://bucket-name/fichier-obsolete.html
```

---

## ✅ VALIDATION POST-NETTOYAGE

Après le nettoyage, vérifier que :

1. ✅ https://saint-esprit.link charge correctement
2. ✅ Toutes les fonctionnalités V3 fonctionnent :
   - Dashboard
   - Contenus/News
   - Archives
   - Journaux/Blocks
   - Conducteur
   - ON AIR
   - Multipiste
3. ✅ Authentification Cognito fonctionne
4. ✅ Upload audio S3 fonctionne
5. ✅ Synchronisation DynamoDB fonctionne

---

**Dernière mise à jour** : 13 novembre 2025
**Généré avec Claude Code**
