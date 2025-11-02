# Guide Configuration AWS Cognito - Saint-Esprit Radio

## Configuration Manuelle (Sans Amplify CLI)

Puisque les permissions Amplify/CloudFormation posent problème, voici comment configurer Cognito manuellement via la console AWS.

---

## Étape 1 : Créer un User Pool Cognito

1. Allez sur : https://console.aws.amazon.com/cognito/
2. Cliquez sur **"Create user pool"**
3. Configuration :

### Step 1 - Configure sign-in
- ✅ Email
- ✅ Allow users to sign in with a preferred username

### Step 2 - Configure security requirements
- Password policy : Par défaut
- MFA : Optional (pour commencer)

### Step 3 - Configure sign-up
- ✅ Enable self-registration
- Required attributes : email

### Step 4 - Configure message delivery
- Email : Cognito default

### Step 5 - Integrate your app
- User pool name : `saint-esprit-radio-users`
- App client name : `saint-esprit-web-client`
- ✅ Generate a client secret : NON (décoché)

### Step 6 - Review and create
Cliquez sur **Create user pool**

**Notez ces valeurs** :
- User pool ID : `eu-west-3_XXXXXXXXX`
- Client ID : `XXXXXXXXXXXXXXXXXXXXXXXXX`

---

## Étape 2 : Créer un Identity Pool

1. Allez sur : https://console.aws.amazon.com/cognito/federated
2. Cliquez sur **"Create identity pool"**
3. Configuration :
   - Identity pool name : `saint_esprit_radio_identity`
   - ✅ Enable access to unauthenticated identities
   - Authentication providers → Cognito :
     - User pool ID : [Votre User pool ID]
     - App client ID : [Votre Client ID]

4. Create Pool
5. Sur la page des rôles IAM, acceptez les rôles par défaut

**Notez cette valeur** :
- Identity pool ID : `eu-west-3:XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`

---

## Étape 3 : Configurer les Rôles IAM

### Rôle pour les utilisateurs authentifiés

1. IAM → Roles → `Cognito_saint_esprit_radio_identityAuth_Role`
2. Add permissions → Create inline policy :

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "s3:GetObject",
                "s3:PutObject",
                "s3:DeleteObject"
            ],
            "Resource": "arn:aws:s3:::saint-esprit-audio/users/${cognito-identity.amazonaws.com:sub}/*"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:ListBucket"
            ],
            "Resource": "arn:aws:s3:::saint-esprit-audio",
            "Condition": {
                "StringLike": {
                    "s3:prefix": "users/${cognito-identity.amazonaws.com:sub}/*"
                }
            }
        }
    ]
}
```

---

## Étape 4 : Mettre à jour le code

Modifiez `/frontend/js/auth/cognito-config.js` :

```javascript
const COGNITO_CONFIG = {
    region: 'eu-west-3',
    userPoolId: 'eu-west-3_XXXXXXXXX', // Votre User Pool ID
    clientId: 'XXXXXXXXXXXXXXXXXXXXXXXXX', // Votre Client ID
    identityPoolId: 'eu-west-3:XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX' // Votre Identity Pool ID
};
```

---

## Étape 5 : Ajouter les scripts Cognito

Dans `/frontend/index.html`, ajoutez avant les autres scripts :

```html
<!-- AWS Cognito SDK -->
<script src="https://sdk.amazonaws.com/js/aws-cognito-sdk.min.js"></script>
<script src="js/auth/cognito-config.js"></script>
```

---

## Étape 6 : Modifier storage.js

Remplacez la configuration dans `/frontend/js/core/storage.js` :

```javascript
constructor() {
    this.auth = new CognitoAuth();
    this.config = {
        region: 'eu-west-3',
        bucket: 'saint-esprit-audio'
    };
    
    // Attendre l'authentification
    this.initializeWithAuth();
}

async initializeWithAuth() {
    const isAuth = await this.auth.isAuthenticated();
    
    if (isAuth) {
        // Utiliser AWS SDK avec Cognito
        AWS.config.credentials.get(() => {
            this.s3 = new AWS.S3({
                apiVersion: '2006-03-01',
                params: {Bucket: this.config.bucket}
            });
        });
    } else {
        // Mode lecture seule HTTP
        this.setupHttpMode();
    }
}
```

---

## Étape 7 : Créer la page de connexion

Créez `/frontend/login.html` :

```html
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Connexion - Saint Esprit Radio</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }
        .login-container {
            background: white;
            padding: 2rem;
            border-radius: 10px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2);
            width: 400px;
        }
        input {
            width: 100%;
            padding: 10px;
            margin: 10px 0;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        button {
            width: 100%;
            padding: 10px;
            background: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
        }
        button:hover {
            background: #45a049;
        }
        .error {
            color: red;
            margin: 10px 0;
        }
    </style>
</head>
<body>
    <div class="login-container">
        <h2>Connexion Saint-Esprit Radio</h2>
        <div id="error" class="error"></div>
        
        <form id="loginForm">
            <input type="text" id="username" placeholder="Nom d'utilisateur" required>
            <input type="password" id="password" placeholder="Mot de passe" required>
            <button type="submit">Se connecter</button>
        </form>
        
        <p style="text-align: center; margin-top: 20px;">
            <a href="#" onclick="showSignup()">Créer un compte</a>
        </p>
    </div>
    
    <script src="https://sdk.amazonaws.com/js/aws-sdk-2.1000.0.min.js"></script>
    <script src="https://sdk.amazonaws.com/js/aws-cognito-sdk.min.js"></script>
    <script src="js/auth/cognito-config.js"></script>
    <script>
        const auth = new CognitoAuth();
        
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            
            try {
                await auth.signIn(username, password);
                window.location.href = '/index.html';
            } catch (error) {
                document.getElementById('error').textContent = error.message;
            }
        });
        
        function showSignup() {
            alert('Fonction inscription à implémenter');
        }
    </script>
</body>
</html>
```

---

## Étape 8 : Tester

1. Créez un utilisateur test dans Cognito Console
2. Accédez à : http://saint-esprit-audio.s3-website.eu-west-3.amazonaws.com/login.html
3. Connectez-vous avec l'utilisateur test

---

## Alternative : Mode Développement Local

Si vous voulez tester sans Cognito :

1. Dans `cognito-config.js`, laissez :
```javascript
userPoolId: 'YOUR_USER_POOL_ID'
```

2. L'application basculera automatiquement en mode local avec localStorage

---

## Support

- Documentation Cognito : https://docs.aws.amazon.com/cognito/
- SDK JavaScript : https://github.com/aws-amplify/amplify-js

---

*Document créé le 21 août 2025*