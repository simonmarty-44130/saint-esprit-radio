#!/bin/bash

set -e  # Arrêter le script en cas d'erreur

# ==========================================
# 🚀 SAINT-ESPRIT AWS - DÉPLOIEMENT ONE-CLICK
# Automatisation complète du déploiement
# ==========================================

clear
echo "🎙️ SAINT-ESPRIT AWS - DÉPLOIEMENT ONE-CLICK"
echo "============================================"
echo ""

# Configuration
PROJECT_DIR="/Users/directionradiofidelite/saint-esprit-aws"
BUCKET="saint-esprit-audio"
REGION="eu-west-3"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'

print_header() {
    echo -e "${PURPLE}$1${NC}"
}

print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# ==========================================
# MENU PRINCIPAL
# ==========================================

show_menu() {
    echo "🎯 CHOISISSEZ VOTRE DÉPLOIEMENT :"
    echo "================================"
    echo ""
    echo "1. 🚀 DÉPLOIEMENT RAPIDE (5 minutes)"
    echo "   ✅ S3 Static Website"
    echo "   ✅ Sécurisation automatique"
    echo "   ✅ Prêt à l'emploi"
    echo "   📱 URL: http://saint-esprit-audio.s3-website.eu-west-3.amazonaws.com"
    echo ""
    echo "2. 🌐 DÉPLOIEMENT COMPLET (15 minutes)"
    echo "   ✅ Tout du déploiement rapide"
    echo "   ✅ CloudFront CDN"
    echo "   ✅ Certificat SSL/HTTPS"
    echo "   📱 URL: https://d[RANDOM].cloudfront.net"
    echo ""
    echo "3. 👑 DÉPLOIEMENT PREMIUM (30 minutes)"
    echo "   ✅ Tout du déploiement complet"
    echo "   ✅ Domaine personnalisé"
    echo "   ✅ AWS Cognito Authentication"
    echo "   📱 URL: https://app.saint-esprit.radio"
    echo ""
    echo "4. 🔧 TESTS SEULEMENT"
    echo "   ✅ Vérifications et diagnostics"
    echo "   ✅ Pas de déploiement"
    echo ""
    echo "5. ❌ ANNULER"
    echo ""
}

# ==========================================
# VÉRIFICATIONS PRÉALABLES
# ==========================================

check_prerequisites() {
    print_header "🔍 VÉRIFICATIONS PRÉALABLES"
    echo ""
    
    local all_good=true
    
    # AWS CLI
    print_step "Vérification AWS CLI..."
    if command -v aws &> /dev/null; then
        local aws_version=$(aws --version 2>&1 | cut -d/ -f2 | cut -d' ' -f1)
        print_success "AWS CLI v$aws_version installé"
    else
        print_error "AWS CLI non installé"
        echo "   Installation: brew install awscli"
        all_good=false
    fi
    
    # Configuration AWS
    print_step "Vérification configuration AWS..."
    if aws sts get-caller-identity &> /dev/null; then
        local aws_account=$(aws sts get-caller-identity --query Account --output text)
        local aws_user=$(aws sts get-caller-identity --query Arn --output text | cut -d/ -f2)
        print_success "Connecté sur compte $aws_account ($aws_user)"
    else
        print_error "Configuration AWS manquante"
        echo "   Configuration: aws configure"
        all_good=false
    fi
    
    # Projet
    print_step "Vérification du projet..."
    if [ -d "$PROJECT_DIR" ]; then
        print_success "Projet trouvé: $PROJECT_DIR"
    else
        print_error "Projet non trouvé: $PROJECT_DIR"
        all_good=false
    fi
    
    # Fichiers critiques
    local critical_files=(
        "$PROJECT_DIR/frontend/index.html"
        "$PROJECT_DIR/frontend/volunteer.html"
        "$PROJECT_DIR/frontend/js/core/storage.js"
    )
    
    for file in "${critical_files[@]}"; do
        if [ -f "$file" ]; then
            print_success "$(basename $file) présent"
        else
            print_error "Fichier manquant: $(basename $file)"
            all_good=false
        fi
    done
    
    echo ""
    if [ "$all_good" = true ]; then
        print_success "Toutes les vérifications passées !"
        return 0
    else
        print_error "Certaines vérifications ont échoué"
        return 1
    fi
}

# ==========================================
# DÉPLOIEMENT RAPIDE
# ==========================================

