// Datos de la serie, los personajes, los actores y Szifrón.
//
// Todo esto está escrito acá, no copiado: los textos son propios y los datos
// se cruzaron entre varias fuentes públicas (IMDb, Wikipedia, cinenacional,
// notas de prensa). Si algún dato está mal, se corrige en este archivo y
// listo: la página no tiene otra fuente.

export type Ficha = {
  id: string;
  /** 01..04, para la tipografía de la ficha */
  numero: string;
  personaje: string;
  /** en dos palabras, lo que hace en el equipo */
  rol: string;
  actor: string;
  /** datos duros del actor, en pares clave-valor */
  datos: { clave: string; valor: string }[];
  /** qué hace el personaje dentro del grupo */
  delPersonaje: string[];
  /** quién es el actor */
  delActor: string[];
};

export const simuladores: Ficha[] = [
  {
    id: "santos",
    numero: "01",
    personaje: "Mario Santos",
    rol: "planificación",
    actor: "Federico D'Elía",
    datos: [
      { clave: "en el equipo", valor: "logística y planificación" },
      { clave: "actor", valor: "Federico D'Elía" },
      { clave: "nació", valor: "La Plata, 1966" },
    ],
    delPersonaje: [
      "Es el que arma el operativo y el que lo dirige mientras pasa. Escucha al cliente, mira el problema desde arriba y lo convierte en un plan con etapas, tiempos y personajes, donde cada uno de los otros tres sabe exactamente qué le toca.",
      "Es también el más frío de los cuatro. Casi nunca se lo ve improvisar ni emocionarse con el cliente: su trabajo empieza cuando el problema deja de ser un drama y pasa a ser un esquema. Esa distancia es lo que hace que el grupo funcione, y también lo que lo deja más solo.",
    ],
    delActor: [
      "Federico D'Elía es hijo de Jorge D'Elía, actor y dramaturgo, así que el oficio lo tenía en casa. Antes de Santos ya había hecho cine grande en los noventa, en Tango feroz y en Caballos salvajes.",
      "Después de la serie siguió en televisión y se metió también a producir. Santos quedó como su papel más reconocido: treinta años de carrera y todavía hoy la gente lo para en la calle para preguntarle si el grupo vuelve.",
    ],
  },
  {
    id: "ravenna",
    numero: "02",
    personaje: "Emilio Ravenna",
    rol: "caracterización",
    actor: "Diego Peretti",
    datos: [
      { clave: "en el equipo", valor: "caracterización" },
      { clave: "actor", valor: "Diego Peretti" },
      { clave: "nació", valor: "Buenos Aires, 1963" },
    ],
    delPersonaje: [
      "Es el que se pone la cara del operativo. Si hay que ser un perito italiano, un psiquiatra, un empresario coreano o un tipo cualquiera en la cola del banco, es él. Cambia acento, postura y edad, y sostiene el personaje todo el tiempo que haga falta.",
      "Es además el más extrovertido del grupo, el que le habla al cliente cuando el cliente está por romperse. Una buena parte del humor de la serie sale de verlo entrar en un papel imposible y no salirse ni cuando todo se cae.",
    ],
    delActor: [
      "Diego Peretti es médico psiquiatra: se recibió, ejerció catorce años y estudió actuación en paralelo desde el segundo año de la carrera de medicina. Recién durante Poliladron dejó el consultorio para dedicarse del todo a actuar.",
      "En Los Simuladores no sólo actuó: también escribió. Después vinieron Tiempo de valientes, Wakolda y El robo del siglo, entre muchas otras.",
    ],
  },
  {
    id: "lamponne",
    numero: "03",
    personaje: "Pablo Lamponne",
    rol: "técnica y movilidad",
    actor: "Alejandro Fiore",
    datos: [
      { clave: "en el equipo", valor: "técnica y movilidad" },
      { clave: "actor", valor: "Alejandro Fiore" },
      { clave: "nació", valor: "Buenos Aires, 1969" },
    ],
    delPersonaje: [
      "Es el que consigue las cosas. Vehículos, locaciones, vestuario, credenciales, la escenografía de una oficina que mañana tiene que parecer que existe hace veinte años: todo lo material del operativo pasa por él.",
      "Hacia afuera es el más duro y el más frontal de los cuatro. Hacia adentro es el más frágil: le pesa el trato seco entre ellos y arrastra la sospecha de que su parte del trabajo vale menos que la de los otros. No es así, y la serie se encarga de mostrarlo.",
    ],
    delActor: [
      "Alejandro Fiore se formó en teatro con Lito Cruz, Raúl Serrano, Alberto Ure y Augusto Fernández, y nunca dejó el escenario: hizo Historia de cazadores en el Cervantes, entre muchas otras obras.",
      "En televisión venía de Poliladron, Gasoleros, Tumberos y Tiempo final. Contó alguna vez que los primeros capítulos de Los Simuladores los bancaron ellos mismos, hasta con la tarjeta de crédito, porque el proyecto no le cerraba a nadie.",
    ],
  },
  {
    id: "medina",
    numero: "04",
    personaje: "Gabriel Medina",
    rol: "información",
    actor: "Martín Seefeld",
    datos: [
      { clave: "en el equipo", valor: "información" },
      { clave: "actor", valor: "Martín Seefeld" },
      { clave: "nació", valor: "1960" },
    ],
    delPersonaje: [
      "Es el que averigua. Antes de que se monte nada, Medina sabe dónde trabaja el tipo, a qué hora sale, con quién habla, qué le debe a quién y qué es lo único que no está dispuesto a perder. Sin esa parte, el plan de Santos no se puede escribir.",
      "Viene del periodismo, y se le nota: pregunta bien y no se conforma con la primera respuesta. Es también el más sensible del grupo, el que se involucra con el cliente más de lo que conviene y el que más incómodo se pone cuando el operativo pasa por encima de alguien.",
    ],
    delActor: [
      "Martín Seefeld venía de laburar en televisión desde los ochenta, y Medina fue el papel que lo puso en otro lugar: de actor conocido a actor que la gente nombra.",
      "Siguió después entre el cine, la televisión y el teatro, y también produciendo. Es de los cuatro el que más veces dijo en público que la serie se terminó cuando tenía que terminarse.",
    ],
  },
];

