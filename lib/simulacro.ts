// El juego: te dan un caso, escribís el operativo y se simula cómo sale.
//
// Este archivo escribe el desenlace entero: mira el plan, detecta qué
// elementos de un operativo tiene y cuáles le faltan, puntúa y arma el
// relato. **No usa red ni azar**: el mismo plan da siempre el mismo
// resultado, la variedad sale de un hash del propio texto. Por eso el juego
// no puede costar plata ni quedarse sin respuesta, y se testea como
// cualquier función.

export type Caso = {
  id: string;
  titulo: string;
  cliente: string;
  problema: string;
  objetivo: string;
  limites: string[];
};

export type Veredicto = "vacio" | "se-cae" | "raspando" | "sale" | "redondo";

export type Fase = { titulo: string; texto: string };

export type Resultado = {
  puntaje: number;
  veredicto: Veredicto;
  titulo: string;
  fases: Fase[];
  tuvo: string[];
  falto: string[];
  nota: string;
};

export const MAX_PLAN = 4000;
const MINIMO_PALABRAS = 25;

export const casos: Caso[] = [
  {
    id: "panaderia",
    titulo: "La panadería de la esquina",
    cliente: "Aníbal Sosa, 61 años, panadero",
    problema:
      "Hace treinta y dos años que amasa en el mismo local. El dueño del inmueble no le renueva el contrato: una cadena de café le ofrece el triple y quiere el local vacío en sesenta días.",
    objetivo: "Que el dueño renueve el contrato por su voluntad y a un precio que Aníbal pueda pagar.",
    limites: [
      "Aníbal no tiene con qué igualar la oferta.",
      "El dueño es un tipo grande, vanidoso, que vive de las rentas y se jacta de que nunca perdió un peso.",
      "La cadena tiene abogados y paciencia.",
    ],
  },
  {
    id: "diploma",
    titulo: "El título que no existe",
    cliente: "Carla Benegas, 34 años, jefa de compras",
    problema:
      "Entró a la empresa diciendo que era contadora. Nunca terminó la carrera. Hace seis años que hace bien su trabajo y ahora Recursos Humanos está pidiendo los títulos de todo el personal jerárquico.",
    objetivo: "Que nadie le pida más el título y que no la echen ni la denuncien.",
    limites: [
      "Falsificar un diploma la deja peor que antes.",
      "La jefa de Recursos Humanos acaba de entrar y quiere mostrar que ordena la casa.",
      "Carla no piensa renunciar: es el único sueldo de la familia.",
    ],
  },
  {
    id: "masters",
    titulo: "Los másters de la banda",
    cliente: "Los pibes de Ferretería Godoy, banda de Lanús",
    problema:
      "Grabaron un disco entero con un productor que ahora dice que las cintas son de él, que las pagó y que si las quieren, las compren. Pide una cifra que no tienen.",
    objetivo: "Recuperar las cintas sin pagarle, y que el productor no vuelva a hacérselo a otro.",
    limites: [
      "No hay contrato firmado: la palabra de ellos contra la de él.",
      "El productor guarda todo en un estudio con alarma en Villa Crespo.",
      "Si desaparecen las cintas y él sospecha de la banda, los hunde.",
    ],
  },
  {
    id: "tratamiento",
    titulo: "El tratamiento milagroso",
    cliente: "Nélida Paz, 72 años, jubilada",
    problema:
      "Un instituto le vendió un tratamiento para la artrosis en tres mil dólares, los ahorros de toda su vida. Son unas pastillas de nada y un aparato que no hace nada. Ya no le atienden el teléfono.",
    objetivo: "Que le devuelvan la plata y que el instituto deje de venderle eso a otros jubilados.",
    limites: [
      "Firmó un papel que dice que el tratamiento es 'de resultado no garantizado'.",
      "El que atiende es un empleado; el dueño no aparece nunca.",
      "Nélida se avergüenza y no quiere que la familia se entere.",
    ],
  },
  {
    id: "ascenso",
    titulo: "El informe ajeno",
    cliente: "Ruiz, 29 años, analista",
    problema:
      "Trabajó ocho meses en un informe que le cambió el número a la empresa. Su jefe lo presentó como propio en el directorio y se llevó el ascenso. Ruiz tiene los borradores, pero nadie le va a creer.",
    objetivo: "Que en el directorio quede claro de quién es el trabajo, sin que Ruiz quede como el resentido de la oficina.",
    limites: [
      "El jefe tiene veinte años en la empresa y todos lo quieren.",
      "Si Ruiz habla primero, pierde.",
      "El directorio se reúne otra vez en tres semanas.",
    ],
  },
  {
    id: "terreno",
    titulo: "El alambrado que se movió",
    cliente: "Los Ferrari, matrimonio, un terreno en Luján",
    problema:
      "Ahorraron quince años para comprar un lote. El vecino les corrió el alambrado treinta metros adentro y dice que siempre estuvo ahí. Tiene un plano viejo que, mirado rápido, le da la razón.",
    objetivo: "Que el vecino devuelva los treinta metros y firme, sin juicio de por medio.",
    limites: [
      "El juicio tarda años y no lo pueden pagar.",
      "El vecino ya hizo lo mismo del otro lado y le salió bien.",
      "En el pueblo todos se conocen: un escándalo se lo comen ellos.",
    ],
  },
];

