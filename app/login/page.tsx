export default async function Login({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  const { e } = await searchParams;
  return (
    <main className="login">
      <div className="brand"><span className="brand-mark">Dx</span>Dex</div>
      <form method="post" action="/api/login">
        <label htmlFor="pw" style={{ position: 'absolute', left: -9999 }}>Password</label>
        <input id="pw" name="password" type="password" placeholder="Password" autoFocus required />
        <button className="btn">Open Dex</button>
        {e && <p className="notice err">That password didn&apos;t match.</p>}
      </form>
    </main>
  );
}
