import { useRef, useState, type ChangeEvent } from "react";
import { Upload } from "lucide-react";

import { ArticleImageFrame } from "@/components/articles/ArticleImageFrame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeImageSrc } from "@/lib/safeImageSrc";

const MIN_HOME_RATIO = 1.5;

type HomeImageFieldProps = {
  value: string;
  coverImage: string;
  saving: boolean;
  onChange: (value: string) => void;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
};

/** Imagem do destaque da home, com prévia e aviso para a imagem que não vai encaixar bem. */
export function HomeImageField({ value, coverImage, saving, onChange, onUpload }: HomeImageFieldProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [measured, setMeasured] = useState<{ src: string; ratio: number } | null>(null);
  const shown = safeImageSrc(value) || safeImageSrc(coverImage);
  const isInvalid = Boolean(value.trim()) && !safeImageSrc(value);
  const isNarrow = measured?.src === shown && measured.ratio < MIN_HOME_RATIO;

  return (
    <div>
      <label className="text-xs uppercase tracking-[0.2em] text-slate-500">Imagem da home</label>
      <div className="mt-1.5 flex items-center gap-3">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="URL da imagem do destaque" className="rounded-none" />
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
        <Button type="button" variant="outline" className="shrink-0 rounded-none" disabled={saving} onClick={() => inputRef.current?.click()}>
          <Upload className="mr-2 size-4" />
          Enviar
        </Button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Use arte horizontal (16:9, a partir de 1600×900) sem selos gravados: os selos saem das hashtags. Sem imagem aqui, a home usa a capa.
      </p>
      {isInvalid ? <p className="mt-1 text-xs text-red-400">Use um endereço http(s) ou um caminho do site, como /uploads/imagem.jpg.</p> : null}
      {shown ? (
        <div className="mt-2 max-w-sm">
          <ArticleImageFrame src={shown} className="h-40 border border-white/10" />
          {/* só para medir a proporção: o quadro acima já mostra a imagem */}
          <img
            src={shown}
            alt=""
            aria-hidden="true"
            className="hidden"
            onLoad={(event) => setMeasured({ src: shown, ratio: event.currentTarget.naturalWidth / event.currentTarget.naturalHeight })}
          />
          {isNarrow ? (
            <p className="mt-1 text-xs text-amber-400">Essa imagem é estreita para a home: aparece inteira, mas com faixas desfocadas nas laterais.</p>
          ) : null}
        </div>
      ) : (
        <p className="mt-1 text-xs text-amber-400">Sem capa e sem imagem da home, o destaque fica só com um ícone.</p>
      )}
    </div>
  );
}
