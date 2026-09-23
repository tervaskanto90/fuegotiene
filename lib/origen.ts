// Por qué existe este sitio. Es el relato de cómo empezó y de en qué se fue
// convirtiendo: sirve de portada del proyecto y es lo primero que conviene
// leer si alguien lo hereda.
//
// Dos reglas para editarlo. La primera: que sea verdad. Cada cosa que se
// afirma acá pasó, y si el sitio cambia, el relato se actualiza — hubo una
// versión que todavía hablaba del código por persona cuando esa puerta ya no
// existía. La segunda: la épica sale de los hechos, no de los adjetivos. Si
// una frase se pone solemne, sobra.

export const origen = {
  apertura: "Esto empezó una noche, con alguien buscando una serie que no estaba.",
  capitulos: [
    {
      numero: "01",
      titulo: "la noche que no estaba",
      parrafos: [
        "Abrió una plataforma y escribió Los Simuladores. Nada. Abrió la otra. Nada. Las fue probando todas, una por una, las que paga todos los meses sin falta y sin pensarlo, y en ninguna había un botón para darle play.",
        "Veinticuatro capítulos que se emitieron por televisión abierta entre 2002 y 2004, que media Argentina vio y todavía cita de memoria, y esa noche, en su casa, no existían. No estaban prohibidos ni perdidos: simplemente no le cerraban los números a nadie.",
        "Esa es la parte que no se dice cuando se habla de que hoy está todo disponible. Está todo disponible mientras convenga. Un catálogo no es una biblioteca: es una vidriera, y lo que no vende se saca.",
      ],
    },
    {
      numero: "02",
      titulo: "lo que había en el disco",
      parrafos: [
        "La parte fácil era resignarse: poner otra cosa, dejarlo pasar, volver a buscar en unos meses por si alguien la subía.",
        "La otra parte empezaba con una certeza incómoda: los capítulos existían. Estaban ahí, en un disco, veinticuatro archivos con nombres de hace veinte años.",
        "Y entre un archivo guardado en un disco y una serie que se puede mirar tranquilo en el sillón hay bastante más distancia de la que parece. Un archivo no tiene portada, no sabe por dónde ibas, no se acuerda de vos, no se abre en el celular de otro. Un archivo no se comparte: se manda. Hay una diferencia.",
      ],
    },
    {
      numero: "03",
      titulo: "dónde se guarda una serie",
      parrafos: [
        "Siete gigas y medio. No es mucho para un disco y es bastante para internet: subirlo a cualquier lado es gratis, el problema es lo que sale bajarlo cada vez que alguien le da play.",
        "Ahí está la decisión que sostiene todo lo demás. Los videos viven en un depósito que no cobra por lo que se baja, y el sitio nunca los toca: cuando alguien abre un capítulo, el sitio firma un permiso que dura tres horas y el navegador va a buscar los bytes directo al depósito.",
      ],
    },
    {
      numero: "04",
      titulo: "por qué ésta",
      parrafos: [
        "Podría haber sido cualquier serie. No lo es.",
        "Los Simuladores salió al aire en marzo de 2002, tres meses después de que en este país se cayera casi todo. Y contaba, una vez por semana, el problema de alguien que no tenía a quién recurrir: un tipo al que querían echar del trabajo por viejo, un padre al que un usurero le amenazaba a los hijos, un pibe que se había llevado siete materias y no podía decírselo a la madre enferma. Problemas del tamaño de una cuadra, en un país donde las cosas grandes no se estaban arreglando.",
        "Y cuatro tipos que los resolvían sin pegarle a nadie. Sin gritar, sin denunciar, sin esperar que alguien hiciera justicia. Armaban una mentira enorme y prolija, la sostenían el tiempo justo, y la realidad se acomodaba sola.",
        "Nadie la cita por el final. La gente cita el momento en que las piezas encajan y uno entiende, dos segundos antes que el personaje, que ya estaba todo armado desde la primera escena. Veinte años después se sigue contando en las mesas como si hubiera pasado el mes pasado.",
        "Por eso ésta y no otra. Una serie así no merecía depender de que a alguien le cerraran los números.",
      ],
    },
    {
      numero: "05",
      titulo: "la máquina de mirar",
      parrafos: [
        "Después hubo que construir la parte que uno no nota cuando funciona.",
        "El reproductor ocupa la pantalla entera y esconde los controles cuando arranca el capítulo. Se acuerda de dónde quedaste en cada capítulo —cada navegador por su cuenta, sin cuenta de usuario ni nada— y la próxima vez sigue desde ahí sin preguntarte nada. En el teléfono, un toque trae los controles y dos toques en un costado saltan diez segundos.",
        "Lo que más trabajo dio fue sacar cosas. Hubo un panel con ajustes, un cartel que te avisaba desde qué minuto seguías, botones para marcar dónde empezaba la intro. Todo eso funcionaba y todo eso se fue: arriba del video quedó lo que hace falta para mirar un capítulo y nada más.",
        "Las portadas de los capítulos no son fotos que alguien buscó por ahí: las saca el propio sitio del video, eligiendo un momento lo bastante adelantado como para que no sea la placa negra del principio. Cuando un video falla, en vez de un cuadro negro sale una frase que dice qué pasó y qué hacer.",
        "Nada de eso es imprescindible. Todo eso es la diferencia entre un archivo y una serie.",
      ],
    },
    {
      numero: "06",
      titulo: "la puerta que era una contraseña",
      parrafos: [
        "Al principio la puerta era obvia: un código por persona, repartido a mano. Entrabas con tu palabra y mirabas.",
        "Funcionaba, y tenía algo que no cerraba. Repartir contraseñas es administrar una lista: hay que acordarse de a quién se la diste, agregar a uno, sacar a otro. Y sobre todo, ponía la entrada del lado equivocado: entrabas porque alguien te dio permiso, no porque hicieras nada.",
      ],
    },
    {
      numero: "07",
      titulo: "la puerta que es un operativo",
      parrafos: [
        "Así que la puerta se dio vuelta. Hoy no hay contraseña ni hay que registrarse: el que entra se encuentra con un caso.",
        "Llega un cliente con un problema que ya intentó resolver por las buenas. Te toca a vos armar el operativo, como lo armaría Santos: quién averigua qué, por quién se hace pasar cada uno, qué hay que montar, en qué orden pasan las cosas y cómo se sale sin dejar rastro. Lo escribís, se simula, y te cuentan cómo salió en cuatro actos.",
        "Si el operativo se sostiene, se abren los veinticuatro capítulos. Si se cae a la mitad, te dice cuánto faltó y podés volver a intentarlo las veces que quieras, con cualquiera de los seis casos.",
        "El que evalúa no es un modelo de inteligencia artificial ni una persona: es un programa que lee el plan buscando las piezas de un operativo, y que descuenta si la solución pasa por pegarle a alguien, por ir de frente o por delegar en la justicia. Es decir: el mismo criterio de la serie. Nadie mira los capítulos sin haberse puesto, aunque sea diez minutos, en el lugar de los cuatro.",
      ],
    },
    {
      numero: "08",
      titulo: "lo que este sitio no tiene",
      parrafos: [
        "No tiene registro. No pide un mail, no pide un nombre, no manda nada a ningún lado. Lo único que guarda de cada uno es que ganó el juego, y lo guarda en su propio navegador.",
        "No tiene base de datos. Lo poco que se comparte entre todos son dos archivos de texto de unos pocos kilobytes, al lado de los videos.",
        "No tiene publicidad, no tiene recomendaciones, no tiene una pantalla que mida cuánto mirás. Cuando termina un capítulo te ofrece el siguiente, pero te da doce segundos para decirle que no. Y no le cuesta un peso a nadie: es una decisión, no una casualidad. Hubo un momento en que el desenlace del juego lo escribía un modelo de inteligencia artificial, que quedaba mejor y salía unos centavos por partida. Se sacó, junto con la dependencia, el día que el sitio se abrió a cualquiera. Un sitio que puede generar una factura es un sitio que un día se apaga.",
      ],
    },
    {
      numero: "09",
      titulo: "para qué",
      parrafos: [
        "Para que la próxima vez que alguien quiera ver Los Simuladores, esté. Sin buscar en cuatro catálogos, sin esperar a que vuelva, sin depender de que a alguien le cierren los números.",
        "Y para probar algo, de paso: que una persona sola, sin saber programar y sin poder instalar un solo programa en su computadora, puede levantar la cosa entera. No hace falta un equipo ni un presupuesto. Hace falta que a alguien le importe lo suficiente.",
        "Una serie no desaparece porque se caiga de un catálogo. Desaparece cuando nadie se toma el trabajo de guardarla.",
      ],
    },
  ],
  datos: [
    { clave: "capítulos", valor: "24" },
    { clave: "emitidos", valor: "2002-2004" },
    { clave: "en el estante", valor: "7,5 GB" },
  ],
};
