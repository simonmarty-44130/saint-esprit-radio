# Documentation Mode Bénévole - Saint Esprit AWS

## Vue d'ensemble

Le mode bénévole est une extension progressive du système Saint Esprit AWS qui offre une interface simplifiée pour les animateurs bénévoles. Cette fonctionnalité a été implémentée selon une approche "Extension Progressive" qui préserve 100% du code existant.

## Architecture

### Principe d'extension
- **AUCUNE modification** des fichiers existants (sauf extensions)
- **RÉUTILISATION** complète des managers et du storage S3
- **ADAPTATION** via CSS conditionnel et modules additionnels
- **ISOLATION** des fonctionnalités bénévoles dans des modules dédiés

## Fonctionnalités

### 1. Sélection de rôle au démarrage
- Modal de sélection : Journaliste ou Bénévole
- Mémorisation du choix dans localStorage
- Changement possible via les paramètres

### 2. Interface adaptative
- **Mode Journaliste** : Interface complète avec tous les modules
- **Mode Bénévole** : Interface simplifiée avec modules essentiels

### 3. Calendriers des studios
- Affichage des calendriers Google des studios
- Configuration par les journalistes
- Vue intégrée pour les bénévoles

### 4. Gestion des émissions simplifiée
- Création rapide d'émissions
- Gestion de playlist musicale
- Export pour diffusion

## Structure des fichiers

```
frontend/
├── js/
│   ├── modules/
│   │   ├── StudiosCalendar.js    # Gestion des calendriers
│   │   └── EmissionEditor.js     # Éditeur d'émissions simplifié
│   ├── managers/
│   │   └── contentmanager.js     # Étendu avec méthodes émissions
│   └── app.js                    # Logique de sélection de rôle
├── css/
│   └── volunteer-mode.css        # Styles spécifiques bénévoles
└── index.html                     # Inclusion des modules
```

## Utilisation

### Pour les bénévoles

1. **Première connexion**
   - Sélectionner "Bénévole" dans la modal
   - L'interface s'adapte automatiquement

2. **Créer une émission**
   - Cliquer sur "Nouvelle Émission"
   - Remplir les informations de base
   - Ajouter des musiques à la playlist
   - Sauvegarder et exporter

3. **Consulter les calendriers**
   - Les calendriers des studios sont visibles dans le dashboard
   - Cliquer pour déplier/replier chaque calendrier

### Pour les journalistes

1. **Configuration des studios**
   - Accès via le bouton "Configurer les studios"
   - Modification des URLs de calendriers
   - Activation/désactivation des studios

2. **Gestion complète**
   - Accès à toutes les fonctionnalités existantes
   - Possibilité de voir les émissions créées par les bénévoles

## Données S3

### Structure de stockage
```
saint-esprit-audio/
├── users/
│   └── {userId}/
│       └── data.json          # Données utilisateur (news, émissions)
├── calendars/
│   └── studios-config.json    # Configuration des calendriers
└── emissions/
    └── exports/
        └── {date}/
            └── {emissionId}.json  # Émissions exportées
```

## CSS Conditionnel

Le système utilise des classes CSS pour adapter l'interface :

- `.user-role-journalist` : Mode journaliste complet
- `.user-role-volunteer` : Mode bénévole simplifié
- `.journalist-only` : Éléments masqués pour les bénévoles

## API des modules

### StudiosCalendar
```javascript
// Initialisation
const calendar = new StudiosCalendar(app);
await calendar.init();

// Méthodes principales
calendar.loadStudiosConfig()      // Charger config depuis S3
calendar.saveStudiosConfig()      // Sauvegarder sur S3
calendar.renderCalendarsPanel()   // Afficher les calendriers
calendar.toggleCalendarView(id)   // Afficher/masquer un calendrier
```

### EmissionEditor
```javascript
// Initialisation
const editor = new EmissionEditor(app);
await editor.init();

// Méthodes principales
editor.createEmission(data)       // Créer une émission
editor.loadEmissionsList()        // Charger la liste
editor.editEmission(id)          // Éditer une émission
editor.exportEmission(id)        // Exporter pour diffusion
```

### ContentManager (extensions)
```javascript
// Méthodes ajoutées pour les émissions
contentManager.createEmission(data)     // Créer émission
contentManager.getEmissions()           // Lister émissions
contentManager.updateEmission(id, data) // Mettre à jour
contentManager.addMusicToEmission(id, music) // Ajouter musique
contentManager.exportEmissionForBroadcast(id) // Exporter
```

## Raccourcis clavier

### Mode bénévole
- `Ctrl/Cmd + E` : Nouvelle émission
- `Escape` : Fermer les formulaires

### Mode journaliste
- Tous les raccourcis existants restent disponibles

## Sécurité et permissions

- Les bénévoles ont accès uniquement à leurs propres données
- Les journalistes peuvent voir toutes les données
- La configuration des studios est réservée aux journalistes
- Les exports sont isolés par date et ID

## Maintenance

### Ajouter un nouveau studio
1. Modifier `StudiosCalendar.getDefaultStudiosConfig()`
2. Ajouter l'entrée dans l'objet `studios`
3. Les journalistes peuvent aussi le faire via l'interface

### Modifier les permissions
1. Ajuster les conditions dans `setupInterfaceForRole()`
2. Ajouter des classes CSS conditionnelles si nécessaire

### Étendre les fonctionnalités
1. Créer un nouveau module dans `js/modules/`
2. L'initialiser dans `setupVolunteerModules()`
3. Ajouter les styles dans `volunteer-mode.css`

## Troubleshooting

### Le mode bénévole ne s'active pas
- Vérifier localStorage : `saint-esprit-role`
- Forcer : `localStorage.setItem('saint-esprit-role', 'volunteer')`
- Rafraîchir la page

### Les calendriers ne s'affichent pas
- Vérifier la configuration S3 : `calendars/studios-config.json`
- Vérifier les URLs des calendriers Google
- S'assurer que les calendriers sont publics

### Les émissions ne se sauvegardent pas
- Vérifier les permissions S3
- Vérifier la connexion AWS
- Consulter la console pour les erreurs

## Évolutions futures

1. **Intégration audio**
   - Liaison avec AudioManager pour les musiques
   - Preview audio dans l'éditeur d'émissions

2. **Statistiques**
   - Dashboard de suivi pour les bénévoles
   - Historique des émissions

3. **Collaboration**
   - Partage d'émissions entre bénévoles
   - Validation par les journalistes

4. **Templates**
   - Modèles d'émissions réutilisables
   - Bibliothèque de playlists

## Support

Pour toute question ou problème :
1. Consulter cette documentation
2. Vérifier les logs console
3. Contacter l'équipe technique

---

*Document créé le 21 août 2025*
*Version 1.0 - Mode Bénévole Extension Progressive*