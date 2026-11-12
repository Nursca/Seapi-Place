# LYRA

A Stellar-native marketplace where an agent can discover an API, compare a per-request USDC price, and settle it with x402.

The homepage follows the attached editorial layout: ivory ground, a taupe announcement bar, a serif wordmark, a black category band, and a product shelf. The catalogue behind it is a working slice, not a claim that 23,000 commercial APIs are connected.

## Run

```bash
npm install
npm test
npm run dev
```

The API listens on `http://127.0.0.1:4020`. The site listens on `http://3000` and proxies `/api/*` to the API.

Open `/agent` and run the default instruction:

> Find the current exchange rate between USD and NGN and compare it with yesterday's rate.

The agent selects Meridian FX, receives HTTP 402, signs a payment under the spending policy, and returns both rates with a receipt.

## What settles

| Piece | Behavior |
| --- | --- |
| Scheme | x402 v2, `exact` |
| Network | `stellar:testnet` |
| Asset | USDC, SEP-41 contract `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| Challenge | `402` with a base64 `PAYMENT-REQUIRED` header |
| Signature | ed25519 over the authorization payload, from the demo smart account |
| Facilitator | Local `/verify` and `/settle`. Verify does not debit. Settle debits only after the upstream call succeeds. |
| Transaction | Empty string. Nothing is broadcast. |

A production payer would replace the demo signature with a Soroban authorization entry and settle through a Stellar facilitator such as `https://channels.openzeppelin.com/x402/testnet`. The local facilitator is explicit about that in every receipt.

## Authorization

Indexing an API does not grant the right to proxy it.

- **Adapter.** A public upstream (currency-api, Frankfurter, Open-Meteo, Nager.Date) is called only where terms allow a demonstration. The listed price is LYRA's access fee. Upstream cost on these sources is zero, and that split is shown on the API page.
- **Native.** The fee oracle is LYRA's own x402 resource over public Horizon fee stats.
- **Indexed.** Metadata only. There is no resource route and no pay button.

Credentials, when a provider later requires one, are read from an environment variable named on the provider record. The value is never returned to the client. Rate limits are enforced per provider before settlement.

## Spending policy

The demo smart account starts with 25 USDC on an internal ledger.

- Daily budget: 5 USDC
- Per-request cap: 0.05 USDC
- Autonomous line: 0.02 USDC
- Categories: finance, weather, research, data, developer

The agent picks the cheapest authorized API that can do the task and still fits the policy. A price above the line is refused and nothing is debited. Change the limits at `/policy`.

## MCP

`POST /mcp` speaks JSON-RPC tools: `search_apis`, `run_task`, `get_spending_policy`, `set_spending_policy`, `list_receipts`.

```bash
npm run mcp -w @lyra/server
```

That process reads one JSON-RPC message per line on stdin and expects the HTTP API at `LYRA_ORIGIN` (default `http://127.0.0.1:4020`).