export function buscarCaso(id: string): Caso | undefined {
  return casos.find((c) => c.id === id);
}

type Senal = { id: string; etiqueta: string; peso: number; re: RegExp };

const SENALES: Senal[] = [
  {
    id: "informacion",
    etiqueta: "estudiar al otro antes de mover una ficha",
    peso: 16,
    re: /investig|averigu|seguirl|segu(i|í)mos|antecedent|\bdatos?\b|estudi|observ|vigil|rutina|espi|inteligencia|saber (qué|quién|dónde|cómo)|mirar cómo/i,
  },
  {
    id: "personaje",
    etiqueta: "un personaje creíble adelante",
    peso: 18,
    re: /hacerse pasar|se hace pasar|nos hacemos pasar|haci(é|e)ndose pasar|hacerme pasar|personaje|disfraz|fing|actua|actúa|actuar|simul|inspector|perito|escriban|auditor|abogad|m(é|e)dic|doctor|funcionari|periodist|comprador|tasador|enviado|representante|cliente falso|\bfalso\b|\bfalsa\b|present(a|á|ar)se como|se presenta como|aparece como|entra como|hace de\b|en\s+el\s+papel\s+de|uno\s+de\s+nosotros|de\s+inc(ó|o)gnito/i,
  },
  {
    id: "montaje",
    etiqueta: "el mundo falso armado",
    peso: 16,
    re: /oficina|cartel|escenograf|utiler|imprent|document|papel|credencial|folleto|tarjeta|sello|formulario|expediente|cami(ó|o)n|camioneta|\bauto\b|uniforme|placa|equipo de|c(á|a)mara|grabador|micr(ó|o)fono|empresa|sociedad|consultora|inmobiliaria|constructora|estudio\s+jur|sucursal|grupo\s+(hotelero|inversor|empresario)|firma\s+que|membrete/i,
  },
  {
    id: "guion",
    etiqueta: "un orden con tiempos",
    peso: 14,
    re: /primero|despu(é|e)s|luego|entonces|el d(í|i)a|a las \d|paso \d|etapa|mientras|cuando |al mismo tiempo|el lunes|el martes|el mi(é|e)rcoles|esa noche|al otro d(í|i)a|la semana/i,
  },
  {
    id: "equipo",
    etiqueta: "cada uno con lo suyo",
    peso: 12,
    re: /santos|ravenna|lampon|medina|cada uno|me encargo|se encarga|uno de nosotros|el otro mientras|en paralelo/i,
  },
  {
    id: "salida",
    etiqueta: "una salida sin rastro",
    peso: 14,
    re: /desaparec|no volver|nunca se entera|no se entera|sin que sepa|sin que se entere|retirar|levantar todo|desarm|no queda rastro|cortar todo|nos borramos|se cierra la oficina/i,
  },
  {
    id: "contingencia",
    etiqueta: "algo previsto por si se cae",
    peso: 10,
    re: /si sale mal|por las dudas|plan b|si no funciona|si sospecha|si pregunta|si falla|prever|respaldo|por si acaso|alternativa/i,
  },
];

