#!/bin/bash
# Script pour déployer AppSync avec Amplify Gen 2
# Crée l'API GraphQL avec subscriptions temps réel

set -e

cd "$(dirname "$0")/.."

echo "🚀 Déploiement de l'API AppSync..."
echo ""

# Vérifier que npm est installé
if ! command -v npm &> /dev/null; then
    echo "❌ npm n'est pas installé"
    exit 1
fi

# Vérifier que les dépendances sont installées
if [ ! -d "node_modules" ]; then
    echo "📦 Installation des dépendances..."
    npm install
fi

# Déployer avec Amplify
echo ""
echo "🔧 Déploiement de l'infrastructure Amplify..."
echo "   - API GraphQL AppSync"
echo "   - Tables DynamoDB"
echo "   - Subscriptions WebSocket"
echo "   - Auth Cognito"
echo ""

# Option 1: Sandbox (développement)
# npx ampx sandbox

# Option 2: Production
npx ampx deploy --branch main

echo ""
echo "✅ Déploiement terminé !"
echo ""
echo "📋 Ressources créées :"
echo "   - API AppSync GraphQL"
echo "   - Tables DynamoDB (News, Animations, Blocks, Conductors)"
echo "   - Subscriptions temps réel"
echo "   - Connexion à Cognito"
echo ""
echo "📄 Configuration exportée dans: amplify_outputs.json"
echo ""
echo "🎯 Prochaine étape :"
echo "   1. Vérifier amplify_outputs.json"
echo "   2. Utiliser StorageDynamoDB.js dans le frontend"
echo "   3. Migrer les données avec migrateToDynamoDB()"
