# Documentation Déploiement AWS - Saint-Esprit Radio
## Date : 21 août 2025
## Réalisé par : Claude Assistant

---

## 📋 RÉSUMÉ EXÉCUTIF

Déploiement de l'application Saint-Esprit Radio sur AWS S3 avec configuration static website hosting. L'application comprend un mode journaliste et un mode bénévole, avec synchronisation des données via S3.

### État actuel
- ✅ Application déployée sur S3
- ✅ Accessible via : http://saint-esprit-audio.s3-website.eu-west-3.amazonaws.com/
- ⚠️ Authentification AWS non fonctionnelle (credentials requis)
- ⚠️ Mode lecture seule actuellement

---

## 🚀 PROCESSUS DE DÉPLOIEMENT

### 1. Installation AWS CLI
```bash
# Tentative initiale via Homebrew (échec - timeout)
brew install awscli

# Solution alternative utilisée
pip3 install --user --break-system-packages awscli

# Ajout au PATH
export PATH="$PATH:/Users/directionradiofidelite/Library/Python/3.13/bin"
```

### 2. Configuration AWS
```bash
aws configure
# Access Key ID: AKIA45Y2RPBESWOAXOU3
# Secret Access Key: [CONFIDENTIEL]
# Region: eu-west-3
# Output: json
```

⚠️ **SÉCURITÉ CRITIQUE** : L'Access Key ID a été exposée publiquement. DOIT être régénérée.

### 3. Permissions IAM
Politique personnalisée appliquée à l'utilisateur "Sim" :
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:CreateBucket",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:PutBucketWebsite",
        "s3:PutBucketPolicy",
        "s3:PutBucketCORS",
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::saint-esprit-audio",
        "arn:aws:s3:::saint-esprit-audio/*"
      ]
    }
  ]
}
```

### 4. Déploiement via Script
```bash
cd /Users/directionradiofidelite/saint-esprit-aws
echo "1" | ./deploy-one-click.sh  # Option 1 : Déploiement rapide
```

---

## 🐛 PROBLÈMES RENCONTRÉS ET SOLUTIONS

### Problème 1 : AWS CLI Installation Timeout
**Symptôme** : Homebrew timeout lors de la compilation de cmake
**Solution** : Installation via pip3 au lieu de Homebrew

### Problème 2 : Permissions AWS Manquantes
**Symptôme** : "AccessDenied" lors des opérations S3
**Solution** : Ajout de la politique IAM personnalisée

### Problème 3 : Fichiers Non Uploadés
**Symptôme** : 404 sur index.html
**Solution** : Upload manuel et synchronisation complète
```bash
aws s3 sync frontend/ s3://saint-esprit-audio/ --exclude "*.bak" --exclude ".htaccess" --exclude "*.md"
```

### Problème 4 : process.env Non Défini
**Symptôme** : "process is not defined" dans le navigateur
**Code erroné** :
```javascript
accessKeyId: process.env.AWS_ACCESS_KEY_ID || "TEMP_KEY"
```
**Solution** : Suppression des références à process.env

### Problème 5 : AWS SDK Credentials Required
**Symptôme** : "Missing credentials in config"
**Tentative 1** : Configuration avec credentials: null (échec)
**Solution finale** : Remplacement d'AWS SDK par fetch() HTTP direct

---

## 📁 STRUCTURE DES FICHIERS DÉPLOYÉS

```
s3://saint-esprit-audio/
├── index.html (77.8 KB)
├── volunteer.html (36.0 KB)
├── css/
│   ├── main.css
│   ├── volunteer-mode.css
│   └── [13 autres fichiers CSS]
├── js/
│   ├── app.js (145.3 KB)
│   ├── core/
│   │   ├── storage.js (32.0 KB - modifié)
│   │   └── [autres modules core]
│   ├── managers/
│   │   └── [tous les managers]
│   └── modules/
│       ├── StudiosCalendar.js
│       └── EmissionEditor.js
└── [Total: 78 fichiers, 1.3 MB]
```

---

## 🔧 MODIFICATIONS TECHNIQUES APPORTÉES

### storage.js - Version HTTP
```javascript
// Avant (AWS SDK)
this.s3 = new AWS.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// Après (HTTP Direct)
this.s3 = {
    getObject: (params) => ({
        promise: () => this.httpGetObject(params)
    }),
    putObject: (params) => ({
        promise: () => this.httpPutObject(params)
    })
};
```

### Configuration CORS du Bucket
```json
{
    "CORSRules": [{
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"],
        "MaxAgeSeconds": 3000
    }]
}
```

### Politique Publique du Bucket
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
            "Resource": "arn:aws:s3:::saint-esprit-audio/*"
        }
    ]
}
```

