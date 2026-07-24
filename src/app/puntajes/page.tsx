"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, MessageCircle, RefreshCw, Send, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchPuntajes, type PuntajeRecord } from "@/lib/campaign";
import { getReputationRankName } from "@/lib/player";
import { buildLeaderboardShareText, shareViaTelegram, shareViaWhatsApp } from "@/lib/share";

const formatDate = (isoDate: string) => {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("es-AR", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

export default function PuntajesPage() {
  const router = useRouter();
  const [puntajes, setPuntajes] = useState<PuntajeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPuntajes = async () => {
    setIsLoading(true);
    setLoadError(null);

    try {
      const rows = await fetchPuntajes();
      setPuntajes(rows);
      if (rows.length === 0) {
        setLoadError("No hay puntajes registrados todavía.");
      }
    } catch {
      setLoadError("No se pudo cargar la tabla de puntajes.");
      setPuntajes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadPuntajes();
  }, []);

  const topScore = useMemo(() => puntajes[0]?.puntaje ?? 0, [puntajes]);

  const handleShareWhatsApp = () => {
    shareViaWhatsApp(buildLeaderboardShareText());
  };

  const handleShareTelegram = () => {
    shareViaTelegram(buildLeaderboardShareText());
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-stone-950 p-4 md:p-6">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-amber-950/25 via-stone-950 to-stone-950" />
      <div className="pointer-events-none absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/black-felt.png')] opacity-[0.07]" />

      <div className="relative z-10 mx-auto w-full max-w-5xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button type="button" variant="secondary" onClick={() => router.push("/")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver al inicio
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" onClick={() => void loadPuntajes()} disabled={isLoading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button type="button" onClick={handleShareWhatsApp} className="bg-emerald-700 hover:bg-emerald-600">
              <MessageCircle className="mr-2 h-4 w-4" />
              WhatsApp
            </Button>
            <Button type="button" onClick={handleShareTelegram} className="bg-sky-700 hover:bg-sky-600">
              <Send className="mr-2 h-4 w-4" />
              Telegram
            </Button>
          </div>
        </div>

        <Card className="border-amber-700/30 bg-stone-950/90 backdrop-blur-md">
          <CardHeader className="space-y-3">
            <div className="flex items-center gap-3 text-amber-300">
              <Trophy className="h-6 w-6" />
              <p className="font-[var(--font-cinzel)] text-sm uppercase tracking-[0.3em] text-amber-300/80">
                Tabla historica
              </p>
            </div>
            <CardTitle className="font-[var(--font-cinzel)] text-3xl text-amber-100">
              Clasificación de aventureros
            </CardTitle>
            <CardDescription className="text-stone-300">
              Compará tus puntajes con los de otros jugadores. Compartí la tabla por WhatsApp o Telegram para
              retar a tus amigos.
            </CardDescription>
            {topScore > 0 && (
              <p className="text-sm text-amber-200/90">
                Puntaje más alto registrado:{" "}
                <span className="font-semibold text-amber-100">{topScore.toLocaleString("es-AR")}</span>
              </p>
            )}
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <p className="py-10 text-center text-stone-400">Cargando puntajes...</p>
            ) : loadError && puntajes.length === 0 ? (
              <div className="space-y-4 py-10 text-center">
                <p className="text-stone-400">{loadError}</p>
                <Button type="button" variant="secondary" onClick={() => void loadPuntajes()}>
                  Reintentar
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-amber-700/25">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-stone-900/80 text-xs uppercase tracking-[0.12em] text-amber-300/80">
                    <tr>
                      <th className="px-3 py-3">#</th>
                      <th className="px-3 py-3">Héroe</th>
                      <th className="px-3 py-3">Puntaje</th>
                      <th className="px-3 py-3">Oro</th>
                      <th className="px-3 py-3">Daño máx.</th>
                      <th className="px-3 py-3">Reputación</th>
                      <th className="px-3 py-3">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {puntajes.map((row, index) => (
                      <tr
                        key={row.idpuntaje}
                        className={`border-t border-amber-700/15 ${
                          index === 0
                            ? "bg-amber-950/30"
                            : index % 2 === 0
                              ? "bg-stone-950/40"
                              : "bg-stone-900/20"
                        }`}
                      >
                        <td className="px-3 py-3 font-medium text-amber-200">{index + 1}</td>
                        <td className="px-3 py-3 font-medium text-stone-100">{row.heroe}</td>
                        <td className="px-3 py-3 font-semibold text-amber-100">
                          {row.puntaje.toLocaleString("es-AR")}
                        </td>
                        <td className="px-3 py-3 text-stone-300">{row.oro.toLocaleString("es-AR")}</td>
                        <td className="px-3 py-3 text-stone-300">
                          {row.danio_maximo.toLocaleString("es-AR")}
                        </td>
                        <td className="px-3 py-3 text-stone-300">
                          {getReputationRankName(row.reputacion)} ({row.reputacion})
                        </td>
                        <td className="px-3 py-3 text-stone-400">{formatDate(row.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="button" variant="secondary" onClick={() => router.push("/")}>
                Crear héroe
              </Button>
              <Button type="button" onClick={() => router.push("/juego")}>
                Ir al juego
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
