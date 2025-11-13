#!/bin/bash
# Script pour vérifier les métriques après déploiement

echo "📊 Vérification des métriques DynamoDB..."

# Métriques de la table blocks
aws cloudwatch get-metric-statistics \
    --namespace AWS/DynamoDB \
    --metric-name ConsumedReadCapacityUnits \
    --dimensions Name=TableName,Value=saint-esprit-blocks \
    --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
    --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
    --period 300 \
    --statistics Sum \
    --region eu-west-3

echo ""
echo "Pour voir les métriques en temps réel:"
echo "1. Ouvrir l'application: https://saint-esprit.link"
echo "2. Ouvrir la console (F12)"
echo "3. Taper: BlockMetrics.display()"
