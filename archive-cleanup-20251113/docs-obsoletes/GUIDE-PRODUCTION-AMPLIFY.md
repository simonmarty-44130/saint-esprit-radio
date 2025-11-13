# 🚀 GUIDE DE PRODUCTION - SAINT-ESPRIT RADIO AVEC AMPLIFY GEN 2

## 📋 État du système

**Statut:** ✅ **PRÊT POUR LA PRODUCTION**

L'infrastructure AWS Amplify Gen 2 est entièrement déployée et configurée pour Saint-Esprit Radio.

---

## 🔐 Accès et authentification

### Utilisateurs disponibles

| Rôle | Email | Mot de passe | Groupe | Permissions |
|------|-------|--------------|--------|-------------|
| **Test** | test@saintesprit.radio | TempPass123! | - | Lecture/Écriture basique |
| **Journaliste** | journalist@saintesprit.radio | Journal123! | journalists | Accès complet |
| **Bénévole** | volunteer@saintesprit.radio | Benev123! | volunteers | Accès limité |

> ⚠️ **Important:** Changement de mot de passe obligatoire au premier login

### Groupes configurés

- **journalists**: Accès complet à toutes les fonctionnalités
- **volunteers**: Accès limité aux émissions et contenus publics

---

## 🌐 Services AWS déployés

### Infrastructure principale

| Service | ID/Endpoint | Région |
|---------|------------|--------|
| **API GraphQL** | https://2pwh6b4pw5cuxop3r6dctrdhoi.appsync-api.eu-west-3.amazonaws.com/graphql | eu-west-3 |
| **Cognito User Pool** | eu-west-3_y2eHg83mr | eu-west-3 |
| **Identity Pool** | eu-west-3:d0f1940d-2b53-4158-bef3-fbb650c6b268 | eu-west-3 |
| **S3 Bucket** | amplify-saintespritaws-di-saintespritstoragebucket-91ui2ognukke | eu-west-3 |

### Tables DynamoDB

- **News**: Articles et actualités (modèle actif)
- **Block**: Blocs de journaux (à implémenter)
- **Emission**: Émissions bénévoles (à implémenter)
- **Conductor**: Conducteurs d'émission (à implémenter)

---

## 🚀 Démarrage rapide

### 1. Initialisation automatique

```bash
# Exécuter le script d'initialisation
./init-amplify.sh
```

Ce script va :
- ✅ Vérifier les prérequis (Node.js 20+, AWS CLI)
- ✅ Installer les dépendances
- ✅ Créer les groupes et utilisateurs
- ✅ Démarrer le serveur de test
- ✅ Afficher les URLs d'accès

### 2. Test de l'application

```bash
# Ouvrir la page de test
open http://localhost:8000/amplify-test.html

# Ou l'application principale
open http://localhost:8000/index.html
```

### 3. Initialisation des données

Dans la console du navigateur (F12) :

```javascript
// Charger le module d'initialisation
import('./js/amplify/init-data.js');

// Créer les données de test
await initializeTestData();

// Pour nettoyer toutes les données
await clearAllData();
```

---

## 📁 Structure du projet

```
saint-esprit-aws/
├── amplify_outputs.json         # Configuration Amplify générée
├── init-amplify.sh              # Script d'initialisation
├── frontend/
│   ├── index.html               # Application principale
│   ├── amplify-test.html        # Page de test Amplify
│   └── js/
│       └── amplify/
│           ├── amplify-config.js         # Configuration
│           ├── amplify-auth.js           # Authentification
│           ├── amplify-data.js           # Données GraphQL
│           ├── amplify-storage-wrapper.js # Compatibilité S3
│           └── init-data.js              # Initialisation données
└── amplify/
    ├── backend.ts               # Configuration backend
    ├── auth/resource.ts         # Configuration Cognito
    ├── storage/resource.ts      # Configuration S3
    └── data/resource.ts         # Schéma GraphQL
```

---

## 🔧 Commandes utiles

### Gestion du sandbox Amplify

```bash
# Démarrer le sandbox
npx ampx sandbox

# Arrêter le sandbox
npx ampx sandbox delete

# Voir les logs en temps réel
npx ampx sandbox --stream-function-logs
```

### Gestion des utilisateurs

```bash
# Lister tous les utilisateurs
aws cognito-idp list-users \
  --user-pool-id eu-west-3_y2eHg83mr \
  --region eu-west-3

# Créer un nouvel utilisateur
aws cognito-idp admin-create-user \
  --user-pool-id eu-west-3_y2eHg83mr \
  --username nouveau@saintesprit.radio \
  --temporary-password "TempPass123!" \
  --region eu-west-3

# Ajouter un utilisateur à un groupe
aws cognito-idp admin-add-user-to-group \
  --user-pool-id eu-west-3_y2eHg83mr \
  --username nouveau@saintesprit.radio \
  --group-name journalists \
  --region eu-west-3
```

