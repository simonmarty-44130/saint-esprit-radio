#!/bin/bash

# Script pour créer des utilisateurs bénévoles dans Cognito
# Usage: ./create-volunteer-users.sh

USER_POOL_ID="eu-west-3_oD1fm8OLs"
REGION="eu-west-3"

# Fonction pour créer un utilisateur
create_user() {
    local email=$1
    local given_name=$2
    local family_name=$3
    local temp_password=$4
    
    echo "Création de l'utilisateur: $given_name $family_name ($email)"
    
    # Créer l'utilisateur
    aws cognito-idp admin-create-user \
        --user-pool-id $USER_POOL_ID \
        --username "$email" \
        --user-attributes \
            Name=email,Value="$email" \
            Name=email_verified,Value=true \
            Name=given_name,Value="$given_name" \
            Name=family_name,Value="$family_name" \
            Name=name,Value="$given_name $family_name" \
            Name=custom:role,Value="volunteer" \
        --temporary-password "$temp_password" \
        --message-action SUPPRESS \
        --region $REGION
    
    if [ $? -eq 0 ]; then
        echo "✅ Utilisateur créé avec succès"
        
        # Forcer la confirmation du mot de passe temporaire
        aws cognito-idp admin-set-user-password \
            --user-pool-id $USER_POOL_ID \
            --username "$email" \
            --password "$temp_password" \
            --permanent \
            --region $REGION
            
        echo "✅ Mot de passe confirmé"
    else
        echo "❌ Erreur lors de la création de l'utilisateur"
    fi
    
    echo "---"
}

# Exemples de bénévoles à créer
# Modifier ces lignes avec les vrais bénévoles

echo "=== Création des comptes bénévoles ==="
echo ""

# Exemple 1
# create_user "benevolent1@saint-esprit.org" "Jean" "Dupont" "TempPass123!"

# Exemple 2  
# create_user "benevolent2@saint-esprit.org" "Marie" "Martin" "TempPass456!"

# Exemple 3
# create_user "benevolent3@saint-esprit.org" "Pierre" "Bernard" "TempPass789!"

echo ""
echo "=== Instructions pour créer un bénévole ==="
echo ""
echo "Décommentez et modifiez une ligne create_user avec :"
echo "  - Email du bénévole"
echo "  - Prénom"
echo "  - Nom"
echo "  - Mot de passe temporaire (min 8 caractères, majuscules, minuscules, chiffres, symboles)"
echo ""
echo "Exemple :"
echo 'create_user "jean.dupont@example.com" "Jean" "Dupont" "MonMotDePasse123!"'
echo ""
echo "Le bénévole pourra ensuite se connecter sur :"
echo "https://saint-esprit.link/volunteer.html"
echo ""
echo "Avec son email et le mot de passe fourni."