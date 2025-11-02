#!/usr/bin/env node

const AWS = require('aws-sdk');

AWS.config.update({ region: 'eu-west-3' });
const dynamodb = new AWS.DynamoDB.DocumentClient();

async function cleanupFlashNews() {
    try {
        // Scan pour toutes les news Flash avec createdAt != 0
        const scanParams = {
            TableName: 'saint-esprit-news',
            FilterExpression: 'begins_with(id, :prefix) AND createdAt <> :zero',
            ExpressionAttributeValues: {
                ':prefix': 'flash-',
                ':zero': 0
            }
        };
        
        const result = await dynamodb.scan(scanParams).promise();
        
        if (!result.Items || result.Items.length === 0) {
            console.log('✅ Aucune news Flash en doublon trouvée');
            return;
        }
        
        console.log(`🗑️ ${result.Items.length} news Flash en doublon trouvées à supprimer...`);
        
        // Supprimer chaque news
        for (const item of result.Items) {
            console.log(`  Suppression: ${item.id} (créée: ${new Date(item.createdAt).toISOString()})`);
            
            const deleteParams = {
                TableName: 'saint-esprit-news',
                Key: {
                    id: item.id,
                    createdAt: item.createdAt
                }
            };
            
            await dynamodb.delete(deleteParams).promise();
        }
        
        console.log('✅ Nettoyage terminé !');
        
        // Vérifier les news permanentes
        console.log('\n📋 Vérification des news permanentes (createdAt = 0):');
        const permanentTypes = ['flash-info-natio-permanent', 'flash-info-titres-permanent', 'flash-info-sport-permanent'];
        
        for (const id of permanentTypes) {
            const getParams = {
                TableName: 'saint-esprit-news',
                Key: {
                    id: id,
                    createdAt: 0
                }
            };
            
            try {
                const result = await dynamodb.get(getParams).promise();
                if (result.Item) {
                    console.log(`  ✅ ${id} - Dernière MàJ: ${new Date(result.Item.updatedAt).toLocaleString()}`);
                } else {
                    console.log(`  ❌ ${id} - N'existe pas encore`);
                }
            } catch (error) {
                console.log(`  ❌ ${id} - Erreur: ${error.message}`);
            }
        }
        
    } catch (error) {
        console.error('❌ Erreur:', error);
        process.exit(1);
    }
}

cleanupFlashNews();