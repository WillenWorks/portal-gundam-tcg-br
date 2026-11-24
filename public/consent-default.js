/* Consentimento (LGPD): carregado antes de qualquer script do Google (index.html). Sem escolha salva, os
 * cookies de análise e de anúncio ficam NEGADOS: o Google Analytics nem carrega e o AdSense só mostra anúncio
 * não personalizado. A escolha é feita no aviso de cookies (src/lib/consent.ts, mesma chave e versão). */
(function () {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function gtag() {
      window.dataLayer.push(arguments);
    };
  }
  var choice = null;
  try {
    choice = JSON.parse(window.localStorage.getItem("anaheimhub:consent") || "null");
  } catch (e) {
    choice = null;
  }
  var valid = choice && choice.v === 1;
  var ads = valid && choice.ads === true ? "granted" : "denied";
  var analytics = valid && choice.analytics === true ? "granted" : "denied";
  window.gtag("consent", "default", {
    ad_storage: ads,
    ad_user_data: ads,
    ad_personalization: ads,
    analytics_storage: analytics,
    functionality_storage: "granted",
    security_storage: "granted",
  });
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.requestNonPersonalizedAds = ads === "granted" ? 0 : 1;
})();
