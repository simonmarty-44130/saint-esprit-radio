#!/bin/bash

# Script pour créer des utilisateurs Radio Fidélité dans Cognito
# Format des emails : prenom.nom@radio-fidelite.fr

USER_POOL_ID="eu-west-3_oD1fm8OLs"
REGION="eu-west-3"

# Couleurs pour l'affichage
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo "🎙️ Création d'utilisateurs Radio Fidélité dans AWS Cognito"
echo "=========================================================="
echo ""

# Fonction pour créer un utilisateur
create_user() {
    local email=$1
    local prenom=$2
    local nom=$3
    local temp_password="Radio2025!"
    
    echo -e "${YELLOW}Création de l'utilisateur : $prenom $nom ($email)${NC}"
    
    # Créer l'utilisateur dans Cognito
    aws cognito-idp admin-create-user \
        --user-pool-id $USER_POOL_ID \
        --username $email \
        --user-attributes \
            Name=email,Value=$email \
            Name=email_verified,Value=true \
            Name=given_name,Value=$prenom \
            Name=family_name,Value=$nom \
            Name=name,Value="$prenom $nom" \
        --message-action SUPPRESS \
        --temporary-password "$temp_password" \
        --region $REGION 2>&1
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Utilisateur créé avec succès${NC}"
        
        # Définir un mot de passe permanent
        echo "   Configuration du mot de passe permanent..."
        aws cognito-idp admin-set-user-password \
            --user-pool-id $USER_POOL_ID \
            --username $email \
            --password "$temp_password" \
            --permanent \
            --region $REGION 2>&1 > /dev/null
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}   ✅ Mot de passe configuré${NC}"
            echo "   📧 Email : $email"
            echo "   🔑 Mot de passe : $temp_password"
        else
            echo -e "${RED}   ❌ Erreur lors de la configuration du mot de passe${NC}"
        fi
        
        # Ajouter l'utilisateur au groupe approprié (optionnel)
        # aws cognito-idp admin-add-user-to-group \
        #     --user-pool-id $USER_POOL_ID \
        #     --username $email \
        #     --group-name "animateurs" \
        #     --region $REGION
        
    else
        echo -e "${RED}❌ Erreur lors de la création de l'utilisateur${NC}"
    fi
    
    echo ""
}

# Menu interactif
while true; do
    echo "Que voulez-vous faire ?"
    echo "1) Créer un utilisateur individuel"
    echo "2) Créer plusieurs utilisateurs depuis une liste"
    echo "3) Lister les utilisateurs existants"
    echo "4) Créer des utilisateurs de test"
    echo "5) Quitter"
    read -p "Choix : " choice
    
    case $choice in
        1)
            echo ""
            read -p "Prénom : " prenom
            read -p "Nom : " nom
            # Convertir en minuscules et remplacer espaces par des tirets
            prenom_clean=$(echo "$prenom" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
            nom_clean=$(echo "$nom" | tr '[:upper:]' '[:lower:]' | tr ' ' '-')
            email="${prenom_clean}.${nom_clean}@radio-fidelite.fr"
            
            echo ""
            create_user "$email" "$prenom" "$nom"
            ;;
            
        2)
            echo ""
            echo "Format du fichier CSV : prenom,nom"
            read -p "Chemin du fichier CSV : " csv_file
            
            if [ -f "$csv_file" ]; then
                while IFS=',' read -r prenom nom
                do
                    prenom_clean=$(echo "$prenom" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | xargs)
                    nom_clean=$(echo "$nom" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | xargs)
                    email="${prenom_clean}.${nom_clean}@radio-fidelite.fr"
                    create_user "$email" "$prenom" "$nom"
                done < "$csv_file"
            else
                echo -e "${RED}Fichier non trouvé${NC}"
            fi
            ;;
            
        3)
            echo ""
            echo "Liste des utilisateurs existants :"
            echo "-----------------------------------"
            aws cognito-idp list-users \
                --user-pool-id $USER_POOL_ID \
                --region $REGION \
                --query 'Users[].{Email:Attributes[?Name==`email`].Value|[0],Status:UserStatus,Created:UserCreateDate}' \
                --output table
            echo ""
            ;;
            
        4)
            echo ""
            echo "Création d'utilisateurs de test..."
            echo ""
            
            # Créer quelques utilisateurs de test
            create_user "jean.dupont@radio-fidelite.fr" "Jean" "Dupont"
            create_user "marie.martin@radio-fidelite.fr" "Marie" "Martin"
            create_user "pierre.bernard@radio-fidelite.fr" "Pierre" "Bernard"
            create_user "sophie.leblanc@radio-fidelite.fr" "Sophie" "Leblanc"
            
            echo -e "${GREEN}Utilisateurs de test créés !${NC}"
            echo ""
            ;;
            
        5)
            echo "Au revoir !"
            exit 0
            ;;
            
        *)
            echo -e "${RED}Option invalide${NC}"
            ;;
    esac
done