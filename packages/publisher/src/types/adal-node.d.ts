export class AuthenticationContext {
  constructor(authorization: string);

  acquireTokenWithClientCredentials(
    resource: string,
    clientId: string,
    clientSecret: string,
    callback: (error: Error | null | undefined, tokenResponse: TokenResponse | null | undefined) => void
  ): void;
}

interface TokenResponse {
  tokenType: string;
  accessToken: string;
}
