// The Daily Wire site navigation (Figma "Header (Web)"): section links, centred logo, actions, account.
import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import logo from '../data/logo.svg';
import { useStore } from '../lib/store';
import { Icon } from './ui';

const LINKS = ['News', 'Shows & Movies', 'All Access', 'Sport & State', 'The Midterms'];
const HERE = 'The Midterms';

export default function Nav() {
  const user = useStore((s) => s.user);
  const openAuth = useStore((s) => s.openAuth);
  const signOut = useStore((s) => s.signOut);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return;
    const off = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('.nav-acct')) setMenu(false); };
    window.addEventListener('pointerdown', off);
    return () => window.removeEventListener('pointerdown', off);
  }, [menu]);

  return (
    <header className="nav">
      <nav className="nav-links">
        {LINKS.map((l) => (
          <a key={l} className={l === HERE ? 'here' : ''} href="#">{l}</a>
        ))}
      </nav>
      <img className="nav-logo" src={logo} alt="Daily Wire" />
      <div className="nav-right">
        <a href="#"><Icon name="download" size={20} stroke={1.7} />Download App</a>
        <a href="#"><Icon name="search" size={20} stroke={1.7} />Search</a>
        <span className="nav-div" />
        <div className="nav-acct">
          <button className={'nav-av' + (user ? ' me' : '')} onClick={() => (user ? setMenu(!menu) : openAuth('play'))} aria-label={user ? 'Account' : 'Sign up'}>
            {user ? user.initials : <Icon name="user" size={16} stroke={1.8} />}
          </button>
          <AnimatePresence>
            {menu && user && (
              <motion.div className="who-menu" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.15 }}>
                <div className="em">{user.email}</div>
                <button onClick={() => { setMenu(false); signOut(); }}>Sign out</button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
