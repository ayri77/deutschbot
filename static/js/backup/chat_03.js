// chat.js — восстановленная версия с анимацией букв и всем функционалом

let topic;
let LETTER_POOL, TEMP_LETTER_POOL, LETTER_OVERLAY,
    CHAT_MESSAGE_COLUMN_WRAPPER, CHAT_MESSAGE_COLUMN,
    MESSAGE_INPUT, MESSAGE_INPUT_FIELD,
    CHAT_BOT_MOOD, CHAT_BOT_MOOD_VALUE;

const STATE = {
  isUserSendingMessage: false,
  isChatBotSendingMessage: false,
  letterPool: {
    transitionPeriod: 30000,
    intervals: []
  },
  moods: ['friendly', 'suspicious', 'boastful'],
  currentMood: '',
  chatbotMessageIndex: 0,
  nLetterSets: 4
};

const moodLabels = {
  friendly: "🌞 Gut gelaunter Sprachcoach",
  suspicious: "🕵️‍♂️ Misstrauischer Beobachter",
  boastful: "🎓 Deutsch-Profi mit Stil"
};

const greetings = {
  friendly: [
    "Hallo! Schön, dich zu sehen. Bist du bereit für ein bisschen Deutsch?",
    "Guten Tag! Lass uns gemeinsam Deutsch lernen!"
  ],
  suspicious: [
    "Hmm... Bist du sicher, dass du Deutsch lernen willst?",
    "Hallo... ich beobachte dich. Lass uns mal sehen, wie gut du vorbereitet bist."
  ],
  boastful: [
    "Ich bin der beste Deutschlehrer im Internet! Los geht's!",
    "Bereit? Ich bin mehr als bereit. Deutsch ist mein Spezialgebiet!"
  ]
};

const convo = {
  friendly: [
    "Sehr gut! Das hast du richtig gesagt.",
    "Du machst Fortschritte! Weiter so!",
    "Ich freue mich, mit dir Deutsch zu sprechen.",
    "Das war eine gute Frage! Lass uns darüber sprechen.",
    "Wenn du Fragen hast, frag ruhig!"
  ],
  suspicious: [
    "Hmm... das klingt nicht ganz richtig.",
    "Ich bin mir nicht sicher, ob das korrekt ist.",
    "Interessant... aber vielleicht gibt es eine bessere Möglichkeit.",
    "Ich hoffe, du weißt, was du tust.",
    "Das war... eine mutige Antwort."
  ],
  boastful: [
    "Ich kenne die Antwort, bevor du die Frage stellst!",
    "Deutsch ist meine Superkraft. Frag mich alles!",
    "Ich bin schneller als jedes Wörterbuch.",
    "Das war leicht! Hast du noch was Schwierigeres?",
    "Du kannst mir vertrauen. Ich bin ein Profi!"
  ]
};

const getEl = (id) => document.getElementById(id);
const addClass = (el, className) => el?.classList.add(className);
const removeClass = (el, className) => el?.classList.remove(className);
const setAttr = (el, attr, value) => el?.setAttribute(attr, value);
const setStyle = (el, styleName, value) => { if (el) el.style[styleName] = value; };
const removeAllChildren = (el) => { while (el?.firstChild) el.removeChild(el.firstChild); };
const removeChild = (parent, child) => { if (parent?.contains(child)) parent.removeChild(child); };
const setElPos = (el, x, y) => { if (el) { el.style.left = `${x}px`; el.style.top = `${y}px`; } };
const getRand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const getRandExcept = (min, max, except) => { let num = getRand(min, max); while (num === except) num = getRand(min, max); return num; };

function getRandPosOffScreen(quadrant = getRand(1, 4)) {
  let x, y;
  switch (quadrant) {
    case 1: x = getRand(-200, -50); y = getRand(-200, window.innerHeight + 200); break;
    case 2: x = getRand(-50, window.innerWidth + 50); y = getRand(-200, -50); break;
    case 3: x = getRand(window.innerWidth + 50, window.innerWidth + 200); y = getRand(-200, window.innerHeight + 200); break;
    case 4: x = getRand(-50, window.innerWidth + 50); y = getRand(window.innerHeight + 50, window.innerHeight + 200); break;
  }
  return { x, y };
}

function getAlphabet(isUpperCase) {
  const letters = [];
  for (let i = 65; i <= 90; i++) {
    const val = isUpperCase ? String.fromCharCode(i) : String.fromCharCode(i).toLowerCase();
    const el = document.createElement('div');
    el.className = 'pool-letter';
    el.innerText = val;
    el.dataset.letter = val;
    letters.push(el);
  }
  return letters;
}