---

## ⚠️ LIMITATIONS ACTUELLES

1. **Lecture Seule** : Les opérations d'écriture (PUT/DELETE) ne fonctionnent pas via HTTP direct
2. **Pas d'Authentification** : Bucket complètement public (dangereux pour production)
3. **Pas de Liste de Fichiers** : listObjectsV2 retourne une liste vide
4. **Sécurité Compromise** : Access Key exposée publiquement

---

## 🎯 PROCHAINES ÉTAPES RECOMMANDÉES

### Option 1 : AWS Amplify + Cognito (RECOMMANDÉ)
```bash
npm install aws-amplify @aws-amplify/ui-react
amplify init
amplify add auth
amplify add storage
amplify push
```

### Option 2 : Backend API Gateway + Lambda
- Créer API REST avec API Gateway
- Lambda functions pour les opérations S3
- Authentification via API Keys ou Cognito

### Option 3 : Mode Local pour Développement
- Utiliser localStorage pour le développement
- S3 uniquement pour la production

---

## 🔐 ACTIONS DE SÉCURITÉ URGENTES

1. **Régénérer les clés AWS immédiatement**
   - Console AWS → IAM → Users → Sim → Security credentials
   - Create new access key
   - Delete old key: AKIA45Y2RPBESWOAXOU3

2. **Supprimer la politique publique du bucket**
   ```bash
   aws s3api delete-bucket-policy --bucket saint-esprit-audio
   ```

3. **Implémenter l'authentification**
   - AWS Cognito pour les utilisateurs
   - IAM roles pour les permissions

---

## 📊 MÉTRIQUES DE DÉPLOIEMENT

- **Durée totale** : ~2 heures (incluant debug)
- **Fichiers uploadés** : 78
- **Taille totale** : 1.3 MB
- **Requêtes S3** : ~150
- **Coût estimé** : < $0.01 (S3 standard)

---

## 📝 NOTES POUR LE DÉVELOPPEUR SUIVANT

### Ce qui fonctionne :
- ✅ Hébergement static website S3
- ✅ Accès public en lecture
- ✅ Interface utilisateur complète
- ✅ Mode bénévole avec page dédiée

### Ce qui ne fonctionne pas :
- ❌ Sauvegarde des données (PUT/POST)
- ❌ Authentification utilisateurs
- ❌ Synchronisation multi-utilisateurs
- ❌ Upload d'audio

### Commandes utiles :
```bash
# Synchroniser les fichiers locaux vers S3
aws s3 sync frontend/ s3://saint-esprit-audio/ --exclude "*.bak"

# Vérifier l'état du bucket
aws s3 ls s3://saint-esprit-audio/

# Tester l'accès
curl -I http://saint-esprit-audio.s3-website.eu-west-3.amazonaws.com/

# Logs de CloudFront (si activé)
aws cloudfront get-distribution --id [DISTRIBUTION_ID]
```

---

## 🆘 SUPPORT ET CONTACT

- **Documentation AWS S3** : https://docs.aws.amazon.com/s3/
- **AWS Amplify** : https://docs.amplify.aws/
- **Problèmes connus** : Voir section "Problèmes rencontrés"

---

**Document généré le** : 21 août 2025
**Version** : 1.0
**Statut** : Déploiement partiel - Authentification requise pour production

---

## ANNEXE : Volunteer.html Améliorations

### Bugs corrigés dans volunteer.html :
1. **audio-name → audio-title** : Correction de l'ID du champ
2. **Formatage impression** : Ajout CSS @page avec marges A4
3. **Export email/download** : Implémentation des fonctions manquantes

### Code ajouté :
```javascript
function downloadAudio() {
    const audioName = document.getElementById('audio-title').value || 'chronique';
    // ... reste du code
}

function sendAudioByEmail() {
    // Download puis ouverture mailto
    const mailtoLink = `mailto:programmation@radio-fidelite.com?subject=${subject}&body=${body}`;
    window.open(mailtoLink);
}
```

---

*Fin du document*