declare namespace google {
    namespace accounts {
        namespace oauth2 {
            interface TokenResponse {
                access_token: string
                expires_in: number
                token_type: string
                scope: string
                error?: string
                error_description?: string
            }
            interface TokenClientConfig {
                client_id: string
                scope: string
                callback: (response: TokenResponse) => void
                error_callback?: (error: { type: string }) => void
            }
            interface TokenClient {
                requestAccessToken(overrideConfig?: { prompt?: string }): void
            }
            function initTokenClient(config: TokenClientConfig): TokenClient
        }
    }
}