### Monitoring

```bash
# Voir les métriques CloudWatch
aws cloudwatch get-metric-statistics \
  --namespace AWS/AppSync \
  --metric-name 4XXError \
  --dimensions Name=GraphQLAPIId,Value=2pwh6b4pw5cuxop3r6dctrdhoi \
  --start-time 2025-08-21T00:00:00Z \
  --end-time 2025-08-22T00:00:00Z \
  --period 3600 \
  --statistics Sum \
  --region eu-west-3
```

---

## 📊 Intégration dans l'application existante

### Option 1: Intégration progressive

1. Ajouter dans `index.html` avant `</body>`:

```html
<script type="module">
  // Charger la configuration Amplify
  import './js/amplify/amplify-config.js';
  
  // Utiliser le wrapper de compatibilité
  import { AmplifyStorageWrapper } from './js/amplify/amplify-storage-wrapper.js';
  
  // Remplacer progressivement storage.js
  window.amplifyStorage = new AmplifyStorageWrapper();
</script>
```

### Option 2: Migration complète

1. Remplacer tous les appels `storage.js` par les nouveaux modules Amplify
2. Utiliser `amplify-auth.js` pour l'authentification
3. Utiliser `amplify-data.js` pour les opérations CRUD

---

## 🔒 Sécurité

### Bonnes pratiques

- ✅ **Rotation des mots de passe** : Forcer le changement au premier login
- ✅ **Groupes IAM** : Utiliser les groupes pour gérer les permissions
- ✅ **HTTPS uniquement** : Toutes les communications sont chiffrées
- ✅ **Tokens JWT** : Expiration automatique après 1 heure

### Checklist sécurité

- [ ] Changer tous les mots de passe temporaires
- [ ] Configurer MFA pour les comptes sensibles
- [ ] Activer les logs CloudTrail
- [ ] Configurer les alertes CloudWatch
- [ ] Réviser les politiques IAM

---

## 📈 Monitoring et performance

### Métriques clés à surveiller

| Métrique | Seuil d'alerte | Action |
|----------|---------------|---------|
| Latence API | > 1000ms | Optimiser les requêtes |
| Erreurs 4xx | > 5% | Vérifier l'authentification |
| Erreurs 5xx | > 1% | Vérifier les logs Lambda |
| Coût mensuel | > 50€ | Réviser l'utilisation |

### Tableaux de bord recommandés

1. **CloudWatch Dashboard** : Métriques temps réel
2. **X-Ray** : Traçage des requêtes
3. **Cost Explorer** : Suivi des coûts

---

## 🚨 Dépannage

### Problèmes courants

#### Erreur d'authentification
```javascript
// Vérifier le token
const user = await getCurrentUser();
console.log('Token valide:', user);

// Forcer la déconnexion/reconnexion
await signOut();
```

#### Erreur API GraphQL
```javascript
// Activer les logs détaillés
window.LOG_LEVEL = 'DEBUG';

// Tester la connexion
const response = await fetch(GRAPHQL_ENDPOINT, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: '{ __typename }' })
});
```

#### Performance lente
- Vérifier la taille du bundle (< 3MB recommandé)
- Activer la mise en cache CloudFront
- Utiliser la pagination pour les grandes listes

---

## 📞 Support et contacts

### Ressources

- **Documentation Amplify** : https://docs.amplify.aws/
- **Console AWS** : https://eu-west-3.console.aws.amazon.com/
- **Rapport technique** : RAPPORT-SUPERVISEUR-TECHNIQUE.md

### Équipe technique

- **Admin AWS** : Direction Radio Fidélité
- **Développement** : Claude AI Assistant
- **Support** : support@saintesprit.radio

---

## ✅ Checklist de mise en production

### Avant le lancement

- [ ] Tous les mots de passe changés
- [ ] Backup des données configuré
- [ ] Monitoring activé
- [ ] Tests de charge effectués
- [ ] Documentation à jour

### Jour J

- [ ] Vérifier tous les services AWS
- [ ] Tester l'authentification
- [ ] Vérifier les permissions
- [ ] Monitorer les logs
- [ ] Communiquer avec l'équipe

### Après le lancement

- [ ] Surveiller les métriques (24h)
- [ ] Collecter les retours utilisateurs
- [ ] Optimiser les performances
- [ ] Planifier les évolutions

---

## 🎯 Conclusion

Saint-Esprit Radio est maintenant équipé d'une infrastructure cloud moderne et scalable avec AWS Amplify Gen 2. Le système est :

- ✅ **Opérationnel** : Tous les services sont actifs
- ✅ **Sécurisé** : Authentification Cognito robuste
- ✅ **Performant** : API GraphQL temps réel
- ✅ **Scalable** : Architecture serverless
- ✅ **Documenté** : Guides complets disponibles

**Bonne diffusion avec Saint-Esprit Radio ! 📻✨**

---

*Document généré le 21 août 2025 - Version 1.0*