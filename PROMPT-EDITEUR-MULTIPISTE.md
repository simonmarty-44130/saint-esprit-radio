# Prompt : Développement de l'Éditeur Multipiste

## Contexte du Projet

Tu travailles sur **Saint-Esprit V3**, une application radio web pour gérer des contenus (news, animations, conducteurs, journaux) avec stockage DynamoDB et hébergement sur AWS S3 + CloudFront.

Le projet utilise :
- **Frontend** : Vanilla JavaScript (pas de framework)
- **Stockage** : DynamoDB via AWS SDK
- **Fichiers** : S3 pour les assets (audio, images)
- **Distribution** : CloudFront (E3I60G2234JQLX)
- **Auth** : Cognito
- **Architecture** : Single Page Application avec système de vues

## Fichiers Principaux

```
frontend/
├── v3.html                          # Page HTML principale
├── v3-app-1762510653.js            # Application principale (version prod)
├── v3-app.js                        # Application backup/dev
├── v3-1762443141.css               # Styles principaux
├── js/
│   ├── core/
│   │   ├── storage-dynamodb-v2.js  # Couche de stockage DynamoDB
│   │   └── dynamodb-client.js      # Client DynamoDB
│   ├── managers/
│   │   └── ContentManager.js       # Gestion des contenus
│   └── components/
│       ├── NewsDurationManager.js  # Calcul de durées
│       └── AudioEditor.js          # Éditeur audio basique
└── maquette-editeur-multipiste.html # MAQUETTE À IMPLÉMENTER
```

## Ce qui a été Fait

Une **maquette HTML/CSS complète** de l'éditeur multipiste a été créée dans :
```
/Users/directionradiofidelite/saint-esprit-aws/frontend/maquette-editeur-multipiste.html
```

### Fonctionnalités de la Maquette

✅ **Interface complète avec :**
- Header (Enregistrer, Exporter)
- Contrôles de transport (play, pause, stop, avance rapide/retour)
- Timeline avec règle temporelle et curseur de lecture
- Timecode (00:00.000)
- 4 pistes audio avec code couleur
- Visualisation waveform (simulée avec des barres)
- Contrôles par piste : Solo, Mute, Record
- Sliders Volume et Pan pour chaque piste
- Bouton "Ajouter une piste"
- Panneau d'export avec options (format, normalisation, etc.)

## Mission : Intégrer l'Éditeur Multipiste dans V3

### Objectif

Créer un **éditeur multipiste fonctionnel** permettant de :
1. **Importer** 4 pistes audio (fichiers locaux ou depuis S3)
2. **Mixer** en temps réel (volume, pan par piste)
3. **Visualiser** les waveforms réels
4. **Synchroniser** la lecture de toutes les pistes
5. **Exporter** le mix final en MP3 vers S3
6. **Sauvegarder** le projet multipiste dans DynamoDB

### Architecture Recommandée

#### 1. Nouveau Composant : `MultitrackEditor.js`

Créer `/frontend/js/components/MultitrackEditor.js` :

```javascript
class MultitrackEditor {
    constructor() {
        this.tracks = []; // Array de {audio: AudioContext, buffer: AudioBuffer, gain, pan, ...}
        this.audioContext = null;
        this.masterGain = null;
        this.isPlaying = false;
        this.currentTime = 0;
        this.duration = 0;
        this.projectData = null; // Pour sauvegarder config du mix
    }

    async init() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
    }

    async loadTrack(trackIndex, fileOrUrl) {
        // Charger le fichier audio
        // Décoder avec audioContext.decodeAudioData()
        // Créer gain et pan nodes
        // Générer waveform pour visualisation
    }

    play() {
        // Lancer toutes les pistes synchronisées
    }

    pause() {
        // Mettre en pause
    }

    stop() {
        // Arrêter et revenir à 0
    }

    setTrackVolume(trackIndex, volume) {
        // Ajuster le gain de la piste
    }

    setTrackPan(trackIndex, pan) {
        // Ajuster le panoramique (-1 gauche, 0 centre, 1 droite)
    }

    muteTrack(trackIndex, mute) {
        // Activer/désactiver le mute
    }

    soloTrack(trackIndex, solo) {
        // Mode solo : seule cette piste est audible
    }

    async exportMix(format = 'mp3', options = {}) {
        // Utiliser Web Audio API OfflineAudioContext
        // pour rendre le mix complet
        // Convertir en MP3 (utiliser lamejs ou encodeur similaire)
        // Upload vers S3
    }

    generateWaveform(audioBuffer, width = 1000, height = 80) {
        // Extraire samples du buffer
        // Générer array de valeurs pour visualisation
    }

    async saveProject(newsId) {
        // Sauvegarder dans DynamoDB :
        // - IDs des fichiers audio de chaque piste
        // - Volumes et pans
        // - Config du mix
    }

    async loadProject(newsId) {
        // Charger un projet existant depuis DynamoDB
    }
}
```