export const szifron = {
  nombre: "Damián Szifrón",
  datos: [
    { clave: "nació", valor: "Ramos Mejía, 1975" },
    { clave: "estudió", valor: "Universidad del Cine" },
    { clave: "en la serie", valor: "creador, guionista y director" },
  ],
  texto: [
    "Los Simuladores es de Szifrón de punta a punta: la creó, la escribió y dirigió buena parte de los capítulos. Tenía veintiséis años cuando salió al aire.",
    "Lo que hizo raro al proyecto no fue la idea de un grupo que resuelve problemas, sino la forma: capítulos cerrados con estructura de relojería, sin culebrón, sin muertos, con un humor que nunca subraya y con la cámara puesta al servicio del mecanismo. En 2002, en la televisión argentina, eso no existía.",
    "Después se fue al cine y volvió a hacer lo mismo en otra escala: historias de mecanismo, con humor seco y una precisión de armador.",
  ],
  hitos: [
    { anio: "2002", que: "crea Los Simuladores para Telefe" },
    { anio: "2003", que: "El fondo del mar, su primera película" },
    { anio: "2005", que: "Tiempo de valientes" },
    { anio: "2006", que: "vuelve a la tele con Hermanos y detectives" },
    { anio: "2014", que: "Relatos salvajes: Cannes y candidata al Oscar" },
  ],
};

export const laSerie = {
  texto: [
    "Cuatro tipos con una oficina sin cartel arreglan, por encargo, problemas que no se arreglan hablando. No usan violencia ni fuerza: montan una simulación alrededor del problema hasta que la realidad del otro se acomoda sola.",
    "El cliente paga, mira de afuera y casi nunca entiende del todo lo que pasó. Cuando termina, el grupo desaparece.",
  ],
  datos: [
    { clave: "canal", valor: "Telefe" },
    { clave: "al aire", valor: "2002 a 2004" },
    { clave: "capítulos", valor: "24: 13 y 11" },
    { clave: "premio", valor: "Martín Fierro de Oro 2002" },
    { clave: "remakes", valor: "Chile, España, México y Rusia" },
  ],
};

export const metodo = [
  {
    numero: "01",
    titulo: "el encargo",
    texto:
      "Llega alguien con un problema que ya intentó resolver por las buenas. El grupo escucha, pregunta poco y decide si lo toma. Si lo toma, el cliente deja de decidir.",
  },
  {
    numero: "02",
    titulo: "el estudio",
    texto:
      "Medina averigua todo sobre el otro: horarios, deudas, vanidades, miedos. El plan no se escribe hasta que aparece la grieta, que nunca es la que el cliente creía.",
  },
  {
    numero: "03",
    titulo: "el montaje",
    texto:
      "Lamponne consigue el mundo falso, Ravenna se pone la cara y Santos reparte el guion. Una oficina, un cartel y dos llamados alcanzan para que exista una empresa que no existe.",
  },
  {
    numero: "04",
    titulo: "el operativo",
    texto:
      "Se ejecuta en orden y con tiempos. Cuando algo se sale de libreto, y siempre se sale, se improvisa sin romper el personaje. El otro nunca sabe que está adentro de una simulación.",
  },
  {
    numero: "05",
    titulo: "la salida",
    texto:
      "Se desarma todo y no queda rastro. Ni oficina, ni nombres, ni forma de volver a encontrarlos. El problema, para el cliente, simplemente dejó de estar.",
  },
];
