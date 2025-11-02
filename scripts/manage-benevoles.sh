#!/bin/bash

# Script de gestion des utilisateurs bénévoles
# User Pool dédié aux bénévoles Saint Esprit Radio

USER_POOL_ID="eu-west-3_wlQrKtvCn"
CLIENT_ID="62i42njgieq7ocg63crjfnopet"
DOMAIN="saint-esprit-benevoles.auth.eu-west-3.amazoncognito.com"
REGION="eu-west-3"

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour créer un bénévole
create_benevole() {
    local email=$1
    local given_name=$2
    local family_name=$3
    local volunteer_type=${4:-"benevole"}  # Type par défaut: benevole
    local temp_password=$5
    
    echo -e "${YELLOW}Création du bénévole: $given_name $family_name ($email)${NC}"
    
    # Créer l'utilisateur
    aws cognito-idp admin-create-user \
        --user-pool-id $USER_POOL_ID \
        --username "$email" \
        --user-attributes \
            Name=email,Value="$email" \
            Name=email_verified,Value=true \
            Name=given_name,Value="$given_name" \
            Name=family_name,Value="$family_name" \
            Name=volunteer_type,Value="$volunteer_type" \
        --message-action SUPPRESS \
        --region $REGION > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        # Définir le mot de passe permanent
        aws cognito-idp admin-set-user-password \
            --user-pool-id $USER_POOL_ID \
            --username "$email" \
            --password "$temp_password" \
            --permanent \
            --region $REGION > /dev/null 2>&1
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Bénévole créé avec succès${NC}"
            echo "  Email: $email"
            echo "  Mot de passe: $temp_password"
            echo "  Type: $volunteer_type"
            echo "  URL de connexion: https://$DOMAIN/login?client_id=$CLIENT_ID&response_type=code&scope=email+openid+profile&redirect_uri=https://saint-esprit.link/benevoles.html"
        else
            echo -e "${RED}❌ Erreur lors de la définition du mot de passe${NC}"
        fi
    else
        echo -e "${RED}❌ Erreur lors de la création de l'utilisateur${NC}"
    fi
}

# Fonction pour lister les bénévoles
list_benevoles() {
    echo -e "${YELLOW}Liste des bénévoles:${NC}"
    
    aws cognito-idp list-users \
        --user-pool-id $USER_POOL_ID \
        --region $REGION \
        --query 'Users[].{Email:Attributes[?Name==`email`].Value|[0],Name:Attributes[?Name==`name`].Value|[0],Status:UserStatus,Created:UserCreateDate}' \
        --output table
}

# Fonction pour supprimer un bénévole
delete_benevole() {
    local email=$1
    
    echo -e "${YELLOW}Suppression du bénévole: $email${NC}"
    
    aws cognito-idp admin-delete-user \
        --user-pool-id $USER_POOL_ID \
        --username "$email" \
        --region $REGION
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Bénévole supprimé${NC}"
    else
        echo -e "${RED}❌ Erreur lors de la suppression${NC}"
    fi
}

# Fonction pour réinitialiser le mot de passe
reset_password() {
    local email=$1
    local new_password=$2
    
    echo -e "${YELLOW}Réinitialisation du mot de passe pour: $email${NC}"
    
    aws cognito-idp admin-set-user-password \
        --user-pool-id $USER_POOL_ID \
        --username "$email" \
        --password "$new_password" \
        --permanent \
        --region $REGION
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Mot de passe réinitialisé${NC}"
        echo "  Nouveau mot de passe: $new_password"
    else
        echo -e "${RED}❌ Erreur lors de la réinitialisation${NC}"
    fi
}

