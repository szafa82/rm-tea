import React, { useMemo } from 'react';
import { Coffee, Printer, Download, Phone, Mail, CheckCircle2 } from 'lucide-react';
import '../poster.css';

const CONTACT_PHONE = '07462 879010';
const CONTACT_EMAIL = 'adam.szafarczyk@royalmail.com';

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(date);
}

export default function PosterStudio({ members = [] }) {
  const activeMembers = useMemo(
    () => members
      .filter(member => !member.resigned)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' })),
    [members]
  );

  function printPoster() {
    window.print();
  }

  function downloadPoster() {
    const content = document.getElementById('tea-club-poster');
    if (!content) return;

    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Tea Club Poster</title></head><body>${content.outerHTML}</body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tea-club-poster-${new Date().toISOString().slice(0, 10)}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="posterStudio">
      <div className="posterToolbar">
        <div>
          <span className="eyebrow">Live Firestore poster</span>
          <h2>Tea Club Poster Studio</h2>
          <p>{activeMembers.length} active members included automatically</p>
        </div>

        <div className="posterActions">
          <button className="secondary" onClick={printPoster}>
            <Printer size={17} /> Print / Save PDF
          </button>
          <button className="primary" onClick={downloadPoster}>
            <Download size={17} /> Download HTML
          </button>
        </div>
      </div>

      <div className="posterStage">
        <article className="teaPoster" id="tea-club-poster">
          <div className="posterSweep posterSweepTop" />
          <div className="posterSweep posterSweepBottom" />

          <header className="posterHeader">
            <div className="royalMailMark">
              <div className="rmCrown">RM</div>
              <div>
                <strong>ROYAL MAIL</strong>
                <span>ENGINEERING</span>
              </div>
            </div>
            <div className="posterDate">Updated {formatDate()}</div>
          </header>

          <section className="posterHero">
            <div className="posterCup"><Coffee size={64} strokeWidth={1.7} /></div>
            <div>
              <p className="posterKicker">MIDLANDS SUPER HUB</p>
              <h1>TEA CLUB</h1>
              <p className="posterSubtitle">Tea, coffee, hot chocolate and milk for members</p>
            </div>
          </section>

          <section className="posterInfoBand">
            <div><strong>£5</strong><span>PER MONTH</span></div>
            <p>Join once and enjoy unlimited drinks during your shifts.</p>
          </section>

          <section className="posterMembersSection">
            <div className="posterSectionHeading">
              <span>OUR MEMBERS</span>
              <b>{activeMembers.length}</b>
            </div>

            <div className="posterMembersGrid">
              {activeMembers.map(member => (
                <div className="posterMember" key={member.id || member.name}>
                  <CheckCircle2 size={16} />
                  <span>{member.name}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="posterFooter">
            <div className="posterContact">
              <h3>JOIN OR ASK A QUESTION</h3>
              <p><Phone size={17} /> {CONTACT_PHONE}</p>
              <p><Mail size={17} /> {CONTACT_EMAIL}</p>
            </div>

            <div className="posterReminder">
              <strong>Please remember:</strong>
              <span>Milk is kept in the fridge. Tea, coffee and hot chocolate are available on the worktop.</span>
            </div>
          </section>
        </article>
      </div>
    </section>
  );
}
