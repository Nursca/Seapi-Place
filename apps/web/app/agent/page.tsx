import { AgentConsole } from "@/components/agent-console";

export const dynamic = "force-dynamic";

export default function AgentPage() {
  return (
    <main className="page">
      <p className="kicker">Collection no. 1</p>
      <h1>Ask once.</h1>
      <p className="lede">
        The agent discovers a service, compares the price, takes the HTTP 402, and settles inside the spending policy. The default instruction is the exchange-rate task.
      </p>
      <AgentConsole />
    </main>
  );
}
