// Íconos del reproductor: trazos simples, un solo color, sin librerías.

type P = { className?: string };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, viewBox: "0 0 24 24", "aria-hidden": true };

export const Play = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none" />
  </svg>
);
export const Pausa = ({ className }: P) => (
  <svg {...base} className={className}>
    <rect x="6" y="4.5" width="4" height="15" fill="currentColor" stroke="none" />
    <rect x="14" y="4.5" width="4" height="15" fill="currentColor" stroke="none" />
  </svg>
);
export const Atras10 = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 12a8 8 0 1 0 2.6-5.9" />
    <path d="M4 4v5h5" />
    <text x="12" y="15.5" fontSize="7.5" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="inherit">10</text>
  </svg>
);
export const Adelante10 = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M20 12a8 8 0 1 1-2.6-5.9" />
    <path d="M20 4v5h-5" />
    <text x="12" y="15.5" fontSize="7.5" fill="currentColor" stroke="none" textAnchor="middle" fontFamily="inherit">10</text>
  </svg>
);
export const Volumen = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" fill="currentColor" stroke="none" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);
export const Silencio = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" fill="currentColor" stroke="none" />
    <path d="M16 9l5 6M21 9l-5 6" />
  </svg>
);
export const PantallaCompleta = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" />
  </svg>
);
export const SalirPantalla = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M9 4v5H4M15 9V4h5M20 15h-5v5M4 15h5v5" />
  </svg>
);
export const Siguiente = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M5 5v14l10-7z" fill="currentColor" stroke="none" />
    <path d="M18 5v14" />
  </svg>
);
export const Subtitulos = ({ className }: P) => (
  <svg {...base} className={className}>
    <rect x="3" y="5" width="18" height="14" rx="1.5" />
    <path d="M7 12h4M13 12h4M7 15.5h6" />
  </svg>
);
export const Engranaje = ({ className }: P) => (
  <svg {...base} className={className}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
  </svg>
);
export const Flecha = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </svg>
);
export const Cerrar = ({ className }: P) => (
  <svg {...base} className={className}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
);
