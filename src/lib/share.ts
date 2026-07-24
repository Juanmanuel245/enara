export const getShareOrigin = () =>
  typeof window !== "undefined" ? window.location.origin : "";

export const getPuntajesPageUrl = () => `${getShareOrigin()}/puntajes`;

export const shareViaWhatsApp = (text: string) => {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
};

export const shareViaTelegram = (text: string, url?: string) => {
  const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");
  window.open(
    `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(text)}`,
    "_blank",
    "noopener,noreferrer"
  );
};

export const buildLeaderboardShareText = () => {
  const url = getPuntajesPageUrl();
  return `Mirá la tabla de puntajes de Futrol — Crónicas de Enara. ¿Quién es el mejor aventurero?\n${url}`;
};

export type PersonalScoreShareInput = {
  heroName: string;
  finalScore: number;
  enemiesKilled: number;
  goldEarned: number;
  maxDamageDealt: number;
  reputationRank: number;
  reputationRankName: string;
};

export const buildPersonalScoreShareText = (input: PersonalScoreShareInput) => {
  const url = getPuntajesPageUrl();
  return (
    `Terminé mi partida en Futrol (Crónicas de Enara) con ${input.finalScore} puntos.\n` +
    `Héroe: ${input.heroName}\n` +
    `Enemigos: ${input.enemiesKilled} | Oro: ${input.goldEarned} | Daño máx: ${input.maxDamageDealt}\n` +
    `Reputación: ${input.reputationRankName} (rango ${input.reputationRank})\n` +
    `¿Podés superarme? Mirá la tabla: ${url}`
  );
};
