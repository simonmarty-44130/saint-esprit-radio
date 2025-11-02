# Prochaines étapes après installation Node.js 20

## 📋 Vérifications après installation

### 1. Vérifier que Node.js 20 est installé
```bash
brew list | grep node@20
# Devrait afficher: node@20
```

### 2. Basculer vers Node.js 20
```bash
# Désactiver la version actuelle
brew unlink node

# Activer Node.js 20
brew link --overwrite node@20

# Vérifier la version
node --version
# Devrait afficher: v20.x.x
```

### 3. Nettoyer et réinstaller les dépendances
```bash
# Supprimer les anciens modules (compilés avec Node 23)
rm -rf node_modules
rm -f package-lock.json

# Réinstaller avec Node 20
npm install
```

## 🚀 Lancer Amplify Gen 2

### 1. Démarrer le sandbox de développement
```bash
npx ampx sandbox
```

Cela va :
- ✅ Créer automatiquement tous les services AWS
- ✅ Générer `amplify_outputs.json`
- ✅ Déployer Cognito, S3, DynamoDB, AppSync
- ✅ Surveiller les changements de code en temps réel

### 2. Ce qui sera créé automatiquement

#### Cognito (Authentification)
- User Pool avec groupes (journalists/volunteers)
- Identity Pool pour les permissions AWS
- Configuration email/password

#### S3 (Stockage)
- Dossiers avec permissions granulaires
- Isolation par utilisateur
- Support pour audio/images/documents

#### DynamoDB + GraphQL (Base de données)
- Tables pour News, Blocks, Emissions, etc.
- API GraphQL avec requêtes temps réel
- Synchronisation automatique

### 3. Première connexion au sandbox

Une fois le sandbox lancé, vous verrez :
```
✅ Sandbox deployed successfully

Amplify outputs written to amplify_outputs.json

GraphQL API: https://xxxxxx.appsync-api.eu-west-3.amazonaws.com/graphql
```

### 4. Tester l'application

Modifiez `frontend/index.html` :
```html
<!-- Ajouter avant </head> -->
<script type="module">
import { Amplify } from 'https://cdn.jsdelivr.net/npm/aws-amplify@latest/+esm';
import outputs from './amplify_outputs.json' assert { type: 'json' };

Amplify.configure(outputs);
console.log('✅ Amplify configuré avec succès !');
</script>
```

### 5. Créer un utilisateur test

Dans un autre terminal :
```bash
# Le sandbox vous donnera l'ID du User Pool
aws cognito-idp admin-create-user \
  --user-pool-id eu-west-3_XXXXXX \
  --username test@example.com \
  --temporary-password TempPass123! \
  --message-action SUPPRESS
```

## 🎯 Migration des données existantes

### Script de migration S3 → DynamoDB
```javascript
// migration.js
import { generateClient } from 'aws-amplify/data';
const client = generateClient();

async function migrate() {
  // Lire l'ancien JSON depuis S3
  const response = await fetch('https://saint-esprit-audio.s3.eu-west-3.amazonaws.com/users/simon/data.json');
  const oldData = await response.json();
  
  // Migrer les news
  for (const news of oldData.news || []) {
    await client.models.News.create({
      title: news.title,
      content: news.content,
      author: news.author || 'simon',
      userId: 'simon',
      status: 'published'
    });
  }
  
  console.log('✅ Migration terminée !');
}

migrate();
```

## 🛠️ En cas de problème

### Si npx ampx sandbox échoue
1. Vérifiez Node.js : `node --version` (doit être v20)
2. Vérifiez AWS : `aws sts get-caller-identity`
3. Nettoyez : `rm -rf .amplify node_modules`

### Si les permissions échouent
Vérifiez que votre utilisateur AWS a :
- AmplifyFullAccess
- CloudFormationFullAccess
- CognitoFullAccess
- S3FullAccess
- DynamoDBFullAccess

### Support
- [Documentation Amplify Gen 2](https://docs.amplify.aws/gen2/)
- [Discord Amplify](https://discord.gg/amplify)
- GitHub Issues : `aws-amplify/amplify-backend`

## ✅ Checklist finale

- [ ] Node.js 20 installé et actif
- [ ] `npm install` réussi
- [ ] `npx ampx sandbox` lance sans erreur
- [ ] `amplify_outputs.json` généré
- [ ] Application connectée à Amplify
- [ ] Utilisateur test créé
- [ ] Connexion fonctionnelle

## 🎉 Félicitations !

Une fois tout configuré, votre application aura :
- ✅ Authentification sécurisée
- ✅ Base de données temps réel
- ✅ Stockage privé par utilisateur
- ✅ API GraphQL complète
- ✅ Synchronisation multi-utilisateurs
- ✅ Permissions granulaires

Plus besoin de gérer manuellement les fichiers JSON dans S3 !

---

*Document créé le 21 août 2025*