import { GET as getItems } from "@/app/api/items/route";

export const runtime = "nodejs";

export async function GET() {
  return getItems();
}
