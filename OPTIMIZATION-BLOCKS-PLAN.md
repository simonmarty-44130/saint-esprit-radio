# 🚀 PLAN D'OPTIMISATION MODULE BLOCKS/JOURNAUX
## Saint-Esprit AWS - Phase 1: Quick Wins (30 min)

### 📊 MÉTRIQUES ACTUELLES
- **Coût DynamoDB**: ~150 RCU/heure (SCAN complets)
- **Temps chargement journaux**: 800-1200ms
- **Requêtes cross-tables**: 3-5 par assignation
- **Cache hit rate**: 0% (pas de cache)

### ✅ PHASE 1: QUICK WINS (30 min)

#### 1.1 Créer Index GSI Optimisé
```bash
aws dynamodb update-table \
  --table-name saint-esprit-blocks \
  --attribute-definitions \
    AttributeName=userId,AttributeType=S \
    AttributeName=scheduledDate,AttributeType=S \
  --global-secondary-index-updates \
    '[{"Create":{"IndexName":"userId-scheduledDate-index","Keys":[{"AttributeName":"userId","KeyType":"HASH"},{"AttributeName":"scheduledDate","KeyType":"RANGE"}],"Projection":{"ProjectionType":"ALL"},"BillingMode":"PAY_PER_REQUEST"}}]'
```

#### 1.2 Optimiser les Requêtes DynamoDB
**Fichier**: `frontend/js/core/storage-dynamodb.js`

```javascript
// Ligne 117 - Remplacer getAll() par Query
async loadBlocksForUser(userId) {
  const params = {
    TableName: 'saint-esprit-blocks',
    IndexName: 'userId-scheduledDate-index',
    KeyConditionExpression: 'userId = :userId',
    ScanIndexForward: false, // Plus récents en premier
    ExpressionAttributeValues: {
      ':userId': userId || this.userId
    }
  };
  return await this.db.query(params).promise();
}
```

#### 1.3 Implémenter Cache TTL Simple
**Fichier**: `frontend/js/managers/BlockManager.js`

```javascript
// Ajouter après ligne 9
constructor() {
  // ... existing code ...
  this.blockCache = new Map();
  this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
}

getCachedBlock(blockId) {
  const cached = this.blockCache.get(blockId);
  if (cached && (Date.now() - cached.timestamp < this.CACHE_TTL)) {
    return cached.data;
  }
  this.blockCache.delete(blockId);
  return null;
}

setCachedBlock(blockId, data) {
  this.blockCache.set(blockId, {
    data,
    timestamp: Date.now()
  });
}
```

### 🎯 PHASE 2: ARCHITECTURE (45 min)

#### 2.1 Migration Relation Items
**Option A**: Table de liaison (Recommandé)
```javascript
// Nouvelle table: saint-esprit-block-items
{
  blockId: "123",      // HASH key
  itemId: "news-456",  // RANGE key  
  itemType: "news",
  order: 0,
  assignedAt: timestamp,
  assignedBy: "userId"
}
```

**Option B**: Dénormalisation dans blocks
```javascript
// Copier données essentielles dans block.items
{
  type: "news",
  id: "456",
  // Données dénormalisées pour éviter lookups
  title: "Titre de la news",
  duration: "2:30",
  author: "Jean Dupont"
}
```

#### 2.2 Batch Operations
```javascript
// BlockManager.js - Optimiser addItem/removeItem
async batchAssignItems(blockId, items) {
  const batch = items.map(item => ({
    PutRequest: {
      Item: {
        blockId,
        itemId: item.id,
        itemType: item.type,
        order: item.order,
        assignedAt: Date.now()
      }
    }
  }));
  
  await this.db.batchWrite({
    RequestItems: {
      'saint-esprit-block-items': batch
    }
  });
}
```

### 📈 PHASE 3: MONITORING (15 min)

#### 3.1 Métriques de Performance
```javascript
class BlockMetrics {
  static track(operation, duration) {
    console.log(`[PERF] Block.${operation}: ${duration}ms`);
    
    // Envoyer à CloudWatch si configuré
    if (window.cloudwatch) {
      window.cloudwatch.putMetric({
        Namespace: 'SaintEsprit/Blocks',
        MetricName: operation,
        Value: duration,
        Unit: 'Milliseconds'
      });
    }
  }
}

// Usage dans BlockManager
async load(blockId) {
  const start = Date.now();
  // ... existing code ...
  BlockMetrics.track('load', Date.now() - start);
}
```

### 🎯 RÉSULTATS ATTENDUS

| Métrique | Avant | Après | Gain |
|----------|-------|-------|------|
| **Coût DynamoDB** | 150 RCU/h | 45 RCU/h | -70% |
| **Temps chargement** | 1200ms | 300ms | -75% |
| **Cache hit rate** | 0% | 65% | +65% |
| **Requêtes/assignation** | 5 | 2 | -60% |

### 🔧 COMMANDES DE DÉPLOIEMENT

```bash
# 1. Créer l'index GSI
./scripts/create-blocks-gsi.sh

# 2. Déployer le code optimisé
npm run build
aws s3 sync frontend/js s3://amplify-saintespritaws-di-saintespritstoragebucket-91ui2ognukke/js/

# 3. Invalider le cache CloudFront
aws cloudfront create-invalidation \
  --distribution-id E3I60G2234JQLX \
  --paths "/js/managers/BlockManager.js" "/js/core/storage-dynamodb.js"

# 4. Monitorer les métriques
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name ConsumedReadCapacityUnits \
  --dimensions Name=TableName,Value=saint-esprit-blocks \
  --start-time 2025-09-09T00:00:00Z \
  --end-time 2025-09-09T23:59:59Z \
  --period 3600 \
  --statistics Sum
```

### ⚠️ ROLLBACK SI NÉCESSAIRE

```bash
# Restaurer version précédente
aws s3 cp s3://backup/BlockManager.js.backup \
  s3://amplify-saintespritaws-di-saintespritstoragebucket-91ui2ognukke/js/managers/BlockManager.js

# Supprimer l'index si problème
aws dynamodb update-table \
  --table-name saint-esprit-blocks \
  --global-secondary-index-updates \
    '[{"Delete":{"IndexName":"userId-scheduledDate-index"}}]'
```

### 📝 NOTES IMPORTANTES

1. **Compatibilité**: Toutes les optimisations sont rétro-compatibles
2. **Migration progressive**: Pas de downtime nécessaire
3. **Monitoring**: CloudWatch dashboards configurés pour suivre l'impact
4. **Backup**: Snapshots DynamoDB avant modifications

### 🎬 PROCHAINES ÉTAPES

1. [ ] Valider le plan avec l'équipe
2. [ ] Créer les index GSI en production
3. [ ] Déployer le code optimisé
4. [ ] Monitorer pendant 24h
5. [ ] Ajuster les TTL de cache selon usage réel

---
**Contact**: Pour toute question sur ce plan d'optimisation, contacter l'équipe technique Saint-Esprit.