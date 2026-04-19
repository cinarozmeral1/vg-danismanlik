const { createDAVClient } = require('tsdav');

const ICLOUD_EMAIL = (process.env.ICLOUD_EMAIL || 'cinar.ozmeral04@gmail.com').trim();
const ICLOUD_APP_PASSWORD = (process.env.ICLOUD_APP_PASSWORD || '').trim().replace(/\\n/g, '').replace(/\n/g, '');
const TARGET_CALENDAR_NAME = 'VG Danışmanlık';
const CZECH_TZ = 'Europe/Prague';
const TURKEY_TZ = 'Europe/Istanbul';

async function getClient() {
    const client = await createDAVClient({
        serverUrl: 'https://caldav.icloud.com',
        credentials: {
            username: ICLOUD_EMAIL,
            password: ICLOUD_APP_PASSWORD
        },
        authMethod: 'Basic',
        defaultAccountType: 'caldav'
    });
    return client;
}

async function getTargetCalendarUrl(client) {
    const calendars = await client.fetchCalendars();
    const target = calendars.find(c =>
        c.displayName && c.displayName.toLowerCase().includes('vg')
    );
    if (!target) {
        console.error('Available calendars:', calendars.map(c => c.displayName));
        throw new Error(`Calendar "${TARGET_CALENDAR_NAME}" not found. Available: ${calendars.map(c => c.displayName).join(', ')}`);
    }
    console.log('✅ iCloud Calendar found:', target.displayName, target.url);
    return target.url;
}

function parseICSDate(dtStr) {
    if (!dtStr) return null;
    const clean = dtStr.replace(/^(DTSTART|DTEND)[^:]*:/i, '');
    if (clean.length === 8) {
        return new Date(
            parseInt(clean.substring(0, 4)),
            parseInt(clean.substring(4, 6)) - 1,
            parseInt(clean.substring(6, 8))
        );
    }
    const y = parseInt(clean.substring(0, 4));
    const m = parseInt(clean.substring(4, 6)) - 1;
    const d = parseInt(clean.substring(6, 8));
    const h = parseInt(clean.substring(9, 11));
    const min = parseInt(clean.substring(11, 13));
    const s = parseInt(clean.substring(13, 15));
    if (clean.endsWith('Z')) {
        return new Date(Date.UTC(y, m, d, h, min, s));
    }
    return new Date(y, m, d, h, min, s);
}

function extractICSField(icsData, field) {
    const regex = new RegExp(`${field}[^:]*:(.+)`, 'i');
    const match = icsData.match(regex);
    return match ? match[1].trim() : null;
}

async function fetchEventsFromAllCalendars(startDate, endDate) {
    try {
        const client = await getClient();
        const calendars = await client.fetchCalendars();
        const allEvents = [];

        for (const cal of calendars) {
            if (!cal.url) continue;
            try {
                const calendarObjects = await client.fetchCalendarObjects({
                    calendar: { url: cal.url },
                    timeRange: {
                        start: startDate.toISOString(),
                        end: endDate.toISOString()
                    }
                });
                for (const obj of calendarObjects) {
                    if (!obj.data) continue;
                    const summary = extractICSField(obj.data, 'SUMMARY') || 'Busy';
                    const dtstart = extractICSField(obj.data, 'DTSTART');
                    const dtend = extractICSField(obj.data, 'DTEND');
                    if (dtstart) {
                        allEvents.push({
                            summary,
                            start: parseICSDate(dtstart),
                            end: dtend ? parseICSDate(dtend) : new Date(parseICSDate(dtstart).getTime() + 60 * 60 * 1000),
                            url: obj.url,
                            calendar: cal.displayName || 'Unknown'
                        });
                    }
                }
            } catch (calErr) {
                console.error('Error fetching from calendar', cal.displayName, ':', calErr.message);
            }
        }

        console.log(`Fetched ${allEvents.length} events from ${calendars.length} calendars`);
        return allEvents;
    } catch (error) {
        console.error('CalDAV fetchAllEvents error:', error.message);
        return [];
    }
}

async function fetchEvents(startDate, endDate) {
    return fetchEventsFromAllCalendars(startDate, endDate);
}

function generateUID() {
    const chars = 'abcdef0123456789';
    const segments = [8, 4, 4, 4, 12];
    return segments.map(len => {
        let s = '';
        for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
        return s;
    }).join('-');
}

