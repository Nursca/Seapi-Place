import { start } from "./app.js";

const port = Number(process.env.PORT ?? 4020);
const server = await start(port);
const address = server.address();
const actual = typeof address === "object" && address ? address.port : port;
console.log(`LYRA API listening on http://127.0.0.1:${actual}`);
