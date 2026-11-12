import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      <p className="kicker">404</p>
      <h1>Not in the catalogue.</h1>
      <Link className="btn" href="/discover">
        Back to the index
      </Link>
    </main>
  );
}
