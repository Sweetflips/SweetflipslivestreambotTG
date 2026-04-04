export function getStreamTimeInMinutes(dayOfWeek: number, streamNumber: 1 | 2): number {
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

export function getStreamTimeUTC(dayOfWeek: number, streamNumber: 1 | 2): string {
  const minutes = getStreamTimeInMinutes(dayOfWeek, streamNumber);
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

