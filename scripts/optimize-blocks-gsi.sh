#!/bin/bash

# Script d'optimisation des index GSI pour la table blocks
# Saint-Esprit AWS - Module Blocks/Journaux

set -e

echo "🚀 Optimisation DynamoDB - Table saint-esprit-blocks"
echo "=================================================="

REGION="eu-west-3"
TABLE_NAME="saint-esprit-blocks"

# Couleurs pour l'output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour vérifier si la table existe
check_table_exists() {
    echo -e "${YELLOW}Vérification de la table $TABLE_NAME...${NC}"
    
    if aws dynamodb describe-table \
        --table-name $TABLE_NAME \
        --region $REGION &>/dev/null; then
        echo -e "${GREEN}✓ Table $TABLE_NAME trouvée${NC}"
        return 0
    else
        echo -e "${RED}✗ Table $TABLE_NAME non trouvée${NC}"
        return 1
    fi
}

# Fonction pour vérifier si l'index existe déjà
check_index_exists() {
    local index_name=$1
    echo -e "${YELLOW}Vérification de l'index $index_name...${NC}"
    
    local indexes=$(aws dynamodb describe-table \
        --table-name $TABLE_NAME \
        --region $REGION \
        --query "Table.GlobalSecondaryIndexes[?IndexName=='$index_name'].IndexName" \
        --output text 2>/dev/null)
    
    if [ -n "$indexes" ]; then
        echo -e "${GREEN}✓ Index $index_name existe déjà${NC}"
        return 0
    else
        echo -e "${YELLOW}→ Index $index_name n'existe pas, création nécessaire${NC}"
        return 1
    fi
}

# Fonction pour créer l'index GSI optimisé
create_optimized_gsi() {
    local index_name="userId-scheduledDate-index"
    
    if check_index_exists $index_name; then
        echo -e "${YELLOW}⚠️  Index déjà existant, passage à l'étape suivante${NC}"
        return 0
    fi
    
    echo -e "${GREEN}Création de l'index GSI optimisé...${NC}"
    
    # D'abord, vérifier et ajouter les attributs nécessaires si pas présents
    echo "📝 Mise à jour des définitions d'attributs..."
    
    aws dynamodb update-table \
        --table-name $TABLE_NAME \
        --region $REGION \
        --attribute-definitions \
            AttributeName=userId,AttributeType=S \
            AttributeName=scheduledDate,AttributeType=S \
        --global-secondary-index-updates \
        "[{
            \"Create\": {
                \"IndexName\": \"$index_name\",
                \"Keys\": [
                    {\"AttributeName\": \"userId\", \"KeyType\": \"HASH\"},
                    {\"AttributeName\": \"scheduledDate\", \"KeyType\": \"RANGE\"}
                ],
                \"Projection\": {\"ProjectionType\": \"ALL\"},
                \"BillingMode\": \"PAY_PER_REQUEST\"
            }
        }]" 2>/dev/null || {
            # Si erreur, essayer avec ProvisionedThroughput
            echo "⚠️  Mode PAY_PER_REQUEST non supporté, utilisation du mode provisionné..."
            
            aws dynamodb update-table \
                --table-name $TABLE_NAME \
                --region $REGION \
                --attribute-definitions \
                    AttributeName=userId,AttributeType=S \
                    AttributeName=scheduledDate,AttributeType=S \
                --global-secondary-index-updates \
                "[{
                    \"Create\": {
                        \"IndexName\": \"$index_name\",
                        \"Keys\": [
                            {\"AttributeName\": \"userId\", \"KeyType\": \"HASH\"},
                            {\"AttributeName\": \"scheduledDate\", \"KeyType\": \"RANGE\"}
                        ],
                        \"Projection\": {\"ProjectionType\": \"ALL\"},
                        \"ProvisionedThroughput\": {
                            \"ReadCapacityUnits\": 5,
                            \"WriteCapacityUnits\": 5
                        }
                    }
                }]"
        }
    
    echo -e "${GREEN}✓ Commande de création envoyée${NC}"
    
    # Attendre que l'index soit créé
    echo -e "${YELLOW}⏳ Attente de la création de l'index (peut prendre quelques minutes)...${NC}"
    
    local max_attempts=60
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        local index_status=$(aws dynamodb describe-table \
            --table-name $TABLE_NAME \
            --region $REGION \
            --query "Table.GlobalSecondaryIndexes[?IndexName=='$index_name'].IndexStatus" \
            --output text 2>/dev/null)
        
        if [ "$index_status" = "ACTIVE" ]; then
            echo -e "${GREEN}✓ Index $index_name créé et actif !${NC}"
            return 0
        elif [ "$index_status" = "CREATING" ]; then
            echo -n "."
            sleep 5
        else
            sleep 5
        fi
        
        attempt=$((attempt + 1))
    done
    
    echo -e "${RED}✗ Timeout lors de la création de l'index${NC}"
    return 1
}

