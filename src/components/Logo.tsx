import './Logo.css'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
}

export default function Logo({ size = 'md', showText = true }: LogoProps) {
  return (
    <div className={`logo logo-${size}`}>
      <svg
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        className="logo-svg"
      >
        {/* Background circle */}
        <circle cx="100" cy="100" r="95" fill="#f0f8ff" stroke="#1e5a96" strokeWidth="2" />

        {/* Water waves */}
        <path
          d="M 30 120 Q 50 110, 70 120 T 110 120 T 150 120 T 190 120"
          stroke="#00a86b"
          strokeWidth="2"
          fill="none"
          opacity="0.7"
        />
        <path
          d="M 20 135 Q 40 125, 60 135 T 100 135 T 140 135 T 180 135"
          stroke="#00a86b"
          strokeWidth="1.5"
          fill="none"
          opacity="0.5"
        />

        {/* Main fish body */}
        <ellipse cx="100" cy="80" rx="45" ry="30" fill="#1e5a96" />

        {/* Fish head */}
        <circle cx="55" cy="75" r="20" fill="#1e5a96" />

        {/* Fish eye */}
        <circle cx="48" cy="70" r="5" fill="#00a86b" />
        <circle cx="50" cy="70" r="2" fill="white" />

        {/* Fish mouth */}
        <path d="M 45 75 Q 42 77, 45 80" stroke="#f0f8ff" strokeWidth="1.5" fill="none" />

        {/* Dorsal fin */}
        <polygon points="85,50 90,30 95,50" fill="#00a86b" opacity="0.8" />

        {/* Tail fin */}
        <polygon points="145,75 175,60 175,90" fill="#00a86b" opacity="0.8" />

        {/* Bottom fin */}
        <ellipse cx="100" cy="110" rx="20" ry="10" fill="#00a86b" opacity="0.6" />

        {/* Side fin */}
        <polygon points="75,85 70,95 80,95" fill="#00a86b" opacity="0.7" />

        {/* Decorative accent lines on fish body */}
        <line x1="80" y1="75" x2="95" y2="75" stroke="#f0f8ff" strokeWidth="1" opacity="0.6" />
        <line x1="80" y1="85" x2="110" y2="85" stroke="#f0f8ff" strokeWidth="1" opacity="0.4" />

        {/* Optional decorative element - sunrise/lake reflection */}
        <circle cx="140" cy="35" r="8" fill="#ffa500" opacity="0.3" />
      </svg>

      {showText && (
        <div className="logo-text-container">
          <h2 className="logo-text-main">Victoria Fresh Fish</h2>
          <p className="logo-text-sub">Lake to Table</p>
        </div>
      )}
    </div>
  )
}
