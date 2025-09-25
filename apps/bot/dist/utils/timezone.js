export const formatStreamTimes = (utcTime, streamNumber) => {
    const times = {
        1: { ist: "12:30", pst: "23:00" },
        2: { ist: "22:30", pst: "09:00" },
    };
    const { ist, pst } = times[streamNumber];
    return [
        { label: "UTC", time: utcTime },
        { label: "IST", time: ist },
        { label: "PST", time: pst },
    ];
};
