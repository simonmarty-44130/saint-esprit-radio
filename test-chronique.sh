#!/bin/bash

# Script pour tester le module Chroniques en ajoutant une chronique exemple

echo "🎤 Test du module Chroniques"
echo "==========================="

# Ajouter une chronique de test
aws dynamodb put-item \
    --table-name saint-esprit-chroniques \
    --region eu-west-3 \
    --item '{
        "id": {"S": "chronique-test-welcome"},
        "title": {"S": "Chronique de Test - Bienvenue"},
        "type": {"S": "manual"},
        "description": {"S": "Première chronique pour tester le nouveau module"},
        "audioUrl": {"S": "https://saint-esprit-audio.s3.eu-west-3.amazonaws.com/test/audio.mp3"},
        "duration": {"N": "180"},
        "lastUpdated": {"S": "'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'"},
        "permanent": {"BOOL": true},
        "autoReplace": {"BOOL": false},
        "category": {"S": "general"},
        "tags": {"L": [{"S": "test"}, {"S": "bienvenue"}]}
    }'

if [ $? -eq 0 ]; then
    echo "✅ Chronique de test ajoutée"
    
    echo ""
    echo "📊 Vérification de la chronique:"
    aws dynamodb get-item \
        --table-name saint-esprit-chroniques \
        --region eu-west-3 \
        --key '{"id": {"S": "chronique-test-welcome"}}' \
        --query 'Item.{id:id.S,title:title.S,type:type.S}' \
        --output json
    
    echo ""
    echo "🌐 Vous pouvez maintenant:"
    echo "1. Aller sur https://saint-esprit.link"
    echo "2. Cliquer sur l'onglet 'Chroniques'"
    echo "3. Voir la chronique de test"
else
    echo "❌ Erreur lors de l'ajout de la chronique"
fi