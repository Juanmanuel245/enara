import type { GameItem } from "@/lib/items";

export const SHOP_CHARISMA_BASELINE = 10;
export const SHOP_OFFER_COUNT = 3;

export const getCharismaTradePercent = (carisma: number) => carisma - SHOP_CHARISMA_BASELINE;

export const getShopBuyPrice = (baseCost: number, carisma: number) => {
  const percent = getCharismaTradePercent(carisma);
  const multiplier = 1 - percent / 100;
  return Math.max(1, Math.round(baseCost * multiplier));
};

export const getShopSellPrice = (baseCost: number, carisma: number) => {
  const percent = getCharismaTradePercent(carisma);
  const multiplier = 1 + percent / 100;
  return Math.max(1, Math.round(baseCost * multiplier));
};

export const formatCharismaTradeHint = (carisma: number) => {
  const percent = getCharismaTradePercent(carisma);
  if (percent > 0) {
    return `${percent}% de descuento al comprar y bonus al vender.`;
  }
  if (percent < 0) {
    return `${Math.abs(percent)}% de recargo al comprar y penalidad al vender.`;
  }
  return "Precios base de la tienda.";
};

export const pickShopOffers = (items: GameItem[], count = SHOP_OFFER_COUNT): GameItem[] => {
  const eligible = items.filter((item) => item.isSelling);
  if (eligible.length === 0) {
    return [];
  }

  const shuffled = [...eligible];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
};
