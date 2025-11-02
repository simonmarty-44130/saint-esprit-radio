#!/bin/bash
# Script de nettoyage des ressources AWS inutilisées
# ⚠️  ATTENTION: Ce script supprime définitivement les ressources identifiées
# 🔒 SÉCURISÉ: Ne touche QUE les ressources saint-esprit
#    Ne touchera JAMAIS gabriel, kto, fser ou autres projets

set -e

REGION="eu-west-3"
DRY_RUN=true

# 🔒 WHITELIST - Seules ces ressources saint-esprit peuvent être analysées
PROJECT_PREFIX="saint-esprit"
ALLOWED_PATTERNS=(
    "saint-esprit*"
    "saintesprit*"
    "*saint-esprit*"
)

# ❌ BLACKLIST - Ces projets NE DOIVENT JAMAIS être touchés
FORBIDDEN_PATTERNS=(
    "*gabriel*"
    "*kto*"
    "*fser*"
    "*sos*"
    "*demo*"
    "*podcast*"
)

# Fonction pour vérifier si une ressource est autorisée
is_allowed() {
    local resource=$1

    # Vérifier qu'elle match un pattern autorisé
    local matches_allowed=false
    for pattern in "${ALLOWED_PATTERNS[@]}"; do
        if [[ $resource == $pattern ]]; then
            matches_allowed=true
            break
        fi
    done

    if [ "$matches_allowed" = false ]; then
        return 1
    fi

    # Vérifier qu'elle ne match AUCUN pattern interdit
    for pattern in "${FORBIDDEN_PATTERNS[@]}"; do
        if [[ $resource == $pattern ]]; then
            echo "  ❌ INTERDIT: $resource (projet en production)"
            return 1
        fi
    done

    return 0
}

# Mode dry-run par défaut
if [ "$1" = "--execute" ]; then
    DRY_RUN=false
    echo "⚠️  MODE EXÉCUTION ACTIVÉ - Les ressources seront supprimées !"
    echo "Appuyez sur Ctrl+C pour annuler dans les 10 secondes..."
    sleep 10
else
    echo "ℹ️  MODE DRY-RUN - Aucune ressource ne sera supprimée"
    echo "Pour exécuter réellement, utilisez: $0 --execute"
fi

echo ""
echo "🧹 NETTOYAGE DES RESSOURCES INUTILISÉES"
echo "========================================"
echo ""

# Fonction pour confirmer
confirm() {
    if [ "$DRY_RUN" = true ]; then
        echo "   [DRY-RUN] $1"
        return 0
    fi

    read -p "   Confirmer: $1 ? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        return 0
    fi
    return 1
}

# 1. NETTOYER S3 BUCKETS VIDES (UNIQUEMENT saint-esprit)
echo "📦 Nettoyage des S3 Buckets (saint-esprit uniquement)..."
echo ""

