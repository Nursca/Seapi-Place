import Link from "next/link";

export default function HelpPage() {
  return (
    <main className="page">
      <p className="kicker">Help</p>
      <h1>How a call settles.</h1>
      <ol className="steps">
        <li data-state="done">
          <span className="num">01</span>
          <div>
            <h3>Instruction</h3>
            <p>You ask for something concrete, such as the dollar against the naira, today and yesterday.</p>
          </div>
        </li>
        <li data-state="done">
          <span className="num">02</span>
          <div>
            <h3>Discovery</h3>
            <p>The agent searches names, tags, and capabilities. Indexed services stay visible so the catalogue is honest about what it does not yet have rights to call.</p>
          </div>
        </li>
        <li data-state="done">
          <span className="num">03</span>
          <div>
            <h3>Pricing</h3>
            <p>Eligible APIs are the ones that cover the task, hold an authorization, and fit the spending policy. The cheapest of those is chosen.</p>
          </div>
        </li>
        <li data-state="done">
          <span className="num">04</span>
          <div>
            <h3>Payment</h3>
            <p>
              The resource answers HTTP 402 with a base64 <code>PAYMENT-REQUIRED</code> header: scheme <code>exact</code>, network <code>stellar:testnet</code>, testnet USDC. The demo account signs an ed25519 authorization. A production wallet would sign a Soroban auth entry instead.
            </p>
          </div>
        </li>
        <li data-state="done">
          <span className="num">05</span>
          <div>
            <h3>Execution</h3>
            <p>The facilitator verifies the signature without moving funds, the adapter calls upstream, and only then is the debit recorded. A failed upstream call is not charged.</p>
          </div>
        </li>
        <li data-state="done">
          <span className="num">06</span>
          <div>
            <h3>Receipt</h3>
            <p>You receive the data, the API that was used, and a receipt. The x402 transaction field is empty in this deployment because settlement is local.</p>
          </div>
        </li>
      </ol>
      <p className="lede" style={{ marginTop: "1.6rem" }}>
        Agents can use the same tools over MCP at <code>POST /mcp</code> on the API, or over stdio with <code>npm run mcp -w @lyra/server</code> while the API is running.
      </p>
      <p>
        <Link className="btn" href="/agent">
          Run the agent
        </Link>
      </p>
    </main>
  );
}
