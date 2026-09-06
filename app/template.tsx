// Se vuelve a montar en cada navegación: así la página entra con un fundido
// corto (ver .pagina en globals.css). El layout, con las fuentes, no se toca.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="pagina">{children}</div>;
}
