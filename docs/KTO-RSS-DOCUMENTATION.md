# Documentation KTO Radio & RSS - Saint-Esprit

## Vue d'ensemble
Ce document décrit les fonctionnalités d'automatisation KTO Radio et RSS implémentées pour Saint-Esprit.

## 1. Enregistrement automatique KTO Radio

### Fonctionnalité
- **Stream** : http://54.37.9.140:8000/ktoradio
- **Horaire** : Lundi-Vendredi, 7h00:12 - 7h15:00 (heure de Paris)
- **Durée** : 14min48s (888 secondes)

### Architecture
```
EventBridge (cron) → Lambda (stream-recorder) → S3 + DynamoDB
                                              ↓
                                         SFTP Upload
```

### Composants

#### Lambda : saint-esprit-stream-recorder
- **Fichier principal** : `kto-complete-with-sftp.js`
- **Modules** :
  - `kto-news-updater.js` : Mise à jour de la news permanente
  - `sftp-uploader.js` : Upload vers serveur externe

#### News permanente
- **ID unique** : `kto-invite-matinale-permanent`
- **Comportement** : Écrase le contenu chaque jour (pas de création de doublons)
- **Fichier S3** : `recordings/kto-radio/KTO-Radio-Matinale_latest.mp3`

#### Upload SFTP
- **Serveur** : access962407919.webspace-data.io
- **Fichier** : `invitekto.mp3` (nom fixe)
- **Credentials** : Stockés dans AWS Secrets Manager

### Règles EventBridge
```bash
# Enregistrement quotidien
Rule: KTO-Radio-Matinale-Recording
Schedule: cron(0 5 ? * MON-FRI *)  # 7h00 Paris
Duration: 888 secondes
```

## 2. Import automatique RSS KTO

### Flux RSS configurés
1. **La Parole aux Associations**
   - URL : https://www.ktotv.com/podcasts.rss/la-parole-aux-associations.rss
   - News ID : `kto-parole-associations`
   - Import : 7h30 (après publication 7h24)

2. **Chronique du Patrimoine**
   - URL : https://www.ktotv.com/podcasts.rss/chronique-du-patrimoine.rss
   - News ID : `kto-chronique-patrimoine`
   - Import : 7h00 (après publication 6h54)

3. **Le Cri de la Terre**
   - URL : https://www.ktotv.com/podcasts.rss/le-cri-de-la-terre.rss
   - News ID : `kto-cri-de-la-terre`
   - Import : 7h00 (après publication 6h54)

### Architecture RSS
```
RSS Feed → Lambda (flash-info-downloader) → S3 + DynamoDB
         ↓
    Extract Latest Episode
         ↓
    Download MP3 → S3
         ↓
    Update News (permanent)
```

### Composants RSS

#### Lambda : saint-esprit-flash-info-downloader
- **Module principal** : `rss-podcast-downloader.js`
- **Handler** : `rss-handler.js`
- **Fonctionnalités** :
  - Extraction du dernier épisode (tri par date)
  - Téléchargement MP3
  - Création/mise à jour de news permanentes
  - Tracking pour éviter les doublons

#### Tables DynamoDB
- `saint-esprit-news` : News avec clé composée (id, createdAt)
- `saint-esprit-rss-tracking` : Suivi des épisodes téléchargés

### Règles EventBridge RSS
```bash
# Import individuel
KTO-RSS-Parole-Associations : cron(30 5 * * ? *)  # 7h30
KTO-RSS-Chronique-Patrimoine : cron(0 5 * * ? *)  # 7h00
KTO-RSS-Cri-de-la-Terre : cron(0 5 * * ? *)      # 7h00

# Import complet quotidien
KTO-RSS-Daily-Complete : cron(0 1 * * ? *)        # 3h00
```

## 3. Corrections appliquées

### Problèmes résolus
1. **FFmpeg path** : Corrigé de `/opt/bin/ffmpeg` vers `/opt/ffmpeg-layer/bin/ffmpeg`
2. **News permanentes** : Implémentation du système de mise à jour au lieu de création
3. **SFTP filename** : Nom fixe `invitekto.mp3` au lieu de timestampé
4. **RSS date sorting** : Extraction du plus récent au lieu du plus ancien
5. **DynamoDB composite key** : Gestion correcte de la clé (id, createdAt)
6. **S3 CORS** : Ajout des méthodes PUT/POST/DELETE pour l'upload frontend
7. **Métadonnées S3** : Nettoyage des caractères non-ASCII

### Nettoyage effectué
- Suppression de 7 doublons de news "Invité Matinale KTO Radio"
- Conservation d'une seule news permanente mise à jour automatiquement

## 4. Scripts de déploiement

### Scripts créés
- `setup-kto-radio-recording.sh` : Configuration de l'enregistrement KTO
- `setup-rss-schedules.sh` : Configuration des imports RSS
- `deploy-rss-module.sh` : Déploiement du module RSS

## 5. Monitoring

### Logs CloudWatch
- `/aws/lambda/saint-esprit-stream-recorder` : Logs d'enregistrement
- `/aws/lambda/saint-esprit-flash-info-downloader` : Logs RSS

### Vérifications quotidiennes
- News KTO mise à jour après 7h15
- News RSS mises à jour selon schedule
- Fichier SFTP présent sur serveur externe

## 6. Commandes utiles

```bash
# Tester l'enregistrement KTO (15 minutes)
aws lambda invoke \
  --function-name saint-esprit-stream-recorder \
  --payload '{"action":"record","duration":900,"streamUrl":"http://54.37.9.140:8000/ktoradio"}' \
  response.json

# Importer tous les flux RSS
aws lambda invoke \
  --function-name saint-esprit-flash-info-downloader \
  --payload '{"action":"rss"}' \
  response.json

# Vérifier les news
aws dynamodb scan \
  --table-name saint-esprit-news \
  --filter-expression "contains(id, :kto)" \
  --expression-attribute-values '{":kto":{"S":"kto"}}' \
  --region eu-west-3
```

## 7. Maintenance

### Points d'attention
- Les credentials SFTP sont dans AWS Secrets Manager
- Les news permanentes ne doivent jamais être supprimées
- Le tracking RSS évite les re-téléchargements
- Les fichiers audio S3 sont conservés indéfiniment

### En cas de problème
1. Vérifier les logs CloudWatch
2. Vérifier les permissions IAM des lambdas
3. Vérifier la disponibilité des streams/RSS
4. Vérifier l'espace S3 et les quotas DynamoDB