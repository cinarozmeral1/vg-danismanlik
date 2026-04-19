const ZOOM_ACCOUNT_ID = (process.env.ZOOM_ACCOUNT_ID || '').trim();
const ZOOM_CLIENT_ID = (process.env.ZOOM_CLIENT_ID || '').trim();
const ZOOM_CLIENT_SECRET = (process.env.ZOOM_CLIENT_SECRET || '').trim();

let cachedToken = null;
let tokenExpiresAt = 0;

async function getAccessToken() {
    if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
        return cachedToken;
    }

    if (!ZOOM_ACCOUNT_ID || !ZOOM_CLIENT_ID || !ZOOM_CLIENT_SECRET) {
        throw new Error('Zoom API credentials not configured');
    }

    const credentials = Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString('base64');

    const response = await fetch('https://zoom.us/oauth/token', {
        method: 'POST',
        headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: `grant_type=account_credentials&account_id=${ZOOM_ACCOUNT_ID}`
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Zoom OAuth failed: ${response.status} - ${error}`);
    }

    const data = await response.json();
    cachedToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in * 1000);

    return cachedToken;
}

async function createZoomMeeting({ topic, startTime, duration = 30, agenda = '' }) {
    const token = await getAccessToken();

    const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            topic,
            type: 2, // scheduled
            start_time: startTime, // ISO 8601 UTC
            duration,
            timezone: 'UTC',
            agenda,
            settings: {
                host_video: false,
                participant_video: false,
                join_before_host: true,
                waiting_room: true,
                auto_recording: 'none',
                meeting_authentication: false
            }
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Zoom meeting creation failed: ${response.status} - ${error}`);
    }

    const meeting = await response.json();

    return {
        join_url: meeting.join_url,
        meeting_id: meeting.id,
        password: meeting.password || ''
    };
}

async function updateZoomMeeting(meetingId, { topic, startTime, duration = 30, agenda = '' }) {
    const token = await getAccessToken();

    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
        method: 'PATCH',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            topic,
            start_time: startTime,
            duration,
            timezone: 'UTC',
            agenda,
            settings: {
                host_video: false,
                participant_video: false,
                join_before_host: true,
                waiting_room: true
            }
        })
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Zoom meeting update failed: ${response.status} - ${error}`);
    }

    return true;
}

async function deleteZoomMeeting(meetingId) {
    const token = await getAccessToken();

    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok && response.status !== 404) {
        const error = await response.text();
        throw new Error(`Zoom meeting delete failed: ${response.status} - ${error}`);
    }

    return true;
}

async function getMeetingDetails(meetingId) {
    const token = await getAccessToken();

    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
        if (response.status === 404) return null;
        const error = await response.text();
        throw new Error(`Zoom meeting details failed: ${response.status} - ${error}`);
    }

    return await response.json();
}

async function getPastMeetingDetails(meetingId) {
    const token = await getAccessToken();

    const response = await fetch(`https://api.zoom.us/v2/past_meetings/${meetingId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (!response.ok) {
        if (response.status === 404) return null;
        const error = await response.text();
        throw new Error(`Zoom past meeting details failed: ${response.status} - ${error}`);
    }

    return await response.json();
}

function isConfigured() {
    return !!(ZOOM_ACCOUNT_ID && ZOOM_CLIENT_ID && ZOOM_CLIENT_SECRET);
}

module.exports = { createZoomMeeting, updateZoomMeeting, deleteZoomMeeting, getMeetingDetails, getPastMeetingDetails, isConfigured };