type Pena = { id: string; etiqueta: string; peso: number; re: RegExp };

const PENAS: Pena[] = [
  {
    id: "violencia",
    etiqueta: "hay violencia o amenazas, y así no se trabaja",
    peso: 60,
    // Ojo con "arma": Santos arma el operativo. Sólo cuentan las armas nombradas.
    // Ojo con el castellano: "amenace" no lleva z, "Santos arma el operativo"
    // no es un arma y "golpea la puerta" no es golpear a nadie.
    re: /golpearl|golpear\s+a\b|lo\s+golpea|a\s+los\s+golpes|una\s+paliza|trompada|peg(a|á)rle|le\s+pegamos|amena[zc]|\bun arma\b|\barmas\b|arma\s+de\s+fuego|pistola|rev(ó|o)lver|cuchillo|secuestr|lastim|romperle|matarlo|apret|apriet|cagarlo a|meterle\s+miedo|un\s+susto|asustarlo|extorsion|chantaj/i,
  },
  {
    id: "frontal",
    etiqueta: "se le habla de frente al otro, que es lo que ya falló",
    peso: 16,
    re: /le decimos la verdad|contarle todo|explicarle que|hablar con (é|e)l y decirle|convencerlo hablando|pedirle por favor/i,
  },
  {
    id: "sinsimulacro",
    etiqueta: "se delega en la justicia o la policía, que no es un operativo",
    peso: 14,
    re: /hacer la denuncia|ir a la polic(í|i)a|llamar a la polic(í|i)a|meter un juicio|denunciarlo en|demanda judicial/i,
  },
  {
    id: "clienteAdentro",
    etiqueta: "el cliente queda metido adentro del operativo",
    peso: 12,
    re: /el cliente (act(ú|u)a|participa|entra|hace de|se hace pasar)|que el cliente se haga pasar|el cliente tiene que actuar/i,
  },
];

