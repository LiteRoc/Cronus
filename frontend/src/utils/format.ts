export const money = (n?: number | null) =>
  typeof n === "number"
    ? n.toLocaleString(undefined, { style: "currency", currency: "USD" })
    : "—";

export const fmtMoney = (n?: number | null) =>
  typeof n === "number"
    ? n.toLocaleString(undefined, { style: "currency", currency: "USD" })
    : "—";

export const safeDiv = (a: number, b: number) => (b ? a / b : 0);
