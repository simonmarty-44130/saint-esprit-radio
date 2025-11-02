#!/bin/bash

# Script pour appliquer le branding personnalisé à Cognito Hosted UI
# Saint-Esprit Radio

# Variables
USER_POOL_ID="eu-west-3_oD1fm8OLs"
CLIENT_ID="5jst6bnhl26ekdr5a7pu9ik2f5"
CSS_FILE="cognito-custom.css"
LOGO_FILE="saint-esprit-logo.png"  # À créer ou remplacer par votre logo
REGION="eu-west-3"

echo "🎨 Application du branding Saint-Esprit Radio à Cognito..."

# Vérifier que les fichiers existent
if [ ! -f "$CSS_FILE" ]; then
    echo "❌ Erreur: Le fichier CSS '$CSS_FILE' n'existe pas"
    exit 1
fi

# Vérifier la taille du CSS (max 3KB)
CSS_SIZE=$(wc -c < "$CSS_FILE")
if [ $CSS_SIZE -gt 3072 ]; then
    echo "⚠️  Attention: Le fichier CSS fait ${CSS_SIZE} octets (max 3072)"
    echo "Réduction nécessaire de $((CSS_SIZE - 3072)) octets"
    exit 1
fi

echo "✅ Fichier CSS valide (${CSS_SIZE}/3072 octets)"

# Lire le contenu CSS et échapper les caractères spéciaux
CSS_CONTENT=$(cat "$CSS_FILE" | sed 's/"/\\"/g' | tr '\n' ' ' | sed 's/[[:space:]]\+/ /g')

# Construire la commande AWS CLI
if [ -f "$LOGO_FILE" ]; then
    # Vérifier la taille du logo (max 100KB)
    LOGO_SIZE=$(wc -c < "$LOGO_FILE")
    if [ $LOGO_SIZE -gt 102400 ]; then
        echo "⚠️  Attention: Le logo fait ${LOGO_SIZE} octets (max 102400)"
        exit 1
    fi
    
    echo "✅ Logo trouvé (${LOGO_SIZE}/102400 octets)"
    
    # Appliquer avec logo et CSS
    aws cognito-idp set-ui-customization \
        --user-pool-id "$USER_POOL_ID" \
        --client-id "$CLIENT_ID" \
        --image-file "fileb://$LOGO_FILE" \
        --css "$CSS_CONTENT" \
        --region "$REGION"
else
    echo "⚠️  Pas de logo trouvé, application du CSS uniquement"
    
    # Appliquer CSS seulement
    aws cognito-idp set-ui-customization \
        --user-pool-id "$USER_POOL_ID" \
        --client-id "$CLIENT_ID" \
        --css "$CSS_CONTENT" \
        --region "$REGION"
fi

if [ $? -eq 0 ]; then
    echo "✅ Branding appliqué avec succès!"
    echo ""
    echo "📋 Pour tester les changements:"
    echo "1. Attendez 1 minute pour la propagation"
    echo "2. Ouvrez en navigation privée:"
    echo "   https://saint-esprit-radio-auth.auth.eu-west-3.amazoncognito.com/login?client_id=5jst6bnhl26ekdr5a7pu9ik2f5&response_type=code&scope=email+openid+profile&redirect_uri=https%3A%2F%2Fsaint-esprit.link%2F"
    echo ""
    echo "💡 Tips:"
    echo "- Utilisez Ctrl+Shift+R pour forcer le rafraîchissement"
    echo "- Testez en navigation privée pour éviter le cache"
else
    echo "❌ Erreur lors de l'application du branding"
    exit 1
fi

# Option pour appliquer à TOUS les clients
echo ""
read -p "Voulez-vous appliquer ce branding à TOUS les clients? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 Application à tous les clients..."
    
    if [ -f "$LOGO_FILE" ]; then
        aws cognito-idp set-ui-customization \
            --user-pool-id "$USER_POOL_ID" \
            --client-id "ALL" \
            --image-file "fileb://$LOGO_FILE" \
            --css "$CSS_CONTENT" \
            --region "$REGION"
    else
        aws cognito-idp set-ui-customization \
            --user-pool-id "$USER_POOL_ID" \
            --client-id "ALL" \
            --css "$CSS_CONTENT" \
            --region "$REGION"
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ Branding appliqué à tous les clients!"
    else
        echo "⚠️  Erreur lors de l'application globale"
    fi
fi

echo ""
echo "🎉 Terminé!"