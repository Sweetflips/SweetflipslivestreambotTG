export interface GuessRecord {
  user: string | null;
  kickName: string | null;
  guess: number;
  timestamp: number;
}

export interface BalanceGameState {
  isOpen: boolean;
  isFinalized: boolean;
  finalBalance: number | null;
  guesses: Map<number, GuessRecord>;
}

export interface BonusGameState {
  isOpen: boolean;
  isFinalized: boolean;
  finalBonus: number | null;
  guesses: Map<number, GuessRecord>;
  bonusAmount: number;
  bonusList: string[];
}

export interface BotState {
  linkingUsers: Set<number>;
  addingGroups: Set<number>;
  knownGroups: Set<string>;
  balance: BalanceGameState;
  bonus: BonusGameState;
}

export const createInitialState = (): BotState => ({
  linkingUsers: new Set<number>(),
  addingGroups: new Set<number>(),
  knownGroups: new Set<string>(),
  balance: {
    isOpen: false,
    isFinalized: false,
    finalBalance: null,
    guesses: new Map<number, GuessRecord>(),
  },
  bonus: {
    isOpen: false,
    isFinalized: false,
    finalBonus: null,
    guesses: new Map<number, GuessRecord>(),
    bonusAmount: 0,
    bonusList: [],
  },
});

