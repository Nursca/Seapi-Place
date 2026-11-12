import { createInterface } from "node:readline";
import { handleMcp } from "./mcp.js";

const origin = process.env.LYRA_ORIGIN ?? "http://127.0.0.1:4020";
const lines = createInterface({ input: process.stdin });

for await (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  try {
    const message = JSON.parse(trimmed) as { method?: string };
    if (String(message.method ?? "").startsWith("notifications/")) continue;
    const response = await handleMcp(message, origin);
    process.stdout.write(`${JSON.stringify(response)}\n`);
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: error instanceof Error ? error.message : "parse error" } })}\n`,
    );
  }
}
