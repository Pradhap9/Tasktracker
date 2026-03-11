function getDateParts(date, timeZone) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return {
        year: Number(values.year),
        month: Number(values.month),
        day: Number(values.day)
    };
}

function formatDateParts(parts) {
    return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function getCurrentDateInTimeZone(timeZone = 'Asia/Kolkata') {
    return formatDateParts(getDateParts(new Date(), timeZone));
}

function getCurrentTimeInTimeZone(timeZone = 'Asia/Kolkata') {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    const parts = formatter.formatToParts(new Date());
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.hour}:${values.minute}`;
}

function isWeekdayInTimeZone(timeZone = 'Asia/Kolkata') {
    const weekday = new Intl.DateTimeFormat('en-US', {
        timeZone,
        weekday: 'short'
    }).format(new Date());
    return !['Sat', 'Sun'].includes(weekday);
}

function getWeekBounds(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    const current = new Date(Date.UTC(year, month - 1, day));
    let weekday = current.getUTCDay();
    if (weekday === 0) weekday = 7;

    const weekStart = new Date(current);
    weekStart.setUTCDate(current.getUTCDate() - weekday + 1);

    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);

    return {
        weekStart: formatDateParts({
            year: weekStart.getUTCFullYear(),
            month: weekStart.getUTCMonth() + 1,
            day: weekStart.getUTCDate()
        }),
        weekEnd: formatDateParts({
            year: weekEnd.getUTCFullYear(),
            month: weekEnd.getUTCMonth() + 1,
            day: weekEnd.getUTCDate()
        })
    };
}

module.exports = {
    getCurrentDateInTimeZone,
    getCurrentTimeInTimeZone,
    isWeekdayInTimeZone,
    getWeekBounds
};
