#!/bin/bash

# Script d'initialisation pour Saint-Esprit Radio avec Amplify Gen 2
# Usage: ./init-amplify.sh

echo "🚀 Initialisation de Saint-Esprit Radio avec Amplify Gen 2"
echo "=========================================================="

# Couleurs pour l'affichage
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
REGION="eu-west-3"
USER_POOL_ID="eu-west-3_y2eHg83mr"
GRAPHQL_ENDPOINT="https://2pwh6b4pw5cuxop3r6dctrdhoi.appsync-api.eu-west-3.amazonaws.com/graphql"

echo ""
echo "📋 Configuration:"
echo "  • Region: $REGION"
echo "  • User Pool: $USER_POOL_ID"
echo "  • API GraphQL: $GRAPHQL_ENDPOINT"
echo ""

# Vérifier AWS CLI
echo "🔍 Vérification AWS CLI..."
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI n'est pas installé${NC}"
    exit 1
fi
echo -e "${GREEN}✅ AWS CLI disponible${NC}"

# Vérifier Node.js
echo "🔍 Vérification Node.js..."
NODE_VERSION=$(node --version 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${YELLOW}⚠️  Node.js 20+ requis${NC}"
    echo "Installation recommandée: brew install node@20"
    exit 1
fi
echo -e "${GREEN}✅ Node.js v$NODE_VERSION détecté${NC}"

# Vérifier les credentials AWS
echo "🔍 Vérification credentials AWS..."
aws sts get-caller-identity --region $REGION > /dev/null 2>&1
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Credentials AWS non configurés${NC}"
    echo "Exécutez: aws configure"
    exit 1
fi
echo -e "${GREEN}✅ Credentials AWS valides${NC}"

echo ""
echo "📦 Installation des dépendances..."
npm install aws-amplify@latest --silent

echo ""
echo "👥 Configuration des utilisateurs et groupes..."

# Créer les groupes s'ils n'existent pas
echo "  • Création du groupe 'journalists'..."
aws cognito-idp create-group \
  --group-name journalists \
  --user-pool-id $USER_POOL_ID \
  --description "Groupe des journalistes avec accès complet" \
  --region $REGION > /dev/null 2>&1 || echo "    (groupe déjà existant)"

echo "  • Création du groupe 'volunteers'..."
aws cognito-idp create-group \
  --group-name volunteers \
  --user-pool-id $USER_POOL_ID \
  --description "Groupe des bénévoles avec accès limité" \
  --region $REGION > /dev/null 2>&1 || echo "    (groupe déjà existant)"

echo ""
echo "📊 Résumé des utilisateurs disponibles:"
echo ""
echo "┌─────────────────────────────────────────────────────────────┐"
echo "│ UTILISATEURS DE TEST                                        │"
echo "├─────────────────────────────────────────────────────────────┤"
echo "│ 📧 Email                          │ 🔑 Mot de passe       │"
echo "├─────────────────────────────────────────────────────────────┤"
echo "│ test@saintesprit.radio           │ TempPass123!          │"
echo "│ journalist@saintesprit.radio     │ Journal123!           │"
echo "│ volunteer@saintesprit.radio      │ Benev123!             │"
echo "└─────────────────────────────────────────────────────────────┘"
echo ""
echo -e "${YELLOW}⚠️  Note: Changement de mot de passe requis au premier login${NC}"

echo ""
echo "🌐 Démarrage du serveur de test..."
cd frontend

# Arrêter le serveur s'il tourne déjà
pkill -f "python3 -m http.server" 2>/dev/null

# Démarrer le serveur
python3 -m http.server 8000 > /dev/null 2>&1 &
SERVER_PID=$!
sleep 2

# Vérifier que le serveur a démarré
if ps -p $SERVER_PID > /dev/null; then
    echo -e "${GREEN}✅ Serveur démarré (PID: $SERVER_PID)${NC}"
else
    echo -e "${RED}❌ Échec du démarrage du serveur${NC}"
    exit 1
fi

echo ""
echo "=========================================================="
echo -e "${GREEN}🎉 INITIALISATION TERMINÉE AVEC SUCCÈS !${NC}"
echo "=========================================================="
echo ""
echo "📱 ACCÈS À L'APPLICATION:"
echo "  • Page de test: http://localhost:8000/amplify-test.html"
echo "  • Application principale: http://localhost:8000/index.html"
echo ""
echo "📚 DOCUMENTATION:"
echo "  • Guide intégration: frontend/js/amplify/README.md"
echo "  • Rapport technique: RAPPORT-SUPERVISEUR-TECHNIQUE.md"
echo ""
echo "🛠️ COMMANDES UTILES:"
echo "  • Arrêter le serveur: pkill -f 'python3 -m http.server'"
echo "  • Voir les logs Amplify: npx ampx sandbox --stream-function-logs"
echo "  • Lister les utilisateurs: aws cognito-idp list-users --user-pool-id $USER_POOL_ID --region $REGION"
echo ""
echo "💡 PROCHAINES ÉTAPES:"
echo "  1. Ouvrir http://localhost:8000/amplify-test.html"
echo "  2. Se connecter avec un compte de test"
echo "  3. Tester la création et synchronisation de news"
echo "  4. Observer les notifications temps réel"
echo ""
echo -e "${GREEN}Bonne exploration de Saint-Esprit Radio avec Amplify Gen 2 ! 🚀${NC}"