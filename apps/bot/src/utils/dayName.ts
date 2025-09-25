const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const getDayName = (dayOfWeek: number) => days[dayOfWeek] ?? "Unknown";

