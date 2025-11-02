// src/lib/fetcher.ts

export const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`An error occurred: ${res.statusText}`);
  }
  return res.json();
};