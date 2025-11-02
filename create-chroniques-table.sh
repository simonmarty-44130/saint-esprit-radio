#!/bin/bash

# Script pour créer la table DynamoDB saint-esprit-chroniques
echo "🔧 Création de la table DynamoDB saint-esprit-chroniques"
echo "=================================================="

TABLE_NAME="saint-esprit-chroniques"
REGION="eu-west-3"

# Vérifier si la table existe déjà
echo "Vérification de l'existence de la table..."
EXISTS=$(aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" 2>&1)

if [[ $EXISTS == *"ResourceNotFoundException"* ]]; then
    echo "✅ La table n'existe pas, création en cours..."
    
    # Créer la table
    aws dynamodb create-table \
        --table-name "$TABLE_NAME" \
        --attribute-definitions \
            AttributeName=id,AttributeType=S \
        --key-schema \
            AttributeName=id,KeyType=HASH \
        --billing-mode PAY_PER_REQUEST \
        --region "$REGION" \
        --tags \
            Key=Project,Value=SaintEsprit \
            Key=Environment,Value=Production \
            Key=Type,Value=Chroniques
    
    echo "⏳ Attente de la création de la table..."
    aws dynamodb wait table-exists --table-name "$TABLE_NAME" --region "$REGION"
    
    echo "✅ Table créée avec succès!"
    
    # Afficher les détails de la table
    echo ""
    echo "📊 Détails de la table:"
    aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" --query 'Table.{TableName:TableName,Status:TableStatus,ItemCount:ItemCount}' --output table
    
else
    echo "⚠️  La table $TABLE_NAME existe déjà"
    
    # Afficher les détails de la table existante
    echo ""
    echo "📊 Détails de la table existante:"
    aws dynamodb describe-table --table-name "$TABLE_NAME" --region "$REGION" --query 'Table.{TableName:TableName,Status:TableStatus,ItemCount:ItemCount}' --output table
fi

echo ""
echo "🎉 Configuration terminée!"
echo ""
echo "Pour tester la table, vous pouvez utiliser:"
echo "aws dynamodb scan --table-name $TABLE_NAME --region $REGION"