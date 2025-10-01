export const formatStreamTimes = (utcTime, streamNumber) => {
    const times = {
        1: { ist: "13:30", pst: "00:00" },
        2: { ist: "23:30", pst: "10:00" },
    };
    const { ist, pst } = times[streamNumber];
    return [
        { label: "UTC", time: utcTime },
        { label: "IST", time: ist },
        { label: "PST", time: pst },
    ];
};
