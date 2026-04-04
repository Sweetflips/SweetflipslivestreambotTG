export interface CwalletWithdrawalRequest {
    amount: string;
    currency: string;
    recipient: string;
    memo?: string;
}
export interface CwalletWithdrawalResponse {
    success: boolean;
    transactionId?: string;
    error?: string;
}
export interface CwalletClient {
    createWithdrawal(request: CwalletWithdrawalRequest): Promise<CwalletWithdrawalResponse>;
    getBalance(currency: string): Promise<{
        balance: string;
        currency: string;
    }>;
    validateRecipient(recipient: string): Promise<boolean>;
}
export declare class MockCwalletClient implements CwalletClient {
    createWithdrawal(request: CwalletWithdrawalRequest): Promise<CwalletWithdrawalResponse>;
    getBalance(currency: string): Promise<{
        balance: string;
        currency: string;
    }>;
    validateRecipient(recipient: string): Promise<boolean>;
}
export declare class RealCwalletClient implements CwalletClient {
    private apiBase;
    private apiKey;
    private apiSecret;
    constructor();
    createWithdrawal(request: CwalletWithdrawalRequest): Promise<CwalletWithdrawalResponse>;
    getBalance(currency: string): Promise<{
        balance: string;
        currency: string;
    }>;
    validateRecipient(recipient: string): Promise<boolean>;
}
export declare function createCwalletClient(): CwalletClient;
//# sourceMappingURL=cwallet.d.ts.map