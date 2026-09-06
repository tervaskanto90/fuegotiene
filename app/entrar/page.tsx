import type { Metadata } from "next";
import { leerConfig, rutaSegura } from "@/lib/auth";
import { sitio } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "entrar" };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function Entrar({ searchParams }: Props) {
  const params = await searchParams;
  const conError = params.error === "1";
  const volverA = rutaSegura(typeof params.a === "string" ? params.a : "/");
  const config = leerConfig();

  return (
    <main className="entrar">
      <span className="wordmark">
        {sitio.nombre.replace("?", "")}
        <span className="wordmark__signo">?</span>
      </span>
      <p className="entrar__bajada">{sitio.bajada}</p>

      {!config.ok ? (
        <div className="aviso aviso--config" role="alert">
          <p>
            <strong>El sitio no está configurado todavía.</strong> {config.problema}
          </p>
          <p style={{ marginTop: 8 }}>
            Se arregla en Vercel: <code>Settings</code>, <code>Environment Variables</code>. Después hay que hacer
            un <code>Redeploy</code> para que tome el cambio.
          </p>
        </div>
      ) : (
        <form method="post" action="/api/entrar">
          <input type="hidden" name="a" value={volverA} />
          <label htmlFor="codigo" className="muted">
            Poné tu código para entrar.
          </label>
          <input
            id="codigo"
            name="codigo"
            className="campo"
            type="password"
            autoComplete="current-password"
            autoFocus
            required
            spellCheck={false}
          />
          {conError && (
            <p className="aviso" role="alert">
              Ese código no es. Fijate si lo copiaste entero, sin espacios.
            </p>
          )}
          <div>
            <button className="boton boton--acento" type="submit">
              entrar
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
