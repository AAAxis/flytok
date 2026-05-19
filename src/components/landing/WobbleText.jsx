export default function WobbleText({ text, color }) {
  return (
    <div style={{ whiteSpace: 'pre' }}>
      {text.split('').map((char, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            color: color || '#38bdf8',
            animation: `wobble 2s ease-in-out infinite`,
            animationDelay: `${i * 0.05}s`,
          }}
        >
          {char}
        </span>
      ))}
    </div>
  );
}