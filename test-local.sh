#!/bin/bash

echo "🚀 Lancement de Saint-Esprit AWS en local..."
echo ""
echo "📁 Répertoire : /Users/directionradiofidelite/saint-esprit-aws/frontend"
echo ""

cd /Users/directionradiofidelite/saint-esprit-aws/frontend

echo "🌐 Démarrage du serveur Python sur le port 8000..."
echo ""
echo "✅ Ouvrez votre navigateur à l'adresse :"
echo "   http://localhost:8000"
echo ""
echo "🔑 À la première connexion :"
echo "   - Entrez votre nom d'utilisateur (ex: clara, thomas)"
echo "   - Les données seront synchronisées avec AWS S3"
echo ""
echo "⚠️  Appuyez sur Ctrl+C pour arrêter le serveur"
echo ""

python3 -m http.server 8000