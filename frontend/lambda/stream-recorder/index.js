const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const eventbridge = new AWS.EventBridge();

const BUCKET = 'amplify-saintespritaws-di-saintespritstoragebucket-91ui2ognukke';
const RECORDINGS_PREFIX = 'public/recordings/';

exports.handler = async (event) => {
    console.log('StreamRecorder Lambda invoked:', JSON.stringify(event));
    
    const headers = {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    };
    
    // Handle OPTIONS request for CORS
    if (event.requestContext?.http?.method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }
    
    try {
        let body;
        if (typeof event.body === 'string') {
            body = JSON.parse(event.body);
        } else {
            body = event.body || {};
        }
        
        const action = body.action || event.action;
        const recordingId = body.recordingId || event.recordingId;
        
        console.log(`Processing action: ${action} for recording: ${recordingId}`);
        
        switch (action) {
            case 'start':
                return await startRecording(recordingId);
                
            case 'stop':
                return await stopRecording(recordingId);
                
            case 'status':
                return await getRecordingStatus(recordingId);
                
            case 'check':
                return await checkRecordingStatus(recordingId);
                
            case 'scheduled':
                // Called by EventBridge for scheduled recordings
                return await handleScheduledRecording(event);
                
            default:
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ 
                        error: 'Invalid action',
                        message: `Unknown action: ${action}`
                    })
                };
        }
    } catch (error) {
        console.error('Lambda error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Internal server error',
                message: error.message 
            })
        };
    }
};

async function startRecording(recordingId) {
    console.log(`Starting recording: ${recordingId}`);
    
    // Update status in schedule.json
    const scheduleKey = `${RECORDINGS_PREFIX}schedule.json`;
    
    try {
        const scheduleData = await s3.getObject({
            Bucket: BUCKET,
            Key: scheduleKey
        }).promise();
        
        const schedule = JSON.parse(scheduleData.Body.toString());
        const recording = schedule.recordings.find(r => r.id === recordingId);
        
        if (recording) {
            recording.status = 'recording';
            recording.startedAt = new Date().toISOString();
            
            await s3.putObject({
                Bucket: BUCKET,
                Key: scheduleKey,
                Body: JSON.stringify(schedule, null, 2),
                ContentType: 'application/json'
            }).promise();
            
            // TODO: Actually start the stream recording process
            // This would involve starting an EC2 instance or ECS task
            // that runs ffmpeg to record the stream
            
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: true,
                    status: 'recording',
                    message: `Recording ${recordingId} started`
                })
            };
        }
        
        return {
            statusCode: 404,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Recording not found',
                recordingId
            })
        };
    } catch (error) {
        console.error('Error starting recording:', error);
        throw error;
    }
}

async function stopRecording(recordingId) {
    console.log(`Stopping recording: ${recordingId}`);
    
    // Update status in schedule.json
    const scheduleKey = `${RECORDINGS_PREFIX}schedule.json`;
    
    try {
        const scheduleData = await s3.getObject({
            Bucket: BUCKET,
            Key: scheduleKey
        }).promise();
        
        const schedule = JSON.parse(scheduleData.Body.toString());
        const recording = schedule.recordings.find(r => r.id === recordingId);
        
        if (recording) {
            recording.status = 'completed';
            recording.completedAt = new Date().toISOString();
            
            // Calculate duration if we have start time
            if (recording.startedAt) {
                const duration = Date.now() - new Date(recording.startedAt).getTime();
                recording.duration = Math.floor(duration / 1000); // in seconds
            }
            
            await s3.putObject({
                Bucket: BUCKET,
                Key: scheduleKey,
                Body: JSON.stringify(schedule, null, 2),
                ContentType: 'application/json'
            }).promise();
            
            // TODO: Actually stop the stream recording process
            
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    success: true,
                    status: 'completed',
                    message: `Recording ${recordingId} stopped`
                })
            };
        }
        
        return {
            statusCode: 404,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Recording not found',
                recordingId
            })
        };
    } catch (error) {
        console.error('Error stopping recording:', error);
        throw error;
    }
}

async function getRecordingStatus(recordingId) {
    console.log(`Getting status for recording: ${recordingId}`);
    
    const scheduleKey = `${RECORDINGS_PREFIX}schedule.json`;
    
    try {
        const scheduleData = await s3.getObject({
            Bucket: BUCKET,
            Key: scheduleKey
        }).promise();
        
        const schedule = JSON.parse(scheduleData.Body.toString());
        const recording = schedule.recordings.find(r => r.id === recordingId);
        
        if (recording) {
            return {
                statusCode: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                body: JSON.stringify({
                    id: recordingId,
                    status: recording.status || 'scheduled',
                    startedAt: recording.startedAt,
                    completedAt: recording.completedAt,
                    duration: recording.duration,
                    s3Key: recording.s3Key
                })
            };
        }
        
        return {
            statusCode: 404,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Recording not found',
                recordingId
            })
        };
    } catch (error) {
        console.error('Error getting recording status:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                error: 'Failed to get status',
                message: error.message
            })
        };
    }
}

async function checkRecordingStatus(recordingId) {
    // Similar to getRecordingStatus but with simplified response
    const result = await getRecordingStatus(recordingId);
    
    if (result.statusCode === 200) {
        const data = JSON.parse(result.body);
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({
                status: data.status || 'scheduled'
            })
        };
    }
    
    return result;
}

async function handleScheduledRecording(event) {
    console.log('Handling scheduled recording from EventBridge:', event);
    
    // Extract recording ID from the event
    const recordingId = event.detail?.recordingId || event.recordingId;
    
    if (!recordingId) {
        console.error('No recording ID in event');
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'No recording ID provided' })
        };
    }
    
    // Start the recording
    return await startRecording(recordingId);
}