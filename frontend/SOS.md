# SOS - Documentation des Solutions Critiques
## Date : 28 août 2025 - Version 3.0

---

## 🚨 PROBLÈMES RÉSOLUS LE 28/08/2025

### 1. ✅ AFFICHAGE DE L'AUTEUR (UUID au lieu du nom)
**Problème :** L'auteur s'affichait comme UUID (ex: 7199604e-c0b1-700b-8cdb-3b100af8fef0) au lieu du nom réel.

**Cause :** Mauvais préfixe dans app.js et mauvaise récupération du nom utilisateur.

**Solution :**
- Corrigé le préfixe dans `app.js` ligne 601 : utiliser `'news-'` au lieu de `''`
- Ajouté `getUserId()` et `getCurrentUserFullName()` dans `cognito-auth.js`
- Corrigé la méthode `isAuthenticated` qui avait un conflit propriété/méthode

### 2. ✅ LECTURE AUDIO "NotSupportedError"
**Problème :** Impossible de lire les fichiers audio, erreur "Failed to load because no supported source was found"

**Causes multiples :**
1. CloudFront redirige tout vers index.html (y compris /audio/*)
2. Le bucket Amplify n'est pas public
3. L'upload utilisait fetch au lieu d'AWS SDK
4. Les URLs n'étaient pas corrigées

**Solution complète :**
- **Changé de bucket** : Utilisation de `saint-esprit-audio` (public) au lieu d'Amplify
- **Créé AudioUrlFixer** (`js/utils/audio-url-fixer.js`) pour corriger toutes les URLs
- **Corrigé Storage.js** :
  - Utilise le vrai AWS SDK au lieu de fetch
  - Retiré `ACL: 'public-read'` (non supporté par le bucket)
  - URLs directes S3 : `https://saint-esprit-audio.s3.eu-west-3.amazonaws.com/audio/...`

### 3. ✅ MIGRATION VERS DYNAMODB
**Problème :** Données qui disparaissent avec le stockage JSON sur S3

**Solution :** Migration complète vers DynamoDB
- **4 tables créées** : saint-esprit-news, saint-esprit-animations, saint-esprit-blocks, saint-esprit-conductors
- **Clés composites** : id (partition) + createdAt (sort)
- **Multi-utilisateurs** : Tous les contenus visibles avec filtrage
- **Fichiers créés** :
  - `js/core/dynamodb-client.js` : Client DynamoDB
  - `js/core/storage-dynamodb.js` : Adaptateur storage
  - `js/components/UserFilter.js` : UI de filtrage

### 4. ✅ ERREUR DYNAMODB "Key element does not match schema"
**Problème :** DynamoDB rejetait les items sans createdAt ou avec createdAt en string

**Solution dans `dynamodb-client.js` :**
```javascript
// S'assurer que createdAt est toujours un nombre
let createdAt = item.createdAt;
if (!createdAt) {
    createdAt = Date.now();
} else if (typeof createdAt === 'string') {
    createdAt = new Date(createdAt).getTime() || Date.now();
}
```

---

## 📁 STRUCTURE DES BUCKETS S3

### saint-esprit-audio (BUCKET PUBLIC)
- **Utilisation** : Fichiers audio des news/animations
- **Accès** : Public via politique de bucket
- **Structure** : `/audio/{userId}/{audioId}.mp3`
- **URL** : `https://saint-esprit-audio.s3.eu-west-3.amazonaws.com/...`

### amplify-saintespritaws-... (BUCKET PRIVÉ)
- **Utilisation** : Enregistrements StreamRecorder uniquement
- **Accès** : Privé, nécessite authentification
- **Ne pas utiliser pour** : Audio des news/animations

---

## 🔧 CONFIGURATION CRITIQUE

### AWS Config (`js/config/aws-config.js`)
```javascript
bucketName: 'saint-esprit-audio',  // NE PAS CHANGER
userPoolId: 'eu-west-3_oD1fm8OLs',
identityPoolId: 'eu-west-3:3bffc600-c5a5-4d37-9fca-7277e64cc66d',
```

### Storage (`js/core/storage.js`)
- Utilise le vrai AWS SDK, pas fetch
- Pas d'ACL dans upload (le bucket les refuse)
- Mock S3 utilise le vrai SDK quand disponible

---

## ⚠️ POINTS D'ATTENTION

### CloudFront
- **PROBLÈME** : CloudFront redirige TOUT vers index.html
- **NE PAS** : Utiliser CloudFront pour les URLs audio
- **TOUJOURS** : Utiliser les URLs S3 directes

### Upload Audio
- **TOUJOURS** : Utiliser AWS SDK, jamais fetch avec PUT
- **PAS D'ACL** : Le bucket refuse `ACL: 'public-read'`
- **VÉRIFIER** : Que AWS.config.credentials existe avant upload

### DynamoDB
- **createdAt** : DOIT être un nombre (timestamp), jamais string
- **id** : DOIT exister et être une string
- **Batch** : Maximum 25 items par batch write

---

## 🚀 COMMANDES UTILES

### Vérifier les fichiers audio sur S3
```bash
aws s3 ls s3://saint-esprit-audio/audio/simonmarty/ --profile default
```

### Tester l'accès à une URL
```bash
curl -I https://saint-esprit-audio.s3.eu-west-3.amazonaws.com/audio/simonmarty/XXX.mp3
```

### Vérifier les tables DynamoDB
```bash
aws dynamodb list-tables --profile default
aws dynamodb scan --table-name saint-esprit-news --profile default
```

---

## 📝 FICHIERS MODIFIÉS CRITIQUES

1. **storage.js** : Utilise AWS SDK réel, bucket saint-esprit-audio
2. **audio-url-fixer.js** : Corrige TOUTES les URLs vers S3 direct
3. **dynamodb-client.js** : Gère createdAt comme nombre
4. **storage-dynamodb.js** : Adaptateur pour DynamoDB
5. **cognito-auth.js** : getUserId() et getCurrentUserFullName()
6. **app.js** : Préfixe correct pour news

---

## 🎯 RÉSUMÉ DES SOLUTIONS

| Problème | Solution | Fichier |
|----------|----------|---------|
| Auteur = UUID | Préfixe 'news-' + getUserId() | app.js, cognito-auth.js |
| Audio ne joue pas | S3 direct + AWS SDK | storage.js, audio-url-fixer.js |
| Données disparaissent | DynamoDB | storage-dynamodb.js |
| Erreur DynamoDB | createdAt = nombre | dynamodb-client.js |
| Upload échoue | Pas d'ACL + AWS SDK | storage.js |

---

## 📌 VERSION 3.0 - 28 août 2025
- ✅ Lecture audio fonctionnelle
- ✅ Affichage auteur correct
- ✅ DynamoDB multi-utilisateurs
- ✅ Upload S3 via AWS SDK
- ✅ Backup : `backup-2025-08-28-v3.0-play-author-ok.tar.gz`

## 📌 VERSION 3.1 - 31 août 2025
- ✅ News peuvent être affectées à plusieurs journaux
- ✅ Option de créer une variante lors de l'affectation multiple
- ✅ Suppression des blocks corrigée dans DynamoDB

## 📌 VERSION 3.2 - 04 septembre 2025
### Corrections majeures du module FTP Flash Info

#### 1. ❌ PROBLÈME : Fichiers Flash Info mélangés
**Symptôme :** Le Flash Sport contenait l'audio des Titres, les fichiers s'écrasaient mutuellement

**Cause :** Les fichiers étaient uploadés sur S3 avec le même timestamp (même seconde) donc le 2ème écrasait le 1er

**Solution dans `lambda/flash-info-downloader/utils/s3-uploader.js` :**
```javascript
// Ajout du type et d'un identifiant unique dans le nom
static generateFileName(originalName = 'flash_info.mp3', flashType = '') {
    const typePrefix = flashType ? `${flashType}_` : '';
    const uniqueSuffix = `${now.getMilliseconds()}_${Math.random().toString(36).substring(2, 6)}`;
    return `flashinfo_${typePrefix}${timestamp}_${uniqueSuffix}.${extension}`;
}
```

#### 2. ⏰ Configuration des horaires automatiques
**Script créé :** `lambda/flash-info-downloader/setup-schedules.sh`

**15 règles EventBridge configurées :**
- **Titres (1')** : 5h, 6h, 8h, 9h, 11h, 12h, 13h, 15h, 17h, 19h Paris
- **Flash National (2'30)** : 6h, 8h, 12h, 17h Paris  
- **Flash Sport** : 6h Paris

**Exécution :** `./setup-schedules.sh`

#### 3. ⏱️ Détection automatique des durées MP3
**Problème :** Toutes les durées étaient fixées à 2:30

**Solution :** Créé `lambda/flash-info-downloader/utils/audio-analyzer.js`
- Détecte la durée réelle des fichiers MP3
- Applique des corrections basées sur le type de flash
- Résultats typiques :
  - Titres : ~1:03
  - Flash National : ~2:36
  - Flash Sport : ~3:27

#### 4. 🔊 Boutons play manquants pour Flash FTP
**Problème :** Les Flash Info créés par FTP n'avaient pas de bouton play

**Solution dans `ContentManager.js` ligne 1153 :**
```javascript
// Simplifié la condition pour afficher le bouton
(sound.url ? 
    `<button onclick="app.${this.type}Manager.playDirectUrl('${sound.url}')">▶️</button>` : 
    ''
)
```

#### 5. 🎵 Unification des audioFileId
**Problème :** Certains audioFileId n'avaient pas l'extension .mp3

**Solutions :**
- `AudioManager.js` ligne 119 : `Date.now().toString() + '.mp3'`
- `AudioEditor.js` ligne 1498 : `audio_${Date.now()}.mp3`
- Ajout de `.mp3` automatique pour les URLs S3

#### 6. 🖼️ Problèmes de layout éditeur
**Problème :** Scrollbar manquant, panneau sounds coupé, espace perdu à droite

**Fichiers créés/modifiés :**
- `css/fixes/layout-fix.css` : Correction structure flex
- `css/fixes/sound-panel-fix.css` : Hauteur suffisante pour les contrôles audio
- `css/fixes/blocks-panel-fix.css` : Conteneurs Journal agrandis
- Police éditeur changée de Courier New à Arial dans `news.css`

### Commandes utiles Lambda Flash Info

```bash
# Tester manuellement la Lambda
aws lambda invoke --function-name saint-esprit-flash-info-downloader \
  --payload eyJtYW51YWwiOiB0cnVlLCAiZm9yY2UiOiB0cnVlfQo= response.json

# Voir les logs de téléchargement
aws logs filter-log-events --log-group-name /aws/lambda/saint-esprit-flash-info-downloader \
  --start-time $(($(date +%s) - 3600))000 --filter-pattern "Processing"

# Lister les règles EventBridge
aws events list-rules --query 'Rules[?contains(Name, `flash`)][Name, State, ScheduleExpression]' --output table

# Vérifier les news dans DynamoDB
aws dynamodb get-item --table-name saint-esprit-news \
  --key '{"id": {"S": "flash-info-natio-permanent"}, "createdAt": {"N": "0"}}' \
  --query 'Item.[title.S, duration.S, updatedAt.N]'
```

---

## 📌 VERSION 3.3 - 05 septembre 2025
### Corrections module Flash Info et On Air

#### 1. 🔄 Historique des imports FTP individualisé
**Problème :** L'historique n'affichait que le Flash Sport (dernier fichier traité)

**Cause :** La Lambda créait un seul log global à la fin avec le dernier fichier

**Solution dans `lambda/flash-info-downloader/index.js` :**
- Création d'un log individuel pour chaque fichier traité (lignes 135-136)
- Suppression du log global en fin de traitement
- Maintenant les 3 Flash (National, Titres, Sport) apparaissent dans l'historique

#### 2. ⏰ Correction horaires EventBridge pour l'heure d'été
**Problème :** Les Titres du matin n'étaient pas récupérés (affichage Flash du soir à 7h31)

**Cause :** Mauvais calcul UTC - les règles utilisaient UTC+1 au lieu d'UTC+2 (CEST)

**Solution dans `setup-schedules.sh` :**
```bash
# Exemple pour 6h Paris en été (CEST = UTC+2)
# Avant : cron(59 4 * * ? *) = 5h59 UTC = 6h59 Paris ❌
# Après : cron(59 3 * * ? *) = 3h59 UTC = 5h59 Paris ✅
```

**Horaires corrigés :**
- Titres : 5h, 6h, 8h, 9h, 11h, 12h, 13h, 15h, 17h, 19h Paris
- Flash National : 6h, 8h, 12h, 17h Paris
- Flash Sport : 6h Paris

#### 3. 🎵 Module On Air - Récupération URL fraîche
**Problème :** Le module On Air jouait l'ancien Flash même après mise à jour

**Cause :** L'URL était stockée dans les attributs HTML au chargement de la fiche

**Solution dans `OnAir.js` ligne 554-572 :**
```javascript
// Détection automatique des Flash Info permanents
if (currentNewsId && currentNewsId.includes('flash-info') && currentNewsId.includes('permanent')) {
    // Récupération de l'URL fraîche depuis DynamoDB au moment du play
    const freshData = await window.app.storage.getItem(this.currentItem.type, currentNewsId);
    // Utilisation de l'URL mise à jour
}
```

**Résultat :** La journaliste peut charger sa fiche à 7h30, l'audio sera automatiquement actualisé à 7h59 sans rechargement

### Commandes de vérification

```bash
# Vérifier les horaires de récupération
aws events list-rules --query 'Rules[?contains(Name, `flash`)][Name, ScheduleExpression]' --output table

# Vérifier les dernières mises à jour des Flash
aws dynamodb get-item --table-name saint-esprit-news \
  --key '{"id": {"S": "flash-info-titres-permanent"}, "createdAt": {"N": "0"}}' \
  --query 'Item.title.S'

# Forcer une mise à jour manuelle
aws lambda invoke --function-name saint-esprit-flash-info-downloader \
  --payload eyJtYW51YWwiOiB0cnVlLCAiZm9yY2UiOiB0cnVlLCAiZmxhc2hUeXBlIjogInRpdHJlcyJ9Cg== \
  response.json

# Voir l'historique des imports
aws dynamodb scan --table-name saint-esprit-flash-info-logs \
  --query 'Items[?importTime.S > `2025-09-05`].[importTime.S, fileName.S, status.S]' \
  --output table
```

### Points d'attention
- **Heure d'été/hiver** : Penser à ajuster les règles EventBridge au changement d'heure
- **Cache navigateur** : Le module On Air contourne le cache pour les Flash permanents
- **Backup** : `backup-2025-09-05-v3.3-flash-onair-fixed.tar.gz`

---

## 📌 PROJET D'INTÉGRATION - 05 septembre 2025
### Fusion ActionDeGrace dans Saint-Esprit avec Prompteur Permanent

#### Objectif
Unifier les deux applications utilisées simultanément pendant l'antenne :
- **ActionDeGrace** : Automate de diffusion (timing, players A/B, conducteur)
- **Saint-Esprit** : Newsroom (contenus, prompteur)

#### Architecture proposée
```
┌────────────────────────────────────────────────────────┐
│                    HEADER (horloge, ON AIR)            │
├─────────────────────┬───────────────────────────────────┤
│   AUTOMATION (40%)  │         PROMPTEUR (60%)          │
│                     │                                   │
│  Player A / B       │  [Tabs: En cours | Suivant | +2] │
│  Conducteur         │  Texte scrollable                │
│  Instant Player     │  Navigation Alt+1,2,3             │
└─────────────────────┴───────────────────────────────────┘
```

#### Points clés
1. **Touche ESPACE préservée** pour play/pause (critique!)
2. **Prompteur toujours visible** pour préparer les textes suivants
3. **Import conducteur** depuis ActionDeGrace (CSV/ZIP)
4. **Connexion DynamoDB** pour charger les contenus
5. **Test en local** avant production (`index-local-test.html`)

#### Fichiers à créer
```
frontend/
├── index-local-test.html           # Version de test
├── js/components/automation/
│   ├── AutomationModule.js        # Moteur ActionDeGrace adapté
│   ├── PrompterPanel.js           # Nouveau prompteur permanent
│   └── UnifiedBroadcast.js        # Orchestrateur unifié
└── css/automation/
    └── automation.css              # Styles du module
```

#### Avantages attendus
- **Une seule application** : Plus de jonglage entre fenêtres
- **Workflow optimisé** : Créer → Placer dans conducteur → Diffuser
- **Pilotage précis** : Timing d'ActionDeGrace préservé
- **Prompteur permanent** : Préparation des textes pendant diffusion

#### Status
- **Analyse** : ✅ Complète
- **Prompt d'implémentation** : ✅ Préparé pour Claude Code
- **Test local** : ⏳ À faire
- **Déploiement production** : ⏳ Après validation

---

## 🆘 EN CAS DE PROBLÈME

1. **Vérifier AWS credentials** : `window.AWS.config.credentials`
2. **Vérifier le bucket** : Doit être `saint-esprit-audio`
3. **Vérifier les URLs** : Doivent être S3 direct, pas CloudFront
4. **Vérifier createdAt** : Doit être un nombre dans DynamoDB
5. **Console browser** : Chercher les erreurs 400/403/404
6. **Flash non actualisé** : Vérifier les logs Lambda et les règles EventBridge

---

**CONTACT URGENCE** : Si problème critique, vérifier d'abord cette documentation.
Les solutions sont testées et fonctionnelles au 05/09/2025.