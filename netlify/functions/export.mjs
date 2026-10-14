import { checkAuth, readAll, toCSV } from "../lib/shared.mjs";

export default async (req) => {
  const denied = checkAuth(req);
  if (denied) return denied;
  const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  return new Response(toCSV(await readAll()), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="dapt_acs_records_${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
};

export const config = { path: "/admin/export.csv" };
