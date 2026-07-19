import React, { useMemo } from 'react';
import {
  Printer, Phone, Mail, CalendarDays, Milk, Coffee,
  UserRound, Check
} from 'lucide-react';
import '../poster.css';

const CONTACT_NAME = 'Adam Szafarczyk';
const CONTACT_PHONE = '07462 879010';
const CONTACT_EMAIL = 'adam.szafarczyk@royalmail.com';

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

export default function PosterStudio({ members = [] }) {
  const activeMembers = useMemo(
    () => members
      .filter(member => !member.resigned)
      .sort((a, b) =>
        String(a.name || '').localeCompare(
          String(b.name || ''),
          'en',
          { sensitivity: 'base' }
        )
      ),
    [members]
  );

  const splitAt = Math.ceil(activeMembers.length / 2);
  const columns = [
    activeMembers.slice(0, splitAt),
    activeMembers.slice(splitAt)
  ];

  return (
    <section className="posterStudio">
      <div className="posterToolbar">
        <div>
          <span className="eyebrow">Live Firestore poster</span>
          <h2>Tea Club Poster Studio</h2>
          <p>{activeMembers.length} active members included automatically</p>
        </div>

        <button className="primary" onClick={() => window.print()}>
          <Printer size={17} /> Print / Save PDF
        </button>
      </div>

      <div className="posterStage">
        <article className="teaPoster" id="tea-club-poster">
          <div className="posterTopArtwork">
            <div className="topArc topArcOne" />
            <div className="topArc topArcTwo" />
            <div className="topArc topArcThree" />
          </div>

          <header className="posterLogoBlock">
            <div className="engineeringLogo" aria-label="RM Engineering">
              <div className="gearTeeth" />
              <div className="gearCore">
                <strong>RM</strong>
              </div>
              <span>ENGINEERING</span>
            </div>
          </header>

          <section className="posterTitleBlock">
            <h1>TEA CLUB</h1>
            <div className="titleDivider">
              <span />
              <b>◆</b>
              <span />
            </div>
          </section>

          <section className="drinksRow" aria-label="Available refreshments">
            <div><Milk size={20} /> Milk available</div>
            <i>•</i>
            <div><Coffee size={20} /> Hot chocolate</div>
            <i>•</i>
            <div><span className="drinkLeaf blackLeaf">◒</span> Tea</div>
            <i>•</i>
            <div><span className="drinkLeaf greenLeaf">●</span> Decaf tea</div>
            <i>•</i>
            <div><span className="coffeeBean brownBean">●</span> Coffee</div>
            <i>•</i>
            <div><span className="coffeeBean redBean">●</span> Decaf coffee</div>
          </section>

          <p className="posterInstruction">
            Please help yourself to tea, coffee and refreshments only if your name appears below.
          </p>

          <section className="joinStrip">
            <div className="joinIcon"><UserRound size={28} /></div>
            <p>
              To join or ask a question, please speak to
              <strong> {CONTACT_NAME}.</strong>
            </p>
          </section>

          <section className="memberFrame">
            <div className="posterMemberColumns">
              {columns.map((column, columnIndex) => (
                <div className="posterMemberColumn" key={columnIndex}>
                  {column.map(member => (
                    <div className="posterMemberName" key={member.id || member.name}>
                      <Check size={18} strokeWidth={3.2} />
                      <span>{member.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <section className="contactFrame">
              <div className="contactRibbon">TO JOIN OR FOR ANY QUESTIONS</div>

              <div className="contactGrid">
                <div className="contactItem">
                  <div className="contactCircle"><Phone size={30} /></div>
                  <div>
                    <span>Call or WhatsApp</span>
                    <strong>{CONTACT_PHONE}</strong>
                  </div>
                </div>

                <div className="contactDivider" />

                <div className="contactItem emailContact">
                  <div className="contactCircle"><Mail size={30} /></div>
                  <div>
                    <span>Email</span>
                    <strong>{CONTACT_EMAIL}</strong>
                  </div>
                </div>
              </div>
            </section>
          </section>

          <footer className="posterBottom">
            <div className="bottomArc bottomArcGrey" />
            <div className="bottomArc bottomArcRed" />
            <div className="bottomArc bottomArcDark" />

            <div className="bottomCup"><Coffee size={34} /></div>

            <div className="updatedLine">
              <CalendarDays size={21} />
              <span>Last updated:</span>
              <strong>{formatDate()}</strong>
            </div>
          </footer>
        </article>
      </div>
    </section>
  );
}
