#!/bin/bash
# Script pour corriger le cache CloudFront
# Réduit le TTL de 24h à 5 minutes et invalide le cache existant

set -e

DISTRIBUTION_ID="E3I60G2234JQLX"
REGION="eu-west-3"

echo "🔧 Correction du cache CloudFront..."
echo "Distribution ID: $DISTRIBUTION_ID"
echo ""

# 1. Récupérer la config actuelle
echo "📥 Récupération de la configuration actuelle..."
aws cloudfront get-distribution-config \
  --id $DISTRIBUTION_ID \
  --output json > /tmp/dist-config.json

# Extraire l'ETag
ETAG=$(jq -r '.ETag' /tmp/dist-config.json)
echo "ETag: $ETAG"

# Extraire la config
jq '.DistributionConfig' /tmp/dist-config.json > /tmp/dist-config-only.json

# 2. Modifier le TTL
echo ""
echo "✏️ Modification du cache TTL..."
echo "   Avant: DefaultTTL = 86400 (24h)"
echo "   Après: DefaultTTL = 300 (5 min)"

jq '.DefaultCacheBehavior.DefaultTTL = 300 |
    .DefaultCacheBehavior.MinTTL = 0 |
    .DefaultCacheBehavior.MaxTTL = 3600' \
  /tmp/dist-config-only.json > /tmp/dist-config-updated.json

# 3. Appliquer la nouvelle config
echo ""
echo "📤 Application de la nouvelle configuration..."
aws cloudfront update-distribution \
  --id $DISTRIBUTION_ID \
  --distribution-config file:///tmp/dist-config-updated.json \
  --if-match $ETAG \
  --output json > /tmp/update-result.json

echo "✅ Configuration mise à jour"

# 4. Invalider le cache existant
echo ""
echo "🗑️ Invalidation du cache existant..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id $DISTRIBUTION_ID \
  --paths "/*" \
  --query 'Invalidation.Id' \
  --output text)

echo "✅ Invalidation créée: $INVALIDATION_ID"

# 5. Attendre la fin de l'invalidation
echo ""
echo "⏳ Attente de la fin de l'invalidation (peut prendre 5-15 min)..."
aws cloudfront wait invalidation-completed \
  --distribution-id $DISTRIBUTION_ID \
  --id $INVALIDATION_ID

echo ""
echo "✅ Cache CloudFront corrigé !"
echo ""
echo "📊 Résumé des changements :"
echo "   - TTL par défaut: 24h → 5 min"
echo "   - TTL minimum: 0s"
echo "   - TTL maximum: 1h"
echo "   - Cache existant: invalidé"
echo ""
echo "🎯 Les modifications seront visibles dans 5 minutes maximum !"

# Nettoyer
rm -f /tmp/dist-config.json /tmp/dist-config-only.json /tmp/dist-config-updated.json /tmp/update-result.json
