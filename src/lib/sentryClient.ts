/* Só o que o monitoramento usa: re-exportar por nome deixa o empacotador descartar replay, feedback e o resto do SDK. */
export { captureException, init } from "@sentry/browser";