function hash(texto: string): number {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function elegir<T>(opciones: T[], semilla: number): T {
  return opciones[semilla % opciones.length];
}

export function contarPalabras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

const TITULOS: Record<Veredicto, string> = {
  vacio: "No hay operativo",
  "se-cae": "El operativo se cayó",
  raspando: "Salió raspando",
  sale: "El operativo salió",
  redondo: "Operativo redondo",
};

/** Mira el plan, lo puntúa y narra cómo termina. Determinista. */
export function evaluarPlan(caso: Caso, plan: string): Resultado {
  const texto = plan.slice(0, MAX_PLAN);
  const palabras = contarPalabras(texto);
  const semilla = hash(`${caso.id}:${texto}`);
  /** Semilla propia de cada fase, para que dos planes distintos no caigan siempre en la misma variante. */
  const sem = (fase: string) => hash(`${caso.id}:${fase}:${texto}`);

  if (palabras < MINIMO_PALABRAS) {
    return {
      puntaje: 0,
      veredicto: "vacio",
      titulo: TITULOS.vacio,
      fases: [
        {
          titulo: "la reunión",
          texto: `Santos escucha, mira el papel y lo apoya en la mesa. "Esto no es un plan, es una intención. ¿Quién entra, con qué cara, qué día y cómo salimos?" ${caso.cliente.split(",")[0]} espera. Nadie se mueve.`,
        },
      ],
      tuvo: [],
      falto: SENALES.map((s) => s.etiqueta),
      nota: "Escribí el operativo con un poco más de detalle: quién se hace pasar por quién, qué se monta y en qué orden pasan las cosas.",
    };
  }

  const presentes = SENALES.filter((s) => s.re.test(texto));
  const ausentes = SENALES.filter((s) => !s.re.test(texto));
  const penas = PENAS.filter((p) => p.re.test(texto));

  let puntaje = presentes.reduce((suma, s) => suma + s.peso, 0);
  // Un plan detallado suma algo, pero la extensión sola no alcanza.
  puntaje += Math.min(10, Math.floor(palabras / 30));
  puntaje -= penas.reduce((suma, p) => suma + p.peso, 0);
  puntaje = Math.max(0, Math.min(100, puntaje));

  const veredicto: Veredicto =
    puntaje >= 75 ? "redondo" : puntaje >= 55 ? "sale" : puntaje >= 32 ? "raspando" : "se-cae";

  const tiene = (id: string) => presentes.some((s) => s.id === id);
  const nombre = caso.cliente.split(",")[0];
  const fases: Fase[] = [];

  fases.push({
    titulo: "el estudio",
    texto: tiene("informacion")
      ? elegir(
          [
            `Medina se toma cuatro días. Vuelve con horarios, un par de nombres y una deuda vieja que nadie había mirado. "Todo el mundo tiene una hora del día en la que está solo", dice, y marca esa hora en el cuaderno.`,
            `Medina sale a mirar. Anota a qué hora entra, con quién almuerza, qué le gusta que le digan. Al tercer día aparece la grieta, y no es la que ${nombre} creía que era.`,
            `Medina vuelve con una carpeta flaca y una sola frase subrayada. Santos la lee dos veces. "Con esto alcanza", dice, y recién ahí empieza a escribir el operativo.`,
          ],
          sem("estudio-a"),
        )
      : elegir(
          [
            `Se arranca sin estudiar al otro. Santos pregunta dos veces si alguien sabe cómo se mueve el tipo y nadie contesta. Se sigue igual, con el plan apoyado en lo que contó ${nombre}, que es lo que ${nombre} cree, no lo que pasa.`,
            `Nadie salió a averiguar nada. El operativo empieza sabiendo del otro lo mismo que sabe cualquiera: el nombre y poco más.`,
          ],
          sem("estudio-b"),
        ),
  });

  fases.push({
    titulo: "el montaje",
    texto:
      tiene("montaje") && tiene("personaje")
        ? elegir(
            [
              `Lamponne consigue todo en dos días: el lugar, los papeles, el cartel. Ravenna se prueba el personaje delante del espejo, cambia la voz tres veces y se queda con la cuarta. Desde afuera, lo que armaron existe desde siempre.`,
              `Para el jueves hay una oficina que ayer no era nada, con teléfono que suena y una secretaria que no es secretaria. Ravenna entra en el papel y no se sale más.`,
              `Lamponne discute media hora por el tipo de papel de las credenciales. Parece una pavada hasta que el otro las mira de cerca, asiente y se las devuelve sin decir nada.`,
            ],
            sem("montaje"),
          )
        : tiene("personaje")
          ? `Ravenna tiene el personaje, y es bueno. Lo que no tiene es dónde pararse: sin oficina, sin papeles y sin nada alrededor, el personaje queda colgado en el aire y hay que sostenerlo a pulmón.`
          : tiene("montaje")
            ? `El decorado queda impecable. El problema es que no hay nadie con una cara preparada para ocuparlo, así que la escena se juega a cuerpo descubierto.`
            : elegir(
                [
                  `No se monta nada. El plan pide que el otro cambie de opinión solo, mirando la misma realidad de siempre.`,
                  `Sin utilería y sin personaje, lo único que hay para ofrecerle al otro es una conversación. Ya hubo conversaciones: por eso ${nombre} está acá.`,
                ],
                sem("montaje-sin"),
              ),
  });

  const conPenas = penas.length > 0;
  fases.push({
    titulo: "el operativo",
    texto: conPenas
      ? elegir(
          [
            `A mitad de camino el plan pide algo que el grupo no hace. Santos corta ahí mismo: "Nosotros no laburamos así. Si hay que apretar a alguien, que lo haga otro." Lo que sigue se hace a medias y se nota.`,
            `Hay un punto del operativo donde se cruza una línea, y cruzarla lo arruina: el otro deja de ser alguien a quien convencer y pasa a ser alguien a quien forzar. Desde ahí, todo lo que se hizo bien no alcanza.`,
          ],
          sem("penas"),
        )
      : tiene("guion") && tiene("equipo")
        ? elegir(
            [
              `Sale como estaba escrito, con un desvío. Algo no ocurre a horario y hay que improvisar noventa segundos; Ravenna los llena hablando de un primo que no existe. Nadie afuera nota nada.`,
              `Cada uno donde tenía que estar y a la hora que tenía que estar. El otro toma la decisión que hay que tomar creyendo que fue idea suya, que es exactamente el punto.`,
              `Dura cuarenta minutos y por afuera no pasa nada: dos tipos hablando en una oficina. Adentro se mueve todo, y cuando el otro dice que sí, ya venía diciendo que sí hace rato.`,
            ],
            sem("operativo"),
          )
        : tiene("guion")
          ? `El orden está bien pensado, pero no está claro quién hace qué, y a mitad de operativo dos cosas caen sobre la misma persona. Se sostiene, con el corazón en la boca.`
          : elegir(
              [
                `Sin un orden claro, el operativo pasa a depender de la improvisación. A veces alcanza. Acá alcanza a medias: se gana una parte y se pierde otra.`,
                `Todo ocurre al mismo tiempo y nada termina de ocurrir. El otro se queda con la sensación de que algo raro pasó, y esa sensación es justo la que no tenía que quedarle.`,
              ],
              sem("operativo-sin"),
            ),
  });

  fases.push({
    titulo: "la salida",
    texto: tiene("salida")
      ? elegir(
          [
            `El viernes a la mañana la oficina no existe más. El teléfono da ocupado para siempre y el cartel está en el baúl del auto de Lamponne. ${nombre} recibe un llamado de veinte segundos y nunca más los ve.`,
            `Se levanta todo antes de que nadie pregunte nada. Queda el resultado y no queda ninguno de los cuatro: es la única forma de que el resultado dure.`,
            `Lamponne carga la última caja a las seis de la mañana. Para el mediodía, el lugar donde estuvo la oficina se alquila otra vez, y nadie recuerda quién estaba antes.`,
          ],
          sem("salida"),
        )
      : `No se previó cómo desaparecer. Queda un teléfono que alguien puede volver a marcar, una cara que alguien puede volver a reconocer y, sobre todo, la pregunta de qué fue todo eso. Los operativos que no terminan de cerrarse se reabren solos.`,
  });

  const logro = caso.objetivo.replace(/^Que /, "");
  const nota =
    veredicto === "redondo"
      ? `${logro.charAt(0).toUpperCase()}${logro.slice(1)} Sin ruido y sin que el otro sepa nunca que hubo un operativo. Santos no dice nada, que es como dice que estuvo bien.`
      : veredicto === "sale"
        ? `Se consigue lo que ${nombre} vino a buscar, pero queda un cabo suelto. En la oficina lo anotan: la próxima, ese cabo se ata antes.`
        : veredicto === "raspando"
          ? `Algo se consigue, bastante menos de lo que se buscaba, y ${nombre} se va contento igual. El grupo sabe que zafó.`
          : `No alcanza. ${nombre} vuelve a su casa con el mismo problema con el que vino, y esta vez sabiendo que alguien intentó ayudarlo.`;

  return {
    puntaje,
    veredicto,
    titulo: TITULOS[veredicto],
    fases,
    tuvo: presentes.map((s) => s.etiqueta),
    falto: [...ausentes.map((s) => s.etiqueta), ...penas.map((p) => p.etiqueta)],
    nota,
  };
}
