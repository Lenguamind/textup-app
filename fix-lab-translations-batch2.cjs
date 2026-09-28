const fs = require('fs');

const blocks = {
  da: {
    line: 165,
    text: [
      '    analysisStepsBasic: {',
      '      digitalization: "Intelligent digitalisering",',
      '      context: "Kontekst­tilpasning",',
      '      vocab: "Avanceret ordforråd",',
      '      structure: "Perfekt struktur"',
      '    },',
      '    analysisLabelsBasic: {',
      '      orWrite: "Eller skriv din tekst"',
      '    },',
      '    stepDescriptionsBasic: {',
      '      ocr1: "Genkendelse af håndskrevet tekst (avanceret OCR)",',
      '      ocr2: "Identifikation af ufuldstændige eller uklare sætninger",',
      '      ocr3: "Automatisk rettelse af mulige læsefejl",',
      '      context1: "Registrerer teksttype: fortællende, formel...",',
      '      context2: "Forslag til mere passende ord",',
      '      context3: "Justering af register (formelt <-> dagligdags)",',
      '      vocab1: "Fjernelse af unødvendige gentagelser",',
      '      vocab2: "Erstatning med mere præcise synonymer",',
      '      vocab3: "Berigelse af ordforråd og udtryksfuldhed",',
      '      structure1: "Logisk rækkefølge af idéer og afsnit",',
      '      structure2: "Brug af konnektorer til at forbinde sætninger",',
      '      structure3: "Forbedret tegnsætning og rytme"',
      '    },'
    ]
  },
  de: {
    line: 165,
    text: [
      '    analysisStepsBasic: {',
      '      digitalization: "Intelligente Digitalisierung",',
      '      context: "Kontextanpassung",',
      '      vocab: "Fortgeschrittener Wortschatz",',
      '      structure: "Perfekte Struktur"',
      '    },',
      '    analysisLabelsBasic: {',
      '      orWrite: "Oder schreibe deinen Text"',
      '    },',
      '    stepDescriptionsBasic: {',
      '      ocr1: "Erkennung von handgeschriebenem Text (fortgeschrittene OCR)",',
      '      ocr2: "Identifikation unvollständiger oder unklarer Sätze",',
      '      ocr3: "Automatische Korrektur möglicher Lesefehler",',
      '      context1: "Erkennt Textart: erzählend, formell...",',
      '      context2: "Vorschläge für passendere Wörter",',
      '      context3: "Anpassung des Registers (formell <-> umgangssprachlich)",',
      '      vocab1: "Entfernung unnötiger Wiederholungen",',
      '      vocab2: "Ersetzung durch präzisere Synonyme",',
      '      vocab3: "Bereicherung von Wortschatz und Ausdruckskraft",',
      '      structure1: "Logische Anordnung von Ideen und Absätzen",',
      '      structure2: "Verwendung von Konnektoren zur Verknüpfung von Sätzen",',
      '      structure3: "Verbesserte Zeichensetzung und Rhythmus"',
      '    },'
    ]
  },
  fr: {
    line: 341,
    text: [
      '    analysisStepsBasic: {',
      '      digitalization: "Numérisation intelligente",',
      '      context: "Adaptation au contexte",',
      '      vocab: "Vocabulaire avancé",',
      '      structure: "Structure parfaite"',
      '    },',
      '    analysisLabelsBasic: {',
      '      orWrite: "Ou écris ton texte"',
      '    },',
      '    stepDescriptionsBasic: {',
      '      ocr1: "Reconnaissance du texte manuscrit (OCR avancé)",',
      '      ocr2: "Identification des phrases incomplètes ou peu claires",',
      '      ocr3: "Correction automatique des erreurs de lecture possibles",',
      '      context1: "Détecte le type de texte : narratif, formel...",',
      '      context2: "Suggestions de mots plus appropriés",',
      '      context3: "Ajustement du registre (formel <-> familier)",',
      '      vocab1: "Suppression des répétitions inutiles",',
      '      vocab2: "Remplacement par des synonymes plus précis",',
      "      vocab3: \"Enrichissement du vocabulaire et de l'expressivité\",",
      '      structure1: "Ordre logique des idées et des paragraphes",',
      '      structure2: "Utilisation de connecteurs pour relier les phrases",',
      '      structure3: "Amélioration de la ponctuation et du rythme"',
      '    },'
    ]
  },
  it: {
    line: 344,
    text: [
      '    analysisStepsBasic: {',
      '      digitalization: "Digitalizzazione intelligente",',
      '      context: "Adattamento al contesto",',
      '      vocab: "Vocabolario avanzato",',
      '      structure: "Struttura perfetta"',
      '    },',
      '    analysisLabelsBasic: {',
      '      orWrite: "Oppure scrivi il tuo testo"',
      '    },',
      '    stepDescriptionsBasic: {',
      '      ocr1: "Riconoscimento del testo manoscritto (OCR avanzato)",',
      '      ocr2: "Identificazione di frasi incomplete o poco chiare",',
      '      ocr3: "Correzione automatica di possibili errori di lettura",',
      '      context1: "Rileva il tipo di testo: narrativo, formale...",',
      '      context2: "Suggerimenti di parole più appropriate",',
      '      context3: "Adeguamento del registro (formale <-> colloquiale)",',
      '      vocab1: "Eliminazione delle ripetizioni inutili",',
      '      vocab2: "Sostituzione con sinonimi più precisi",',
      "      vocab3: \"Arricchimento del lessico e dell'espressività\",",
      '      structure1: "Ordine logico di idee e paragrafi",',
      '      structure2: "Uso di connettori per collegare le frasi",',
      '      structure3: "Miglioramento della punteggiatura e del ritmo"',
      '    },'
    ]
  },
  nl: {
    line: 165,
    text: [
      '    analysisStepsBasic: {',
      '      digitalization: "Slimme digitalisering",',
      '      context: "Contextaanpassing",',
      '      vocab: "Geavanceerde woordenschat",',
      '      structure: "Perfecte structuur"',
      '    },',
      '    analysisLabelsBasic: {',
      '      orWrite: "Of schrijf je tekst"',
      '    },',
      '    stepDescriptionsBasic: {',
      '      ocr1: "Herkenning van handgeschreven tekst (geavanceerde OCR)",',
      '      ocr2: "Identificatie van onvolledige of onduidelijke zinnen",',
      '      ocr3: "Automatische correctie van mogelijke leesfouten",',
      '      context1: "Detecteert teksttype: verhalend, formeel...",',
      '      context2: "Suggesties voor meer geschikte woorden",',
      '      context3: "Aanpassing van het register (formeel <-> informeel)",',
      '      vocab1: "Verwijdering van onnodige herhalingen",',
      '      vocab2: "Vervanging door preciezere synoniemen",',
      '      vocab3: "Verrijking van woordenschat en expressiviteit",',
      "      structure1: \"Logische volgorde van ideeën en alinea's\",",
      '      structure2: "Gebruik van verbindingswoorden om zinnen te koppelen",',
      '      structure3: "Verbeterde interpunctie en ritme"',
      '    },'
    ]
  },
  pl: {
    line: 165,
    text: [
      '    analysisStepsBasic: {',
      '      digitalization: "Inteligentna digitalizacja",',
      '      context: "Dostosowanie do kontekstu",',
      '      vocab: "Zaawansowane słownictwo",',
      '      structure: "Doskonała struktura"',
      '    },',
      '    analysisLabelsBasic: {',
      '      orWrite: "Lub napisz swój tekst"',
      '    },',
      '    stepDescriptionsBasic: {',
      '      ocr1: "Rozpoznawanie tekstu odręcznego (zaawansowane OCR)",',
      '      ocr2: "Identyfikacja niekompletnych lub niejasnych zdań",',
      '      ocr3: "Automatyczna korekta możliwych błędów odczytu",',
      '      context1: "Wykrywa typ tekstu: narracyjny, formalny...",',
      '      context2: "Sugestie bardziej odpowiednich słów",',
      '      context3: "Dostosowanie rejestru (formalny <-> potoczny)",',
      '      vocab1: "Usunięcie zbędnych powtórzeń",',
      '      vocab2: "Zastąpienie bardziej precyzyjnymi synonimami",',
      '      vocab3: "Wzbogacenie słownictwa i ekspresji",',
      '      structure1: "Logiczne uporządkowanie idei i akapitów",',
      '      structure2: "Użycie łączników do łączenia zdań",',
      '      structure3: "Poprawiona interpunkcja i rytm"',
      '    },'
    ]
  },
  pt: {
    line: 165,
    text: [
      '    analysisStepsBasic: {',
      '      digitalization: "Digitalização inteligente",',
      '      context: "Adaptação ao contexto",',
      '      vocab: "Vocabulário avançado",',
      '      structure: "Estrutura perfeita"',
      '    },',
      '    analysisLabelsBasic: {',
      '      orWrite: "Ou escreve o teu texto"',
      '    },',
      '    stepDescriptionsBasic: {',
      '      ocr1: "Reconhecimento de texto manuscrito (OCR avançado)",',
      '      ocr2: "Identificação de frases incompletas ou pouco claras",',
      '      ocr3: "Correção automática de possíveis erros de leitura",',
      '      context1: "Deteta o tipo de texto: narrativo, formal...",',
      '      context2: "Sugestões de palavras mais adequadas",',
      '      context3: "Ajuste de registo (formal <-> coloquial)",',
      '      vocab1: "Remoção de repetições desnecessárias",',
      '      vocab2: "Substituição por sinónimos mais precisos",',
      '      vocab3: "Enriquecimento do vocabulário e expressividade",',
      '      structure1: "Ordem lógica das ideias e parágrafos",',
      '      structure2: "Uso de conectores para ligar frases",',
      '      structure3: "Melhoria da pontuação e do ritmo"',
      '    },'
    ]
  },
  ru: {
    line: 165,
    text: [
      '    analysisStepsBasic: {',
      '      digitalization: "Умная оцифровка",',
      '      context: "Адаптация к контексту",',
      '      vocab: "Продвинутая лексика",',
      '      structure: "Идеальная структура"',
      '    },',
      '    analysisLabelsBasic: {',
      '      orWrite: "Или напиши свой текст"',
      '    },',
      '    stepDescriptionsBasic: {',
      '      ocr1: "Распознавание рукописного текста (продвинутый OCR)",',
      '      ocr2: "Определение неполных или неясных предложений",',
      '      ocr3: "Автоматическое исправление возможных ошибок чтения",',
      '      context1: "Определяет тип текста: повествовательный, формальный...",',
      '      context2: "Предложения более подходящих слов",',
      '      context3: "Настройка регистра (формальный <-> разговорный)",',
      '      vocab1: "Удаление ненужных повторов",',
      '      vocab2: "Замена более точными синонимами",',
      '      vocab3: "Обогащение лексики и выразительности",',
      '      structure1: "Логический порядок идей и абзацев",',
      '      structure2: "Использование связок для соединения предложений",',
      '      structure3: "Улучшенная пунктуация и ритм"',
      '    },'
    ]
  },
  uk: {
    line: 329,
    text: [
      '    analysisStepsBasic: {',
      '      digitalization: "Розумна оцифровка",',
      '      context: "Адаптація до контексту",',
      '      vocab: "Розширена лексика",',
      '      structure: "Ідеальна структура"',
      '    },',
      '    analysisLabelsBasic: {',
      '      orWrite: "Або напиши свій текст"',
      '    },',
      '    stepDescriptionsBasic: {',
      '      ocr1: "Розпізнавання рукописного тексту (розширений OCR)",',
      '      ocr2: "Визначення неповних або незрозумілих речень",',
      '      ocr3: "Автоматичне виправлення можливих помилок читання",',
      '      context1: "Визначає тип тексту: розповідний, формальний...",',
      '      context2: "Пропозиції більш відповідних слів",',
      '      context3: "Налаштування регістру (формальний <-> розмовний)",',
      '      vocab1: "Видалення непотрібних повторів",',
      '      vocab2: "Заміна точнішими синонімами",',
      '      vocab3: "Збагачення лексики та виразності",',
      "      structure1: \"Логічний порядок ідей та абзаців\",",
      "      structure2: \"Використання конекторів для з'єднання речень\",",
      '      structure3: "Покращена пунктуація та ритм"',
      '    },'
    ]
  }
};

for (const [lang, cfg] of Object.entries(blocks)) {
  const path = `translations/${lang}.ts`;
  const lines = fs.readFileSync(path, 'utf8').split('\n');
  const idx = cfg.line - 1;
  if (!lines[idx].includes('analysisSteps: {')) {
    throw new Error(`MISMATCH at ${path}:${cfg.line} - expected "analysisSteps: {" but found: ${lines[idx]}`);
  }
  lines.splice(idx, 0, ...cfg.text);
  fs.writeFileSync(path, lines.join('\n'), 'utf8');
  console.log(`${path} actualitzat`);
}

console.log('FET. Ara verifica amb els grep de comprovacio.');
