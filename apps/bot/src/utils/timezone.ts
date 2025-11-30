export interface StreamTime {
  label: string;
  time: string;
}

function convertUTCToIST(utcTime: string): string {
  const [hours, minutes] = utcTime.split(':').map(Number);
  let istHours = hours + 5;
  let istMinutes = minutes + 30;
  if (istMinutes >= 60) {
    istMinutes -= 60;
    istHours += 1;
  }
  if (istHours >= 24) {
    istHours -= 24;
  }
  return `${istHours.toString().padStart(2, '0')}:${istMinutes.toString().padStart(2, '0')}`;
}

function convertUTCToPST(utcTime: string): string {
  const [hours, minutes] = utcTime.split(':').map(Number);
  let pstHours = hours - 8;
  if (pstHours < 0) {
    pstHours += 24;
  }
  return `${pstHours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export const formatStreamTimes = (
  utcTime: string,
  streamNumber: 1 | 2
): StreamTime[] => {
  const ist = convertUTCToIST(utcTime);
  const pst = convertUTCToPST(utcTime);

  return [
    { label: "UTC", time: utcTime },
    { label: "IST", time: ist },
    { label: "PST", time: pst },
  ];
};