#### 2. Intégration dans `v3-app.js`

Ajouter une nouvelle vue "multitrack" :

```javascript
// Dans SaintEspritV3 class
this.multitrackEditor = null;

async initMultitrackEditor() {
    this.multitrackEditor = new MultitrackEditor();
    await this.multitrackEditor.init();
}

showMultitrackEditor(newsId = null) {
    this.switchView('multitrack');

    // Charger le HTML de la maquette dans la vue
    const editorContainer = document.getElementById('multitrack-view');
    editorContainer.innerHTML = `<!-- Contenu de la maquette -->`;

    // Bind les événements
    this.setupMultitrackControls();

    // Si newsId fourni, charger le projet existant
    if (newsId) {
        this.multitrackEditor.loadProject(newsId);
    }
}

setupMultitrackControls() {
    // Lier les boutons play/pause/stop
    // Lier les sliders volume/pan
    // Lier les boutons solo/mute
    // Gérer le drag & drop de fichiers
    // Gérer l'import depuis S3
}
```

#### 3. Ajout dans `v3.html`

Ajouter une nouvelle section de vue :

```html
<!-- Multitrack Editor View -->
<div id="multitrack-view" class="view-section" style="display: none;">
    <!-- Le contenu sera injecté dynamiquement -->
</div>
```

#### 4. Bouton d'accès depuis l'éditeur de News

Dans `showNewsEditor()`, ajouter un bouton pour ouvrir l'éditeur multipiste :

```html
<button class="btn btn-primary" onclick="app.openMultitrackForNews('${newsId}')">
    🎚️ Éditeur Multipiste
</button>
```

### Fonctionnalités Techniques à Implémenter

#### Phase 1 : Lecture Audio de Base
- [ ] Charger des fichiers audio depuis le système de fichiers local
- [ ] Décoder avec Web Audio API
- [ ] Lecture synchronisée de plusieurs pistes
- [ ] Contrôles play/pause/stop fonctionnels
- [ ] Timeline interactive (cliquer pour se positionner)

#### Phase 2 : Visualisation
- [ ] Générer des waveforms réels à partir des AudioBuffer
- [ ] Affichage canvas ou SVG des waveforms
- [ ] Curseur de lecture qui suit en temps réel
- [ ] Zoom in/out sur la timeline

#### Phase 3 : Mixage
- [ ] Contrôle de volume par piste (GainNode)
- [ ] Contrôle de panoramique par piste (StereoPannerNode)
- [ ] Boutons Solo/Mute fonctionnels
- [ ] Master volume

#### Phase 4 : Import/Export
- [ ] Drag & drop de fichiers audio
- [ ] Import depuis S3 (sélectionner des audios existants)
- [ ] Export du mix en MP3 avec lamejs
- [ ] Upload automatique du mix sur S3
- [ ] Génération d'un nom de fichier unique

#### Phase 5 : Sauvegarde de Projet
- [ ] Structure de données pour projet multipiste :
  ```json
  {
    "id": "multitrack-123",
    "newsId": "news-456",
    "tracks": [
      {
        "index": 0,
        "name": "Voix principale",
        "audioUrl": "s3://...",
        "audioFileId": "audio-789",
        "volume": 0.8,
        "pan": 0,
        "mute": false,
        "solo": false
      }
    ],
    "duration": 154.5,
    "masterVolume": 1.0,
    "exportedMixUrl": "s3://...",
    "createdAt": 1234567890,
    "updatedAt": 1234567890
  }
  ```
- [ ] Sauvegarder dans DynamoDB (nouvelle table ou intégré dans news ?)
- [ ] Charger un projet existant
- [ ] Associer le mix final à la news

