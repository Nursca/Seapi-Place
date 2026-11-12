const origin = process.env.LYRA_API_ORIGIN ?? "http://127.0.0.1:4020";

export async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${origin}${path}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}
