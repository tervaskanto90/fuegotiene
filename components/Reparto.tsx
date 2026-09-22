import { codigo, episodios } from "@/lib/episodes";
import { recurrentes, repartoDe, totalDeNombres } from "@/lib/reparto";

/**
 * La parte de biblioteca del expediente: quién actuó en cada capítulo y, sobre
 * todo, quiénes vuelven. Es todo `<details>` nativo — sin JavaScript, cada
 * capítulo se abre solo y la página no pesa nada.
 */
export default function Reparto() {
  const vuelven = recurrentes(3);
  const total = totalDeNombres();

  return (
    <>
      <section className="seccion">
        <h2 className="seccion__titulo seccion__titulo--linea">
          las caras que vuelven
          <span className="num">{vuelven.length} en tres o más</span>
        </h2>
        <p className="seccion__bajada">
          Los Simuladores no repartía invitados sueltos: armaba un barrio. El cliente de un capítulo reaparece dos
          después recomendándole el grupo a otro, y así la serie encadena los veinticuatro. Los cuatro que más
          vuelven no son casualidad: terminaron formando la Brigada B, el equipo paralelo de la segunda temporada, y
          tres de ellos habían empezado siendo clientes en los capítulos 2, 3 y 4.
        </p>
        <ul className="caras">
          {vuelven.map((r) => (
            <li key={r.actor}>
              <span className="caras__n narrow">{r.capitulos}</span>
              <span className="caras__actor">{r.actor}</span>
              {r.personaje && <span className="caras__personaje">{r.personaje}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="seccion">
        <h2 className="seccion__titulo seccion__titulo--linea">
          quién actuó en cada capítulo
          <span className="num">{total} nombres</span>
        </h2>
        <p className="seccion__bajada">
          Tocá un capítulo para abrirlo. Primero van los que tienen papel con nombre y después el resto del reparto,
          que en esta serie es larguísimo: hay capítulos con más de veinte personas en pantalla.
        </p>
        <div className="reparto">
          {episodios.map((e) => {
            const r = repartoDe(e.id);
            const cuantos = r.invitados.length + r.tambien.length;
            return (
              <details className="reparto__cap" key={e.id}>
                <summary>
                  <span className="reparto__codigo narrow">{codigo(e)}</span>
                  <span className="reparto__titulo">{e.titulo}</span>
                  <span className="reparto__cuantos narrow">{cuantos}</span>
                </summary>
                <div className="reparto__cuerpo">
                  {r.invitados.length > 0 && (
                    <ul className="reparto__lista">
                      {r.invitados.map((i) => (
                        <li key={i.actor}>
                          <b>{i.actor}</b>
                          {i.personaje && <span className="muted"> como {i.personaje}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.tambien.length > 0 && (
                    <p className="reparto__tambien">
                      <span className="reparto__rotulo narrow">también</span> {r.tambien.join(" · ")}
                    </p>
                  )}
                </div>
              </details>
            );
          })}
        </div>
        <p className="reparto__fuente muted">
          Los nombres salen de la lista de episodios de Wikipedia en español. Son datos, no texto: acá no hay
          sinopsis copiadas.
        </p>
      </section>
    </>
  );
}
