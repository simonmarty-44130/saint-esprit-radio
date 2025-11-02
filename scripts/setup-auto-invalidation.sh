#!/bin/bash
# Script pour configurer l'invalidation automatique CloudFront
# Crée une Lambda qui invalide CloudFront après chaque modification DynamoDB

set -e

DISTRIBUTION_ID="E3I60G2234JQLX"
REGION="eu-west-3"
LAMBDA_NAME="saint-esprit-cloudfront-invalidator"

echo "🔧 Configuration de l'invalidation automatique..."
echo ""

# 1. Créer le rôle IAM pour la Lambda
echo "📝 Création du rôle IAM..."
cat > /tmp/lambda-trust-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "lambda.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

ROLE_ARN=$(aws iam create-role \
  --role-name ${LAMBDA_NAME}-role \
  --assume-role-policy-document file:///tmp/lambda-trust-policy.json \
  --query 'Role.Arn' \
  --output text 2>/dev/null || \
  aws iam get-role --role-name ${LAMBDA_NAME}-role --query 'Role.Arn' --output text)

echo "Role ARN: $ROLE_ARN"

# 2. Attacher les policies
echo "📎 Attachement des policies..."
aws iam attach-role-policy \
  --role-name ${LAMBDA_NAME}-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Créer policy pour CloudFront
cat > /tmp/cloudfront-policy.json <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation"
      ],
      "Resource": "*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name ${LAMBDA_NAME}-role \
  --policy-name cloudfront-invalidation \
  --policy-document file:///tmp/cloudfront-policy.json

# 3. Créer le code de la Lambda
echo ""
echo "📝 Création du code Lambda..."
mkdir -p lambda
cat > lambda/invalidate-cloudfront.js <<EOF
const AWS = require('aws-sdk');
const cloudfront = new AWS.CloudFront();

exports.handler = async (event) => {
    console.log('Event:', JSON.stringify(event, null, 2));

    try {
        // Invalider CloudFront
        const params = {
            DistributionId: '${DISTRIBUTION_ID}',
            InvalidationBatch: {
                CallerReference: Date.now().toString(),
                Paths: {
                    Quantity: 1,
                    Items: ['/*']
                }
            }
        };

        const result = await cloudfront.createInvalidation(params).promise();
        console.log('✅ Invalidation created:', result.Invalidation.Id);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: 'CloudFront invalidated',
                invalidationId: result.Invalidation.Id
            })
        };
    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
};
EOF

# 4. Créer le package Lambda
echo "📦 Création du package Lambda..."
cd lambda
npm init -y 2>/dev/null
zip -q invalidate-cloudfront.zip invalidate-cloudfront.js package.json
cd ..

# 5. Créer/Mettre à jour la Lambda
echo "🚀 Déploiement de la Lambda..."
sleep 10  # Attendre que le rôle soit propagé

aws lambda create-function \
  --function-name $LAMBDA_NAME \
  --runtime nodejs18.x \
  --role $ROLE_ARN \
  --handler invalidate-cloudfront.handler \
  --zip-file fileb://lambda/invalidate-cloudfront.zip \
  --timeout 30 \
  --memory-size 128 \
  --region $REGION \
  --environment "Variables={DISTRIBUTION_ID=${DISTRIBUTION_ID}}" \
  2>/dev/null || \
aws lambda update-function-code \
  --function-name $LAMBDA_NAME \
  --zip-file fileb://lambda/invalidate-cloudfront.zip \
  --region $REGION

LAMBDA_ARN=$(aws lambda get-function \
  --function-name $LAMBDA_NAME \
  --region $REGION \
  --query 'Configuration.FunctionArn' \
  --output text)

echo "Lambda ARN: $LAMBDA_ARN"

# 6. Configurer DynamoDB Streams (à faire pour chaque table)
echo ""
echo "📡 Configuration des DynamoDB Streams..."
for TABLE in "saint-esprit-news" "saint-esprit-animations" "saint-esprit-blocks" "saint-esprit-conductors"
do
    echo "   Configuring stream for $TABLE..."

    # Activer le stream
    aws dynamodb update-table \
      --table-name $TABLE \
      --stream-specification StreamEnabled=true,StreamViewType=NEW_AND_OLD_IMAGES \
      --region $REGION 2>/dev/null || echo "     Stream déjà activé"

    # Récupérer l'ARN du stream
    STREAM_ARN=$(aws dynamodb describe-table \
      --table-name $TABLE \
      --region $REGION \
      --query 'Table.LatestStreamArn' \
      --output text)

    if [ "$STREAM_ARN" != "None" ]; then
        echo "     Stream ARN: $STREAM_ARN"

        # Créer le mapping
        aws lambda create-event-source-mapping \
          --function-name $LAMBDA_NAME \
          --event-source-arn $STREAM_ARN \
          --starting-position LATEST \
          --batch-size 10 \
          --region $REGION \
          2>/dev/null || echo "     Mapping déjà existant"
    fi
done

echo ""
echo "✅ Invalidation automatique configurée !"
echo ""
echo "📊 Résumé :"
echo "   - Lambda: $LAMBDA_NAME"
echo "   - Distribution: $DISTRIBUTION_ID"
echo "   - Région: $REGION"
echo ""
echo "🎯 Fonctionnement :"
echo "   1. Une modification est faite dans DynamoDB"
echo "   2. DynamoDB Stream déclenche la Lambda"
echo "   3. La Lambda invalide le cache CloudFront"
echo "   4. Les utilisateurs voient les changements immédiatement"
echo ""
echo "🧪 Test :"
echo "   Créez ou supprimez une news dans l'app,"
echo "   puis vérifiez les logs Lambda :"
echo "   aws logs tail /aws/lambda/$LAMBDA_NAME --follow"

# Nettoyer
rm -f /tmp/lambda-trust-policy.json /tmp/cloudfront-policy.json