deploy_fast() {
    print_header "🚀 DÉPLOIEMENT RAPIDE EN COURS..."
    echo ""
    
    local start_time=$(date +%s)
    
    # Étape 1: Sécurisation
    print_step "Sécurisation du code..."
    bash -c "$(cat <<'EOF'
cd "/Users/directionradiofidelite/saint-esprit-aws/frontend/js/core"
if [ ! -f "storage.js.original" ]; then
    cp storage.js storage.js.original
fi

# Créer version sécurisée temporaire
sed 's/accessKeyId: .*/accessKeyId: process.env.AWS_ACCESS_KEY_ID || "TEMP_KEY",/' storage.js | \
sed 's/secretAccessKey: .*/secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "TEMP_SECRET",/' > storage.js.secure
mv storage.js.secure storage.js
EOF
)" && print_success "Code sécurisé" || print_warning "Problème de sécurisation (continuer)"
    
    # Étape 2: Configuration S3
    print_step "Configuration du bucket S3..."
    
    # Créer bucket
    aws s3api head-bucket --bucket $BUCKET --region $REGION 2>/dev/null || {
        aws s3api create-bucket \
            --bucket $BUCKET \
            --region $REGION \
            --create-bucket-configuration LocationConstraint=$REGION
    }
    
    # Website hosting
    aws s3 website s3://$BUCKET \
        --index-document index.html \
        --error-document index.html \
        --region $REGION
    
    # CORS
    echo '{
        "CORSRules": [{
            "AllowedHeaders": ["*"],
            "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
            "AllowedOrigins": ["*"],
            "ExposeHeaders": [],
            "MaxAgeSeconds": 3000
        }]
    }' | aws s3api put-bucket-cors --bucket $BUCKET --cors-configuration file:///dev/stdin
    
    # Politique publique
    echo '{
        "Version": "2012-10-17",
        "Statement": [{
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::'$BUCKET'/*"
        }]
    }' | aws s3api put-bucket-policy --bucket $BUCKET --policy file:///dev/stdin
    
    print_success "Bucket configuré"
    
    # Étape 3: Upload
    print_step "Upload des fichiers..."
    aws s3 sync "$PROJECT_DIR/frontend/" "s3://$BUCKET/" \
        --region $REGION \
        --delete \
        --exclude "*.DS_Store" \
        --exclude "*.bak" \
        --exclude "RAPPORT_*" \
        --acl public-read
    
    print_success "Fichiers uploadés"
    
    # Étape 4: Structure initiale
    print_step "Initialisation S3..."
    echo '{}' | aws s3 cp - "s3://$BUCKET/sync/global-state.json"
    echo '{}' | aws s3 cp - "s3://$BUCKET/locks/global-locks.json"
    aws s3api put-object --bucket $BUCKET --key users/ > /dev/null
    aws s3api put-object --bucket $BUCKET --key audio/ > /dev/null
    print_success "Structure initialisée"
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Résultats
    echo ""
    print_header "🎉 DÉPLOIEMENT RAPIDE TERMINÉ !"
    echo ""
    echo "⏱️  Durée: ${duration}s"
    echo ""
    echo "📱 URLS D'ACCÈS :"
    echo "   🎙️ Application: http://$BUCKET.s3-website.$REGION.amazonaws.com"
    echo "   🎤 Mode bénévole: http://$BUCKET.s3-website.$REGION.amazonaws.com/volunteer.html"
    echo ""
    echo "✅ FONCTIONNALITÉS ACTIVES :"
    echo "   - Collaboration multi-utilisateurs"
    echo "   - Synchronisation S3 temps réel"
    echo "   - Mode journaliste complet"
    echo "   - Mode bénévole simplifié"
    echo "   - Système de verrouillage"
    echo ""
    print_warning "PROCHAINES ÉTAPES RECOMMANDÉES :"
    echo "   1. Tester l'application déployée"
    echo "   2. Créer des utilisateurs de test"
    echo "   3. Configurer AWS Cognito (sécurité)"
    echo "   4. Ajouter un domaine personnalisé"
    echo ""
}

# ==========================================
# DÉPLOIEMENT COMPLET (avec CloudFront)
# ==========================================

deploy_complete() {
    print_header "🌐 DÉPLOIEMENT COMPLET EN COURS..."
    echo ""
    
    # D'abord le déploiement rapide
    deploy_fast
    
    # Puis CloudFront
    print_step "Configuration CloudFront..."
    
    local distribution_config='{
        "CallerReference": "'$(date +%s)'",
        "Comment": "Saint-Esprit Radio Distribution",
        "DefaultCacheBehavior": {
            "TargetOriginId": "S3-'$BUCKET'",
            "ViewerProtocolPolicy": "redirect-to-https",
            "TrustedSigners": {
                "Enabled": false,
                "Quantity": 0
            },
            "ForwardedValues": {
                "QueryString": false,
                "Cookies": {"Forward": "none"}
            },
            "MinTTL": 0
        },
        "Origins": {
            "Quantity": 1,
            "Items": [{
                "Id": "S3-'$BUCKET'",
                "DomainName": "'$BUCKET'.s3.amazonaws.com",
                "S3OriginConfig": {
                    "OriginAccessIdentity": ""
                }
            }]
        },
        "Enabled": true
    }'
    
    local dist_id=$(echo "$distribution_config" | aws cloudfront create-distribution --distribution-config file:///dev/stdin --query 'Distribution.Id' --output text 2>/dev/null)
    
    if [ "$dist_id" != "" ] && [ "$dist_id" != "None" ]; then
        print_success "CloudFront créé: $dist_id"
        local cloudfront_url=$(aws cloudfront get-distribution --id $dist_id --query 'Distribution.DomainName' --output text)
        echo ""
        echo "🌐 URL CloudFront: https://$cloudfront_url"
        echo "⏳ Propagation: 5-15 minutes"
    else
        print_warning "CloudFront non créé (déjà existant ou erreur)"
    fi
}

# ==========================================
# TESTS ET DIAGNOSTICS
# ==========================================

run_tests() {
    print_header "🔧 TESTS ET DIAGNOSTICS"
    echo ""
    
    print_step "Test de connectivité AWS..."
    if aws sts get-caller-identity &> /dev/null; then
        print_success "AWS connecté"
    else
        print_error "AWS non configuré"
        return 1
    fi
    
    print_step "Test bucket S3..."
    if aws s3 ls "s3://$BUCKET" &> /dev/null; then
        local files_count=$(aws s3 ls "s3://$BUCKET" --recursive | wc -l)
        print_success "Bucket accessible ($files_count fichiers)"
    else
        print_warning "Bucket non accessible ou vide"
    fi
    
    print_step "Test website S3..."
    local website_url="http://$BUCKET.s3-website.$REGION.amazonaws.com"
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$website_url" || echo "000")
    
    if [ "$http_code" = "200" ]; then
        print_success "Site web accessible"
        echo "   📱 URL: $website_url"
    else
        print_warning "Site web non accessible (code: $http_code)"
    fi
    
    print_step "Test structure S3..."
    local required_paths=("sync/global-state.json" "users/" "audio/")
    for path in "${required_paths[@]}"; do
        if aws s3 ls "s3://$BUCKET/$path" &> /dev/null; then
            print_success "$path présent"
        else
            print_warning "$path manquant"
        fi
    done
    
    echo ""
    print_success "Tests terminés"
}

# ==========================================
# FONCTION PRINCIPALE
# ==========================================

main() {
    # Vérifications préalables
    if ! check_prerequisites; then
        echo ""
        print_error "Corrigez les problèmes ci-dessus avant de continuer"
        exit 1
    fi
    
    echo ""
    
    # Menu
    while true; do
        show_menu
        read -p "Votre choix (1-5): " choice
        echo ""
        
        case $choice in
            1)
                print_header "🚀 LANCEMENT DU DÉPLOIEMENT RAPIDE"
                echo ""
                deploy_fast
                break
                ;;
            2)
                print_header "🌐 LANCEMENT DU DÉPLOIEMENT COMPLET"
                echo ""
                deploy_complete
                break
                ;;
            3)
                print_header "👑 DÉPLOIEMENT PREMIUM"
                echo ""
                print_warning "Déploiement premium en développement"
                echo "Utilisez le déploiement complet pour l'instant"
                echo ""
                deploy_complete
                break
                ;;
            4)
                run_tests
                echo ""
                print_step "Voulez-vous continuer avec un déploiement ? (y/n)"
                read -p "> " continue_choice
                if [[ $continue_choice =~ ^[Yy] ]]; then
                    continue
                else
                    break
                fi
                ;;
            5)
                print_step "Déploiement annulé"
                exit 0
                ;;
            *)
                print_error "Choix invalide, essayez encore"
                echo ""
                ;;
        esac
    done
    
    echo ""
    print_header "🎯 DÉPLOIEMENT TERMINÉ"
    echo ""
    echo "📋 Prochaines étapes recommandées :"
    echo "   1. Tester l'application déployée"
    echo "   2. Inviter des utilisateurs test"
    echo "   3. Surveiller les coûts AWS"
    echo "   4. Planifier les améliorations"
    echo ""
    print_success "Merci d'avoir utilisé Saint-Esprit AWS !"
}

# Lancer le script
main "$@"