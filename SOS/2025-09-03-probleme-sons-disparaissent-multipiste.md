# 🔍 RAPPORT : Disparition des sons après utilisation du Multipiste

## 🐛 PROBLÈME IDENTIFIÉ

### Symptômes
- Clara crée une news avec des sons → ✅ Fonctionne
- Morgane utilise le multipiste puis sauvegarde → ❌ Les sons disparaissent
- Seule Morgane utilise le multipiste

### ⚠️ CAUSE PRINCIPALE TROUVÉE

**Le MultitrackEditor ÉCRASE les données de la news sans préserver le champ `sounds`**

## 📝 ANALYSE DÉTAILLÉE

### 1. Comment ContentManager sauvegarde les sons

```javascript
// ContentManager.js - ligne 741
if (!item.sounds) item.sounds = [];

// Ajoute un son
item.sounds.push({
    id: soundId,
    name: sound.name,
    duration: sound.duration,
    type: sound.type,
    audioFileId: sound.audioFileId,
    url: sound.url
});
```

### 2. Ce que fait le MultitrackEditor lors de l'export

```javascript
// MultitrackEditor.js - ligne 3011-3022
reader.onloadend = () => {
    newsItem.audioData = reader.result;       // ✅ Sauvegarde l'audio mixé
    newsItem.content = this.newsText;         // ✅ Sauvegarde le texte
    newsItem.hasAudio = true;                 // ✅ Flag audio
    newsItem.lastModified = new Date();       // ✅ Date modif
    newsItem.actualDuration = `${minutes}:${seconds}`; // ✅ Durée
    
    // ❌ MAIS NE PRÉSERVE PAS newsItem.sounds !!!!
    
    window.app.newsManager.setDatabase(database);
};
```

### 3. Le problème

Le MultitrackEditor remplace ces champs :
- `audioData` ✅
- `content` ✅ 
- `hasAudio` ✅
- `actualDuration` ✅
- `lastModified` ✅

**MAIS IL OUBLIE DE PRÉSERVER :**
- `sounds` ❌ (tableau des sons individuels)

## 🎯 CONSÉQUENCE

Quand Morgane :
1. Crée une news
2. Ajoute des sons (le tableau `sounds` est rempli)
3. Ouvre le multipiste
4. Exporte vers la news
5. **Le multipiste écrase la news SANS conserver le tableau `sounds`**
6. Les sons disparaissent !

## ✅ SOLUTION PROPOSÉE

Modifier `MultitrackEditor.js` ligne 3011 pour préserver les sons existants :

```javascript
reader.onloadend = () => {
    // PRÉSERVER LES SONS EXISTANTS
    const existingSounds = newsItem.sounds || [];
    
    newsItem.audioData = reader.result;
    newsItem.content = this.newsText;
    newsItem.hasAudio = true;
    newsItem.lastModified = new Date().toISOString();
    newsItem.actualDuration = `${minutes}:${seconds}`;
    
    // RESTAURER LES SONS
    newsItem.sounds = existingSounds;
    
    window.app.newsManager.setDatabase(database);
};
```

## 📊 IMPACT

- **Clara** : N'utilise pas le multipiste → Pas d'impact → ✅ Ses sons restent
- **Morgane** : Utilise le multipiste → Impact → ❌ Ses sons disparaissent
- **Autres** : Si n'utilisent pas le multipiste → Pas d'impact

## 🔧 FICHIER À MODIFIER

**`/frontend/js/components/MultitrackEditor.js`**
- Ligne 3011-3022
- Fonction : `exportToNews()`
- Action : Préserver le champ `sounds` lors de l'export

## ⚠️ RECOMMANDATION IMMÉDIATE

**NE PAS UTILISER LE MULTIPISTE** tant que ce bug n'est pas corrigé, ou alors :
1. Sauvegarder les sons APRÈS l'export multipiste
2. Ou noter les sons à part et les rajouter après

## 🚀 CORRECTION URGENTE REQUISE

Ce bug fait perdre du travail à Morgane à chaque utilisation du multipiste. La correction est simple : il suffit de préserver le tableau `sounds` lors de l'export.