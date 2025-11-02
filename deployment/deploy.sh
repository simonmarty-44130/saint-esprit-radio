#!/bin/bash

echo "🚀 Deploying Saint-Esprit AWS Migration..."

# Configuration
BUCKET="saint-esprit-audio"
REGION="eu-west-3"
LAMBDA_FUNCTION="saint-esprit-sync"

# 1. Vérifier configuration AWS
echo "🔧 Checking AWS configuration..."
aws sts get-caller-identity || exit 1

# 2. Créer bucket S3 s'il n'existe pas
echo "📦 Setting up S3 bucket..."
aws s3api head-bucket --bucket $BUCKET --region $REGION 2>/dev/null
if [ $? -ne 0 ]; then
    echo "Creating S3 bucket..."
    aws s3api create-bucket \
        --bucket $BUCKET \
        --region $REGION \
        --create-bucket-configuration LocationConstraint=$REGION
fi

# 3. Configurer CORS pour le bucket
echo "🔧 Configuring CORS..."
cat > cors-config.json << EOF
{
    "CORSRules": [
        {
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
            "AllowedOrigins": ["*"],
            "ExposeHeaders": [],
            "MaxAgeSeconds": 3000
        }
    ]
}
EOF

aws s3api put-bucket-cors \
    --bucket $BUCKET \
    --cors-configuration file://cors-config.json \
    --region $REGION

rm cors-config.json

# 4. Synchroniser frontend vers S3
echo "📤 Uploading frontend to S3..."
aws s3 sync frontend/ s3://$BUCKET/app/ \
    --region $REGION \
    --delete \
    --exclude "*.DS_Store" \
    --exclude "node_modules/*"

# 5. Configurer S3 pour hosting web
echo "🌐 Configuring S3 website hosting..."
aws s3 website s3://$BUCKET \
    --index-document app/index.html \
    --error-document app/index.html \
    --region $REGION

# 6. Déployer fonction Lambda
if [ -d "backend" ]; then
    echo "⚡ Deploying Lambda function..."
    cd backend
    zip -r function.zip *.js package.json
    
    # Créer le rôle IAM si nécessaire
    ROLE_NAME="saint-esprit-lambda-role"
    aws iam get-role --role-name $ROLE_NAME 2>/dev/null
    if [ $? -ne 0 ]; then
        echo "Creating IAM role..."
        aws iam create-role \
            --role-name $ROLE_NAME \
            --assume-role-policy-document '{
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
            }'
        
        # Attacher les politiques
        aws iam attach-role-policy \
            --role-name $ROLE_NAME \
            --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
        
        aws iam attach-role-policy \
            --role-name $ROLE_NAME \
            --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess
        
        # Attendre que le rôle soit disponible
        sleep 10
    fi
    
    # Récupérer l'ARN du rôle
    ROLE_ARN=$(aws iam get-role --role-name $ROLE_NAME --query 'Role.Arn' --output text)
    
    # Créer ou mettre à jour la fonction
    aws lambda get-function --function-name $LAMBDA_FUNCTION --region $REGION 2>/dev/null
    if [ $? -eq 0 ]; then
        # Mettre à jour
        aws lambda update-function-code \
            --function-name $LAMBDA_FUNCTION \
            --zip-file fileb://function.zip \
            --region $REGION
    else
        # Créer nouvelle fonction
        aws lambda create-function \
            --function-name $LAMBDA_FUNCTION \
            --runtime nodejs18.x \
            --role $ROLE_ARN \
            --handler sync.handler \
            --zip-file fileb://function.zip \
            --region $REGION \
            --timeout 30 \
            --memory-size 256
    fi
    
    rm function.zip
    cd ..
fi

# 7. Créer les dossiers initiaux dans S3
echo "📁 Creating initial S3 structure..."
echo "{}" | aws s3 cp - s3://$BUCKET/sync/global-state.json --region $REGION
aws s3api put-object --bucket $BUCKET --key users/ --region $REGION
aws s3api put-object --bucket $BUCKET --key audio/ --region $REGION
aws s3api put-object --bucket $BUCKET --key backups/ --region $REGION

# 8. Afficher URL d'accès
echo ""
echo "✅ Deployment completed!"
echo ""
echo "🔗 App URL: http://$BUCKET.s3-website.$REGION.amazonaws.com/app/"
echo ""
echo "📋 Next steps:"
echo "1. Open the app URL in your browser"
echo "2. Enter your username when prompted"
echo "3. Your data will be automatically synced to S3"
echo ""
echo "⚠️  IMPORTANT: Remember to revoke AWS credentials after development!"
echo ""