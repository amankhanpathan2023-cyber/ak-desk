import Link from 'next/link';
import QuickAdd from './QuickAdd';

const LINKS = [
  ['/', 'Today'],
  ['/buckets', 'Buckets'],
  ['/waiting', 'Waiting'],
  ['/money', 'Money'],
  ['/goals', 'Goals'],
];

export default function Shell({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <div className="shell">
      <header className="top">
        <Link href="/" className="brand"><span className="brand-mark">Dx</span>Dex</Link>
        <nav className="nav" aria-label="Main">
          {LINKS.map(([href, label]) => (
            <Link key={href} href={href} className={active === href ? 'on' : ''} aria-current={active === href ? 'page' : undefined}>
              {label}
            </Link>
          ))}
        </nav>
      </header>
      <QuickAdd />
      {children}
    </div>
  );
}
