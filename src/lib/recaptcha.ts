// Cliente do Google reCAPTCHA Enterprise no front-end
// Executa o score invisível se VITE_RECAPTCHA_SITE_KEY estiver configurada.

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

declare global {
  interface Window {
    grecaptcha?: {
      enterprise: {
        ready: (cb: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
      };
    };
  }
}

let scriptPromise: Promise<boolean> | null = null;

function loadRecaptchaScript(siteKey: string): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.grecaptcha?.enterprise) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve) => {
    const existing = document.getElementById("recaptcha-enterprise-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(true), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.id = "recaptcha-enterprise-script";
    script.src = `https://www.google.com/recaptcha/enterprise.js?render=${encodeURIComponent(siteKey)}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.warn("[recaptcha] falha ao carregar script do reCAPTCHA Enterprise");
      resolve(false);
    };
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function executeRecaptcha(action: string): Promise<string | null> {
  if (!RECAPTCHA_SITE_KEY) return null;
  try {
    const loaded = await loadRecaptchaScript(RECAPTCHA_SITE_KEY);
    if (!loaded || !window.grecaptcha?.enterprise) return null;
    return new Promise((resolve) => {
      window.grecaptcha!.enterprise.ready(async () => {
        try {
          const token = await window.grecaptcha!.enterprise.execute(RECAPTCHA_SITE_KEY, { action });
          resolve(token);
        } catch (err) {
          console.warn("[recaptcha] falha na execução do token para action", action, err);
          resolve(null);
        }
      });
    });
  } catch {
    return null;
  }
}
