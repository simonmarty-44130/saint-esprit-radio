#!/bin/bash

# Script pour démarrer Saint-Esprit en local sans Cognito

echo "🚀 Démarrage de Saint-Esprit en mode LOCAL..."
echo "📍 Sans authentification Cognito"
echo "🎙️ Module Automation activé"
echo ""
echo "Accessible à : http://localhost:8080/index-local.html"
echo ""
echo "Raccourcis clavier :"
echo "  - ESPACE : Play/Pause"
echo "  - Alt+1 : Prompteur 'En cours'"
echo "  - Alt+2 : Prompteur 'Suivant'"
echo "  - Alt+3 : Prompteur '+2'"
echo "  - F11 : Ouvrir Automation"
echo ""
echo "Appuyez sur Ctrl+C pour arrêter le serveur"
echo "----------------------------------------"

# Démarrer un serveur Python simple
python3 -m http.server 8080