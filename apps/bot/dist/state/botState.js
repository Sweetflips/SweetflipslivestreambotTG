export const createInitialState = () => ({
    linkingUsers: new Set(),
    addingGroups: new Set(),
    knownGroups: new Set(),
    balance: {
        isOpen: false,
        isFinalized: false,
        finalBalance: null,
        guesses: new Map(),
    },
    bonus: {
        isOpen: false,
        isFinalized: false,
        finalBonus: null,
        guesses: new Map(),
        bonusAmount: 0,
        bonusList: [],
    },
});
