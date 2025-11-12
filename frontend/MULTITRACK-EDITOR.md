# Éditeur Multipiste - Documentation

## Vue d'ensemble

L'éditeur multipiste de Saint-Esprit V3 est un outil professionnel d'édition audio permettant de mixer jusqu'à 4 pistes audio simultanément, avec enregistrement en direct, effets audio et export MP3.

## Accès

- Depuis le menu latéral : Cliquer sur **🎚️ Multipiste**
- Depuis une news : Bouton **🎚️ Éditeur Multipiste** dans l'éditeur de news

## Fonctionnalités principales

### 1. Import et enregistrement

- **Import de fichiers** : Glisser-déposer ou bouton 📁
- **Enregistrement micro** : Bouton 🎤 + armer une piste
- **Chutier audio** : Bibliothèque de clips réutilisables

### 2. Édition audio

#### Points In/Out
- **Point IN** (`I`) : Marque le début d'une sélection
- **Point OUT** (`O`) : Marque la fin d'une sélection
- Affichage dynamique de la durée entre In et Out
- Découpe précise avec `Ctrl+X`

#### Opérations de base
- **Cut** (`Ctrl+X`) : Couper le clip ou la région In/Out
- **Copy** (`Ctrl+C`) : Copier le clip sélectionné
- **Paste** (`Ctrl+V`) : Coller au curseur
- **Split** (`S`) : Diviser un clip en 2

#### Effets audio
- **Normalize** : Normalisation à -3dB (standard radio)
- **Amplify** : Gain de -20dB à +20dB
- **Silence** : Rendre un clip silencieux
- **Fade In/Out** : Fondus automatiques
- **Crossfade** : Fondu enchaîné entre 2 clips

#### Trim
- **Trim Start** : Rogner le début au curseur
- **Trim End** : Rogner la fin au curseur

### 3. Contrôles de lecture

#### Transport
- **Play/Pause** (`Espace`) : Lecture/Pause
- **Stop** (`K`) : Arrêt et retour au début
- **Avance rapide** (`L`) : +5 secondes
- **Retour arrière** (`J`) : -5 secondes

#### Navigation
- **Home** : Aller au début
- **End** : Aller à la fin
- **←/→** : Déplacer le playhead frame par frame
- **Page Up/Down** : Sauter 5 secondes

### 4. Zoom et visualisation

- **Zoom In** (`+`) : Agrandir la timeline
- **Zoom Out** (`-`) : Réduire la timeline
- **Zoom Fit** (`Ctrl+0`) : Ajuster toute la timeline à l'écran

### 5. Pistes audio

#### Configuration
- 4 pistes fixes avec code couleur :
  - **Piste 1 - Voix** : Vert 🟢
  - **Piste 2 - Interview** : Orange 🟠
  - **Piste 3 - Ambiance** : Violet 🟣
  - **Piste 4 - Musique** : Bleu 🔵

#### Contrôles par piste
- **Volume** : Slider de 0 à 100%
- **Pan** : Gauche/Centre/Droite
- **Solo** (S) : Isoler une piste
- **Mute** (M) : Couper le son d'une piste
- **Record** (⏺️) : Armer pour l'enregistrement

### 6. Export

#### Format MP3
- Bitrate : 320kbps (radio quality)
- Normalisation automatique optionnelle
- Upload direct vers S3
- Téléchargement local

#### Options
- **Normaliser** : -3dB standard radio
- **Nom de fichier** : Personnalisable
- **Lier à une news** : Association automatique

## Workflow recommandé

### 1. Montage radio classique

```
1. Importer les rushes (interviews, ambiances)
2. Les placer dans le chutier
3. Glisser sur les pistes appropriées
4. Enregistrer la voix (piste 1)
5. Ajuster les volumes et pans
6. Créer des crossfades entre clips
7. Définir In/Out pour la durée cible
8. Normaliser si nécessaire
9. Exporter en MP3
```

### 2. Édition précise

```
1. Zoomer sur la région à éditer
2. Placer le point IN (I)
3. Placer le point OUT (O)
4. Opération (Cut, Amplify, etc.)
5. Vérifier avec Play
6. Undo si nécessaire (Ctrl+Z)
```

## Raccourcis clavier complets

### Playback
- `Espace` : Play/Pause
- `K` : Pause
- `J` : Retour arrière
- `L` : Avance rapide
- `Home` : Début
- `End` : Fin
- `←` / `→` : Frame par frame
- `Page Up` / `Page Down` : ±5 secondes

### Points In/Out
- `I` : Définir point IN
- `O` : Définir point OUT
- `Shift+I` : Aller au point IN
- `Shift+O` : Aller au point OUT

