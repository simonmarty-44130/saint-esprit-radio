#!/bin/bash

set -e  # Arrêter le script en cas d'erreur

# Script de configuration rapide pour Amplify Gen 2
# À exécuter après l'installation de Node.js 20

echo "🚀 Configuration d'Amplify Gen 2 pour Saint-Esprit Radio"
echo "========================================================="

# 1. Vérifier la version de Node
echo ""
echo "📋 Vérification de Node.js..."
NODE_VERSION=$(node --version 2>/dev/null)
if [[ -z "$NODE_VERSION" ]]; then
    echo "❌ Node.js n'est pas installé ou non accessible"
    echo "   Veuillez d'abord installer Node.js 20"
    exit 1
fi

# Extraire le numéro de version majeure
MAJOR_VERSION=$(echo $NODE_VERSION | cut -d'.' -f1 | sed 's/v//')
if [[ $MAJOR_VERSION -lt 18 || $MAJOR_VERSION -gt 22 ]]; then
    echo "⚠️  Version actuelle: $NODE_VERSION"
    echo "   Amplify Gen 2 nécessite Node.js 18-22"
    echo ""
    echo "Pour basculer vers Node 20:"
    echo "  brew unlink node"
    echo "  brew link --overwrite node@20"
    exit 1
fi

echo "✅ Node.js $NODE_VERSION détecté"

# 2. Nettoyer les anciens modules de manière sécurisée
echo ""
echo "🧹 Nettoyage des anciens modules..."
if [ -d "node_modules" ]; then
    echo "  Suppression du dossier node_modules..."
    rm -rf node_modules && echo "  ✅ node_modules supprimé" || {
        echo "  ⚠️ Impossible de supprimer node_modules - vérifiez les permissions"
        echo "  Tentative de suppression forcée..."
        sudo rm -rf node_modules 2>/dev/null && echo "  ✅ node_modules supprimé (sudo)" || echo "  ❌ Échec suppression node_modules"
    }
fi

if [ -f "package-lock.json" ]; then
    echo "  Suppression du fichier package-lock.json..."
    rm -f package-lock.json && echo "  ✅ package-lock.json supprimé" || echo "  ⚠️ Erreur suppression package-lock.json"
fi

# 3. Installer les dépendances Amplify Gen 2
echo ""
echo "📦 Installation des dépendances Amplify Gen 2..."
npm install @aws-amplify/backend @aws-amplify/backend-cli typescript aws-amplify

# 4. Vérifier l'installation
echo ""
echo "🔍 Vérification de l'installation..."
if ! npx ampx --version > /dev/null 2>&1; then
    echo "❌ Amplify CLI Gen 2 n'est pas installé correctement"
    exit 1
fi

echo "✅ Amplify CLI Gen 2 installé: $(npx ampx --version)"

# 5. Afficher les prochaines étapes
echo ""
echo "🎉 Installation terminée !"
echo "========================="
echo ""
echo "📋 Prochaines étapes:"
echo ""
echo "1. Lancer le sandbox de développement:"
echo "   npx ampx sandbox"
echo ""
echo "2. Dans un autre terminal, créer un utilisateur test:"
echo "   # Attendez que le sandbox affiche l'ID du User Pool"
echo "   aws cognito-idp admin-create-user \\"
echo "     --user-pool-id eu-west-3_XXXXXX \\"
echo "     --username test@example.com \\"
echo "     --temporary-password TempPass123! \\"
echo "     --message-action SUPPRESS"
echo ""
echo "3. L'application sera accessible avec:"
echo "   - GraphQL API: https://xxxxx.appsync-api.eu-west-3.amazonaws.com/graphql"
echo "   - Fichier de config: amplify_outputs.json"
echo ""
echo "📚 Documentation: https://docs.amplify.aws/gen2/"
echo ""
echo "💡 Astuce: Le sandbox surveille les changements en temps réel"
echo "   Toute modification dans amplify/ sera automatiquement déployée"