function setRandLetterPaths(letters) {
  for (const letter of letters) {
    const startQ = getRand(1, 4);
    const nextQ = getRandExcept(1, 4, startQ);
    const startPos = getRandPosOffScreen(startQ);
    const nextPos = getRandPosOffScreen(nextQ);
    const delay = getRand(0, STATE.letterPool.transitionPeriod) * -1;
    const transition = `left ${STATE.letterPool.transitionPeriod}ms linear ${delay}ms, top ${STATE.letterPool.transitionPeriod}ms linear ${delay}ms`;
    setElPos(letter, startPos.x, startPos.y);
    setStyle(letter, 'transition', transition);
    addClass(letter, 'invisible');
    LETTER_POOL.appendChild(letter);
    setTimeout(() => {
      setElPos(letter, nextPos.x, nextPos.y);
      removeClass(letter, 'invisible');
      const interval = setInterval(() => {
        const next = getRandPosOffScreen(getRand(1, 4));
        setElPos(letter, next.x, next.y);
      }, STATE.letterPool.transitionPeriod);
      STATE.letterPool.intervals.push(interval);
    }, 1);
  }
}

function clearLetterPool() {
  removeAllChildren(LETTER_POOL);
}

function fillLetterPool(nSets = 1) {
  for (let i = 0; i < nSets; i++) {
    setRandLetterPaths(getAlphabet(false));
    setRandLetterPaths(getAlphabet(true));
  }
}

function getRandGreeting() {
  const mood = STATE.currentMood;
  const options = greetings[mood];
  return options[getRand(0, options.length - 1)];
}

function getRandConvo() {
  const mood = STATE.currentMood;
  const options = convo[mood];
  return options[getRand(0, options.length - 1)];
}

function setChatbotMood() {
  STATE.currentMood = STATE.moods[getRand(0, STATE.moods.length - 1)];
  for (const mood of STATE.moods) removeClass(CHAT_BOT_MOOD, mood);
  addClass(CHAT_BOT_MOOD, STATE.currentMood);
  CHAT_BOT_MOOD_VALUE.innerHTML = moodLabels[STATE.currentMood] || STATE.currentMood;
}

function createLetterElement(val) {
  const span = document.createElement('span');
  span.className = 'overlay-letter in-flight';
  span.innerText = val;
  return span;
}

function findLetterInPool(letterVal) {
  const letters = LETTER_POOL.childNodes;
  for (let i = 0; i < letters.length; i++) {
    const l = letters[i];
    if (l.dataset.letter === letterVal && !l.dataset.used) {
      l.dataset.used = 'true';
      return l;
    }
  }
  return null;
}

function animateOverlayLetter(letter, contentText, finalPos, isReceived) {
    removePoolLetter(letter);
    const initPos = letter.getBoundingClientRect();
    const overlayLetter = createOverlayLetter(letter.dataset.letter);
  
    setElPos(overlayLetter, initPos.left, initPos.top);
    LETTER_OVERLAY.appendChild(overlayLetter);
  
    setTimeout(() => {
      setElPos(overlayLetter, finalPos.left, finalPos.top);
      setTimeout(() => {
        removeClass(contentText, 'invisible');
        addClass(overlayLetter, 'invisible');
        setTimeout(() => {
          removeChild(LETTER_OVERLAY, overlayLetter);
        }, 1000);
      }, 1500);
    }, 100);
  }

function createOverlayLetter(val) {
    const overlayLetter = document.createElement('span');
    overlayLetter.classList.add('overlay-letter', 'in-flight');
    overlayLetter.innerText = val;
    return overlayLetter;
  }

  function animateMessageLetters(message, isReceived) {
    const content = message.getElementsByClassName('content')[0];
    const contentText = content.getElementsByClassName('text')[0];
    const letters = contentText.childNodes;
  
    const wrapperRect = CHAT_MESSAGE_COLUMN_WRAPPER.getBoundingClientRect();
  
    for (let i = 0; i < letters.length; i++) {
      const letter = letters[i];
      const targetLetter = findLetterInPool(letter.dataset.letter);
      const letterRect = letter.getBoundingClientRect();
  
      const correctedFinalPos = {
        top: letterRect.top - wrapperRect.top + CHAT_MESSAGE_COLUMN_WRAPPER.scrollTop,
        left: letterRect.left - wrapperRect.left
      };
  
      if (targetLetter) {
        animateOverlayLetter(targetLetter, contentText, correctedFinalPos, isReceived);
      } else {
        const tempLetter = createLetter('temp-letter', letter.dataset.letter);
        const pos = getRandPosOffScreen();
        addClass(tempLetter, 'invisible');
        setElPos(tempLetter, pos.x, pos.y);
        TEMP_LETTER_POOL.appendChild(tempLetter);
        animateOverlayLetter(tempLetter, contentText, correctedFinalPos, isReceived);
        setTimeout(() => {
          removeChild(TEMP_LETTER_POOL, tempLetter);
        }, 100);
      }
    }
  }
  