### Édition
- `Ctrl+X` : Couper
- `Ctrl+C` : Copier
- `Ctrl+V` : Coller
- `Ctrl+Z` : Annuler
- `Ctrl+Y` : Refaire
- `S` : Diviser le clip
- `Delete` : Supprimer le clip

### Zoom
- `+` ou `=` : Zoomer
- `-` : Dézoomer
- `Ctrl+0` ou `Cmd+0` : Ajuster à la vue

### Enregistrement
- `R` : Armer/désarmer la piste

## Sauvegarde et projets

### Auto-sauvegarde
- Tous les projets sont sauvegardés automatiquement dans DynamoDB
- Table : `saint-esprit-multitrack-projects`

### Structure d'un projet
```json
{
  "id": "multitrack-123456789",
  "name": "Mon montage",
  "userId": "user-id",
  "linkedNewsId": "news-id",
  "duration": 70.5,
  "tracks": [
    {
      "index": 0,
      "name": "Voix",
      "clips": [
        {
          "id": "clip-123",
          "libraryId": "audio-456",
          "position": 0,
          "duration": 30.5,
          "volume": 0.8,
          "pan": 0,
          "fadeIn": 0.5,
          "fadeOut": 1.0
        }
      ]
    }
  ],
  "createdAt": 1762443141000,
  "updatedAt": 1762443141000
}
```

### Charger un projet
- Bouton **📂 Projets** dans l'en-tête
- Liste de tous les projets sauvegardés
- Double-clic pour charger

## Performance et optimisation

### Cache de waveforms
- Les waveforms sont pré-rendues et mises en cache
- Cache intelligent par dimensions (largeur × hauteur)
- Limite de 5 tailles différentes par clip
- Nettoyage automatique après effets audio

### Recommandations
- **Fichiers audio** : MP3, WAV, M4A supportés
- **Taille max** : ~100 MB par fichier recommandé
- **Nombre de clips** : Jusqu'à 20 clips par piste
- **Durée totale** : Jusqu'à 2 heures de mix

## Intégration avec les News

### Lier un projet à une news
1. Ouvrir l'éditeur de news
2. Cliquer sur **🎚️ Éditeur Multipiste**
3. Le projet sera automatiquement lié
4. L'export peut être associé à la news

### Durée cible
- Si une news a une durée cible (ex: 1:10)
- Zone rouge affichée après la durée cible
- Points In/Out pour respecter le format

## Architecture technique

### Fichiers principaux
```
frontend/
├── v3.html                          # Interface HTML
├── v3-1762443141.css                # Styles
├── v3-app-1762510653.js             # Application principale
└── js/components/
    └── MultitrackEditor.js          # Logique de l'éditeur (3900 lignes)
```

### Technologies utilisées
- **Web Audio API** : Lecture, mixage, effets
- **Canvas API** : Rendu des waveforms et interface
- **MediaRecorder API** : Enregistrement microphone
- **lamejs** : Encodage MP3 côté client
- **DynamoDB** : Persistance des projets
- **S3** : Stockage des fichiers audio

### Classes principales
```javascript
class MultitrackEditor {
  - audioContext: AudioContext
  - tracks: Track[]
  - audioLibrary: LibraryItem[]
  - currentTime: number
  - inPoint: number | null
  - outPoint: number | null
  - zoomLevel: number
  - history: State[]
}
```

## Support et dépannage

### Problèmes courants

**Le son ne sort pas**
- Vérifier que le volume de la piste n'est pas à 0
- Vérifier que la piste n'est pas en mute
- Vérifier le volume master du navigateur

**Lag/Performance**
- Réduire le nombre de clips visibles (zoom)
- Limiter le nombre de pistes utilisées
- Nettoyer le chutier (supprimer clips inutilisés)

**Export échoue**
- Vérifier la connexion réseau
- Vérifier les permissions S3
- Essayer avec un nom de fichier différent

**Points In/Out ne fonctionnent pas**
- S'assurer que le curseur est positionné
- Appuyer sur `I` puis déplacer le curseur puis `O`
- Vérifier l'affichage dans la barre In/Out

## Évolutions futures

### Prévues
- [ ] Enveloppe de volume par clip
- [ ] Effets audio avancés (EQ, compression)
- [ ] Import depuis URL
- [ ] Export en formats multiples (WAV, AAC)
- [ ] Marqueurs de navigation
- [ ] Groupes de pistes

### En cours d'évaluation
- [ ] Mode spectrogramme
- [ ] Analyse de loudness LUFS
- [ ] Détection automatique de silences
- [ ] Suggestions de découpe IA
- [ ] Collaboration temps réel

---

**Version** : 1.0.0
**Dernière mise à jour** : 12 novembre 2024
**Auteur** : Saint-Esprit Radio