#### Phase 6 : UX Avancées
- [ ] Bouton "Ajouter une piste" pour passer de 4 à 8 pistes
- [ ] Suppression de piste
- [ ] Réorganisation de pistes (drag & drop)
- [ ] Prévisualisation avant export
- [ ] Normalisation audio (loudness)
- [ ] Fade in/out par piste

### Bibliothèques Recommandées

1. **lamejs** : Encodage MP3 côté client
   ```html
   <script src="https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js"></script>
   ```

2. **WaveSurfer.js** (optionnel) : Visualisation waveform avancée
   ```html
   <script src="https://unpkg.com/wavesurfer.js@7"></script>
   ```

3. **Utiliser uniquement Web Audio API** : Pour un contrôle total et pas de dépendances lourdes

### Exemple de Code : Export MP3

```javascript
async exportToMP3(audioBuffer) {
    const mp3encoder = new lamejs.Mp3Encoder(2, audioBuffer.sampleRate, 320);
    const samples = this.interleaveChannels(audioBuffer);

    const mp3Data = [];
    const sampleBlockSize = 1152;

    for (let i = 0; i < samples.length; i += sampleBlockSize) {
        const leftChunk = samples[i];
        const rightChunk = samples[i + 1] || leftChunk;
        const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }
    }

    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
    }

    const blob = new Blob(mp3Data, { type: 'audio/mp3' });
    return blob;
}
```

### Contraintes & Considérations

1. **Taille des fichiers** : Les fichiers audio peuvent être lourds
   - Prévoir un indicateur de progression pour le chargement
   - Limiter à 4-8 pistes max pour éviter surcharge mémoire

2. **Performance** : Web Audio API peut être gourmand
   - Utiliser OfflineAudioContext pour l'export (pas en temps réel)
   - Optimiser les waveforms (ne pas dessiner tous les samples)

3. **Compatibilité** :
   - Tester sur Chrome, Firefox, Safari
   - Vérifier que AudioContext est bien supporté

4. **Stockage S3** :
   - Utiliser le même bucket que les autres audios
   - Préfixer les fichiers : `multitrack-mix-{newsId}-{timestamp}.mp3`

5. **UX** :
   - Feedback visuel pendant export (spinner, barre de progression)
   - Notification de succès/erreur
   - Auto-save périodique du projet

### Point d'Entrée Suggéré

1. Commence par créer `MultitrackEditor.js` avec les méthodes de base
2. Intègre la maquette HTML dans une nouvelle vue
3. Implémente la lecture audio simple (1 piste pour commencer)
4. Ajoute les contrôles de mixage
5. Implémente l'export MP3
6. Ajoute la sauvegarde DynamoDB
7. Polish l'UX

### Questions à Valider avec l'Utilisateur

- [ ] Faut-il créer une **table DynamoDB dédiée** pour les projets multipiste, ou les intégrer dans la table `news` ?
- [ ] Les pistes audio doivent-elles être **limitées à 4** ou permettre d'en ajouter plus ?
- [ ] L'éditeur doit-il supporter **l'enregistrement direct** depuis un micro (piste voix) ?
- [ ] Faut-il un **historique d'annulation** (undo/redo) ?
- [ ] Les projets multipiste sont-ils **privés par utilisateur** ou partagés entre utilisateurs ?

### Ressources Utiles

- [Web Audio API - MDN](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
- [lamejs sur GitHub](https://github.com/zhuker/lamejs)
- [Creating a simple multitrack audio editor](https://www.html5rocks.com/en/tutorials/webaudio/intro/)
- [OfflineAudioContext for rendering](https://developer.mozilla.org/en-US/docs/Web/API/OfflineAudioContext)

---

## Résumé pour Démarrer Rapidement

**Tu as :**
- ✅ Une maquette HTML/CSS complète et fonctionnelle
- ✅ L'architecture V3 existante bien documentée
- ✅ Les patterns de code pour les autres éditeurs (news, animations)

**Tu dois créer :**
1. `js/components/MultitrackEditor.js` - Classe principale
2. Nouvelle vue dans `v3.html`
3. Intégration dans `v3-app.js` (méthodes show/setup)
4. Route d'accès depuis l'éditeur de news

**Commence par :**
- Copier la maquette HTML dans le projet
- Créer la classe MultitrackEditor de base
- Implémenter le chargement et la lecture d'1 fichier audio
- Étendre progressivement aux 4 pistes

Bon courage ! 🎚️🎵
