export interface StreamTime {
  label: string;
  time: string;
}

export const formatStreamTimes = (
  utcTime: string,
  streamNumber: 1 | 2
): StreamTime[] => {
  const times = {
    1: { ist: "12:30", pst: "23:00" },
    2: { ist: "22:30", pst: "09:00" },
  } as const;

  const { ist, pst } = times[streamNumber];

  return [
    { label: "UTC", time: utcTime },
    { label: "IST", time: ist },
    { label: "PST", time: pst },
  ];
};
