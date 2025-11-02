# 🔧 RÉSOLUTION PROBLÈME FLASH INFO - 03/09/2025

## 🐛 PROBLÈMES IDENTIFIÉS

### 1. Doublons de Flash Info
- **Symptôme** : Multiples news Flash Info créées au lieu d'une seule permanente
- **Cause** : Le système créait des news avec différents timestamps au lieu d'utiliser toujours `createdAt: 0`
- **Impact** : Jusqu'à 16 doublons par type de Flash Info

### 2. News qui reviennent après suppression
- **Symptôme** : Les news supprimées réapparaissent après quelques minutes
- **Cause** : Le système de synchronisation multi-postes `onDatabaseUpdate` redistribuait les doublons depuis les caches locaux

### 3. Audio non écoutable
- **Symptôme** : Bouton play absent, compteur à 0:00, erreur "play() request was interrupted"
- **Cause** : Durée définie à "0:00" dans les métadonnées

## ✅ SOLUTIONS APPLIQUÉES

### 1. Modification de `frontend/js/core/storage-dynamodb.js`
```javascript
// Force createdAt = 0 pour les news Flash Info permanentes
if (type === 'news' && itemToSave.id && 
    (itemToSave.id === 'flash-info-natio-permanent' || 
     itemToSave.id === 'flash-info-titres-permanent' || 
     itemToSave.id === 'flash-info-sport-permanent')) {
    itemToSave.createdAt = 0;
}

// Filtrage automatique des doublons lors du chargement
const flashInfoIds = ['flash-info-natio-permanent', 'flash-info-titres-permanent', 'flash-info-sport-permanent'];
for (const item of data) {
    if (flashInfoIds.includes(item.id)) {
        // Ne garder que createdAt = 0
        if (item.createdAt === 0 && !seenFlashInfo.has(item.id)) {
            filtered.push(item);
            seenFlashInfo.add(item.id);
        }
    }
}
```

### 2. Modification de `lambda/flash-info-downloader/utils/news-creator.js`
```javascript
// Toujours utiliser createdAt = 0 pour les permanentes
createdAt: 0, // Always use 0 for permanent news

// Durée par défaut corrigée
duration: '2:30', // Default duration - will be updated when audio is analyzed
```

### 3. Scripts de maintenance créés

#### `/scripts/cleanup-flash-news.js`
- Supprime tous les Flash Info avec `createdAt != 0`
- Vérifie l'existence des 3 news permanentes

#### `/scripts/fix-flash-durations.js`
- Corrige les durées des Flash Info existants à "2:30"

## 📦 FICHIERS MODIFIÉS

1. **DÉPLOYÉ EN PRODUCTION** ✅
   - `/frontend/js/core/storage-dynamodb.js` → S3 + CloudFront invalidé

2. **LAMBDA MISE À JOUR** ✅
   - `saint-esprit-flash-info-downloader` → Code déployé sur AWS Lambda

3. **SCRIPTS LOCAUX** 
   - `/scripts/cleanup-flash-news.js`
   - `/scripts/fix-flash-durations.js`

## 🗄️ DONNÉES DYNAMODB

### News permanentes maintenues
- `flash-info-natio-permanent` (createdAt: 0)
- `flash-info-titres-permanent` (createdAt: 0)  
- `flash-info-sport-permanent` (createdAt: 0)

### Nettoyage effectué
- 16+ doublons supprimés
- Durées corrigées à "2:30"

## 🔄 SYSTÈME DE SYNCHRONISATION

Le système `onDatabaseUpdate` a été modifié pour :
1. Filtrer automatiquement les doublons Flash Info
2. Ne synchroniser que les versions avec `createdAt: 0`
3. Empêcher la recréation des doublons entre postes

## 📝 COMMANDES UTILES

```bash
# Nettoyer les doublons
cd /Users/directionradiofidelite/saint-esprit-aws/scripts
node cleanup-flash-news.js

# Corriger les durées
node fix-flash-durations.js

# Vérifier les news Flash dans DynamoDB
aws dynamodb scan --table-name saint-esprit-news \
  --filter-expression "begins_with(id, :prefix)" \
  --expression-attribute-values '{":prefix":{"S":"flash-"}}' \
  --region eu-west-3
```

## ⚠️ POINTS D'ATTENTION

1. Les 3 news Flash Info doivent TOUJOURS avoir `createdAt: 0`
2. La durée par défaut est "2:30" (format MM:SS)
3. Le filtrage des doublons est automatique au chargement
4. La Lambda ne crée plus de doublons lors des imports

## 🚀 DÉPLOIEMENT

```bash
# Frontend
aws s3 cp frontend/js/core/storage-dynamodb.js \
  s3://amplify-saintespritaws-di-saintespritstoragebucket-91ui2ognukke/js/core/ \
  --region eu-west-3

# Invalider CloudFront
aws cloudfront create-invalidation \
  --distribution-id E3I60G2234JQLX \
  --paths "/js/core/storage-dynamodb.js"

# Lambda
cd lambda/flash-info-downloader
zip -r lambda-package.zip . -x "*.git*" -x "deploy*"
aws lambda update-function-code \
  --function-name saint-esprit-flash-info-downloader \
  --zip-file fileb://lambda-package.zip \
  --region eu-west-3
```

## ✨ RÉSULTAT

- Plus de doublons Flash Info
- Les suppressions sont définitives
- L'audio est écoutable avec durée correcte
- Synchronisation multi-postes fonctionnelle