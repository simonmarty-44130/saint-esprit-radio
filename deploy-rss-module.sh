#!/bin/bash

# Script de déploiement du module RSS pour Flash Info Lambda

echo "🚀 Déploiement du module RSS Podcast"
echo "====================================="

LAMBDA_NAME="saint-esprit-flash-info"
REGION="eu-west-3"

# Couleurs
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${YELLOW}📦 Préparation du package...${NC}"

cd lambda/flash-info-downloader

# Copier les modules RSS depuis ftp-importer
echo "📋 Copie des modules RSS..."
cp ../ftp-importer/rss-podcast-downloader.js ./
cp ../ftp-importer/rss-handler.js ./

# Vérifier les dépendances
echo "📚 Vérification des dépendances..."
if ! npm ls xml2js > /dev/null 2>&1; then
    echo "Installation de xml2js..."
    npm install xml2js --save
fi

echo -e "${YELLOW}🗜️ Création du package ZIP...${NC}"

# Créer le ZIP avec tous les fichiers
zip -r ../flash-info-rss.zip . \
  -x "*.git*" \
  -x "test/*" \
  -x "*.md" \
  -x ".env" \
  -x "*.test.js" \
  -x "response*.json"

cd ../..

echo -e "${GREEN}📤 Mise à jour du code Lambda...${NC}"

# Mettre à jour le code
aws lambda update-function-code \
  --function-name $LAMBDA_NAME \
  --zip-file fileb://lambda/flash-info-rss.zip \
  --region $REGION \
  --output text --query 'LastUpdateStatus'

echo -e "${YELLOW}⏳ Attente de la mise à jour...${NC}"
sleep 10

echo -e "${YELLOW}🔐 Mise à jour de la configuration...${NC}"

# Ajouter les permissions DynamoDB pour la table de tracking
aws lambda add-permission \
  --function-name $LAMBDA_NAME \
  --statement-id AllowDynamoDBTracking \
  --action "lambda:InvokeFunction" \
  --principal dynamodb.amazonaws.com \
  --region $REGION 2>/dev/null || true

# Mettre à jour le rôle IAM pour inclure DynamoDB
ROLE_NAME=$(aws lambda get-function-configuration \
  --function-name $LAMBDA_NAME \
  --region $REGION \
  --query 'Role' \
  --output text | awk -F'/' '{print $NF}')

echo "📝 Ajout des permissions DynamoDB au rôle $ROLE_NAME..."

# Créer la politique pour la table de tracking
cat > /tmp/rss-tracking-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:Query",
                "dynamodb:Scan"
            ],
            "Resource": [
                "arn:aws:dynamodb:eu-west-3:888577030217:table/saint-esprit-rss-tracking",
                "arn:aws:dynamodb:eu-west-3:888577030217:table/saint-esprit-rss-tracking/index/*"
            ]
        }
    ]
}
EOF

# Attacher la politique
aws iam put-role-policy \
  --role-name $ROLE_NAME \
  --policy-name RSSTrackingPolicy \
  --policy-document file:///tmp/rss-tracking-policy.json \
  --region $REGION

# Nettoyer
rm -f lambda/flash-info-rss.zip
rm -f /tmp/rss-tracking-policy.json

echo ""
echo -e "${GREEN}✅ Déploiement terminé !${NC}"
echo ""
echo -e "${YELLOW}📝 Pour tester le module RSS :${NC}"
echo ""
echo "# Lister les flux RSS disponibles:"
echo 'aws lambda invoke \'
echo '  --function-name '$LAMBDA_NAME' \'
echo '  --payload '"'"'{"action":"list-rss"}'"'"' \'
echo '  --region '$REGION' \'
echo '  /tmp/rss-list.json'
echo ""
echo "# Tester un flux RSS KTO:"
echo 'aws lambda invoke \'
echo '  --function-name '$LAMBDA_NAME' \'
echo '  --payload '"'"'{"action":"rss","feedIds":["kto-parole-associations"]}'"'"' \'
echo '  --region '$REGION' \'
echo '  /tmp/rss-test.json'
echo ""
echo "# Télécharger tous les flux RSS:"
echo 'aws lambda invoke \'
echo '  --function-name '$LAMBDA_NAME' \'
echo '  --payload '"'"'{"action":"rss"}'"'"' \'
echo '  --region '$REGION' \'
echo '  /tmp/rss-all.json'
echo ""
echo -e "${GREEN}📡 Le module RSS est maintenant opérationnel !${NC}"