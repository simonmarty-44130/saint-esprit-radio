#!/bin/bash
BASE_URL="http://localhost:8080"

echo "🔄 Restauration des fichiers depuis localhost:8080..."

# Télécharger les fichiers principaux
FILES=(
    "index.html"
    "js/app.js"
    "js/modules/StreamRecorder.js"
    "js/modules/EmissionEditor.js"
    "js/modules/VolunteerOptimizations.js"
    "js/modules/StudiosCalendar.js"
)

for FILE in "${FILES[@]}"; do
    echo "Téléchargement de $FILE..."
    curl -s "$BASE_URL/$FILE" -o "$FILE" --create-dirs
    if [ -s "$FILE" ]; then
        echo "✅ $FILE téléchargé ($(wc -c < $FILE) octets)"
    else
        echo "❌ Erreur lors du téléchargement de $FILE"
    fi
done

echo "✅ Restauration terminée"