aws s3 ls | while read -r line; do
    BUCKET=$(echo $line | awk '{print $3}')

    if [ ! -z "$BUCKET" ]; then
        # 🔒 Vérifier que c'est un bucket saint-esprit
        if ! is_allowed "$BUCKET"; then
            continue
        fi

        echo "  ✅ Bucket autorisé: $BUCKET"

        OBJECTS=$(aws s3 ls s3://$BUCKET --recursive --summarize 2>/dev/null | grep "Total Objects" | awk '{print $3}')

        if [ "$OBJECTS" = "0" ]; then
            echo "     Bucket vide trouvé"

            if confirm "Supprimer le bucket $BUCKET"; then
                if [ "$DRY_RUN" = false ]; then
                    aws s3 rb s3://$BUCKET --force
                    echo "  ✅ Bucket $BUCKET supprimé"
                fi
            else
                echo "  ⏭️  Ignoré"
            fi
        fi
    fi
done

# 2. NETTOYER TABLES DYNAMODB (UNIQUEMENT saint-esprit)
echo ""
echo "📊 Nettoyage des Tables DynamoDB (saint-esprit uniquement)..."
echo ""

# Tables à garder (nouvelles tables Amplify Gen 2)
KEEP_TABLES=(
    "News-7yevmhz3trhdvo7wr4syjbghaa-NONE"
    "Animation-7yevmhz3trhdvo7wr4syjbghaa-NONE"
    "Block-7yevmhz3trhdvo7wr4syjbghaa-NONE"
    "Conductor-7yevmhz3trhdvo7wr4syjbghaa-NONE"
    "Settings-7yevmhz3trhdvo7wr4syjbghaa-NONE"
    "Template-7yevmhz3trhdvo7wr4syjbghaa-NONE"
    "Audio-7yevmhz3trhdvo7wr4syjbghaa-NONE"
    "UserActivity-7yevmhz3trhdvo7wr4syjbghaa-NONE"
    "NewsArchive-7yevmhz3trhdvo7wr4syjbghaa-NONE"
)

aws dynamodb list-tables --region $REGION --query 'TableNames[]' --output text | tr '\t' '\n' | while read TABLE; do
    if [ ! -z "$TABLE" ]; then
        # 🔒 Vérifier que c'est une table saint-esprit
        if ! is_allowed "$TABLE"; then
            continue
        fi

        echo "  ✅ Table autorisée: $TABLE"

        # Vérifier si la table est dans la liste à garder
        SHOULD_KEEP=false
        for KEEP in "${KEEP_TABLES[@]}"; do
            if [ "$TABLE" = "$KEEP" ]; then
                SHOULD_KEEP=true
                break
            fi
        done

        if [ "$SHOULD_KEEP" = true ]; then
            echo "     Table à conserver (Amplify Gen 2)"
            continue
        fi

        # Récupérer le nombre d'items
        ITEM_COUNT=$(aws dynamodb describe-table --table-name $TABLE --region $REGION --query 'Table.ItemCount' --output text)

        if [ "$ITEM_COUNT" = "0" ]; then
            echo "  Table vide trouvée: $TABLE"

            if confirm "Supprimer la table $TABLE"; then
                if [ "$DRY_RUN" = false ]; then
                    aws dynamodb delete-table --table-name $TABLE --region $REGION
                    echo "  ✅ Table $TABLE supprimée"
                fi
            else
                echo "  ⏭️  Ignorée"
            fi
        fi
    fi
done

# 3. NETTOYER LAMBDAS NON INVOQUÉES (UNIQUEMENT saint-esprit)
echo ""
echo "⚡ Nettoyage des Lambdas (saint-esprit uniquement)..."
echo ""

# Lambdas à garder (nouvelles fonctions)
KEEP_LAMBDAS=(
    "saint-esprit-cloudfront-invalidator"
)

aws lambda list-functions --region $REGION --query 'Functions[].FunctionName' --output text | tr '\t' '\n' | while read FUNCTION; do
    if [ ! -z "$FUNCTION" ]; then
        # 🔒 Vérifier que c'est une Lambda saint-esprit
        if ! is_allowed "$FUNCTION"; then
            continue
        fi

        echo "  ✅ Lambda autorisée: $FUNCTION"

        # Vérifier si la fonction est dans la liste à garder
        SHOULD_KEEP=false
        for KEEP in "${KEEP_LAMBDAS[@]}"; do
            if [ "$FUNCTION" = "$KEEP" ]; then
                SHOULD_KEEP=true
                break
            fi
        done

        if [ "$SHOULD_KEEP" = true ]; then
            echo "     Lambda à conserver"
            continue
        fi

        # Vérifier les invocations des 30 derniers jours
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

        if [ "$INVOCATIONS" = "None" ] || [ "$INVOCATIONS" = "0" ]; then
            echo "  Lambda non invoquée trouvée: $FUNCTION"

            if confirm "Supprimer la fonction $FUNCTION"; then
                if [ "$DRY_RUN" = false ]; then
                    aws lambda delete-function --function-name $FUNCTION --region $REGION
                    echo "  ✅ Fonction $FUNCTION supprimée"
                fi
            else
                echo "  ⏭️  Ignorée"
            fi
        fi
    fi
done

# 4. SUPPRIMER LES ANCIENNES TABLES SAINT-ESPRIT (une fois migré)
echo ""
echo "🗄️ Migration vers nouvelles tables DynamoDB..."
echo ""
echo "⚠️  Les anciennes tables saint-esprit-* peuvent être supprimées"
echo "   UNIQUEMENT après avoir migré les données vers les nouvelles tables Amplify"
echo ""

OLD_TABLES=(
    "saint-esprit-news"
    "saint-esprit-animations"
    "saint-esprit-blocks"
    "saint-esprit-conductors"
    "saint-esprit-audio"
    "saint-esprit-habillage"
    "saint-esprit-chroniques"
)

for TABLE in "${OLD_TABLES[@]}"; do
    TABLE_EXISTS=$(aws dynamodb describe-table --table-name $TABLE --region $REGION 2>/dev/null && echo "yes" || echo "no")

    if [ "$TABLE_EXISTS" = "yes" ]; then
        ITEM_COUNT=$(aws dynamodb describe-table --table-name $TABLE --region $REGION --query 'Table.ItemCount' --output text)

        echo "  Ancienne table: $TABLE (Items: $ITEM_COUNT)"

        if [ "$ITEM_COUNT" = "0" ]; then
            echo "    ✅ Peut être supprimée (vide)"

            if confirm "Supprimer l'ancienne table $TABLE"; then
                if [ "$DRY_RUN" = false ]; then
                    aws dynamodb delete-table --table-name $TABLE --region $REGION
                    echo "    ✅ Table $TABLE supprimée"
                fi
            fi
        else
            echo "    ⚠️  Contient encore des données - MIGRER D'ABORD !"
        fi
    fi
done

# RÉSUMÉ
echo ""
echo "======================================"
echo "📊 RÉSUMÉ DU NETTOYAGE"
echo "======================================"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo "ℹ️  MODE DRY-RUN - Aucune ressource n'a été supprimée"
    echo ""
    echo "Pour exécuter réellement le nettoyage:"
    echo "  $0 --execute"
else
    echo "✅ Nettoyage terminé !"
    echo ""
    echo "💰 Économies estimées: ~\$5-10/mois"
fi

echo ""
echo "🎯 PROCHAINES ÉTAPES:"
echo "  1. Migrer les données vers les nouvelles tables Amplify"
echo "  2. Vérifier que tout fonctionne avec la nouvelle architecture"
echo "  3. Supprimer les anciennes tables saint-esprit-*"
echo "  4. Configurer des alarmes CloudWatch pour surveiller les coûts"