function formatICSDate(d) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function buildICSString({ uid, title, description, startDate, endDate, location, attendeeEmail, attendeeName, organizerEmail }) {
    const now = new Date();
    const lines = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//VG Danismanlik//Appointment System//TR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${formatICSDate(now)}`,
        `DTSTART:${formatICSDate(startDate)}`,
        `DTEND:${formatICSDate(endDate)}`,
        `SUMMARY:${title}`,
    ];

    if (description) {
        const escaped = description.replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
        lines.push(`DESCRIPTION:${escaped}`);
    }
    if (location) lines.push(`LOCATION:${location}`);
    if (organizerEmail) lines.push(`ORGANIZER;CN=VG Danismanlik:mailto:${organizerEmail}`);
    if (attendeeEmail) {
        lines.push(`ATTENDEE;CN=${attendeeName || attendeeEmail};RSVP=TRUE:mailto:${attendeeEmail}`);
    }

    lines.push('BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', `DESCRIPTION:Randevu hatirlatmasi`, 'END:VALARM');
    lines.push('END:VEVENT', 'END:VCALENDAR');

    return lines.join('\r\n');
}

async function createEvent({ title, description, startDate, endDate, location, attendeeEmail, attendeeName }) {
    const client = await getClient();
    const calendarUrl = await getTargetCalendarUrl(client);
    const uid = generateUID();

    const icsData = buildICSString({
        uid,
        title,
        description: description || '',
        startDate,
        endDate,
        location,
        attendeeEmail,
        attendeeName,
        organizerEmail: 'info@vgdanismanlik.com'
    });

    console.log('📅 Creating CalDAV event:', { title, start: startDate.toISOString(), end: endDate.toISOString(), calendarUrl });

    await client.createCalendarObject({
        calendar: { url: calendarUrl },
        filename: `${uid}.ics`,
        iCalString: icsData
    });

    console.log('✅ iCloud event created successfully:', title);
    return uid;
}

async function updateEvent(uid, { title, description, startDate, endDate, location, attendeeEmail, attendeeName }) {
    const client = await getClient();
    const calendarUrl = await getTargetCalendarUrl(client);

    const searchStart = new Date(startDate);
    searchStart.setDate(searchStart.getDate() - 2);
    const searchEnd = new Date(endDate);
    searchEnd.setDate(searchEnd.getDate() + 2);

    const calendarObjects = await client.fetchCalendarObjects({
        calendar: { url: calendarUrl },
        timeRange: { start: searchStart.toISOString(), end: searchEnd.toISOString() }
    });
    const existing = calendarObjects.find(obj => obj.data && obj.data.includes(uid));

    const icsData = buildICSString({
        uid, title, description: description || '', startDate, endDate,
        location, attendeeEmail, attendeeName, organizerEmail: 'info@vgdanismanlik.com'
    });

    if (existing) {
        await client.updateCalendarObject({
            calendarObject: { url: existing.url, data: icsData, etag: existing.etag }
        });
        console.log('Updated CalDAV event:', uid);
    } else {
        await client.createCalendarObject({
            calendar: { url: calendarUrl },
            filename: `${uid}.ics`,
            iCalString: icsData
        });
        console.log('Created new CalDAV event (old not found):', uid);
    }
    return uid;
}

async function deleteEvent(uid) {
    try {
        const client = await getClient();
        const calendarUrl = await getTargetCalendarUrl(client);

        const now = new Date();
        const searchStart = new Date(now);
        searchStart.setMonth(searchStart.getMonth() - 3);
        const searchEnd = new Date(now);
        searchEnd.setMonth(searchEnd.getMonth() + 6);

        const calendarObjects = await client.fetchCalendarObjects({
            calendar: { url: calendarUrl },
            timeRange: { start: searchStart.toISOString(), end: searchEnd.toISOString() }
        });
        const existing = calendarObjects.find(obj => obj.data && obj.data.includes(uid));

        if (existing) {
            await client.deleteCalendarObject({ calendarObject: { url: existing.url, etag: existing.etag } });
            console.log('✅ Deleted CalDAV event:', uid);
            return true;
        }
        console.log('ℹ️ CalDAV event not found for deletion:', uid);
        return false;
    } catch (error) {
        console.error('❌ CalDAV deleteEvent error:', error.message);
        return false;
    }
}

