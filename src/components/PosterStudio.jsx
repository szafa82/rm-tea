import React, { useMemo, useRef, useState } from 'react';
import {
  Printer, Phone, Mail, CalendarDays, Milk, Coffee, UserRound, Check,
  Download, ImageDown, LayoutTemplate, Columns3, Sparkles
} from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import '../poster.css';

function formatDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric'
  }).format(date);
}

function splitColumns(items, columnCount) {
  const columns = Array.from({ length: columnCount }, () => []);
  const rows = Math.ceil(items.length / columnCount);
  items.forEach((item, index) => {
    const column = Math.min(Math.floor(index / rows), columnCount - 1);
    columns[column].push(item);
  });
  return columns;
}

function safeFilename(value) {
  return String(value || 'tea-club-poster')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export default function PosterStudio({ members = [], settings = {} }) {
  const posterRef = useRef(null);
  const [template, setTemplate] = useState('classic');
  const [columnMode, setColumnMode] = useState('auto');
  const [nameScale, setNameScale] = useState(100);
  const [busy, setBusy] = useState('');
  const [showContact, setShowContact] = useState(true);

  const activeMembers = useMemo(
    () => members
      .filter(member => !member.resigned)
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'en', { sensitivity: 'base' })),
    [members]
  );

  const columnCount = columnMode === 'auto'
    ? (activeMembers.length > 38 ? 3 : 2)
    : Number(columnMode);
  const columns = useMemo(() => splitColumns(activeMembers, columnCount), [activeMembers, columnCount]);

  async function capturePoster(scale = 3) {
    if (!posterRef.current) throw new Error('Poster is not ready');
    return html2canvas(posterRef.current, {
      scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: posterRef.current.offsetWidth,
      height: posterRef.current.offsetHeight
    });
  }

  async function downloadPng() {
    try {
      setBusy('png');
      const canvas = await capturePoster(3);
      const link = document.createElement('a');
      link.download = `${safeFilename(settings.clubName)}-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png', 1);
      link.click();
    } finally {
      setBusy('');
    }
  }

  async function downloadPdf() {
    try {
      setBusy('pdf');
      const canvas = await capturePoster(2.5);
      const img = canvas.toDataURL('image/jpeg', 0.98);
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
      pdf.addImage(img, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      pdf.save(`${safeFilename(settings.clubName)}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } finally {
      setBusy('');
    }
  }

  return (
    <section className="posterStudio">
      <div className="posterToolbar posterToolbarV11">
        <div>
          <span className="eyebrow">V11 Poster Studio</span>
          <h2>Tea Club Poster Studio</h2>
          <p>{activeMembers.length} active members included automatically</p>
        </div>

        <div className="posterActions">
          <button className="secondary" onClick={() => window.print()}><Printer size={17}/>Print</button>
          <button className="secondary" disabled={Boolean(busy)} onClick={downloadPng}><ImageDown size={17}/>{busy === 'png' ? 'Creating…' : 'PNG 300 DPI'}</button>
          <button className="primary" disabled={Boolean(busy)} onClick={downloadPdf}><Download size={17}/>{busy === 'pdf' ? 'Creating…' : 'Download PDF'}</button>
        </div>
      </div>

      <div className="posterControls">
        <label><LayoutTemplate size={16}/>Template
          <select value={template} onChange={event => setTemplate(event.target.value)}>
            <option value="classic">Classic RM</option>
            <option value="premium">Premium</option>
            <option value="dark">Dark</option>
          </select>
        </label>
        <label><Columns3 size={16}/>Columns
          <select value={columnMode} onChange={event => setColumnMode(event.target.value)}>
            <option value="auto">Auto</option><option value="2">2 columns</option><option value="3">3 columns</option>
          </select>
        </label>
        <label className="scaleControl"><Sparkles size={16}/>Name size
          <input type="range" min="82" max="112" value={nameScale} onChange={event => setNameScale(Number(event.target.value))}/>
          <b>{nameScale}%</b>
        </label>
        <label className="toggleControl"><input type="checkbox" checked={showContact} onChange={event => setShowContact(event.target.checked)}/>Contact panel</label>
      </div>

      <div className="posterStage">
        <article
          className={`teaPoster poster-${template} columns-${columnCount}`}
          id="tea-club-poster"
          ref={posterRef}
          style={{ '--name-scale': nameScale / 100 }}
        >
          <div className="posterTopArtwork"><div className="topArc topArcOne"/><div className="topArc topArcTwo"/><div className="topArc topArcThree"/></div>

          <header className="posterLogoBlock">
            <div className="engineeringLogo" aria-label="RM Engineering">
              <div className="gearTeeth"/><div className="gearCore"><strong>RM</strong></div><span>ENGINEERING</span>
            </div>
          </header>

          <section className="posterTitleBlock">
            <h1>{settings.clubName || 'TEA CLUB'}</h1>
            <div className="titleDivider"><span/><b>◆</b><span/></div>
          </section>

          <section className="drinksRow" aria-label="Available refreshments">
            {(settings.drinks || ['Milk available', 'Hot chocolate', 'Tea', 'Decaf tea', 'Coffee', 'Decaf coffee']).map((drink, index) => (
              <React.Fragment key={`${drink}-${index}`}>
                {index > 0 && <i>•</i>}
                <div>{index === 0 ? <Milk size={18}/> : <Coffee size={18}/>} {drink}</div>
              </React.Fragment>
            ))}
          </section>

          <p className="posterInstruction">Please help yourself to tea, coffee and refreshments only if your name appears below.</p>

          <section className="joinStrip"><div className="joinIcon"><UserRound size={26}/></div><p>To join or ask a question, please speak to <strong>{settings.contactName || 'Adam Szafarczyk'}.</strong></p></section>

          <section className="memberFrame">
            <div className="posterMemberColumns">
              {columns.map((column, columnIndex) => (
                <div className="posterMemberColumn" key={columnIndex}>
                  {column.map(member => (
                    <div className="posterMemberName" key={member.id || member.name} title={member.name}>
                      <Check size={16} strokeWidth={3.2}/><span>{member.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {showContact && <section className="contactFrame">
              <div className="contactRibbon">TO JOIN OR FOR ANY QUESTIONS</div>
              <div className="contactGrid">
                <div className="contactItem"><div className="contactCircle"><Phone size={28}/></div><div><span>Call or WhatsApp</span><strong>{settings.phone || '07462 879010'}</strong></div></div>
                <div className="contactDivider"/>
                <div className="contactItem emailContact"><div className="contactCircle"><Mail size={28}/></div><div><span>Email</span><strong>{settings.email || 'adam.szafarczyk@royalmail.com'}</strong></div></div>
              </div>
            </section>}
          </section>

          <footer className="posterBottom"><div className="bottomArc bottomArcGrey"/><div className="bottomArc bottomArcRed"/><div className="bottomArc bottomArcDark"/><div className="bottomCup"><Coffee size={32}/></div><div className="updatedLine"><CalendarDays size={20}/><span>Last updated:</span><strong>{formatDate()}</strong></div></footer>
        </article>
      </div>
    </section>
  );
}
