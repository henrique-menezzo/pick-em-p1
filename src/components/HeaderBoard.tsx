// ?board=1 — an exploration board for the page header only (back · title · deadline · help).
// Every concept is real markup at the real width, with the nav's hairline above it and the top of
// the card below it, so the hierarchy can be judged against what actually sits underneath.
import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './ui';
import Nav from './Nav';

const BACK = 'The Midterms';
const TITLE = 'Midterms Pick Em';
const CLOCK = '43d 04:20:49';
const HELP = 'How it works';

/** The first row of the card, dimmed: avatar, tabs, panel — context, not the subject. */
function CardTop({ extra }: { extra?: ReactNode }) {
  return (
    <div className="hb-card">
      <div className="hb-ghost">
        <span className="hb-av" />
        <span className="hb-name" />
        <span className="hb-tabs"><i /><b /><i /></span>
        <span className="hb-panel" />
      </div>
      {extra}
    </div>
  );
}

/** ?only=01,02 — render a subset (used to capture the board in readable slices). */
const ONLY = new URLSearchParams(location.search).get('only');

function Cell({ n, name, note, children, card }: { n: string; name: string; note: string; children: ReactNode; card?: ReactNode }) {
  if (ONLY && !ONLY.split(',').includes(n)) return null;
  return (
    <section className="hb-cell">
      <div className="hb-tag"><b>{n}</b>{name}</div>
      <p className="hb-note">{note}</p>
      <div className="hb-stage">
        {/* the real site nav, dimmed: the header has to be judged against what sits above it */}
        <div className="hb-navwrap"><Nav /></div>
        <div className="hb-rule" />
        <div className="hb-band">{children}</div>
        {card ?? <CardTop />}
      </div>
    </section>
  );
}

/** The board is composed at 1440, like the app; narrower windows get the same uniform scale. */
function useFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [s, setS] = useState({ scale: 1, height: 0 });
  useLayoutEffect(() => {
    const fit = () => {
      const scale = Math.min(1, window.innerWidth / 1440);
      setS({ scale, height: (ref.current?.offsetHeight ?? 0) * scale });
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (ref.current) ro.observe(ref.current);
    window.addEventListener('resize', fit);
    return () => { ro.disconnect(); window.removeEventListener('resize', fit); };
  }, []);
  return { ref, ...s };
}

