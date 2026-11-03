import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { recordDailyAnswer } from '../quiz-score-store.js';

const QUIZ_VERSION = 'v2';

const questions = [
  {
    question: 'Какво означава съотношение риск/печалба 1:2?',
    answers: [
      'Рискуваш 2 единици за потенциална печалба 1 единица',
      'Имаш гарантирана печалба от 2 единици',
      'Рискуваш 1 единица за потенциална печалба 2 единици',
    ],
    correctAnswer: 2,
  },
  {
    question: 'Каква е основната цел на stop-loss поръчката?',
    answers: [
      'Да увеличи размера на позицията автоматично',
      'Да гарантира, че сделката ще бъде печеливша',
      'Да ограничи потенциалната загуба според предварително зададено ниво',
    ],
    correctAnswer: 2,
  },
  {
    question: 'От какво най-вече зависи размерът на позицията при планиран риск?',
    answers: [
      'От рисковата сума и разстоянието до stop-loss',
      'От цвета на последната свещ',
      'Само от наличния баланс',
    ],
    correctAnswer: 0,
  },
  {
    question: 'Какво прави ливъриджът?',
    answers: [
      'Намалява риска до нула',
      'Позволява контрол над по-голяма експозиция спрямо вложения маржин и увеличава и печалбите, и загубите',
      'Гарантира по-добра цена за вход',
    ],
    correctAnswer: 1,
  },
  {
    question: 'Във валутната двойка EUR/USD коя валута е базова?',
    answers: ['USD', 'EUR', 'И двете са базови'],
    correctAnswer: 1,
  },
  {
    question: 'Във валутната двойка EUR/USD коя валута е котируема?',
    answers: ['USD', 'EUR', 'Няма котируема валута'],
    correctAnswer: 0,
  },
  {
    question: 'Какво показва bid-ask spread?',
    answers: [
      'Разликата между най-високата и най-ниската цена за деня',
      'Промяната в цената за един pip',
      'Разликата между ask и bid цената',
    ],
    correctAnswer: 2,
  },
  {
    question: 'Какво цели да направи market поръчката?',
    answers: [
      'Да изчака конкретна цена, зададена от трейдъра',
      'Да се изпълни възможно най-скоро на наличната пазарна цена',
      'Да гарантира точно определена цена на изпълнение',
    ],
    correctAnswer: 1,
  },
  {
    question: 'При каква цена може да се изпълни buy limit поръчка?',
    answers: [
      'На зададената лимит цена или по-ниско',
      'Само над зададената лимит цена',
      'На всяка цена, без ограничение',
    ],
    correctAnswer: 0,
  },
  {
    question: 'Какво обикновено става с класическа stop-market поръчка, когато се достигне stop цената?',
    answers: ['Изтрива се автоматично', 'Става limit поръчка', 'Става market поръчка'],
    correctAnswer: 2,
  },
  {
    question: 'При повечето валутни двойки без JPY колко е стандартната стойност на един pip?',
    answers: ['0.01', '0.0001', '1.0'],
    correctAnswer: 1,
  },
  {
    question: 'Какво означава курс USD/JPY = 150?',
    answers: [
      'Един USD струва 150 JPY',
      'Един JPY струва 150 USD',
      'Двете валути имат еднаква стойност',
    ],
    correctAnswer: 0,
  },
  {
    question: 'Какво очаква трейдър с long позиция в EUR/USD?',
    answers: [
      'EUR да отслабне спрямо USD',
      'И двете валути да останат без промяна',
      'EUR да поскъпне спрямо USD',
    ],
    correctAnswer: 2,
  },
  {
    question: 'Какво означава short позиция в EUR/USD?',
    answers: [
      'Очакване EUR да поскъпне спрямо USD',
      'Очакване EUR да поевтинее спрямо USD',
      'Покупка само на EUR без валутна двойка',
    ],
    correctAnswer: 1,
  },
  {
    question: 'Какво е margin при търговия с ливъридж?',
    answers: [
      'Обезпечение, необходимо за отваряне или поддържане на позиция',
      'Комисионата, която винаги се плаща при затваряне',
      'Гарантирана печалба по позицията',
    ],
    correctAnswer: 0,
  },
  {
    question: 'Какво приблизително означава ливъридж 10:1?',
    answers: [
      'Позицията винаги носи 10% печалба',
      'Една единица маржин може да поддържа експозиция до 10 единици',
      'Рискът по сделката е точно 1 единица',
    ],
    correctAnswer: 1,
  },
  {
    question: 'Какво е slippage?',
    answers: [
      'Разликата между две валутни сесии',
      'Такса за поддържане на сметка',
      'Разликата между очакваната и реалната цена на изпълнение',
    ],
    correctAnswer: 2,
  },
  {
    question: 'При бързо движещ се пазар stop поръчката гарантира ли изпълнение точно на stop цената?',
    answers: [
      'Не, цената на изпълнение може да се различава',
      'Да, винаги гарантира точната цена',
      'Да, но само при валутни двойки с JPY',
    ],
    correctAnswer: 0,
  },
  {
    question: 'Какво може да постигне диверсификацията?',
    answers: [
      'Да премахне напълно всички загуби',
      'Да разпредели експозицията, без да премахва пазарния риск',
      'Да гарантира положителен резултат всеки месец',
    ],
    correctAnswer: 1,
  },
  {
    question: 'За какво служи trading plan?',
    answers: [
      'Да предскаже със сигурност следващото движение',
      'Да гарантира, че няма да има губещи сделки',
      'Да опише предварително правила за вход, изход и риск',
    ],
    correctAnswer: 2,
  },
  {
    question: 'За какво помага trading journal?',
    answers: [
      'Да записва решенията и резултатите за последващ преглед',
      'Да изпълнява поръчки вместо трейдъра',
      'Да премахне нуждата от план',
    ],
    correctAnswer: 0,
  },
  {
    question: 'Какво описва волатилността?',
    answers: [
      'Посоката, в която цената задължително ще се движи',
      'Колко силно или често се променя цената',
      'Размерът на ливъриджа на брокера',
    ],
    correctAnswer: 1,
  },
  {
    question: 'Какво означава ликвидност на пазара?',
    answers: [
      'Че всяка сделка е печеливша',
      'Че цената не може да се променя бързо',
      'Колко лесно може да се търгува без голямо влияние върху цената',
    ],
    correctAnswer: 2,
  },
  {
    question: 'Какво показва тялото на стандартна японска свещ?',
    answers: [
      'Разликата между цените на отваряне и затваряне',
      'Само най-високата цена за деня',
      'Броя на изпълнените поръчки',
    ],
    correctAnswer: 0,
  },
  {
    question: 'Ако EUR/USD е 1.10, какво приблизително означава това?',
    answers: [
      '1 USD се равнява на 1.10 EUR',
      '1 EUR се равнява на 1.10 USD',
      'EUR и USD имат еднакъв курс',
    ],
    correctAnswer: 1,
  },
  {
    question: 'Променя ли Япония часовника за лятно часово време?',
    answers: [
      'Да, всяка година през март',
      'Да, но само в Токио',
      'Не, Япония не използва лятно часово време',
    ],
    correctAnswer: 2,
  },
  {
    question: 'Как е най-точно да се описват часовете на Forex сесиите?',
    answers: [
      'Като ориентировъчни прозорци, които може да се различават според пазара и брокера',
      'Като универсални часове за всички финансови пазари',
      'Като часове, които никога не се влияят от часови зони',
    ],
    correctAnswer: 0,
  },
  {
    question: 'Защо местните часове на London и New York понякога се разместват спрямо София?',
    answers: [
      'Защото София сменя часовника всяка седмица',
      'Защото регионите сменят лятното часово време на различни дати',
      'Защото Forex пазарът променя часовата зона',
    ],
    correctAnswer: 1,
  },
  {
    question: 'Какво означава припокриване на две Forex сесии?',
    answers: [
      'Двете сесии са затворени едновременно',
      'Едната сесия отменя другата',
      'И двата ориентировъчни търговски прозореца са отворени едновременно',
    ],
    correctAnswer: 2,
  },
  {
    question: 'Какво НЕ гарантира доброто съотношение риск/печалба?',
    answers: [
      'Че конкретната сделка ще бъде печеливша',
      'Че потенциалната печалба е по-голяма от планирания риск',
      'Че вероятността за успех има значение',
    ],
    correctAnswer: 0,
  },
  {
    question: 'Какво може да покаже backtesting?',
    answers: [
      'Как биха се представили предварително зададени правила върху исторически данни, без гаранция за бъдещи резултати',
      'Каква ще бъде със сигурност печалбата през следващия месец',
      'Кой брокер винаги ще даде най-добра цена',
    ],
    correctAnswer: 0,
  },
];

