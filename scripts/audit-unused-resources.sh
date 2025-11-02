#!/bin/bash
# Script d'audit des ressources AWS inutilisées
# Identifie les services qui coûtent de l'argent sans être utilisés

set -e

REGION="eu-west-3"
OUTPUT_FILE="aws-resources-audit-$(date +%Y%m%d-%H%M%S).txt"

echo "🔍 AUDIT DES RESSOURCES AWS" | tee $OUTPUT_FILE
echo "Date: $(date)" | tee -a $OUTPUT_FILE
echo "Région: $REGION" | tee -a $OUTPUT_FILE
echo "" | tee -a $OUTPUT_FILE
echo "=====================================" | tee -a $OUTPUT_FILE
echo "" | tee -a $OUTPUT_FILE

# Fonction pour calculer le coût estimé
calculate_cost() {
    local service=$1
    local usage=$2
    local cost=0

    case $service in
        "s3-storage")
            # $0.023 par GB
            cost=$(echo "$usage * 0.023" | bc)
            ;;
        "s3-requests")
            # $0.0004 par 1000 requests GET
            cost=$(echo "$usage * 0.0004 / 1000" | bc)
            ;;
        "dynamodb-storage")
            # $0.25 par GB
            cost=$(echo "$usage * 0.25" | bc)
            ;;
        "lambda-invocations")
            # $0.20 par million
            cost=$(echo "$usage * 0.20 / 1000000" | bc)
            ;;
    esac

    echo $cost
}

# 1. S3 BUCKETS
echo "📦 S3 BUCKETS" | tee -a $OUTPUT_FILE
echo "-------------" | tee -a $OUTPUT_FILE

S3_TOTAL_SIZE=0
S3_TOTAL_OBJECTS=0