export default function HeaderBoard() {
  const { ref, scale, height } = useFit();
  return (
    <div className="hb-page" style={{ height }}>
    <div className="hb" ref={ref} style={{ transform: `scale(${scale})` }}>
      {!ONLY && <header className="hb-head">
        <h1>Header studies</h1>
        <p>Twelve ways to carry the same four things — where you came from, what this is, when it locks, how to play.
          Everything below the header is the real card, dimmed.</p>
      </header>}

      <Cell n="01" name="One line" note="The title is the last crumb. No vertical cost at all; the deadline is metadata, not a subtitle.">
        <div className="c1">
          <a className="c1-back"><Icon name="arrowLeft" size={15} stroke={1.8} />{BACK}</a>
          <span className="c1-sep" />
          <h1>{TITLE}</h1>
          <span className="c1-gap" />
          <span className="c1-clock">Locks in <b>{CLOCK}</b></span>
          <a className="c1-help">{HELP}</a>
        </div>
      </Cell>

      <Cell n="02" name="Lockup" note="Title and deadline read as one object: a micro-label and the clock on a single line under the name.">
        <div className="c2">
          <a className="c2-back"><Icon name="arrowLeft" size={15} stroke={1.8} />{BACK}</a>
          <div className="c2-mid">
            <h1>{TITLE}</h1>
            <div className="c2-lock"><span>PICKS LOCK IN</span><b>{CLOCK}</b></div>
          </div>
          <a className="c2-help">{HELP}</a>
        </div>
      </Cell>

      <Cell n="03" name="Masthead" note="Back becomes the kicker above the name. The clock hangs on the right, on the title's baseline.">
        <div className="c3">
          <div className="c3-l">
            <a className="c3-kick"><Icon name="arrowLeft" size={12} stroke={2} />{BACK}</a>
            <h1>{TITLE}</h1>
          </div>
          <div className="c3-r">
            <b>{CLOCK}</b>
            <span>until picks lock</span>
            <a className="c3-help">{HELP}</a>
          </div>
        </div>
      </Cell>

      <Cell
        n="04"
        name="Clock block"
        note="The deadline is a right-hand clock, stacked label over figure. Help leaves the header and lives on the card."
        card={<CardTop extra={<span className="hb-q"><Icon name="help" size={17} stroke={1.7} /></span>} />}
      >
        <div className="c4">
          <a className="c4-back"><Icon name="arrowLeft" size={15} stroke={1.8} />{BACK}</a>
          <h1>{TITLE}</h1>
          <div className="c4-clock"><span>PICKS LOCK IN</span><b>{CLOCK}</b></div>
        </div>
      </Cell>

      <Cell n="05" name="Two tiers" note="The title owns its line. Everything secondary drops to a second, quieter tier that spans the column.">
        <div className="c5">
          <h1>{TITLE}</h1>
          <div className="c5-row">
            <a className="c5-back"><Icon name="arrowLeft" size={14} stroke={1.8} />{BACK}</a>
            <span className="c5-clock"><i />Picks lock in <b>{CLOCK}</b></span>
            <a className="c5-help">{HELP}</a>
          </div>
        </div>
      </Cell>

      <Cell n="06" name="One quiet line" note="Nothing hugs the edges. Title centred, and a single centred line carries all three secondary things.">
        <div className="c6">
          <h1>{TITLE}</h1>
          <div className="c6-row">
            <a><Icon name="arrowLeft" size={13} stroke={1.9} />{BACK}</a>
            <span className="c6-dot" />
            <span>Picks lock in <b>{CLOCK}</b></span>
            <span className="c6-dot" />
            <a>{HELP}</a>
          </div>
        </div>
      </Cell>

      <Cell n="07" name="Left product" note="Everything hugs the left edge and the clock sits inline with the title, far enough to read as status.">
        <div className="c7">
          <div className="c7-l">
            <a className="c7-back"><Icon name="arrowLeft" size={13} stroke={1.9} />{BACK}</a>
            <div className="c7-row">
              <h1>{TITLE}</h1>
              <span className="c7-clock">Picks lock in <b>{CLOCK}</b></span>
            </div>
          </div>
          <a className="c7-help">{HELP}</a>
        </div>
      </Cell>

      <Cell
        n="08"
        name="On the card's shoulder"
        note="No floating header: the title is the card's first row. Only the way back stays on the page."
        card={
          <div className="hb-card tall">
            <div className="c8-row">
              <h1>{TITLE}</h1>
              <div className="c8-r">
                <span className="c8-clock">Picks lock in <b>{CLOCK}</b></span>
                <a className="c8-help">{HELP}</a>
              </div>
            </div>
            <div className="hb-ghost low">
              <span className="hb-av" />
              <span className="hb-name" />
              <span className="hb-tabs"><i /><b /><i /></span>
              <span className="hb-panel" />
            </div>
          </div>
        }
      >
        <div className="c8">
          <a className="c8-back"><Icon name="arrowLeft" size={14} stroke={1.8} />{BACK}</a>
        </div>
      </Cell>

      <Cell n="09" name="Clock first" note="The deadline is nearly as loud as the name — urgency forward, for the week before the lock.">
        <div className="c9">
          <div className="c9-l">
            <a className="c9-kick"><Icon name="arrowLeft" size={12} stroke={2} />{BACK}</a>
            <h1>{TITLE}</h1>
            <a className="c9-help">{HELP}</a>
          </div>
          <div className="c9-r">
            <span>PICKS LOCK IN</span>
            <b>{CLOCK}</b>
          </div>
        </div>
      </Cell>

      <Cell n="10" name="Until needed" note="At rest only the name and a faint clock. The two actions are glyphs that grow their labels on hover.">
        <div className="c10">
          <div className="c10-state">
            <span className="c10-lbl">rest</span>
            <div className="c10-row">
              <a className="c10-ico"><Icon name="arrowLeft" size={17} stroke={1.7} /></a>
              <h1>{TITLE}</h1>
              <a className="c10-ico"><Icon name="help" size={17} stroke={1.7} /></a>
            </div>
            <div className="c10-clock dim">{CLOCK}</div>
          </div>
          <div className="c10-state on">
            <span className="c10-lbl">hover</span>
            <div className="c10-row">
              <a className="c10-ico lit"><Icon name="arrowLeft" size={17} stroke={1.7} />{BACK}</a>
              <h1>{TITLE}</h1>
              <a className="c10-ico lit"><Icon name="help" size={17} stroke={1.7} />{HELP}</a>
            </div>
            <div className="c10-clock">Picks lock in <b>{CLOCK}</b></div>
          </div>
        </div>
      </Cell>

      <Cell
        n="11"
        name="Deadline by the button"
        note="The clock moves to where it matters — next to Save Map. The header keeps only place and help."
        card={
          <>
            <CardTop />
            <div className="hb-foot">
              <span className="lbl">card footer</span>
              <span className="c11-save"><i>Locks in {CLOCK}</i><b>Save Map</b></span>
            </div>
          </>
        }
      >
        <div className="c11">
          <a className="c11-back"><Icon name="arrowLeft" size={15} stroke={1.8} />{BACK}</a>
          <h1>{TITLE}</h1>
          <a className="c11-help">{HELP}</a>
        </div>
      </Cell>

      <Cell n="12" name="Chrome strip" note="Navigation and help pin themselves to the site chrome, so the title and its clock stand alone.">
        <div className="c12">
          <div className="c12-strip">
            <a><Icon name="arrowLeft" size={13} stroke={1.9} />{BACK}</a>
            <a>{HELP}</a>
          </div>
          <div className="c12-mid">
            <h1>{TITLE}</h1>
            <span className="c12-clock">Picks lock in <b>{CLOCK}</b></span>
          </div>
        </div>
      </Cell>
    </div>
    </div>
  );
}