function getAvailableSlots(date, existingEvents) {
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 1 || dayOfWeek === 4) return [];

    const SLOT_START_CZECH_HOUR = 18;
    const turkeyOffsetHours = Math.round(getTurkeyOffsetFromCzech(date) / (60 * 60 * 1000));
    const maxTurkeyHour = 23;
    const maxCzechHour = maxTurkeyHour - turkeyOffsetHours;
    const czechUTCOffset = getCzechUTCOffsetHours(date);

    const MEETING_DURATION_MS = 30 * 60 * 1000;
    const SLOT_BLOCK_MS = 60 * 60 * 1000; // 30 min meeting + 30 min buffer
    const SLOT_STEP_MINS = 60;
    const slots = [];
    const startMinutes = SLOT_START_CZECH_HOUR * 60;
    const endMinutes = maxCzechHour * 60;

    const y = date.getUTCFullYear();
    const mo = date.getUTCMonth();
    const d = date.getUTCDate();

    for (let mins = startMinutes; mins + 30 <= endMinutes; mins += SLOT_STEP_MINS) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;

        const slotStartUTC = new Date(Date.UTC(y, mo, d, h - czechUTCOffset, m, 0, 0));
        const slotEndUTC = new Date(slotStartUTC.getTime() + MEETING_DURATION_MS);
        const blockEndUTC = new Date(slotStartUTC.getTime() + SLOT_BLOCK_MS);

        const isConflict = existingEvents.some(event => {
            return event.start < blockEndUTC && event.end > slotStartUTC;
        });

        if (!isConflict) {
            const trHour = h + turkeyOffsetHours;
            const czTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            const trTime = `${String(trHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
            slots.push({
                czechTime: czTime,
                turkeyTime: trTime,
                startUTC: slotStartUTC.toISOString(),
                endUTC: slotEndUTC.toISOString()
            });
        }
    }
    return slots;
}

function getCzechUTCOffsetHours(date) {
    const year = date.getFullYear();
    const marchLastSunday = getLastSunday(year, 2);
    const octLastSunday = getLastSunday(year, 9);
    const isSummer = date >= marchLastSunday && date < octLastSunday;
    return isSummer ? 2 : 1;
}

function getTurkeyOffsetFromCzech(date) {
    const year = date.getFullYear();
    const marchLastSunday = getLastSunday(year, 2);
    const octLastSunday = getLastSunday(year, 9);
    const isCzechSummer = date >= marchLastSunday && date < octLastSunday;
    return isCzechSummer ? 1 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000;
}

function getLastSunday(year, month) {
    const d = new Date(year, month + 1, 0);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(2, 0, 0, 0);
    return d;
}

function projectEventsToDate(events, targetDate) {
    const targetDateStr = targetDate.toISOString().split('T')[0];
    const targetDayEnd = new Date(targetDate);
    targetDayEnd.setHours(23, 59, 59, 999);
    const projected = [];

    for (const event of events) {
        const eventDateStr = event.start.toISOString().split('T')[0];

        if (eventDateStr === targetDateStr) {
            projected.push(event);
        } else if (event.end > targetDate && event.start < targetDayEnd) {
            projected.push(event);
        } else if (event.start.getDay() === targetDate.getDay()) {
            const duration = event.end.getTime() - event.start.getTime();
            const projectedStart = new Date(targetDate);
            projectedStart.setHours(event.start.getHours(), event.start.getMinutes(), event.start.getSeconds(), 0);
            const projectedEnd = new Date(projectedStart.getTime() + duration);
            projected.push({ ...event, start: projectedStart, end: projectedEnd });
        }
    }

    return projected;
}

async function getSlotsForDate(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);

    const events = await fetchEvents(dayStart, dayEnd);
    const projectedEvents = projectEventsToDate(events, date);
    return getAvailableSlots(date, projectedEvents);
}

async function getAvailableDates(startDate, endDate) {
    const events = await fetchEvents(startDate, endDate);
    const dates = [];
    const current = new Date(startDate);
    current.setHours(12, 0, 0, 0);

    while (current <= endDate) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 1 && dayOfWeek !== 4) {
            const currentDateStr = current.toISOString().split('T')[0];
            const dayEvents = events.filter(e => {
                const eventDateStr = e.start.toISOString().split('T')[0];
                if (eventDateStr === currentDateStr) return true;
                return e.start.getDay() === dayOfWeek;
            });

            const projectedEvents = projectEventsToDate(dayEvents, new Date(current));
            const slots = getAvailableSlots(new Date(current), projectedEvents);

            if (dayOfWeek === 0) {
                const sundayBookedSlots = projectedEvents.filter(e =>
                    e.summary && e.summary.includes('VG Randevu')
                );
                if (sundayBookedSlots.length >= 1) {
                    current.setDate(current.getDate() + 1);
                    continue;
                }
                if (slots.length > 0) {
                    dates.push({
                        date: currentDateStr,
                        slotsAvailable: 1,
                        isSunday: true
                    });
                }
            } else if (slots.length > 0) {
                dates.push({
                    date: currentDateStr,
                    slotsAvailable: slots.length,
                    isSunday: false
                });
            }
        }
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

module.exports = {
    fetchEvents,
    createEvent,
    updateEvent,
    deleteEvent,
    getSlotsForDate,
    getAvailableSlots,
    getAvailableDates,
    getCzechUTCOffsetHours,
    buildICSString,
    generateUID,
    formatICSDate,
    CZECH_TZ,
    TURKEY_TZ
};
