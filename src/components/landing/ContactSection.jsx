import { useEffect, useRef, useState } from 'react';
import { Mail, Send } from 'lucide-react';

const CONTACT_EMAILS = ['contact@roamerz.io', 'polskoydm@gmail.com'];
const CONTACT_DISPLAY = CONTACT_EMAILS[0];

export default function ContactSection() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); },
      { threshold: 0.1 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const canSubmit = name.trim() && email.trim() && message.trim();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    const subject = encodeURIComponent(`Contact from ${name.trim()}`);
    const body = encodeURIComponent(
      `Name: ${name.trim()}\nEmail: ${email.trim()}\n\n${message.trim()}`
    );
    window.location.href = `mailto:${CONTACT_EMAILS.join(',')}?subject=${subject}&body=${body}`;
    setSent(true);
  };

  const inputStyle = {
    width: '100%',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: '14px 16px',
    color: '#fff',
    fontSize: 15,
    outline: 'none',
    transition: 'all 0.2s ease',
    fontFamily: 'inherit',
  };

  return (
    <section
      id="contact"
      ref={ref}
      className="relative py-20 md:py-28 px-4 sm:px-6 md:px-16 overflow-hidden"
      style={{
        background: 'transparent',
        position: 'relative',
        zIndex: 10,
      }}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse 50% 40% at 50% 30%, rgba(56,189,248,0.06) 0%, transparent 70%)',
      }} />

      <div className="relative z-10 max-w-2xl mx-auto">
        {/* Badge */}
        <div
          className="flex justify-center"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.8s ease 0.05s, transform 0.8s ease 0.05s',
            marginBottom: 18,
          }}
        >
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(56,189,248,0.07)', border: '1px solid rgba(56,189,248,0.2)',
            borderRadius: 999, padding: '6px 18px',
          }}>
            <Mail size={14} style={{ color: '#38bdf8' }} />
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, letterSpacing: '0.04em' }}>
              GET IN TOUCH
            </span>
          </div>
        </div>

        {/* Headline */}
        <h2
          className="text-center"
          style={{
            fontSize: 'clamp(1.8rem, 5vw, 3rem)',
            fontWeight: 900,
            letterSpacing: '-0.02em',
            color: '#fff',
            margin: 0,
            marginBottom: 12,
            lineHeight: 1.1,
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'opacity 0.8s ease 0.15s, transform 0.8s ease 0.15s',
          }}
        >
          Got a question?{' '}
          <span style={{
            background: 'linear-gradient(90deg, #38bdf8, #67e8f9)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Drop us a line.
          </span>
        </h2>

        <p
          className="text-center"
          style={{
            color: 'rgba(255,255,255,0.45)',
            fontSize: 15,
            marginBottom: 36,
            lineHeight: 1.7,
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.8s ease 0.25s',
          }}
        >
          Press, partnerships, support — we usually reply within 24 hours.
        </p>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'opacity 0.8s ease 0.35s, transform 0.8s ease 0.35s',
            background: 'rgba(8,18,36,0.55)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            padding: 'clamp(20px, 4vw, 32px)',
            boxShadow: '0 0 40px rgba(56,189,248,0.08), 0 20px 60px rgba(0,0,0,0.5)',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}
               className="contact-grid">
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = 'rgba(56,189,248,0.4)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
              onFocus={(e) => e.target.style.borderColor = 'rgba(56,189,248,0.4)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>

          <textarea
            placeholder="How can we help?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            required
            style={{ ...inputStyle, resize: 'vertical', minHeight: 120 }}
            onFocus={(e) => e.target.style.borderColor = 'rgba(56,189,248,0.4)'}
            onBlur={(e) => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
          />

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            marginTop: 4,
          }}>
            <a
              href={`mailto:${CONTACT_EMAILS.join(',')}`}
              style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: 13,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#38bdf8'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
            >
              <Mail size={14} />
              {CONTACT_DISPLAY}
            </a>

            <button
              type="submit"
              disabled={!canSubmit}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '12px 24px',
                borderRadius: 999,
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: '0.02em',
                background: canSubmit
                  ? 'linear-gradient(135deg, #1a7fa0, #0e5f7a)'
                  : 'rgba(255,255,255,0.06)',
                color: canSubmit ? '#fff' : 'rgba(255,255,255,0.3)',
                border: '1px solid transparent',
                cursor: canSubmit ? 'pointer' : 'default',
                boxShadow: canSubmit ? '0 0 24px rgba(56,189,248,0.25)' : 'none',
                transition: 'all 0.2s ease',
              }}
            >
              <Send size={14} />
              {sent ? 'Opening your mail app…' : 'Send message'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        @media (max-width: 540px) {
          .contact-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}