function createChatMessage(text, isReceived) {
    const message = document.createElement('div');
    const profileIcon = document.createElement('div');
    const icon = document.createElement('i');
    const content = document.createElement('div');
    const contentText = document.createElement('h1');
    const direction = isReceived ? 'received' : 'sent';
  
    content.classList.add('content', 'invisible');
    contentText.classList.add('text', 'invisible');
  
    for (let i = 0; i < text.length; i++) {
      const span = document.createElement('span');
      span.innerText = text[i];
      span.setAttribute('data-letter', text[i]);
      contentText.appendChild(span);
    }
  
    content.appendChild(contentText);
    profileIcon.classList.add('profile-icon', 'invisible');
    profileIcon.appendChild(icon);
    message.classList.add('message', direction);
  
    if (isReceived) {
      icon.classList.add('fab', 'fa-cloudsmith');
      message.classList.add(STATE.currentMood);
      message.appendChild(profileIcon);
      message.appendChild(content);
    } else {
      icon.classList.add('far', 'fa-user');
      message.appendChild(content);
      message.appendChild(profileIcon);
    }
  
    return message;
  }
  

function addChatMessage(text, isReceived) {
    const message = createChatMessage(text, isReceived);
    const content = message.getElementsByClassName('content')[0];
    const contentText = content.getElementsByClassName('text')[0];
    const profileIcon = message.getElementsByClassName('profile-icon')[0];
    CHAT_MESSAGE_COLUMN.appendChild(message);
  
    setTimeout(() => {
      profileIcon.classList.remove('invisible');
      setTimeout(() => {
        content.classList.remove('invisible');
        setTimeout(() => {
          animateMessageLetters(message, isReceived);
          setTimeout(() => replenishLetterPool(STATE.nLetterSets), 2500);
        }, 1000);
      }, 250);
    }, 250);
}
  
function sendUserMessage() {
  const userMessage = MESSAGE_INPUT_FIELD.value;
  if (!userMessage.trim()) return;
  addChatMessage(userMessage, false);
  MESSAGE_INPUT_FIELD.value = '';
  sendChatbotMessage(userMessage);
}

function sendChatbotMessage(userMessage) {
  fetch('/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: userMessage, topic: topic })
  })
    .then(res => res.json())
    .then(data => {
      const botMessage = data.answer;
      addChatMessage(botMessage, true);
    })
    .catch(err => console.error(err));
}

function setupInput() {
  MESSAGE_INPUT_FIELD.addEventListener('keypress', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendUserMessage();
    }
  });
}

function initLetterPool() {
  clearLetterPool();
  fillLetterPool(STATE.nLetterSets);
}

function resetLetterPool() {
  for (const interval of STATE.letterPool.intervals) clearInterval(interval);
  clearLetterPool();
  setTimeout(() => initLetterPool(), 200);
}

function setMoodInterval(time) {
  moodInterval = setInterval(() => {
    clearInterval(moodInterval);
    setChatbotMood();
    setMoodInterval(getRand(20000, 40000));
  }, time);
}

function init() {
  topic = getEl('topic')?.value || "Немецкий язык";
  LETTER_POOL = getEl('letter-pool');
  TEMP_LETTER_POOL = getEl('temp-letter-pool');
  LETTER_OVERLAY = getEl('letter-overlay');
  CHAT_MESSAGE_COLUMN_WRAPPER = getEl('chat-message-column-wrapper');
  CHAT_MESSAGE_COLUMN = getEl('chat-message-column');
  MESSAGE_INPUT = getEl('message-input');
  MESSAGE_INPUT_FIELD = getEl('message-input-field');
  CHAT_BOT_MOOD = getEl('chat-bot-mood');
  CHAT_BOT_MOOD_VALUE = getEl('chat-bot-mood-value');

  if (!MESSAGE_INPUT_FIELD) {
    console.error("Не найден input для ввода сообщений!");
    return;
  }

  setupInput();
  setChatbotMood();
  initLetterPool();
  setMoodInterval(getRand(20000, 40000));
  addChatMessage(getRandGreeting(), true);
}

document.addEventListener("DOMContentLoaded", () => {
  try {
    init();
  } catch (e) {
    console.error("Ошибка при инициализации чата:", e);
  }
});

window.onfocus = () => resetLetterPool();
window.onresize = _.throttle(resetLetterPool, 200);
