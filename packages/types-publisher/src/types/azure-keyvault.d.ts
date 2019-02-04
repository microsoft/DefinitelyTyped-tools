type AuthenticatorCallback = (error: Error | null | undefined, authorization?: string) => void;
export class KeyVaultCredentials {
    constructor(authenticator: (challenge: Challenge, callback: AuthenticatorCallback) => void);
}
interface Challenge {
    authorization: string;
    resource: string;
}

export class KeyVaultClient {
    constructor(credentials: KeyVaultCredentials);
    getSecret(baseUrl: string, name: string, version: string): Promise<SecretBundle>;
    getSecretVersions(url: string, name: string): Promise<{ value: { id: string }[] }>;
}

interface SecretBundle {
    id: string;
    value: string;
}
