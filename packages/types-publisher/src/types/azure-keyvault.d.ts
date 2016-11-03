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
	getSecret(uri: string, callback: (error: Error | null | undefined, secretBundle: SecretBundle | null | undefined) => void): void;
}

interface SecretBundle {
	id: string;
	value: string;
}