# Fonction pour activer/désactiver un bénévole
toggle_benevole() {
    local email=$1
    local action=$2  # enable ou disable
    
    if [ "$action" == "enable" ]; then
        echo -e "${YELLOW}Activation du bénévole: $email${NC}"
        aws cognito-idp admin-enable-user \
            --user-pool-id $USER_POOL_ID \
            --username "$email" \
            --region $REGION
    else
        echo -e "${YELLOW}Désactivation du bénévole: $email${NC}"
        aws cognito-idp admin-disable-user \
            --user-pool-id $USER_POOL_ID \
            --username "$email" \
            --region $REGION
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Opération réussie${NC}"
    else
        echo -e "${RED}❌ Erreur lors de l'opération${NC}"
    fi
}

# Menu principal
show_menu() {
    echo -e "\n${GREEN}=== Gestion des Bénévoles Saint Esprit Radio ===${NC}"
    echo -e "Pool ID: ${YELLOW}$USER_POOL_ID${NC}"
    echo -e "Région: ${YELLOW}$REGION${NC}"
    echo ""
    echo "1) Créer un nouveau bénévole"
    echo "2) Lister tous les bénévoles"
    echo "3) Supprimer un bénévole"
    echo "4) Réinitialiser un mot de passe"
    echo "5) Activer un bénévole"
    echo "6) Désactiver un bénévole"
    echo "7) Afficher les infos de connexion"
    echo "0) Quitter"
    echo ""
    read -p "Choix: " choice
    
    case $choice in
        1)
            read -p "Email: " email
            read -p "Prénom: " given_name
            read -p "Nom: " family_name
            read -p "Type (benevole/chroniqueur/technicien): " volunteer_type
            read -p "Mot de passe: " password
            create_benevole "$email" "$given_name" "$family_name" "$volunteer_type" "$password"
            ;;
        2)
            list_benevoles
            ;;
        3)
            read -p "Email du bénévole à supprimer: " email
            delete_benevole "$email"
            ;;
        4)
            read -p "Email: " email
            read -p "Nouveau mot de passe: " password
            reset_password "$email" "$password"
            ;;
        5)
            read -p "Email du bénévole à activer: " email
            toggle_benevole "$email" "enable"
            ;;
        6)
            read -p "Email du bénévole à désactiver: " email
            toggle_benevole "$email" "disable"
            ;;
        7)
            echo -e "\n${GREEN}Informations de connexion:${NC}"
            echo "URL: https://saint-esprit.link/benevoles.html"
            echo "Domaine Cognito: https://$DOMAIN"
            echo "Client ID: $CLIENT_ID"
            echo "User Pool ID: $USER_POOL_ID"
            ;;
        0)
            echo "Au revoir!"
            exit 0
            ;;
        *)
            echo -e "${RED}Option invalide${NC}"
            ;;
    esac
}

# Si des arguments sont passés, les traiter directement
if [ $# -gt 0 ]; then
    case $1 in
        create)
            if [ $# -lt 6 ]; then
                echo "Usage: $0 create <email> <prénom> <nom> <type> <mot_de_passe>"
                exit 1
            fi
            create_benevole "$2" "$3" "$4" "$5" "$6"
            ;;
        list)
            list_benevoles
            ;;
        delete)
            if [ $# -lt 2 ]; then
                echo "Usage: $0 delete <email>"
                exit 1
            fi
            delete_benevole "$2"
            ;;
        reset)
            if [ $# -lt 3 ]; then
                echo "Usage: $0 reset <email> <nouveau_mot_de_passe>"
                exit 1
            fi
            reset_password "$2" "$3"
            ;;
        enable)
            if [ $# -lt 2 ]; then
                echo "Usage: $0 enable <email>"
                exit 1
            fi
            toggle_benevole "$2" "enable"
            ;;
        disable)
            if [ $# -lt 2 ]; then
                echo "Usage: $0 disable <email>"
                exit 1
            fi
            toggle_benevole "$2" "disable"
            ;;
        *)
            echo "Commande inconnue: $1"
            echo "Commandes disponibles: create, list, delete, reset, enable, disable"
            exit 1
            ;;
    esac
else
    # Mode interactif
    while true; do
        show_menu
    done
fi