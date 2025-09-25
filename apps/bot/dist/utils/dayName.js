const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
];
export const getDayName = (dayOfWeek) => days[dayOfWeek] ?? "Unknown";
