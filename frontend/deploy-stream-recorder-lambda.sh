#!/bin/bash

# Script de déploiement de la Lambda StreamRecorder
set -e

echo "🚀 Déploiement de la Lambda StreamRecorder..."

# Variables
FUNCTION_NAME="StreamRecorder-Lambda"
ROLE_NAME="StreamRecorder-Lambda-Role"
REGION="eu-west-3"
RUNTIME="nodejs18.x"
HANDLER="index.handler"
TIMEOUT=30
MEMORY=256

# Créer le rôle IAM si nécessaire
echo "📋 Vérification du rôle IAM..."
if ! aws iam get-role --role-name $ROLE_NAME 2>/dev/null; then
    echo "🔧 Création du rôle IAM..."
    
    # Trust policy
    cat > /tmp/trust-policy.json << EOF
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

    aws iam create-role \
        --role-name $ROLE_NAME \
        --assume-role-policy-document file:///tmp/trust-policy.json \
        --description "Role for StreamRecorder Lambda function"
    
    # Attacher les politiques de base
    aws iam attach-role-policy \
        --role-name $ROLE_NAME \
        --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
    
    # Politique personnalisée pour S3 et EventBridge
    cat > /tmp/lambda-policy.json << EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::amplify-saintespritaws-di-saintespritstoragebucket-91ui2ognukke",
        "arn:aws:s3:::amplify-saintespritaws-di-saintespritstoragebucket-91ui2ognukke/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "events:PutRule",
        "events:DeleteRule",
        "events:PutTargets",
        "events:RemoveTargets",
        "events:DescribeRule"
      ],
      "Resource": "*"
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "*"
    }
  ]
}
EOF

    aws iam put-role-policy \
        --role-name $ROLE_NAME \
        --policy-name StreamRecorderPolicy \
        --policy-document file:///tmp/lambda-policy.json
    
    echo "⏳ Attente de la propagation du rôle (15 secondes)..."
    sleep 15
fi

# Créer le package de déploiement
echo "📦 Création du package de déploiement..."
cd lambda/stream-recorder
zip -q deployment-package.zip index.js package.json

# Créer ou mettre à jour la fonction Lambda
echo "🔄 Déploiement de la fonction Lambda..."
ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)

if aws lambda get-function --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
    echo "♻️ Mise à jour de la fonction existante..."
    aws lambda update-function-code \
        --function-name $FUNCTION_NAME \
        --zip-file fileb://deployment-package.zip \
        --region $REGION
    
    aws lambda update-function-configuration \
        --function-name $FUNCTION_NAME \
        --runtime $RUNTIME \
        --handler $HANDLER \
        --timeout $TIMEOUT \
        --memory-size $MEMORY \
        --region $REGION
else
    echo "✨ Création de la nouvelle fonction..."
    aws lambda create-function \
        --function-name $FUNCTION_NAME \
        --runtime $RUNTIME \
        --role $ROLE_ARN \
        --handler $HANDLER \
        --zip-file fileb://deployment-package.zip \
        --timeout $TIMEOUT \
        --memory-size $MEMORY \
        --region $REGION \
        --description "Lambda function for StreamRecorder module"
fi

# Créer une URL de fonction Lambda
echo "🌐 Configuration de l'URL de la fonction..."
if ! aws lambda get-function-url-config --function-name $FUNCTION_NAME --region $REGION 2>/dev/null; then
    aws lambda create-function-url-config \
        --function-name $FUNCTION_NAME \
        --auth-type NONE \
        --cors '{
            "AllowOrigins": ["*"],
            "AllowMethods": ["GET", "POST", "OPTIONS"],
            "AllowHeaders": ["Content-Type"],
            "MaxAge": 86400
        }' \
        --region $REGION
fi

# Ajouter les permissions pour l'URL publique
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id FunctionURLAllowPublicAccess \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE \
    --region $REGION 2>/dev/null || true

# Ajouter les permissions pour EventBridge
aws lambda add-permission \
    --function-name $FUNCTION_NAME \
    --statement-id AllowEventBridgeInvoke \
    --action lambda:InvokeFunction \
    --principal events.amazonaws.com \
    --region $REGION 2>/dev/null || true

# Récupérer l'URL de la fonction
FUNCTION_URL=$(aws lambda get-function-url-config \
    --function-name $FUNCTION_NAME \
    --region $REGION \
    --query 'FunctionUrl' \
    --output text)

# Nettoyer
rm deployment-package.zip
cd ../..

echo "✅ Lambda déployée avec succès !"
echo "📍 URL de la fonction : $FUNCTION_URL"
echo ""
echo "⚠️  IMPORTANT : Mettez à jour StreamRecorder.js avec cette URL :"
echo "    LAMBDA_URL: '$FUNCTION_URL'"
echo ""
echo "Pour tester :"
echo "curl -X POST $FUNCTION_URL -H 'Content-Type: application/json' -d '{\"action\":\"status\",\"recordingId\":\"test\"}'"