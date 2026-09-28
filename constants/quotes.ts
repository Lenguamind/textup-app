
export interface Quote {
  text: string;
  author: string;
}

export const WRITER_QUOTES: Record<string, Quote[]> = {
  ca: [
    { text: "Escriure és l'ofici de les paraules.", author: "Mercè Rodoreda" },
    { text: "La paraula és l'arma de la llibertat.", author: "Joan Fuster" },
    { text: "No hi ha res més perillós que una paraula en el moment oportú.", author: "Montserrat Roig" },
    { text: "Escriure és una manera de parlar sense ser interromput.", author: "Jules Renard" },
    { text: "La ploma és la llengua de l'ànima.", author: "Miguel de Cervantes" },
    { text: "Escriure és el plaer de la soledat.", author: "Virginia Woolf" },
    { text: "Un llibre ha de ser la destral per al mar glaçat dins nostre.", author: "Franz Kafka" },
    { text: "L'escriptura és la pintura de la veu.", author: "Voltaire" },
    { text: "Escriure és l'única manera que tinc de viure.", author: "Ana María Matute" },
    { text: "La lectura fa l'home complet; l'escriptura, precís.", author: "Francis Bacon" },
    { text: "La literatura és una forma de felicitat.", author: "Jorge Luis Borges" },
    { text: "Escriure és l'art de desxifrar-se.", author: "Maria-Mercè Marçal" },
    { text: "No s'escriu per a ser entès, s'escriu per a ser.", author: "Quim Monzó" },
    { text: "La poesia no és de qui l'escriu, sinó de qui la necessita.", author: "Pablo Neruda" },
    { text: "Un escriptor és algú per a qui escriure és més difícil que per a la resta.", author: "Thomas Mann" },
    { text: "La literatura és la prova que la vida no basta.", author: "Fernando Pessoa" },
    { text: "Les paraules són tot el que tenim.", author: "Samuel Beckett" },
    { text: "Escriure és com fer un petó, però sense llavis.", author: "Felice Picano" },
    { text: "La imaginació és la meitat de la malaltia; la tranquil·litat és la meitat del remei.", author: "Ibn Sina" },
    { text: "L'escriptor escriu per buidar-se, no per omplir-se.", author: "F. Scott Fitzgerald" }
  ],
  es: [
    { text: "Escribir es el oficio de las palabras.", author: "Mercè Rodoreda" },
    { text: "La palabra es el arma de la libertad.", author: "Joan Fuster" },
    { text: "No hay nada más peligroso que una palabra en el momento oportuno.", author: "Montserrat Roig" },
    { text: "Escribir es una manera de hablar sin ser interrumpido.", author: "Jules Renard" },
    { text: "La pluma es la lengua del alma.", author: "Miguel de Cervantes" },
    { text: "Escribir es el placer de la soledad.", author: "Virginia Woolf" },
    { text: "Un libro debe ser el hacha para el mar helado dentro de nosotros.", author: "Franz Kafka" },
    { text: "La escritura es la pintura de la voz.", author: "Voltaire" },
    { text: "Escribir es la única manera que tengo de vivir.", author: "Ana María Matute" },
    { text: "La lectura hace al hombre completo; la escritura, preciso.", author: "Francis Bacon" },
    { text: "La literatura es una forma de felicidad.", author: "Jorge Luis Borges" },
    { text: "Escribir es el arte de descifrarse.", author: "Maria-Mercè Marçal" },
    { text: "No se escribe para ser entendido, se escribe para ser.", author: "Quim Monzó" },
    { text: "La poesía no es de quien la escribe, sino de quien la necesita.", author: "Pablo Neruda" },
    { text: "Un escritor es alguien para quien escribir es más difícil que para el resto.", author: "Thomas Mann" },
    { text: "La literatura es la prueba de que la vida no basta.", author: "Fernando Pessoa" },
    { text: "Las palabras son todo lo que tenemos.", author: "Samuel Beckett" },
    { text: "Escribir es como dar un beso, pero sin labios.", author: "Felice Picano" },
    { text: "La imaginación es la mitad de la enfermedad; la tranquilidad es la mitad del remedio.", author: "Ibn Sina" },
    { text: "El escritor escribe para vaciarse, no para llenarse.", author: "F. Scott Fitzgerald" }
  ],
  en: [
    { text: "Writing is the trade of words.", author: "Mercè Rodoreda" },
    { text: "The word is the weapon of freedom.", author: "Joan Fuster" },
    { text: "There is nothing more dangerous than a word at the right moment.", author: "Montserrat Roig" },
    { text: "Writing is a way of talking without being interrupted.", author: "Jules Renard" },
    { text: "The pen is the tongue of the mind.", author: "Miguel de Cervantes" },
    { text: "Writing is the pleasure of solitude.", author: "Virginia Woolf" },
    { text: "A book must be the axe for the frozen sea within us.", author: "Franz Kafka" },
    { text: "Writing is the painting of the voice.", author: "Voltaire" },
    { text: "Writing is the only way I have to live.", author: "Ana María Matute" },
    { text: "Reading maketh a full man; writing an exact man.", author: "Francis Bacon" },
    { text: "Literature is a form of happiness.", author: "Jorge Luis Borges" },
    { text: "Writing is the art of deciphering oneself.", author: "Maria-Mercè Marçal" },
    { text: "One does not write to be understood, one writes to be.", author: "Quim Monzó" },
    { text: "Poetry belongs not to those who write it, but to those who need it.", author: "Pablo Neruda" },
    { text: "A writer is someone for whom writing is more difficult than it is for other people.", author: "Thomas Mann" },
    { text: "Literature is proof that life is not enough.", author: "Fernando Pessoa" },
    { text: "Words are all we have.", author: "Samuel Beckett" },
    { text: "Writing is like kissing, but without lips.", author: "Felice Picano" },
    { text: "Imagination is half of the disease; tranquility is half of the remedy.", author: "Ibn Sina" },
    { text: "The writer writes to empty himself, not to fill himself.", author: "F. Scott Fitzgerald" }
  ]
};

export const getQuotesByLanguage = (lang: string): Quote[] => {
  return WRITER_QUOTES[lang] || WRITER_QUOTES['ca']; // Default to Catalan as requested by the user's context
};
