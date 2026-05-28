/* Perfil público — vitrine focada em decks abertos, username e identidade do jogador. */
import { useEffect, useState } from "react";
import { Link, useRoute } from "wouter";

import { api, type ApiDeck } from "@/lib/api";
import { PublicShell } from "@/components/layout/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

type PublicProfile = {
  id: string;
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  decks: ApiDeck[];
};

export default function PublicProfilePage() {
  const [, params] = useRoute<{ username: string }>("/u/:username");
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!params?.username) return;
    api.getPublicProfile(params.username).then(setProfile).catch((err) => setError(err.message));
  }, [params?.username]);

  return (
    <PublicShell>
      <div className="space-y-6">
        <Card className="panel-cut rounded-none border-primary/30 hero-surface">
          <CardContent className="p-6">
            {error ? (
              <p className="text-sm text-red-300">{error}</p>
            ) : !profile ? (
              <p className="text-sm text-slate-300">Carregando perfil público...</p>
            ) : (
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-400">Perfil público</p>
                  <h2 className="mt-2 font-heading text-5xl uppercase">{profile.displayName}</h2>
                  <p className="mt-3 text-sm uppercase tracking-[0.18em] text-primary">@{profile.username}</p>
                  <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">{profile.bio || "Jogador sem bio pública cadastrada."}</p>
                </div>
                <Badge className="rounded-none border border-accent/40 bg-accent/10 text-accent">{profile.decks.length} decks públicos</Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {profile ? (
          <div className="grid gap-6 lg:grid-cols-2">
            {profile.decks.map((deck) => (
              <Card key={deck.id} className="panel-cut rounded-none surface-panel">
                <CardContent className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Deck público</p>
                      <h3 className="mt-2 font-heading text-3xl uppercase">{deck.name}</h3>
                    </div>
                    <Badge className="rounded-none border border-white/15 bg-white/5 text-slate-200">{deck.items.reduce((sum, item) => sum + item.quantity, 0)} cartas</Badge>
                  </div>
                  <p className="text-sm leading-7 text-slate-300">{deck.notes || "Sem observações públicas."}</p>
                  <Link href={`/deck/${deck.shareId}`} className="inline-flex items-center rounded-none border border-white/15 bg-white/5 px-4 py-2 text-sm uppercase tracking-[0.18em] text-white nav-hover-soft light:border-slate-400/90 light:bg-white light:text-slate-950">Abrir deck compartilhado</Link>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </PublicShell>
  );
}
