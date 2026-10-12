// Validação de tokens do Google reCAPTCHA Enterprise
// Usado para proteger endpoints sensíveis (/api/auth/login, /api/auth/register, /api/auth/forgot-password).
// Se o reCAPTCHA não estiver configurado no ambiente (sem RECAPTCHA_SITE_KEY ou sem RECAPTCHA_API_KEY),
// o serviço opera em modo permissivo (não bloqueia), mantendo o rate-limiter nativo da API.

export interface RecaptchaVerificationResult {
  valid: boolean;
  score?: number;
  reason?: string;
}

export interface RecaptchaConfig {
  siteKey?: string;
  projectId?: string;
  apiKey?: string;
  minScore?: number;
}

export function createRecaptchaVerifier(config?: RecaptchaConfig) {
  const siteKey = config?.siteKey || process.env.RECAPTCHA_SITE_KEY;
  const projectId = config?.projectId || process.env.RECAPTCHA_PROJECT_ID || "anaheimhub-portal";
  const apiKey = config?.apiKey || process.env.RECAPTCHA_API_KEY;
  const minScore = config?.minScore ?? Number(process.env.RECAPTCHA_MIN_SCORE || 0.4);

  const isConfigured = Boolean(siteKey && apiKey && projectId);

  return {
    isConfigured,
    async verify(token: string | undefined, expectedAction: string): Promise<RecaptchaVerificationResult> {
      // Se o backend não tem as chaves de API do Google configuradas, não bloqueia o usuário
      if (!isConfigured) {
        return { valid: true, reason: "recaptcha_not_configured" };
      }

      // Se está configurado mas nenhum token foi enviado pelo cliente
      if (!token) {
        return { valid: false, reason: "token_missing" };
      }

      try {
        const url = `https://recaptchaenterprise.googleapis.com/v1/projects/${encodeURIComponent(projectId!)}/assessments?key=${encodeURIComponent(apiKey!)}`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: {
              token,
              siteKey,
              expectedAction,
            },
          }),
        });

        if (!resp.ok) {
          const detail = await resp.text().catch(() => "");
          console.warn(`[recaptcha] Google API respondeu ${resp.status}: ${detail}`);
          // Em caso de erro temporário da API do Google (ex: 5xx ou erro de chave),
          // não derruba o login de jogadores legítimos a menos que configurado estrito
          return { valid: process.env.RECAPTCHA_STRICT !== "true", reason: `api_error_${resp.status}` };
        }

        const data = (await resp.json()) as {
          tokenProperties?: { valid?: boolean; action?: string };
          riskAnalysis?: { score?: number };
        };

        const tokenValid = Boolean(data.tokenProperties?.valid);
        const actionMatches = !data.tokenProperties?.action || data.tokenProperties.action === expectedAction;
        const score = data.riskAnalysis?.score ?? 1.0;

        if (!tokenValid) {
          return { valid: false, score, reason: "invalid_token" };
        }

        if (!actionMatches) {
          return { valid: false, score, reason: "action_mismatch" };
        }

        if (score < minScore) {
          return { valid: false, score, reason: "low_score" };
        }

        return { valid: true, score };
      } catch (err) {
        console.warn("[recaptcha] falha na requisição de assessment:", err instanceof Error ? err.message : err);
        return { valid: process.env.RECAPTCHA_STRICT !== "true", reason: "network_error" };
      }
    },
  };
}

export const recaptchaVerifier = createRecaptchaVerifier();
