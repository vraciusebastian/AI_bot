import { useRouter } from 'next/router';

const NAV_ITEMS = [
  { href: '/', label: 'Upload' },
  { href: '/github', label: 'GitHub' },
  { href: '/plan', label: 'Plan' },
  { href: '/interaction', label: 'Interact' },
];

export default function Layout({ children, step = 1 }) {
  const router = useRouter();

  return (
    <div>
      <div className="header">
        <h1>Behavioral AI Bot</h1>
        <nav>
          {NAV_ITEMS.map((item, i) => (
            <span
              key={item.href}
              className={router.pathname === item.href ? 'active' : ''}
              onClick={() => router.push(item.href)}
            >
              {item.label}
            </span>
          ))}
        </nav>
        <div className="step-dots">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`step-dot${s === step ? ' active' : ''}${s < step ? ' done' : ''}`}
            />
          ))}
        </div>
      </div>
      <div className="container">
        {children}
      </div>
    </div>
  );
}