aws s3 ls | while read -r line; do
    BUCKET=$(echo $line | awk '{print $3}')

    if [ ! -z "$BUCKET" ]; then
        SIZE=$(aws s3 ls s3://$BUCKET --recursive --summarize 2>/dev/null | grep "Total Size" | awk '{print $3}')
        OBJECTS=$(aws s3 ls s3://$BUCKET --recursive --summarize 2>/dev/null | grep "Total Objects" | awk '{print $3}')

        SIZE_GB=$(echo "scale=2; $SIZE / 1024 / 1024 / 1024" | bc 2>/dev/null || echo "0")
        COST=$(calculate_cost "s3-storage" $SIZE_GB)

        echo "  Bucket: $BUCKET" | tee -a $OUTPUT_FILE
        echo "    - Taille: ${SIZE_GB} GB" | tee -a $OUTPUT_FILE
        echo "    - Objets: $OBJECTS" | tee -a $OUTPUT_FILE
        echo "    - Coût estimé: \$${COST}/mois" | tee -a $OUTPUT_FILE

        # Vérifier si le bucket est utilisé (dernière modification)
        LAST_MODIFIED=$(aws s3 ls s3://$BUCKET --recursive 2>/dev/null | tail -1 | awk '{print $1, $2}')
        if [ ! -z "$LAST_MODIFIED" ]; then
            echo "    - Dernière modification: $LAST_MODIFIED" | tee -a $OUTPUT_FILE
        fi

        # Recommandations
        if [ "$OBJECTS" = "0" ]; then
            echo "    ⚠️  RECOMMANDATION: Bucket vide, peut être supprimé" | tee -a $OUTPUT_FILE
        fi

        echo "" | tee -a $OUTPUT_FILE
    fi
done

# 2. TABLES DYNAMODB
echo "" | tee -a $OUTPUT_FILE
echo "📊 TABLES DYNAMODB" | tee -a $OUTPUT_FILE
echo "------------------" | tee -a $OUTPUT_FILE

aws dynamodb list-tables --region $REGION --query 'TableNames[]' --output text | tr '\t' '\n' | while read TABLE; do
    if [ ! -z "$TABLE" ]; then
        # Récupérer les infos de la table
        INFO=$(aws dynamodb describe-table --table-name $TABLE --region $REGION)

        ITEM_COUNT=$(echo $INFO | jq -r '.Table.ItemCount')
        TABLE_SIZE=$(echo $INFO | jq -r '.Table.TableSizeBytes')
        TABLE_STATUS=$(echo $INFO | jq -r '.Table.TableStatus')
        BILLING_MODE=$(echo $INFO | jq -r '.Table.BillingModeSummary.BillingMode // "PROVISIONED"')

        TABLE_SIZE_GB=$(echo "scale=2; $TABLE_SIZE / 1024 / 1024 / 1024" | bc 2>/dev/null || echo "0")
        COST=$(calculate_cost "dynamodb-storage" $TABLE_SIZE_GB)

        echo "  Table: $TABLE" | tee -a $OUTPUT_FILE
        echo "    - Statut: $TABLE_STATUS" | tee -a $OUTPUT_FILE
        echo "    - Items: $ITEM_COUNT" | tee -a $OUTPUT_FILE
        echo "    - Taille: ${TABLE_SIZE_GB} GB" | tee -a $OUTPUT_FILE
        echo "    - Mode facturation: $BILLING_MODE" | tee -a $OUTPUT_FILE
        echo "    - Coût estimé: \$${COST}/mois" | tee -a $OUTPUT_FILE

        # Recommandations
        if [ "$ITEM_COUNT" = "0" ]; then
            echo "    ⚠️  RECOMMANDATION: Table vide, peut être supprimée si inutilisée" | tee -a $OUTPUT_FILE
        fi

        echo "" | tee -a $OUTPUT_FILE
    fi
done

# 3. LAMBDAS
echo "" | tee -a $OUTPUT_FILE
echo "⚡ FONCTIONS LAMBDA" | tee -a $OUTPUT_FILE
echo "-------------------" | tee -a $OUTPUT_FILE

aws lambda list-functions --region $REGION --query 'Functions[].FunctionName' --output text | tr '\t' '\n' | while read FUNCTION; do
    if [ ! -z "$FUNCTION" ]; then
        # Récupérer les métriques des 30 derniers jours
        END_TIME=$(date -u +%Y-%m-%dT%H:%M:%S)
        START_TIME=$(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -u -v-30d +%Y-%m-%dT%H:%M:%S)

        INVOCATIONS=$(aws cloudwatch get-metric-statistics \
            --namespace AWS/Lambda \
            --metric-name Invocations \
            --dimensions Name=FunctionName,Value=$FUNCTION \
            --start-time $START_TIME \
            --end-time $END_TIME \
            --period 2592000 \
            --statistics Sum \
            --region $REGION \
            --query 'Datapoints[0].Sum' \
            --output text 2>/dev/null || echo "0")

        if [ "$INVOCATIONS" = "None" ]; then
            INVOCATIONS=0
        fi

        COST=$(calculate_cost "lambda-invocations" $INVOCATIONS)

        echo "  Fonction: $FUNCTION" | tee -a $OUTPUT_FILE
        echo "    - Invocations (30j): $INVOCATIONS" | tee -a $OUTPUT_FILE
        echo "    - Coût estimé: \$${COST}/mois" | tee -a $OUTPUT_FILE

        # Recommandations
        if [ "$INVOCATIONS" = "0" ]; then
            echo "    ⚠️  RECOMMANDATION: Aucune invocation, peut être supprimée" | tee -a $OUTPUT_FILE
        fi

        echo "" | tee -a $OUTPUT_FILE
    fi
done

# 4. API GATEWAY
echo "" | tee -a $OUTPUT_FILE
echo "🌐 API GATEWAY" | tee -a $OUTPUT_FILE
echo "--------------" | tee -a $OUTPUT_FILE

aws apigateway get-rest-apis --region $REGION --query 'items[].[id,name]' --output text | while read ID NAME; do
    if [ ! -z "$ID" ]; then
        echo "  API: $NAME ($ID)" | tee -a $OUTPUT_FILE

        # Essayer de récupérer les métriques
        REQUESTS=$(aws cloudwatch get-metric-statistics \
            --namespace AWS/ApiGateway \
            --metric-name Count \
            --dimensions Name=ApiName,Value=$NAME \
            --start-time $(date -u -d '30 days ago' +%Y-%m-%dT%H:%M:%S 2>/dev/null || date -u -v-30d +%Y-%m-%dT%H:%M:%S) \
            --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
            --period 2592000 \
            --statistics Sum \
            --region $REGION \
            --query 'Datapoints[0].Sum' \
            --output text 2>/dev/null || echo "0")

        if [ "$REQUESTS" = "None" ]; then
            REQUESTS=0
        fi

        echo "    - Requêtes (30j): $REQUESTS" | tee -a $OUTPUT_FILE

        if [ "$REQUESTS" = "0" ]; then
            echo "    ⚠️  RECOMMANDATION: Aucune requête, peut être supprimée" | tee -a $OUTPUT_FILE
        fi

        echo "" | tee -a $OUTPUT_FILE
    fi
done

# 5. CLOUDFRONT DISTRIBUTIONS
echo "" | tee -a $OUTPUT_FILE
echo "🌍 CLOUDFRONT DISTRIBUTIONS" | tee -a $OUTPUT_FILE
echo "---------------------------" | tee -a $OUTPUT_FILE

aws cloudfront list-distributions --query 'DistributionList.Items[].[Id,Comment,Enabled]' --output text | while read ID COMMENT ENABLED; do
    if [ ! -z "$ID" ]; then
        echo "  Distribution: $ID" | tee -a $OUTPUT_FILE
        echo "    - Comment: $COMMENT" | tee -a $OUTPUT_FILE
        echo "    - Activée: $ENABLED" | tee -a $OUTPUT_FILE

        if [ "$ENABLED" = "False" ]; then
            echo "    ⚠️  RECOMMANDATION: Distribution désactivée, peut être supprimée" | tee -a $OUTPUT_FILE
        fi

        echo "" | tee -a $OUTPUT_FILE
    fi
done

# 6. COGNITO USER POOLS
echo "" | tee -a $OUTPUT_FILE
echo "👥 COGNITO USER POOLS" | tee -a $OUTPUT_FILE
echo "---------------------" | tee -a $OUTPUT_FILE

aws cognito-idp list-user-pools --max-results 20 --region $REGION --query 'UserPools[].[Id,Name]' --output text | while read ID NAME; do
    if [ ! -z "$ID" ]; then
        USER_COUNT=$(aws cognito-idp list-users --user-pool-id $ID --region $REGION --query 'Users | length(@)' --output text 2>/dev/null || echo "0")

        echo "  User Pool: $NAME ($ID)" | tee -a $OUTPUT_FILE
        echo "    - Utilisateurs: $USER_COUNT" | tee -a $OUTPUT_FILE

        if [ "$USER_COUNT" = "0" ]; then
            echo "    ⚠️  RECOMMANDATION: Aucun utilisateur, peut être supprimé si inutilisé" | tee -a $OUTPUT_FILE
        fi

        echo "" | tee -a $OUTPUT_FILE
    fi
done

# RÉSUMÉ DES RECOMMANDATIONS
echo "" | tee -a $OUTPUT_FILE
echo "=====================================" | tee -a $OUTPUT_FILE
echo "📋 RÉSUMÉ DES RECOMMANDATIONS" | tee -a $OUTPUT_FILE
echo "=====================================" | tee -a $OUTPUT_FILE
echo "" | tee -a $OUTPUT_FILE

# Compter les ressources inutilisées
EMPTY_BUCKETS=$(grep -c "Bucket vide" $OUTPUT_FILE || echo "0")
EMPTY_TABLES=$(grep -c "Table vide" $OUTPUT_FILE || echo "0")
UNUSED_LAMBDAS=$(grep -c "Aucune invocation" $OUTPUT_FILE || echo "0")
UNUSED_APIS=$(grep -c "Aucune requête" $OUTPUT_FILE || echo "0")

echo "🔴 Ressources potentiellement inutilisées :" | tee -a $OUTPUT_FILE
echo "   - S3 Buckets vides: $EMPTY_BUCKETS" | tee -a $OUTPUT_FILE
echo "   - Tables DynamoDB vides: $EMPTY_TABLES" | tee -a $OUTPUT_FILE
echo "   - Lambdas non invoquées: $UNUSED_LAMBDAS" | tee -a $OUTPUT_FILE
echo "   - APIs sans trafic: $UNUSED_APIS" | tee -a $OUTPUT_FILE
echo "" | tee -a $OUTPUT_FILE

echo "💡 ACTIONS RECOMMANDÉES :" | tee -a $OUTPUT_FILE
echo "" | tee -a $OUTPUT_FILE
echo "1. Supprimer les ressources inutilisées identifiées ci-dessus" | tee -a $OUTPUT_FILE
echo "2. Migrer complètement vers DynamoDB (abandonner S3 pour les données)" | tee -a $OUTPUT_FILE
echo "3. Désactiver les lambdas non utilisées" | tee -a $OUTPUT_FILE
echo "4. Configurer des alarmes CloudWatch pour surveiller l'utilisation" | tee -a $OUTPUT_FILE
echo "" | tee -a $OUTPUT_FILE

echo "✅ Audit terminé !" | tee -a $OUTPUT_FILE
echo "📄 Rapport sauvegardé: $OUTPUT_FILE"
echo ""
echo "🔧 Pour nettoyer les ressources inutilisées, utilisez:"
echo "   ./scripts/cleanup-unused-resources.sh"
