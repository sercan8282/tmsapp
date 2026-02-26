/**
 * Dutch (NL) License Plate Component
 * 
 * Renders a realistic Dutch license plate with the blue EU strip on the left
 * containing the EU stars circle and "NL" text. The yellow area displays
 * the license plate number.
 * 
 * Supports three sizes: sm, md, lg
 */

interface LicensePlateProps {
  /** The license plate text, e.g. "AB-123-CD" */
  kenteken: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Optional extra className on the outer wrapper */
  className?: string
  /** Optional click handler */
  onClick?: () => void
}

export default function LicensePlate({ 
  kenteken, 
  size = 'md', 
  className = '',
  onClick,
}: LicensePlateProps) {
  const sizeConfig = {
    sm: {
      plate: 'h-6 min-w-[90px] rounded-[3px] border',
      euStrip: 'w-5 px-0.5 rounded-l-[2px]',
      stars: 'w-3 h-3',
      starSize: 2,
      nl: 'text-[5px] font-bold',
      text: 'text-[11px] px-1.5 tracking-wider',
    },
    md: {
      plate: 'h-8 min-w-[130px] rounded-[4px] border-[1.5px]',
      euStrip: 'w-7 px-1 rounded-l-[3px]',
      stars: 'w-4 h-4',
      starSize: 2.5,
      nl: 'text-[7px] font-bold',
      text: 'text-sm px-2.5 tracking-widest',
    },
    lg: {
      plate: 'h-10 min-w-[170px] rounded-[5px] border-2',
      euStrip: 'w-9 px-1 rounded-l-[4px]',
      stars: 'w-5 h-5',
      starSize: 3,
      nl: 'text-[9px] font-bold',
      text: 'text-base px-3 tracking-[0.2em]',
    },
  }

  const cfg = sizeConfig[size]

  return (
    <div
      className={`
        inline-flex items-stretch ${cfg.plate}
        border-gray-800 bg-[#F7B731] shadow-sm
        overflow-hidden select-none
        ${onClick ? 'cursor-pointer hover:shadow-md hover:brightness-105 transition-all' : ''}
        ${className}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') onClick() } : undefined}
    >
      {/* Blue EU strip */}
      <div className={`
        ${cfg.euStrip}
        bg-[#003399] flex flex-col items-center justify-center gap-0.5
        flex-shrink-0
      `}>
        {/* EU Stars circle */}
        <EUStars className={cfg.stars} starSize={cfg.starSize} />
        {/* NL text */}
        <span className={`${cfg.nl} text-white leading-none`}>NL</span>
      </div>
      
      {/* Yellow plate area with kenteken text */}
      <div className={`
        flex items-center justify-center flex-1
        ${cfg.text}
        font-bold text-gray-900 font-mono
        whitespace-nowrap
      `}>
        {kenteken?.toUpperCase() || '—'}
      </div>
    </div>
  )
}

/**
 * EU Stars circle - 12 stars arranged in a circle
 */
function EUStars({ className, starSize }: { className: string; starSize: number }) {
  const stars = Array.from({ length: 12 }, (_, i) => {
    const angle = (i * 30 - 90) * (Math.PI / 180)
    const radius = 38
    const cx = 50 + radius * Math.cos(angle)
    const cy = 50 + radius * Math.sin(angle)
    return { cx, cy }
  })

  return (
    <svg className={className} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      {stars.map((star, i) => (
        <Star key={i} cx={star.cx} cy={star.cy} size={starSize} />
      ))}
    </svg>
  )
}

/**
 * 5-pointed star SVG path
 */
function Star({ cx, cy, size }: { cx: number; cy: number; size: number }) {
  const r = size * 4
  const points = Array.from({ length: 5 }, (_, i) => {
    const angle = (i * 72 - 90) * (Math.PI / 180)
    return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`
  })
  const innerPoints = Array.from({ length: 5 }, (_, i) => {
    const angle = (i * 72 - 90 + 36) * (Math.PI / 180)
    const ir = r * 0.4
    return `${cx + ir * Math.cos(angle)},${cy + ir * Math.sin(angle)}`
  })
  
  // Interleave outer and inner points
  const path = points.map((p, i) => `${p} ${innerPoints[i]}`).join(' ')

  return (
    <polygon
      points={path}
      fill="#F7B731"
      stroke="none"
    />
  )
}
