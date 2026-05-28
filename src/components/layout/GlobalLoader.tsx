/* Loader global — brilho técnico + núcleo girando para transições entre páginas e módulos. */
export function GlobalLoader({ label = "Sincronizando hangar" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center px-6 py-16 text-white">
      <div className="panel-cut border border-white/10 bg-white/5 px-8 py-10 text-center shadow-[0_0_40px_rgba(0,190,255,0.12)] backdrop-blur-xl">
        <div className="mx-auto flex w-fit items-center gap-4">
          <div className="relative h-14 w-14">
            <span className="absolute inset-0 border-2 border-primary/40 animate-spin" />
            <span className="absolute inset-[8px] border border-accent/50 animate-[spin_1.6s_linear_reverse_infinite]" />
            <span className="absolute inset-[18px] bg-primary/90 shadow-[0_0_25px_rgba(34,211,238,0.6)]" />
          </div>
          <div className="text-left">
            <p className="text-xs uppercase tracking-[0.28em] text-slate-400">Loading</p>
            <p className="mt-2 font-heading text-3xl uppercase leading-none">{label}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
