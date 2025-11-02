# 🚀 Guide de Lancement Local - Saint-Esprit Radio
## localhost:8000

---

## 📋 LANCEMENT RAPIDE (30 secondes)

### Option 1 : Python (Recommandé - Déjà installé sur Mac)
```bash
# 1. Ouvrir Terminal
# 2. Aller dans le dossier frontend
cd /Users/directionradiofidelite/saint-esprit-aws/frontend

# 3. Lancer le serveur
python3 -m http.server 8000

# 4. Ouvrir dans Chrome
# http://localhost:8000
```

**Pour arrêter** : Appuyer sur `Ctrl + C` dans le Terminal

---

## 🔄 RELANCER APRÈS REDÉMARRAGE MAC

### Méthode Simple - Copier/Coller
```bash
cd /Users/directionradiofidelite/saint-esprit-aws/frontend && python3 -m http.server 8000
```
Puis ouvrir : http://localhost:8000

### Créer un Raccourci Permanent (1 fois seulement)
```bash
# Créer un alias dans votre profil
echo "alias saint='cd /Users/directionradiofidelite/saint-esprit-aws/frontend && python3 -m http.server 8000'" >> ~/.zshrc

# Recharger le profil
source ~/.zshrc

# Maintenant, tapez simplement :
saint
```

---

## 🌐 ACCÈS DEPUIS D'AUTRES APPAREILS

### 1. Trouver l'IP de votre Mac
```bash
# Dans Terminal, taper :
ifconfig | grep "inet " | grep -v 127.0.0.1

# Vous verrez quelque chose comme :
# inet 192.168.1.45 netmask 0xffffff00 broadcast 192.168.1.255
```

### 2. Accéder depuis un autre appareil
- **iPhone/iPad** : Safari → `http://192.168.1.45:8000`
- **Autre ordinateur** : Chrome → `http://192.168.1.45:8000`
- **Android** : Chrome → `http://192.168.1.45:8000`

⚠️ **Note** : Les appareils doivent être sur le même réseau WiFi

---

## 🔧 AUTRES OPTIONS DE SERVEUR

### Option 2 : Node.js (Si installé)
```bash
# Installer http-server globalement (1 fois)
npm install -g http-server

# Lancer
cd /Users/directionradiofidelite/saint-esprit-aws/frontend
http-server -p 8000

# Accès : http://localhost:8000
```

### Option 3 : PHP (Si installé)
```bash
cd /Users/directionradiofidelite/saint-esprit-aws/frontend
php -S localhost:8000

# Accès : http://localhost:8000
```

### Option 4 : Visual Studio Code
Si vous avez VS Code :
1. Installer l'extension "Live Server"
2. Ouvrir le dossier frontend dans VS Code
3. Clic droit sur `index.html` → "Open with Live Server"

---

## 🛠️ DÉPANNAGE

### Problème : "Port 8000 already in use"
```bash
# Voir ce qui utilise le port
lsof -i :8000

# Tuer le processus (remplacer PID par le numéro)
kill -9 [PID]

# Ou utiliser un autre port
python3 -m http.server 8001
# Puis accéder à http://localhost:8001
```

### Problème : "python3: command not found"
```bash
# Vérifier si Python est installé
python --version

# Si oui, utiliser python au lieu de python3
python -m http.server 8000
```

### Problème : Page blanche
1. Vérifier la console Chrome : `Cmd + Option + J`
2. Vérifier que vous êtes dans le bon dossier (`/frontend`)
3. Rafraîchir avec cache vidé : `Cmd + Shift + R`

---

## 🎯 SCRIPT DE DÉMARRAGE AUTOMATIQUE

### Créer une App Mac pour lancer en 1 clic

1. Ouvrir **Automator** (dans Applications)
2. Choisir "Application"
3. Ajouter "Exécuter un script Shell"
4. Coller ce code :
```bash
cd /Users/directionradiofidelite/saint-esprit-aws/frontend
python3 -m http.server 8000 &
sleep 2
open http://localhost:8000
```
5. Sauvegarder comme "Saint-Esprit.app" sur le Bureau
6. Double-cliquer pour lancer !

---

## 📱 ACCÈS RAPIDE - BOOKMARKS

### Ajouter aux Favoris Chrome
1. Aller sur http://localhost:8000
2. `Cmd + D` pour ajouter aux favoris
3. Nommer "Saint-Esprit Local"

### Créer un Raccourci Bureau (Mac)
1. Ouvrir Safari
2. Aller sur http://localhost:8000
3. Fichier → Ajouter à la Dock
4. L'icône apparaît dans le Dock

---

## ✅ CHECKLIST DE VÉRIFICATION

Après lancement, vérifier :

- [ ] Page d'accueil s'affiche
- [ ] Demande du nom d'utilisateur
- [ ] Les données se chargent depuis AWS S3
- [ ] Les modules (News, Animation, etc.) fonctionnent
- [ ] Les sons se jouent correctement
- [ ] Le module ON AIR affiche la conduite

---

## 🔄 COMMANDES UTILES

```bash
# Lancer Saint-Esprit
cd /Users/directionradiofidelite/saint-esprit-aws/frontend && python3 -m http.server 8000

# Voir les logs en temps réel (dans un autre Terminal)
tail -f /var/log/system.log | grep python

# Nettoyer le cache Chrome pour Saint-Esprit
# Dans Chrome : Cmd + Shift + R

# Backup rapide avant modifications
cp -r /Users/directionradiofidelite/saint-esprit-aws /Users/directionradiofidelite/Desktop/backup-saint-esprit-$(date +%Y%m%d)
```

---

## 📞 RÉSOLUTION RAPIDE

### L'app ne démarre pas ?
```bash
# Solution en 1 ligne :
pkill -f "python3 -m http.server" && cd /Users/directionradiofidelite/saint-esprit-aws/frontend && python3 -m http.server 8000
```

### Besoin de logs ?
Ouvrir la Console Chrome : `Cmd + Option + J`

### Données non synchronisées ?
1. Vérifier la connexion internet
2. Vérifier que AWS S3 est accessible
3. Rafraîchir : `Cmd + R`

---

## 🎉 LANCEMENT FESTIF

Pour impressionner l'équipe, lancer avec style :
```bash
clear && echo "🎙️ SAINT-ESPRIT RADIO 🎙️" && echo "========================" && echo "Démarrage du serveur..." && sleep 1 && cd /Users/directionradiofidelite/saint-esprit-aws/frontend && python3 -m http.server 8000 & sleep 2 && echo "✅ Serveur démarré !" && echo "📱 Ouverture dans Chrome..." && open http://localhost:8000
```

---

## 💡 ASTUCE PRO

### Lancement au démarrage du Mac
1. Préférences Système → Utilisateurs et groupes
2. Onglet "Ouverture"
3. Ajouter "Saint-Esprit.app" (créée avec Automator)
4. L'app se lance automatiquement au démarrage !

---

*Guide créé le 20/08/2025 - Saint-Esprit Radio v2.0 AWS*