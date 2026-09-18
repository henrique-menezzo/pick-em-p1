import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useStore } from '../lib/store';
import { Icon, asset } from './ui';

// Figma "Last Call Container" (11096:1142869): DW sign-up card, 587 wide, #151515, r8.
const COPY = {
  save: 'Create a free account to save your map and compare it with the live results on election night.',
  play: 'Create a free account to play, save your map and compare it with the live results on election night.',
  night: 'Election Night compares your saved map with the live results. Create a free account to unlock it.',
};

export default function AuthModal() {
  const auth = useStore((s) => s.auth);
  const close = useStore((s) => s.closeAuth);
  // on a phone the card is a bottom sheet that slides up from the edge
  const sheet = window.matchMedia('(max-width: 760px)').matches;
  useEffect(() => {
    if (!auth) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); } };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [auth, close]);

  return createPortal(
    <AnimatePresence>
      {auth && (
        <motion.div
          key="back"
          className="auth-back"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onPointerDown={(e) => { if (e.target === e.currentTarget) close(); }}
        >
          <motion.div
            className="auth"
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            initial={sheet ? { y: '100%' } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={sheet ? { y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={sheet ? { y: '100%', transition: { duration: 0.22, ease: [0.4, 0, 1, 1] } } : { opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.15 } }}
            transition={sheet ? { type: 'spring', stiffness: 320, damping: 34 } : { type: 'spring', stiffness: 380, damping: 32 }}
          >
            <button className="auth-x" aria-label="Close" onClick={close}><Icon name="x" size={20} stroke={1.8} /></button>
            <AuthForm key={auth.mode} auth={auth} />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

// `auth` comes in as a prop: during the exit animation the store value is already null.
function AuthForm({ auth }: { auth: { mode: 'signup' | 'login'; reason: 'save' | 'play' | 'night' } }) {
  const openAuth = useStore((s) => s.openAuth);
  const signIn = useStore((s) => s.signIn);
  const signup = auth.mode === 'signup';
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState<{ email?: string; pw?: string }>({});
  const [busy, setBusy] = useState(false);
  const first = useRef<HTMLInputElement>(null);
  useEffect(() => { first.current?.focus(); }, []);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof err = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address';
    if (pw.length < 6) next.pw = signup ? 'Use at least 6 characters' : 'Enter your password';
    setErr(next);
    if (next.email || next.pw) return;
    setBusy(true);
    // prototype: no real account — pretend the request round-trips
    setTimeout(() => signIn(email.trim()), 750);
  }

  return (
    <form className="auth-main" onSubmit={submit} noValidate>
      <img className="auth-logo" src={asset('auth/logo-sm.svg')} alt="Daily Wire" />
      <div className="auth-text">
        <h2 id="auth-title">{signup ? 'Create a free account.' : 'Welcome back.'}</h2>
        <p>{signup ? COPY[auth.reason] : 'Log in to save your map and compare it with the live results on election night.'}</p>
      </div>
      <div className="auth-fields">
        <Field label="Email address" type="email" value={email} onChange={setEmail} error={err.email} inputRef={first} autoComplete="email" />
        <Field
          label="Password"
          type={show ? 'text' : 'password'}
          value={pw}
          onChange={setPw}
          error={err.pw}
          autoComplete={signup ? 'new-password' : 'current-password'}
          right={
            <button type="button" className="eye" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
                <circle cx="12" cy="12" r="2.6" />
                {show && <path d="M4 4l16 16" />}
              </svg>
            </button>
          }
        />
      </div>
      {signup && <img className="auth-captcha" src={asset('auth/captcha.png')} alt="Verification passed" />}
      <div className="auth-foot">
        <button className="auth-btn" type="submit" disabled={busy}>
          {busy ? <span className="spin" aria-label="Loading" /> : signup ? 'CREATE FREE ACCOUNT' : 'LOG IN'}
        </button>
        <div className="auth-alt">
          {signup ? 'Already a user?' : 'New here?'}{' '}
          <button type="button" onClick={() => openAuth(auth.reason, signup ? 'login' : 'signup')}>{signup ? 'Log in' : 'Create a free account'}</button>
        </div>
        {signup && (
          <p className="auth-terms">
            By Create an Account you agree with The <a href="#">Daily Wire's Terms</a> and <a href="#">Privacy Policy</a>, and{' '}
            <a href="#">Bentkey's Terms</a>, <a href="#">Privacy Policy</a> and <a href="#">Children's Privacy Policy.</a>
          </p>
        )}
      </div>
    </form>
  );
}

function Field(props: {
  label: string; type: string; value: string; onChange: (v: string) => void; error?: string;
  right?: React.ReactNode; inputRef?: React.RefObject<HTMLInputElement | null>; autoComplete?: string;
}) {
  const [focus, setFocus] = useState(false);
  const up = focus || !!props.value;
  return (
    <label className={'field' + (up ? ' up' : '') + (props.error ? ' bad' : '')}>
      <span className="lb">{props.label}</span>
      <input
        ref={props.inputRef}
        type={props.type}
        value={props.value}
        autoComplete={props.autoComplete}
        onChange={(e) => props.onChange(e.target.value)}
        onFocus={() => setFocus(true)}
        onBlur={() => setFocus(false)}
      />
      {props.right}
      {props.error && <em className="er">{props.error}</em>}
    </label>
  );
}
