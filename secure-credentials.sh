#!/bin/bash

set -e  # Arrêter le script en cas d'erreur

# ==========================================
# 🔒 SÉCURISATION IMMÉDIATE DES CREDENTIALS
# Saint-Esprit AWS - Action d'urgence
# ==========================================
#
# ⚠️ AVERTISSEMENT SÉCURITÉ ⚠️
# CE SCRIPT A ÉTÉ SÉCURISÉ POUR ÉVITER L'EXPOSITION DE CREDENTIALS
# 
# CHANGEMENTS APPORTÉS :
# - Suppression des credentials AWS en dur
# - Utilisation de variables d'environnement
# - Prompt utilisateur sécurisé en fallback
# - Documentation de sécurité améliorée
#
# POUR UTILISER CETTE VERSION :
# 1. Configurez vos variables d'environnement :
#    export AWS_ACCESS_KEY_ID="votre_access_key"
#    export AWS_SECRET_ACCESS_KEY="votre_secret_key"
# 2. Ou laissez le script vous demander les credentials
#
# ==========================================

echo "🔒 Sécurisation immédiate des credentials AWS"
echo "============================================="

PROJECT_DIR="/Users/directionradiofidelite/saint-esprit-aws"
STORAGE_FILE="$PROJECT_DIR/frontend/js/core/storage.js"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_step() {
    echo -e "📋 $1"
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
# ÉTAPE 1: BACKUP DU FICHIER ORIGINAL
# ==========================================

print_step "Sauvegarde du fichier storage.js original..."

if [ ! -f "$STORAGE_FILE.original" ]; then
    cp "$STORAGE_FILE" "$STORAGE_FILE.original"
    print_success "Backup créé: storage.js.original"
else
    print_warning "Backup existe déjà"
fi

# ==========================================
# ÉTAPE 2: CRÉER UNE VERSION SÉCURISÉE TEMPORAIRE
# ==========================================

print_step "Création de la version sécurisée..."

# Créer un nouveau storage.js sans les credentials en dur
cat > "$STORAGE_FILE.secure" << 'EOF'
/**
 * Storage AWS pour Saint-Esprit - VERSION SÉCURISÉE
 * Les credentials sont gérés via variables d'environnement ou prompt utilisateur
 */
class Storage {
    constructor() {
        // Configuration AWS sans credentials en dur
        this.config = {
            region: 'eu-west-3',
            bucket: 'saint-esprit-audio'
        };
        
        // Initialiser AWS SDK de manière sécurisée
        this.initializeAWSCredentials();
        
        // État local
        this.userId = this.getCurrentUser();
        this.data = null;
        this.lastSyncCheck = 0;
        
        console.log(`🔧 AWS Storage initialized for user: ${this.userId}`);
    }
    
    async initializeAWSCredentials() {
        // Option 1: Utiliser les credentials depuis localStorage (temporaire)
        let accessKeyId = localStorage.getItem('aws_access_key');
        let secretAccessKey = localStorage.getItem('aws_secret_key');
        
        // Option 2: Si pas en localStorage, demander à l'utilisateur (une seule fois)
        if (!accessKeyId || !secretAccessKey) {
            const useStoredCreds = confirm(
                '🔑 Configuration AWS requise.\n\n' +
                'Voulez-vous utiliser les credentials temporaires intégrés ?\n\n' +
                '⚠️ En production, ceci sera remplacé par AWS Cognito.\n\n' +
                'Cliquez OK pour continuer avec les credentials temporaires.'
            );
            
            if (useStoredCreds) {
                // ⚠️ CONFIGURATION MANUELLE REQUISE ⚠️
                // REMPLACEZ les valeurs ci-dessous par vos vrais credentials AWS
                // OU configurez des variables d'environnement
                
                // Option 1: Variables d'environnement (recommandé)
                accessKeyId = process.env.AWS_ACCESS_KEY_ID || 'CONFIGURE_YOUR_ACCESS_KEY_HERE';
                secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || 'CONFIGURE_YOUR_SECRET_KEY_HERE';
                
                // Option 2: Prompt utilisateur sécurisé
                if (accessKeyId.includes('CONFIGURE_YOUR') || secretAccessKey.includes('CONFIGURE_YOUR')) {
                    accessKeyId = prompt('🔑 Entrez votre AWS Access Key ID:') || '';
                    secretAccessKey = prompt('🔑 Entrez votre AWS Secret Access Key:') || '';
                    
                    if (!accessKeyId || !secretAccessKey) {
                        throw new Error('❌ Credentials AWS requis. Configurez AWS_ACCESS_KEY_ID et AWS_SECRET_ACCESS_KEY ou entrez-les manuellement.');
                    }
                }
                
                // Les stocker temporairement (évite de redemander)
                localStorage.setItem('aws_access_key', accessKeyId);
                localStorage.setItem('aws_secret_key', secretAccessKey);
                
                console.log('⚠️ Utilisation credentials temporaires');
            } else {
                // L'utilisateur peut entrer ses propres credentials
                accessKeyId = prompt('🔑 AWS Access Key ID:');
                secretAccessKey = prompt('🔑 AWS Secret Access Key:');
                
                if (accessKeyId && secretAccessKey) {
                    localStorage.setItem('aws_access_key', accessKeyId);
                    localStorage.setItem('aws_secret_key', secretAccessKey);
                }
            }
        }
        
        if (!accessKeyId || !secretAccessKey) {
            throw new Error('❌ Credentials AWS requis pour fonctionner');
        }
        
        // Configurer AWS SDK
        AWS.config.update({
            accessKeyId: accessKeyId,
            secretAccessKey: secretAccessKey,
            region: this.config.region
        });
        
        this.s3 = new AWS.S3();
        
        // Test de connexion
        try {
            await this.s3.headBucket({ Bucket: this.config.bucket }).promise();
            console.log('✅ Connexion AWS S3 établie');
        } catch (error) {
            console.error('❌ Erreur connexion AWS S3:', error);
            
            // En cas d'erreur, proposer de nettoyer et recommencer
            if (confirm('❌ Erreur de connexion AWS.\n\nVoulez-vous effacer les credentials et recommencer ?')) {
                localStorage.removeItem('aws_access_key');
                localStorage.removeItem('aws_secret_key');
                location.reload();
            }
            
            throw error;
        }
    }
    
    // Méthode pour nettoyer les credentials (pour admin)
    clearStoredCredentials() {
        if (confirm('🗑️ Effacer les credentials stockés ?\n\nL\'application demandera de nouveaux credentials au prochain chargement.')) {
            localStorage.removeItem('aws_access_key');
            localStorage.removeItem('aws_secret_key');
            console.log('🗑️ Credentials effacés');
            alert('Credentials effacés. Rechargez la page.');
        }
    }
    
    // Méthode pour afficher les infos de sécurité
    showSecurityInfo() {
        const hasStoredCreds = !!(localStorage.getItem('aws_access_key'));
        const info = `
🔒 INFORMATIONS SÉCURITÉ

Status: ${hasStoredCreds ? '🟡 Credentials temporaires stockés' : '🔴 Pas de credentials'}
Bucket: ${this.config.bucket}
Région: ${this.config.region}

⚠️ IMPORTANT:
- Version temporaire en attente de déploiement sécurisé
- Les credentials seront remplacés par AWS Cognito
- Ne partagez jamais ces credentials

🔧 Actions disponibles:
- clearStoredCredentials() : Effacer les credentials
- showSecurityInfo() : Afficher ces infos
        `;
        
        console.log(info);
        alert(info);
    }
EOF

# Ajouter le reste du fichier original (à partir de la ligne 20)
tail -n +60 "$STORAGE_FILE.original" >> "$STORAGE_FILE.secure"

print_success "Version sécurisée créée"

# ==========================================
# ÉTAPE 3: CHOIX DE L'UTILISATEUR
# ==========================================

echo ""
echo "🤔 CHOIX DE SÉCURISATION :"
echo "========================="
echo ""
echo "1. 🔒 SÉCURISÉ (Recommandé)"
echo "   - Retire les credentials du code"
echo "   - Demande confirmation à l'utilisateur"
echo "   - Prêt pour le déploiement"
echo ""
echo "2. 📝 CONSERVER TEMPORAIREMENT"
echo "   - Garde les credentials actuels"
echo "   - Pour continuer le développement"
echo "   - DANGER si déployé tel quel"
echo ""

read -p "Votre choix (1 ou 2) : " choice

case $choice in
    1)
        print_step "Application de la version sécurisée..."
        mv "$STORAGE_FILE.secure" "$STORAGE_FILE"
        print_success "Version sécurisée appliquée !"
        echo ""
        echo "✅ SÉCURISATION TERMINÉE"
        echo "======================"
        echo ""
        echo "📋 Ce qui a changé :"
        echo "   - Credentials supprimés du code source"
        echo "   - Demande confirmation utilisateur au chargement"
        echo "   - Credentials stockés temporairement en localStorage"
        echo ""
        echo "🚀 Vous pouvez maintenant :"
        echo "   1. Tester l'app localement (http://localhost:8000)"
        echo "   2. Lancer le déploiement sécurisé"
        echo "   3. Partager le code sans risque"
        echo ""
        echo "🔧 Test immédiat :"
        echo "   cd $PROJECT_DIR/frontend"
        echo "   python3 -m http.server 8000"
        echo ""
        ;;
    2)
        print_warning "Conservation de la version actuelle"
        rm "$STORAGE_FILE.secure"
        echo ""
        echo "⚠️  ATTENTION - RISQUE SÉCURITAIRE"
        echo "=================================="
        echo ""
        echo "Les credentials AWS restent dans le code !"
        echo ""
        echo "📋 Actions requises AVANT déploiement :"
        echo "   1. NE PAS partager ce code"
        echo "   2. NE PAS commit sur Git public"
        echo "   3. Appliquer la sécurisation avant production"
        echo ""
        echo "🔧 Pour sécuriser plus tard :"
        echo "   Relancez ce script et choisissez l'option 1"
        echo ""
        ;;
    *)
        print_error "Choix invalide"
        exit 1
        ;;
esac

# ==========================================
# ÉTAPE 4: INSTRUCTIONS FINALES
# ==========================================

echo "📋 FICHIERS DISPONIBLES :"
echo "========================"
echo ""
echo "   - storage.js.original : Version originale (backup)"
echo "   - storage.js : Version active"
if [ "$choice" = "1" ]; then
    echo "   - storage.js.secure : Version sécurisée (appliquée)"
fi
echo ""

echo "🔧 COMMANDES UTILES :"
echo "==================="
echo ""
echo "# Restaurer l'original (si besoin)"
echo "cp $STORAGE_FILE.original $STORAGE_FILE"
echo ""
echo "# Tester localement"
echo "cd $PROJECT_DIR/frontend && python3 -m http.server 8000"
echo ""
echo "# Lancer le déploiement sécurisé"
echo "cd $PROJECT_DIR && ./deploy-one-click.sh"
echo ""

print_success "Sécurisation terminée !"