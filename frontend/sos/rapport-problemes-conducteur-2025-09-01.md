# Rapport de problèmes - Module Conducteur
## Date : 1er septembre 2025

### Contexte
Problèmes rencontrés lors de l'ajout de blocs (journaux) avec leurs enfants (news/animations) au conducteur.

---

## PROBLÈME 1 : Les enfants des blocs ne sont pas ajoutés au conducteur
**Status : EN COURS DE RÉSOLUTION**

### Symptômes
- Quand on ajoute un journal au conducteur, seul le bloc parent apparaît
- Les news affectées au journal ne sont pas visibles dans le conducteur
- Le log montre `hasChildren: 0` même quand le bloc contient des items
- Seulement 1 segment est sauvegardé au lieu de 2+ (parent + enfants)

### Diagnostic
1. **Flux d'ajout depuis app.js (lignes 1860-1877)** :
   - Le code DEVRAIT ajouter les enfants un par un après le bloc parent
   - Les logs montrent que ce code ne s'exécute pas ou ne trouve pas les items

2. **Problème identifié** :
   - `block.items` existe et contient 1 item (confirmé par les logs)
   - Mais les enfants ne sont pas ajoutés au conducteur
   - Possible problème de type/format des IDs (string vs number)

### Solutions tentées
1. ✅ Ajout de logs détaillés pour tracer l'exécution
2. ✅ Correction des comparaisons d'IDs (string vs number)
3. ⏳ En attente de test avec les nouveaux logs

---

## PROBLÈME 2 : Sauvegarde bloquée par protection anti-spam
**Status : PARTIELLEMENT RÉSOLU**

### Symptômes
- Message "⏳ Sauvegarde ignorée (trop récente)" après ajout d'enfants
- Les segments enfants ne sont pas persistés car la sauvegarde est bloquée
- Protection de 10 secondes trop longue pour les opérations rapides

### Solutions appliquées
1. ✅ Ajout d'une sauvegarde différée automatique après 2 secondes
2. ✅ Méthode `forceSave()` pour contourner la protection si nécessaire
3. ✅ Les sauvegardes bloquées sont maintenant réessayées automatiquement

---

## PROBLÈME 3 : Accumulation de conducteurs multiples dans DynamoDB
**Status : RÉSOLU**

### Symptômes
- 5 conducteurs trouvés au lieu d'1 seul
- Sélection d'un journal importait tous les conducteurs

### Solution appliquée
✅ Suppression systématique des anciens conducteurs avant sauvegarde du nouveau
✅ Fonction `cleanupOldConductors()` pour nettoyer manuellement si besoin

---

## PROBLÈME 4 : Lecture audio non fonctionnelle
**Status : RÉSOLU**

### Symptômes
- Erreur "NotSupportedError: Failed to load because no supported source was found"
- URL pointe vers S3 mais fichiers non trouvés (404)

### Cause
- Les fichiers audio n'ont jamais été uploadés sur S3
- Les URLs pointent vers des fichiers inexistants

### Solution appliquée
✅ AudioManager modifié pour :
- Détecter et utiliser les data URLs (ancien format) si présents
- Construire l'URL S3 si pas de données locales
- Support des deux formats (data URL et S3)

---

## PROBLÈME 5 : Cache CloudFront empêche les mises à jour
**Status : CONTOURNÉ**

### Symptômes
- Les modifications déployées ne sont pas visibles immédiatement
- L'ancien code continue de s'exécuter malgré les déploiements

### Solution
✅ Invalidations CloudFront systématiques après chaque déploiement
✅ Recommandation : Ctrl+Shift+R pour forcer le rafraîchissement

---

## Actions en cours
1. **Debug des enfants de blocs** :
   - Logs détaillés ajoutés dans app.js (lignes 1860-1890)
   - Attente des résultats des logs pour identifier le blocage exact
   
2. **Prochaines étapes** :
   - Analyser les logs pour voir où les items sont perdus
   - Vérifier le format exact de `block.items`
   - Possiblement revoir tout le flux d'ajout de segments

---

## Recommandations

### Court terme
1. Exécuter avec les nouveaux logs pour identifier le problème exact
2. Vérifier la console pour les messages commençant par 🔍, 🎯, 📰
3. Partager les logs complets lors de l'ajout d'un journal au conducteur

### Moyen terme
1. Simplifier le flux d'ajout de segments (un seul point d'entrée)
2. Harmoniser les types d'IDs (tout en string)
3. Améliorer la gestion du cache côté client

### Long terme
1. Migration complète des fichiers audio vers S3
2. Refactoring du module conducteur pour plus de robustesse
3. Tests automatisés pour éviter les régressions

---

## Fichiers modifiés aujourd'hui
- `/js/app.js` : Logs, sauvegarde différée, gestion conducteurs
- `/js/managers/ConductorManager.js` : Logs, gestion enfants
- `/js/managers/BlockManager.js` : Logs export conducteur
- `/js/managers/ContentManager.js` : Checkboxes journaux
- `/js/managers/AudioManager.js` : Support data URLs + S3
- `/js/core/storage-dynamodb.js` : Nettoyage conducteurs, logs
- `/js/utils/audio-url-fixer.js` : Correction URLs audio

---

## Commandes utiles

### Nettoyage manuel des conducteurs dupliqués
```javascript
app.cleanupOldConductors()
```

### Force la sauvegarde immédiate
```javascript
app.forceSave()
```

### Vérification des blocs
```javascript
app.blockManager.getBlocks()
```

### Vérification des segments du conducteur
```javascript
app.conductorManager.getSegments()
```