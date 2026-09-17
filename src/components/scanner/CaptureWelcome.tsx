import { Camera, UploadCloud, ArrowUpRight, ScanLine, Check, Globe2, Users, ArrowRight } from 'lucide-react';

interface Props { onScan: () => void; onUpload: () => void; onDrop: (event: React.DragEvent) => void; onContacts: () => void; count: number }
export default function CaptureWelcome({ onScan, onUpload, onDrop, onContacts, count }: Props) {
  return <div className="capture-home">
    <div className="workspace-heading"><span>YOUR CONNECTIONS, ELEVATED</span><span className="workspace-label"><span /> Contact workspace</span></div>
    <section className="capture-hero">
      <div className="hero-copy">
        <div className="eyebrow"><span /> BUILT FOR EVERY CONNECTION</div>
        <h1>A world of opportunity.<br /><em>One card away.</em></h1>
        <p>From a first introduction to your next aviation partnership. Turn business cards into contacts worth keeping.</p>
        <div className="hero-actions"><button className="primary-action" onClick={onScan}><Camera size={18} /> Scan Business Card <ArrowUpRight size={17} /></button><button className="secondary-action" onClick={onUpload}><UploadCloud size={18} /> Upload Card</button></div>
        <div className="hero-note"><Check size={14} /> Capture. Review. Connect.</div>
      </div>
      <div className="capture-visual" onDrop={onDrop} onDragOver={e => e.preventDefault()}>
        <div className="visual-grid" />
        <div className="orbit orbit-one" /><div className="orbit orbit-two" />
        <div className="visual-heading"><span><span className="status-dot" /> CONTACT CAPTURE</span><ScanLine size={17} /></div>
        <div className="sample-card"><div className="sample-brand"><img src="/Picture1.png" alt="Aventure Aviation" /><span>GLOBAL CONNECTIONS</span></div><div className="sample-person"><strong>Alex Morgan</strong><span>Director of Aircraft Solutions</span></div><div className="sample-details"><span>alex@example.com</span><span>+1 202 555 0148</span></div><div className="card-flight-path" /></div>
        <div className="scan-corners"><i /><i /><i /><i /><div className="visual-scan-beam" /></div>
        <div className="extraction-chip"><div><Check size={16} /></div><span>From card to connection<small>Clean, structured contact details</small></span></div>
        <div className="visual-bottom"><span>ILLUSTRATIVE CONTACT</span><span>01 — 03</span></div>
      </div>
    </section>
    <section className="connection-strip"><div><Globe2 size={21} /><span>Keeping aviation connected.<small>Across conversations. Across the world.</small></span></div><span className="strip-caption">AIRCRAFT PARTS. GLOBAL PARTNERSHIPS.</span><svg viewBox="0 0 160 32" aria-hidden="true"><path d="M0 27 C60 27 100 24 155 3" /><path d="m144 3 11 0-6 9" /></svg></section>
    <section className="workspace-grid">
      <div className="journey-panel"><div className="section-heading"><h2>A better way to follow through.</h2><span>THREE SIMPLE STEPS</span></div><div className="journey-steps">{[{ n: '01', title: 'Capture the card', text: 'Use your camera or upload a clear image.', icon: Camera }, { n: '02', title: 'Make it accurate', text: 'Review extracted details. Fine-tune anything.', icon: ScanLine }, { n: '03', title: 'Keep the connection', text: 'Save a verified contact, ready for what’s next.', icon: Users }].map(step => <div className="journey-step" key={step.n}><div className="step-top"><step.icon size={20} /><span>{step.n}</span></div><h3>{step.title}</h3><p>{step.text}</p></div>)}</div></div>
      <button className="contacts-panel" onClick={onContacts}><div className="contacts-panel-top"><span>YOUR CONTACT COLLECTION</span><ArrowUpRight size={20} /></div><div className="contact-total">{String(count).padStart(2, '0')}<span>verified {count === 1 ? 'contact' : 'contacts'}</span></div><div className="contacts-panel-bottom"><span>{count ? 'Your next conversation starts here.' : 'Every great partnership starts somewhere.'}</span><ArrowRight size={17} /></div></button>
    </section>
    <footer className="workspace-footer"><span>AVENTURE AVIATION <span className="footer-dot">/</span> CONTACT CAPTURE</span><span>Designed for the connections that move aviation.</span></footer>
  </div>;
}
