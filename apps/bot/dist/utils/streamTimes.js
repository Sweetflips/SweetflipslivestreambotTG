export function getStreamTimeInMinutes(dayOfWeek, streamNumber) {
    const stream1Time = 9 * 60;
    if (streamNumber === 1) {
        return stream1Time;
    }
    const lateStreamDays = [0, 1, 3, 6];
    if (lateStreamDays.includes(dayOfWeek)) {
        return 19 * 60;
    }
    return 13 * 60;
}
export function getStreamTimeUTC(dayOfWeek, streamNumber) {
    const minutes = getStreamTimeInMinutes(dayOfWeek, streamNumber);
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}
