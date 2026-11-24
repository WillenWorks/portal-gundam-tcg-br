import { useEffect } from "react";

/**
 * Tira a capa de carregamento do index.html (#boot-cover) depois que o app pinta a primeira tela. A capa cobre o
 * texto estático do #root, que fica no HTML para quem lê sem JavaScript (robô do AdSense); sem ela, esse texto
 * piscava na tela antes da home.
 */
export function BootCoverRelease() {
  useEffect(() => {
    const cover = document.getElementById("boot-cover");
    if (!cover) return;
    requestAnimationFrame(() => {
      cover.classList.add("boot-cover-done");
      window.setTimeout(() => cover.remove(), 250);
    });
  }, []);
  return null;
}
