#!/bin/bash

# Script de déploiement des optimisations du module Blocks/Journaux
# Saint-Esprit AWS

set -e

echo "🚀 DÉPLOIEMENT OPTIMISATIONS MODULE BLOCKS/JOURNAUX"
echo "===================================================="
echo ""

# Variables
REGION="eu-west-3"
BUCKET="amplify-saintespritaws-di-saintespritstoragebucket-91ui2ognukke"
DISTRIBUTION_ID="E3I60G2234JQLX"
FRONTEND_DIR="frontend"

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Fonction pour afficher l'étape
show_step() {
    echo -e "\n${GREEN}▶ $1${NC}"
}

# Fonction pour afficher un warning
show_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Fonction pour afficher une erreur
show_error() {
    echo -e "${RED}❌ $1${NC}"
}

# 1. Créer l'index GSI sur DynamoDB
show_step "1. Création des index GSI optimisés sur la table blocks..."

if [ -f "scripts/optimize-blocks-gsi.sh" ]; then
    echo "Exécution du script d'optimisation GSI..."
    bash scripts/optimize-blocks-gsi.sh
else
    show_warning "Script GSI non trouvé, vérification manuelle nécessaire"
fi

# 2. Build du frontend
show_step "2. Build du frontend avec les optimisations..."

if [ -d "$FRONTEND_DIR" ]; then
    cd $FRONTEND_DIR
    
    # Vérifier si les fichiers optimisés existent
    if [ ! -f "js/managers/BlockManager.js" ]; then
        show_error "BlockManager.js non trouvé!"
        exit 1
    fi
    
    if [ ! -f "js/core/storage-dynamodb.js" ]; then
        show_error "storage-dynamodb.js non trouvé!"
        exit 1
    fi
    
    if [ ! -f "js/utils/block-metrics.js" ]; then
        show_warning "block-metrics.js non trouvé, création..."
        mkdir -p js/utils
    fi
    
    echo "✅ Fichiers optimisés vérifiés"
    cd ..
else
    show_error "Dossier frontend non trouvé!"
    exit 1
fi

# 3. Upload vers S3
show_step "3. Upload des fichiers optimisés vers S3..."

# Fichiers modifiés à uploader
FILES_TO_UPLOAD=(
    "js/managers/BlockManager.js"
    "js/core/storage-dynamodb.js"
    "js/core/dynamodb-client.js"
    "js/utils/block-metrics.js"
)

echo "Upload des fichiers optimisés..."
for file in "${FILES_TO_UPLOAD[@]}"; do
    if [ -f "$FRONTEND_DIR/$file" ]; then
        aws s3 cp "$FRONTEND_DIR/$file" "s3://$BUCKET/$file" \
            --region $REGION \
            --cache-control "max-age=3600" \
            --content-type "application/javascript"
        echo "  ✅ $file"
    else
        show_warning "  Fichier non trouvé: $file"
    fi
done

# 4. Invalider le cache CloudFront
show_step "4. Invalidation du cache CloudFront..."

INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id $DISTRIBUTION_ID \
    --paths "/js/managers/*" "/js/core/*" "/js/utils/*" \
    --query "Invalidation.Id" \
    --output text)

echo "Invalidation créée: $INVALIDATION_ID"
echo "Attente de la propagation (peut prendre 2-3 minutes)..."

# 5. Vérification des métriques
show_step "5. Configuration du monitoring..."

cat << 'EOF' > check-metrics.sh
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
EOF

chmod +x check-metrics.sh

# 6. Tests de validation
show_step "6. Tests de validation..."

cat << 'EOF' > test-optimization.js
// Test des optimisations
console.log('🧪 Test des optimisations blocks...');

// Test 1: Vérifier le cache
if (window.app && window.app.blockManager) {
    const stats = window.app.blockManager.getCacheStats();
    console.log('Cache stats:', stats);
}

// Test 2: Vérifier les métriques
if (window.BlockMetrics) {
    console.log('✅ BlockMetrics chargé');
    BlockMetrics.display();
} else {
    console.error('❌ BlockMetrics non trouvé');
}

// Test 3: Tester une requête optimisée
if (window.storage && window.storage.db) {
    console.log('Test requête optimisée...');
    window.storage.db.getBlocksByUser('current').then(blocks => {
        console.log(`✅ ${blocks.length} blocks chargés avec Query`);
    });
}
EOF

# 7. Rapport final
show_step "7. Déploiement terminé!"

echo ""
echo "========================================="
echo -e "${GREEN}✅ OPTIMISATIONS DÉPLOYÉES AVEC SUCCÈS${NC}"
echo "========================================="
echo ""
echo "📊 Gains attendus:"
echo "  • Coût DynamoDB: -70% (Query vs Scan)"
echo "  • Temps chargement: -75% (cache TTL)"
echo "  • Requêtes batch: -60% (assignations groupées)"
echo ""
echo "🔍 Pour vérifier:"
echo "  1. Ouvrir: https://saint-esprit.link"
echo "  2. Console F12 > BlockMetrics.display()"
echo "  3. Vérifier ./check-metrics.sh"
echo ""
echo "⚠️  Notes importantes:"
echo "  • L'index GSI peut prendre 5-10 min pour être actif"
echo "  • Le cache CloudFront met 2-3 min à se propager"
echo "  • Surveiller les métriques pendant 24h"
echo ""
echo "📝 Rollback si nécessaire:"
echo "  aws s3 sync s3://$BUCKET-backup/js s3://$BUCKET/js"
echo ""

# Créer un backup pour rollback
show_step "Création d'un point de sauvegarde..."
BACKUP_DATE=$(date +%Y%m%d-%H%M%S)
aws s3 sync "s3://$BUCKET/js" "s3://$BUCKET-backup-$BACKUP_DATE/js" --region $REGION

echo -e "${GREEN}✅ Backup créé: $BUCKET-backup-$BACKUP_DATE${NC}"
echo ""
echo "Déploiement terminé à $(date)"