/**
 * API Lambda pour coordination multi-utilisateurs
 * Endpoints simples pour état de sync
 */

const AWS = require('aws-sdk');
const s3 = new AWS.S3();

const BUCKET = 'saint-esprit-audio';
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
};

exports.handler = async (event) => {
    console.log('📡 Saint-Esprit Sync API:', event.httpMethod, event.path);
    
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: ''
        };
    }

    try {
        const path = event.path;
        const method = event.httpMethod;
        
        if (path === '/sync/status' && method === 'GET') {
            return await getSyncStatus();
        }
        
        if (path === '/sync/users' && method === 'GET') {
            return await getActiveUsers();
        }
        
        if (path === '/sync/notify' && method === 'POST') {
            return await notifyChange(JSON.parse(event.body));
        }
        
        return {
            statusCode: 404,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'Route not found' })
        };
        
    } catch (error) {
        console.error('❌ API Error:', error);
        return {
            statusCode: 500,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: error.message })
        };
    }
};

async function getSyncStatus() {
    try {
        const response = await s3.getObject({
            Bucket: BUCKET,
            Key: 'sync/global-state.json'
        }).promise();
        
        const syncState = JSON.parse(response.Body.toString());
        
        return {
            statusCode: 200,
            headers: CORS_HEADERS,
            body: JSON.stringify({
                ...syncState,
                serverTime: Date.now()
            })
        };
        
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            const initialState = {
                users: {},
                lastUpdate: Date.now()
            };
            
            return {
                statusCode: 200,
                headers: CORS_HEADERS,
                body: JSON.stringify({
                    ...initialState,
                    serverTime: Date.now()
                })
            };
        }
        throw error;
    }
}

async function getActiveUsers() {
    const syncState = await getCurrentSyncState();
    const now = Date.now();
    const activeThreshold = 5 * 60 * 1000; // 5 minutes
    
    const activeUsers = {};
    for (const [userId, userInfo] of Object.entries(syncState.users || {})) {
        if (now - userInfo.lastModified < activeThreshold) {
            activeUsers[userId] = {
                ...userInfo,
                isActive: true,
                minutesAgo: Math.floor((now - userInfo.lastModified) / 60000)
            };
        }
    }
    
    return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
            activeUsers,
            count: Object.keys(activeUsers).length,
            serverTime: now
        })
    };
}

async function notifyChange(data) {
    const { userId, version, action = 'update' } = data;
    
    if (!userId || !version) {
        return {
            statusCode: 400,
            headers: CORS_HEADERS,
            body: JSON.stringify({ error: 'userId and version required' })
        };
    }

    const syncState = await getCurrentSyncState();
    
    syncState.users[userId] = {
        lastModified: Date.now(),
        version: version,
        action: action,
        status: 'active'
    };
    syncState.lastUpdate = Date.now();
    
    await s3.putObject({
        Bucket: BUCKET,
        Key: 'sync/global-state.json',
        Body: JSON.stringify(syncState, null, 2),
        ContentType: 'application/json'
    }).promise();
    
    return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ success: true, timestamp: Date.now() })
    };
}

async function getCurrentSyncState() {
    try {
        const response = await s3.getObject({
            Bucket: BUCKET,
            Key: 'sync/global-state.json'
        }).promise();
        
        return JSON.parse(response.Body.toString());
    } catch (error) {
        if (error.code === 'NoSuchKey') {
            return {
                users: {},
                lastUpdate: Date.now()
            };
        }
        throw error;
    }
}