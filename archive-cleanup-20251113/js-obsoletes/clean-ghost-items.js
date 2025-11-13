// Script de nettoyage des items fantômes dans les blocks
// À exécuter dans la console du navigateur

function cleanGhostItems() {
    console.log('🧹 Démarrage du nettoyage des items fantômes...');
    
    if (!window.app?.blockManager) {
        console.error('❌ BlockManager non disponible');
        return;
    }
    
    const blocks = window.app.blockManager.blocks;
    const newsDb = window.app?.newsManager?.getDatabase() || [];
    const animationDb = window.app?.animationManager?.getDatabase() || [];
    
    let totalCleaned = 0;
    let blocksModified = 0;
    
    blocks.forEach(block => {
        if (!block.items || block.items.length === 0) return;
        
        const beforeCount = block.items.length;
        console.log(`\n📦 Block "${block.title || block.id}":`);
        console.log(`  Items avant: ${beforeCount}`);
        
        // Filtrer et nettoyer les items
        const cleanedItems = [];
        const removedItems = [];
        
        block.items.forEach(item => {
            let keep = false;
            let itemInfo = { type: item.type, id: item.id };
            
            if (item.type === 'news') {
                const news = newsDb.find(n => String(n.id) === String(item.id));
                if (news) {
                    keep = true;
                    itemInfo.title = news.title;
                } else {
                    itemInfo.status = '❌ News introuvable';
                }
            } else if (item.type === 'animation') {
                const animation = animationDb.find(a => String(a.id) === String(item.id));
                if (animation) {
                    keep = true;
                    itemInfo.title = animation.title;
                } else {
                    itemInfo.status = '❌ Animation introuvable';
                }
            } else {
                itemInfo.status = '❌ Type inconnu';
            }
            
            if (keep) {
                cleanedItems.push(item);
            } else {
                removedItems.push(itemInfo);
                console.log(`  ❌ Suppression: ${item.type} #${item.id} ${itemInfo.status}`);
            }
        });
        
        if (cleanedItems.length !== beforeCount) {
            block.items = cleanedItems;
            const removed = beforeCount - cleanedItems.length;
            totalCleaned += removed;
            blocksModified++;
            console.log(`  ✅ Nettoyé ${removed} item(s) fantôme(s)`);
            console.log(`  Items après: ${cleanedItems.length}`);
        } else {
            console.log(`  ✅ Aucun item fantôme`);
        }
    });
    
    console.log('\n📊 Résumé du nettoyage:');
    console.log(`  Total items supprimés: ${totalCleaned}`);
    console.log(`  Blocks modifiés: ${blocksModified}`);
    
    if (totalCleaned > 0) {
        // Sauvegarder les changements
        window.app.blockManager.save();
        console.log('💾 Changements sauvegardés');
        
        // Rafraîchir l'affichage
        if (window.app.blockManager.currentBlockId) {
            window.app.blockManager.renderBlockItems();
        }
        window.app.blockManager.render();
        console.log('🔄 Interface mise à jour');
    }
    
    console.log('\n✅ Nettoyage terminé!');
    return { totalCleaned, blocksModified };
}

// Fonction pour corriger les IDs inconsistants
function fixInconsistentIds() {
    console.log('🔧 Correction des IDs inconsistants...');
    
    const blocks = window.app.blockManager.blocks;
    let fixed = 0;
    
    blocks.forEach(block => {
        if (!block.items) return;
        
        block.items.forEach(item => {
            // Convertir tous les IDs en string pour cohérence
            const oldId = item.id;
            item.id = String(item.id);
            if (oldId !== item.id) {
                fixed++;
                console.log(`  Converti ID ${typeof oldId} "${oldId}" -> string "${item.id}"`);
            }
        });
    });
    
    if (fixed > 0) {
        window.app.blockManager.save();
        console.log(`✅ ${fixed} IDs corrigés et sauvegardés`);
    } else {
        console.log('✅ Tous les IDs sont déjà cohérents');
    }
    
    return fixed;
}

// Fonction pour diagnostiquer les problèmes
function diagnoseBlocks() {
    console.log('🔍 Diagnostic des blocks...\n');
    
    const blocks = window.app.blockManager.blocks;
    const newsDb = window.app?.newsManager?.getDatabase() || [];
    const animationDb = window.app?.animationManager?.getDatabase() || [];
    
    blocks.forEach(block => {
        if (!block.items || block.items.length === 0) return;
        
        console.log(`📦 Block "${block.title || block.id}":`);
        console.log(`  ID: ${block.id}`);
        console.log(`  Items: ${block.items.length}`);
        
        block.items.forEach((item, index) => {
            let status = '❓';
            let title = 'Inconnu';
            
            if (item.type === 'news') {
                const news = newsDb.find(n => String(n.id) === String(item.id));
                if (news) {
                    status = '✅';
                    title = news.title;
                } else {
                    status = '❌';
                }
            } else if (item.type === 'animation') {
                const animation = animationDb.find(a => String(a.id) === String(item.id));
                if (animation) {
                    status = '✅';
                    title = animation.title;
                } else {
                    status = '❌';
                }
            }
            
            console.log(`    [${index}] ${status} ${item.type} #${item.id} (${typeof item.id}) - "${title}"`);
        });
    });
}

// Exécution automatique des corrections
console.log('🚀 Script de nettoyage chargé!');
console.log('Commandes disponibles:');
console.log('  cleanGhostItems() - Nettoyer les items fantômes');
console.log('  fixInconsistentIds() - Corriger les IDs inconsistants');
console.log('  diagnoseBlocks() - Diagnostiquer les problèmes');
console.log('\nExécution automatique dans 2 secondes...');

setTimeout(() => {
    console.log('\n========== DIAGNOSTIC ==========');
    diagnoseBlocks();
    
    console.log('\n========== CORRECTION DES IDS ==========');
    fixInconsistentIds();
    
    console.log('\n========== NETTOYAGE ==========');
    cleanGhostItems();
    
    console.log('\n✅ Toutes les opérations sont terminées!');
}, 2000);