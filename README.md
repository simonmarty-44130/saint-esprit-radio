# 🎙️ Saint-Esprit Radio - Système de Newsroom AWS

Application de gestion radio professionnelle avec synchronisation temps réel multi-utilisateurs.

## 🌟 Fonctionnalités

- 📰 **Gestion des News** - Création, édition, organisation des actualités
- 🎬 **Animations** - Jingles, pubs, liners, habillage d'antenne
- 📋 **Journaux** - Construction de journaux avec drag & drop
- 🎼 **Conducteur** - Planification d'émissions et conducteurs d'antenne
- 🎵 **Audio Editor** - Édition audio avec waveform
- 📻 **Mode ON AIR** - Interface simplifiée pour l'antenne
- 👥 **Multi-utilisateurs** - Synchronisation temps réel entre utilisateurs
- 📱 **Responsive** - Interface adaptée mobile/tablette/desktop

## 🏗️ Architecture

### Stack technique

- **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
- **Backend:** AWS Amplify Gen 2
- **Base de données:** DynamoDB (serverless)
- **API:** AppSync GraphQL + WebSocket Subscriptions
- **Authentification:** AWS Cognito
- **Storage:** S3 + CloudFront CDN
- **Région:** eu-west-3 (Paris)

### Architecture AWS

```
Utilisateurs
    ↓
CloudFront (CDN) - Cache 5 min
    ↓
S3 (Frontend) + AppSync (API GraphQL)
    ↓
DynamoDB (9 tables) + Cognito (Auth)
```

## 🚀 Déploiement

### Prérequis

- Node.js 18+
- AWS CLI configuré
- Compte AWS avec permissions Amplify

### Installation locale

```bash
# Installer les dépendances
npm install

# Démarrer le sandbox Amplify
npx ampx sandbox

# Le frontend est dans /frontend
cd frontend
python3 -m http.server 8000
```

### Déploiement production

```bash
# Déployer l'infrastructure Amplify
npx ampx sandbox --once

# Uploader le frontend vers S3
aws s3 sync frontend/ s3://[BUCKET_NAME]/ --region eu-west-3

# Invalider le cache CloudFront
aws cloudfront create-invalidation \
  --distribution-id [DISTRIBUTION_ID] \
  --paths "/*"
```

## 📊 Tables DynamoDB

- **News** - Articles et actualités
- **NewsArchive** - Archives des news expirées
- **Animation** - Éléments d'animation radio
- **Block** - Journaux et blocs de contenu
- **Conductor** - Conducteurs d'antenne
- **Template** - Modèles réutilisables
- **Audio** - Métadonnées des fichiers audio
- **UserActivity** - Suivi d'activité en temps réel
- **Settings** - Paramètres utilisateur/global

## 🔐 Sécurité

- Authentification via AWS Cognito
- API sécurisée avec AppSync
- CORS configuré
- Credentials jamais en dur dans le code
- Auth tokens gérés par Amplify

## 📱 Utilisation

### Connexion

1. Ouvrir l'application (https://saint-esprit.link)
2. Se connecter avec Cognito (redirection automatique)
3. L'interface se charge avec vos données

### Créer une news

```javascript
// Via l'interface ou la console
await appSyncStorage.createNews({
    title: "Titre de la news",
    content: "Contenu...",
    status: "draft",
    priority: 1,
    tags: ["actualité", "local"]
});
```

### Synchronisation temps réel

Les modifications sont synchronisées automatiquement entre tous les utilisateurs connectés via WebSocket subscriptions.

## 🛠️ Scripts utiles

```bash
# Corriger le cache CloudFront
./scripts/fix-cloudfront-cache.sh

# Déployer AppSync
./scripts/deploy-appsync.sh

# Audit des ressources AWS
./scripts/audit-unused-resources.sh

# Nettoyage ressources inutilisées
./scripts/cleanup-unused-resources.sh
```

## 📁 Structure du projet

```
saint-esprit-aws/
├── amplify/               # Configuration Amplify Gen 2
│   ├── auth/             # Cognito configuration
│   ├── data/             # Schema GraphQL
│   └── storage/          # S3 configuration
├── frontend/             # Application web
│   ├── index.html        # Point d'entrée
│   ├── css/              # Styles
│   └── js/
│       ├── core/         # Storage, auth
│       ├── components/   # UI components
│       └── managers/     # Business logic
├── scripts/              # Scripts de déploiement
├── amplify_outputs.json  # Config Amplify (généré)
└── package.json          # Dependencies
```

## 💰 Coûts AWS estimés

- DynamoDB: ~$3/mois
- AppSync: ~$4/mois
- S3: ~$0.50/mois
- CloudFront: ~$4/mois
- **Total: ~$12/mois**

## 🐛 Débogage

### Vérifier la connexion AppSync

```javascript
// Dans la console navigateur (F12)
appSyncStorage.getStats()
```

### Logs CloudWatch

```bash
# Logs AppSync
aws logs tail /aws/appsync/apis/[API_ID] --follow

# Métriques DynamoDB
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=News-[HASH] \
  --start-time 2025-11-02T00:00:00Z \
  --end-time 2025-11-02T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

## 📚 Documentation

- [Solution Robuste](SOLUTION-ROBUSTE.md) - Architecture complète
- [Guide d'implémentation](GUIDE-IMPLEMENTATION.md) - Déploiement pas à pas
- [Migration complète](MIGRATION-COMPLETE.md) - Historique de migration

## 🤝 Contribution

Ce projet est propriétaire et géré par Radio Fidélité.

## 📞 Support

Pour toute question : direction@radiofidelite.com

## 📄 License

Propriétaire - Radio Fidélité © 2025

---

**Développé pour Saint-Esprit Radio**
*Système de newsroom professionnel avec synchronisation temps réel*
