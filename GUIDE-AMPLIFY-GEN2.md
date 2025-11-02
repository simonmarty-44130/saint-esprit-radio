# Guide Amplify Gen 2 - Saint-Esprit Radio

## 🚀 Introduction

Amplify Gen 2 est la nouvelle génération d'AWS Amplify, offrant :
- **Code-first** : Tout est défini en TypeScript
- **Type-safe** : Types générés automatiquement
- **Git-based** : Déploiements basés sur les branches Git
- **Serverless** : Infrastructure entièrement managée

## 📁 Structure créée

```
saint-esprit-aws/
├── amplify/
│   ├── backend.ts          # Configuration backend principale
│   ├── auth/
│   │   └── resource.ts     # Configuration Cognito
│   ├── storage/
│   │   └── resource.ts     # Configuration S3
│   └── data/
│       └── resource.ts     # Schéma GraphQL/DynamoDB
├── tsconfig.json           # Configuration TypeScript
└── frontend/
    └── [vos fichiers existants]
```

## 🔧 Configuration créée

### 1. **Authentification** (`amplify/auth/resource.ts`)
- Connexion par email et nom d'utilisateur
- Groupes : `journalists` (accès complet) et `volunteers` (accès limité)
- Politique de mot de passe sécurisée

### 2. **Stockage** (`amplify/storage/resource.ts`)
Dossiers avec permissions granulaires :
- `users/{id}/*` : Dossier personnel de chaque utilisateur
- `audio/*` : Fichiers audio partagés
- `emissions/*` : Émissions radio
- `templates/*` : Templates (journalistes uniquement)
- `calendars/*` : Calendriers des studios

### 3. **Base de données** (`amplify/data/resource.ts`)
Modèles GraphQL avec autorisations :
- **News** : Articles et actualités
- **Block** : Blocs de contenu
- **Emission** : Émissions radio
- **Conductor** : Conducteurs d'émission
- **Template** : Modèles réutilisables
- **Animation** : Jingles et transitions
- **Fridge** : Contenus en attente
- **StudioCalendar** : Réservations studios

## 📦 Installation

### 1. Installer les dépendances manquantes
```bash
npm install @aws-amplify/backend @aws-amplify/backend-cli typescript
```

### 2. Créer un sandbox de développement
```bash
npx ampx sandbox
```
Cela va :
- Déployer un environnement de développement temporaire
- Générer `amplify_outputs.json` avec la configuration
- Synchroniser automatiquement vos changements

### 3. Pour le déploiement en production
```bash
npx ampx pipeline-deploy --branch main --app-id YOUR_APP_ID
```

## 🔄 Migration depuis votre code existant

### Étape 1 : Remplacer storage.js

Créez `frontend/js/core/amplify-gen2-storage.js` :

```javascript
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { uploadData, downloadData, remove, list } from 'aws-amplify/storage';
import outputs from '../../../amplify_outputs.json';

// Configurer Amplify avec les outputs générés
Amplify.configure(outputs);

const client = generateClient();

class AmplifyGen2Storage {
    constructor() {
        this.userId = null;
        this.init();
    }
    
    async init() {
        const { username } = await getCurrentUser();
        this.userId = username;
    }
    
    // Créer une news via GraphQL
    async createNews(news) {
        const { data } = await client.models.News.create({
            title: news.title,
            content: news.content,
            author: this.userId,
            userId: this.userId,
            publishedAt: new Date().toISOString(),
            status: 'published'
        });
        return data;
    }
    
    // Lister les news
    async getNews() {
        const { data } = await client.models.News.list();
        return data;
    }
    
    // Upload audio vers S3
    async uploadAudio(file) {
        const result = await uploadData({
            path: `audio/${this.userId}/${Date.now()}_${file.name}`,
            data: file,
            options: {
                contentType: file.type,
                onProgress: ({ transferredBytes, totalBytes }) => {
                    const progress = (transferredBytes / totalBytes) * 100;
                    console.log(`Upload: ${progress}%`);
                }
            }
        }).result;
        
        return result.path;
    }
    
    // Télécharger un fichier
    async downloadFile(path) {
        const result = await downloadData({
            path
        }).result;
        
        return result.body;
    }
}

export default AmplifyGen2Storage;
```

### Étape 2 : Mettre à jour index.html

```html
<!-- Remplacer AWS SDK par Amplify -->
<script type="module">
    import { Amplify } from 'aws-amplify';
    import outputs from './amplify_outputs.json';
    
    Amplify.configure(outputs);
    
    // Votre code d'initialisation
    import AmplifyGen2Storage from './js/core/amplify-gen2-storage.js';
    window.storage = new AmplifyGen2Storage();
</script>
```

## 🎯 Avantages d'Amplify Gen 2

### Par rapport à votre solution actuelle :

| Aspect | Solution actuelle | Amplify Gen 2 |
|--------|------------------|---------------|
| **Authentification** | Manuelle/Aucune | Cognito intégré |
| **Autorisations** | Bucket public 😱 | Permissions granulaires |
| **Base de données** | Fichiers JSON dans S3 | GraphQL + DynamoDB |
| **Temps réel** | Pas possible | WebSockets intégrés |
| **Recherche** | Limitée | GraphQL queries |
| **Coût** | S3 requests × users | Optimisé avec cache |
| **Sécurité** | Clés exposées | IAM roles automatiques |
| **Déploiement** | Manuel | CI/CD automatique |

## 🚀 Commandes utiles

```bash
# Démarrer le sandbox de développement
npx ampx sandbox

# Voir les logs en temps réel
npx ampx sandbox --stream-function-logs

# Générer les types TypeScript
npx ampx generate graphql-client-code --out frontend/graphql

# Déployer une branche
npx ampx pipeline-deploy --branch [branch-name]

# Supprimer le sandbox
npx ampx sandbox delete
```

## ⚠️ Migration des données existantes

Pour migrer vos données S3 actuelles vers DynamoDB :

```javascript
// Script de migration
async function migrateData() {
    // 1. Lire les anciens fichiers JSON depuis S3
    const oldData = await fetchFromS3('users/simon/data.json');
    
    // 2. Créer les enregistrements dans DynamoDB
    for (const news of oldData.news) {
        await client.models.News.create(news);
    }
    
    for (const block of oldData.blocks) {
        await client.models.Block.create(block);
    }
    
    console.log('Migration terminée !');
}
```

## 📚 Ressources

- [Documentation Amplify Gen 2](https://docs.amplify.aws/gen2/)
- [Guide de migration Gen1 → Gen2](https://docs.amplify.aws/gen2/deploy-and-host/migration/)
- [Exemples de code](https://github.com/aws-amplify/amplify-backend)

## 🎉 Prochaines étapes

1. **Exécutez** `npx ampx sandbox` dans votre terminal
2. **Attendez** le déploiement (5-10 minutes)
3. **Testez** avec le fichier `amplify_outputs.json` généré
4. **Migrez** progressivement vos fonctionnalités

---

**Note** : Amplify Gen 2 nécessite Node.js 18+ et un compte AWS avec les permissions appropriées.

*Document créé le 21 août 2025*