# Fonction pour créer un second index pour les requêtes par date
create_date_index() {
    local index_name="scheduledDate-createdAt-index"
    
    if check_index_exists $index_name; then
        echo -e "${YELLOW}⚠️  Index déjà existant, passage à l'étape suivante${NC}"
        return 0
    fi
    
    echo -e "${GREEN}Création de l'index par date...${NC}"
    
    aws dynamodb update-table \
        --table-name $TABLE_NAME \
        --region $REGION \
        --attribute-definitions \
            AttributeName=scheduledDate,AttributeType=S \
            AttributeName=createdAt,AttributeType=N \
        --global-secondary-index-updates \
        "[{
            \"Create\": {
                \"IndexName\": \"$index_name\",
                \"Keys\": [
                    {\"AttributeName\": \"scheduledDate\", \"KeyType\": \"HASH\"},
                    {\"AttributeName\": \"createdAt\", \"KeyType\": \"RANGE\"}
                ],
                \"Projection\": {\"ProjectionType\": \"ALL\"},
                \"ProvisionedThroughput\": {
                    \"ReadCapacityUnits\": 5,
                    \"WriteCapacityUnits\": 5
                }
            }
        }]" 2>/dev/null || echo "⚠️  Index optionnel non créé (peut déjà exister)"
}

# Fonction pour afficher les statistiques de la table
show_table_stats() {
    echo -e "\n${GREEN}📊 Statistiques de la table $TABLE_NAME:${NC}"
    
    aws dynamodb describe-table \
        --table-name $TABLE_NAME \
        --region $REGION \
        --query '{
            TableName: Table.TableName,
            ItemCount: Table.ItemCount,
            TableSizeBytes: Table.TableSizeBytes,
            BillingMode: Table.BillingModeSummary.BillingMode,
            GlobalSecondaryIndexes: Table.GlobalSecondaryIndexes[].{
                IndexName: IndexName,
                Status: IndexStatus,
                ItemCount: ItemCount,
                IndexSizeBytes: IndexSizeBytes
            }
        }' \
        --output json | jq '.'
}

# Main execution
main() {
    echo -e "${GREEN}🔧 Début de l'optimisation DynamoDB${NC}"
    echo "Date: $(date)"
    echo ""
    
    # Vérifier que la table existe
    if ! check_table_exists; then
        echo -e "${RED}Erreur: Table $TABLE_NAME non trouvée dans la région $REGION${NC}"
        exit 1
    fi
    
    # Créer l'index principal pour userId-scheduledDate
    echo -e "\n${YELLOW}1️⃣  Création de l'index principal userId-scheduledDate${NC}"
    if create_optimized_gsi; then
        echo -e "${GREEN}✓ Index principal créé avec succès${NC}"
    else
        echo -e "${RED}✗ Échec de la création de l'index principal${NC}"
    fi
    
    # Créer l'index secondaire pour scheduledDate-createdAt (optionnel)
    echo -e "\n${YELLOW}2️⃣  Création de l'index secondaire scheduledDate-createdAt${NC}"
    create_date_index
    
    # Afficher les statistiques finales
    echo -e "\n${YELLOW}3️⃣  Vérification finale${NC}"
    show_table_stats
    
    echo -e "\n${GREEN}✅ Optimisation terminée !${NC}"
    echo ""
    echo "Prochaines étapes:"
    echo "1. Déployer le code optimisé: npm run deploy"
    echo "2. Invalider le cache CloudFront: aws cloudfront create-invalidation --distribution-id E3I60G2234JQLX --paths '/*'"
    echo "3. Monitorer les métriques CloudWatch pour vérifier l'amélioration"
}

# Exécuter le script principal
main