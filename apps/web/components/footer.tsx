import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <div className="mark">LYRA</div>
        <p>Discover. Pay. Execute.</p>
        <p>A Stellar-native access layer for agents. This deployment settles on a local x402 facilitator and does not broadcast to the network.</p>
      </div>
      <div>
        <strong>MARKETPLACE</strong>
        <Link href="/discover">Catalogue</Link>
        <Link href="/agent">Agent</Link>
        <Link href="/providers">Providers</Link>
      </div>
      <div>
        <strong>ACCOUNT</strong>
        <Link href="/policy">Spending policy</Link>
        <Link href="/receipts">Receipts</Link>
        <Link href="/help">Help</Link>
      </div>
      <div>
        <strong>PROTOCOL</strong>
        <a href="https://developers.stellar.org/docs/build/agentic-payments/x402">x402 on Stellar</a>
        <a href="https://stellar.org/x402">Stellar x402</a>
        <a href="https://github.com/x402-foundation/x402">x402 specification</a>
      </div>
      <p className="legal">Testnet USDC contract CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA. Indexed listings are not for sale.</p>
    </footer>
  );
}