export const data = new SlashCommandBuilder()
  .setName('quiz')
  .setDescription('Отговори на дневния трейдинг въпрос и спечели Pips.');

function getSofiaDateKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Sofia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== 'literal')
      .map(({ type, value }) => [type, value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function getQuestionForDate(dateKey) {
  const dayNumber = Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / 86_400_000);
  const questionIndex = dayNumber % questions.length;
  return questions[questionIndex];
}

export async function execute(interaction) {
  const dateKey = getSofiaDateKey();
  const question = getQuestionForDate(dateKey);
  const letters = ['A', 'B', 'C'];

  const embed = new EmbedBuilder()
    .setTitle('📈 Дневен трейдинг quiz')
    .setDescription(`**${question.question}**\n\n${question.answers
      .map((answer, index) => `**${letters[index]}.** ${answer}`)
      .join('\n')}`)
    .setColor(0x3498db)
    .setFooter({ text: 'Всеки играч има един отговор за деня. Верният носи 10 Pips.' });

  const answerButtons = new ActionRowBuilder().addComponents(
    letters.map((letter, index) =>
      new ButtonBuilder()
        .setCustomId(`quiz:${QUIZ_VERSION}:${dateKey}:${index}`)
        .setLabel(letter)
        .setStyle(ButtonStyle.Primary),
    ),
  );

  await interaction.reply({ embeds: [embed], components: [answerButtons] });
}

export async function handleAnswer(interaction) {
  const [, version, dateKey, answerIndexText] = interaction.customId.split(':');

  if (version !== QUIZ_VERSION || dateKey !== getSofiaDateKey()) {
    await interaction.reply({ content: 'Този дневен въпрос вече е изтекъл.', ephemeral: true });
    return;
  }

  const question = getQuestionForDate(dateKey);
  const isCorrect = Number(answerIndexText) === question.correctAnswer;

  await interaction.deferReply({ ephemeral: true });
  const result = await recordDailyAnswer({
    userId: interaction.user.id,
    username: interaction.user.username,
    dateKey,
    isCorrect,
  });

  if (result.alreadyAnswered) {
    await interaction.editReply('Вече си отговорил на днешния въпрос. Опитай пак утре!');
    return;
  }

  if (isCorrect) {
    await interaction.editReply('✅ Вярно! Получаваш **10 Pips**.');
  } else {
    await interaction.editReply('❌ Не е вярно. Нов въпрос утре!');
  }
}
