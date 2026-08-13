/* Filtro multi-seleção — combina valores do mesmo campo (ex: Azul + Roxa, ou trait OZ
 * + G Team) via checkbox num popover, ao invés de um <select> que só deixa escolher 1.
 * Valor interno continua sendo string separada por vírgula (bate com o mesmo formato
 * que o backend já entende em /api/cards), pra não precisar mudar o tipo CardFilters
 * (ainda string) em cascata por todo o código que já usa esses filtros. */
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export function MultiSelectFilter({ label, options, value, onChange }: { label: string; options: string[]; value: string; onChange: (next: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = value ? value.split(",").filter(Boolean) : [];

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const toggle = (option: string) => {
    const next = selected.includes(option) ? selected.filter((v) => v !== option) : [...selected, option];
    onChange(next.join(","));
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="field-shell flex h-10 w-full items-center justify-between px-3 text-sm">
        <span className="truncate">{selected.length ? `${label} (${selected.length})` : `Todas as ${label.toLowerCase()}`}</span>
        <ChevronDown className="size-4 shrink-0 text-slate-500" />
      </button>
      {open ? (
        <div className="surface-panel absolute left-0 top-11 z-30 max-h-64 w-full min-w-[200px] overflow-y-auto border p-2 shadow-xl">
          {options.length ? options.map((option) => (
            <label key={option} className="flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm hover:bg-white/10">
              <input type="checkbox" checked={selected.includes(option)} onChange={() => toggle(option)} className="accent-primary" />
              {option}
            </label>
          )) : <p className="px-2 py-1.5 text-xs text-slate-500">Nenhuma opção.</p>}
          {selected.length ? <button type="button" onClick={() => onChange("")} className="mt-1 w-full border-t border-white/10 px-2 pt-2 text-left text-xs text-slate-400 hover:text-white">Limpar seleção</button> : null}
        </div>
      ) : null}
    </div>
  );
}
