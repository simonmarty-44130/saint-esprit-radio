#!/bin/bash

# Script pour ajouter un utilisateur à Saint-Esprit

echo "=== Ajout d'un utilisateur Saint-Esprit ==="
echo ""

read -p "Email de l'utilisateur: " EMAIL
read -p "Nom complet: " NAME
read -p "Mot de passe temporaire: " -s PASSWORD
echo ""

# Créer l'utilisateur dans Cognito
aws cognito-idp admin-create-user \
  --user-pool-id eu-west-3_oD1fm8OLs \
  --username "$EMAIL" \
  --user-attributes Name=email,Value="$EMAIL" Name=name,Value="$NAME" Name=email_verified,Value=true \
  --temporary-password "$PASSWORD" \
  --message-action SUPPRESS \
  --region eu-west-3

if [ $? -eq 0 ]; then
    echo "✅ Utilisateur créé avec succès!"
    echo ""
    echo "L'utilisateur peut maintenant se connecter à:"
    echo "https://saint-esprit.link"
    echo ""
    echo "Avec:"
    echo "- Email: $EMAIL"
    echo "- Mot de passe temporaire: (celui que vous avez défini)"
    echo ""
    echo "Il devra changer son mot de passe à la première connexion."
else
    echo "❌ Erreur lors de la création de l'utilisateur"
fi