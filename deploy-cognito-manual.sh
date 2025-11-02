#!/bin/bash

# Script de déploiement manuel Cognito pour Saint-Esprit Radio
# Alternative à Amplify Gen 2 si Node.js incompatible

echo "🚀 Déploiement Cognito pour Saint-Esprit Radio"
echo "============================================"

REGION="eu-west-3"
USER_POOL_NAME="saint-esprit-radio-users"
CLIENT_NAME="saint-esprit-web-client"
IDENTITY_POOL_NAME="saint_esprit_radio_identity"

# 1. Créer le User Pool
echo "📋 Création du User Pool Cognito..."
USER_POOL_ID=$(aws cognito-idp create-user-pool \
    --pool-name "$USER_POOL_NAME" \
    --region "$REGION" \
    --auto-verified-attributes email \
    --username-attributes email \
    --policies '{"PasswordPolicy":{"MinimumLength":8,"RequireUppercase":true,"RequireLowercase":true,"RequireNumbers":true,"RequireSymbols":false}}' \
    --query 'UserPool.Id' \
    --output text)

echo "✅ User Pool créé : $USER_POOL_ID"

# 2. Créer le App Client
echo "📋 Création du App Client..."
CLIENT_ID=$(aws cognito-idp create-user-pool-client \
    --user-pool-id "$USER_POOL_ID" \
    --client-name "$CLIENT_NAME" \
    --region "$REGION" \
    --no-generate-secret \
    --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH \
    --query 'UserPoolClient.ClientId' \
    --output text)

echo "✅ App Client créé : $CLIENT_ID"

# 3. Créer les groupes
echo "📋 Création des groupes..."
aws cognito-idp create-group \
    --group-name journalists \
    --user-pool-id "$USER_POOL_ID" \
    --description "Journalistes avec accès complet" \
    --region "$REGION"

aws cognito-idp create-group \
    --group-name volunteers \
    --user-pool-id "$USER_POOL_ID" \
    --description "Bénévoles avec accès limité" \
    --region "$REGION"

echo "✅ Groupes créés"

# 4. Créer l'Identity Pool
echo "📋 Création de l'Identity Pool..."
IDENTITY_POOL_ID=$(aws cognito-identity create-identity-pool \
    --identity-pool-name "$IDENTITY_POOL_NAME" \
    --region "$REGION" \
    --allow-unauthenticated-identities \
    --cognito-identity-providers "ProviderName=cognito-idp.$REGION.amazonaws.com/$USER_POOL_ID,ClientId=$CLIENT_ID" \
    --query 'IdentityPoolId' \
    --output text)

echo "✅ Identity Pool créé : $IDENTITY_POOL_ID"

# 5. Créer le fichier de configuration
echo "📋 Création du fichier de configuration..."
cat > frontend/js/auth/aws-cognito-config.json << EOF
{
    "region": "$REGION",
    "userPoolId": "$USER_POOL_ID",
    "clientId": "$CLIENT_ID",
    "identityPoolId": "$IDENTITY_POOL_ID"
}
EOF

echo "✅ Configuration sauvegardée dans frontend/js/auth/aws-cognito-config.json"

# 6. Afficher les informations
echo ""
echo "🎉 DÉPLOIEMENT TERMINÉ !"
echo "========================"
echo ""
echo "📝 Informations Cognito :"
echo "  Region: $REGION"
echo "  User Pool ID: $USER_POOL_ID"
echo "  Client ID: $CLIENT_ID"
echo "  Identity Pool ID: $IDENTITY_POOL_ID"
echo ""
echo "🔐 Pour créer un utilisateur test :"
echo "  aws cognito-idp admin-create-user \\"
echo "    --user-pool-id $USER_POOL_ID \\"
echo "    --username test@example.com \\"
echo "    --temporary-password TempPass123! \\"
echo "    --message-action SUPPRESS"
echo ""
echo "📚 Documentation : https://docs.aws.amazon.com/cognito/"