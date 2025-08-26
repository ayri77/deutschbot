// Новый параметр для переключения режима стриминга
const USE_STREAMING = true;

// Новый параметр для включения/выключения голосового вывода
const USE_SPEECH_OUTPUT = true;

function showTypingIndicator(show) {
  const el = document.getElementById("typing-indicator");
  if (!el) return;

  el.classList.toggle("hidden", !show);

  if (show) scrollToBottomOfMessages();
}

const topic = new URLSearchParams(window.location.search).get("topic") || "Немецкий язык";

// Вспомогательная функция для сокращения записи document.getElementById
const getEl = (id) => document.getElementById(id);

// Вспомогательные функции, которые также часто используются в шаблоне:
const addClass = (el, className) => el.classList.add(className);
const removeClass = (el, className) => el.classList.remove(className);
const setAttr = (el, attr, value) => el.setAttribute(attr, value);
const setStyle = (el, styleName, value) => el.style[styleName] = value;
const removeAllChildren = (el) => { while (el.firstChild) el.removeChild(el.firstChild); };
const removeChild = (parent, child) => {
  if (parent.contains(child)) {
    parent.removeChild(child);
  }
};

const setElPos = (el, x, y) => {
  el.style.left = `${x}px`;
  el.style.top = `${y}px`;
};

// Получить случайное число от min до max (включительно)
const getRand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

// Получить случайное число от min до max (кроме указанного значения)
const getRandExcept = (min, max, except) => {
  let num = getRand(min, max);
  while (num === except) num = getRand(min, max);
  return num;
};

// Получить случайную позицию за пределами экрана
const getRandPosOffScreen = (quadrant = getRand(1,4)) => {
  let x, y;
  switch(quadrant){
    case 1:
      x = getRand(-200, -50);
      y = getRand(-200, window.innerHeight + 200);
      break;
    case 2:
      x = getRand(-50, window.innerWidth + 50);
      y = getRand(-200, -50);
      break;
    case 3:
      x = getRand(window.innerWidth + 50, window.innerWidth + 200);
      y = getRand(-200, window.innerHeight + 200);
      break;
    case 4:
      x = getRand(-50, window.innerWidth + 50);
      y = getRand(window.innerHeight + 50, window.innerHeight + 200);
      break;
  }
  return { x, y };
};


const LETTER_POOL = getEl('letter-pool'),
      TEMP_LETTER_POOL = getEl('temp-letter-pool'),
      LETTER_OVERLAY = getEl('letter-overlay'),
      CHAT_MESSAGE_COLUMN_WRAPPER = getEl('chat-message-column-wrapper'),
      CHAT_MESSAGE_COLUMN = getEl('chat-message-column'),
      MESSAGE_INPUT = getEl('message-input'),
      MESSAGE_INPUT_FIELD = getEl('message-input-field'),
      CHAT_BOT_MOOD = getEl('chat-bot-mood'),
      CHAT_BOT_MOOD_VALUE = getEl('chat-bot-mood-value')

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
}

const moodLabels = {
  friendly: "🌞 Gut gelaunter Sprachcoach",
  suspicious: "🕵️‍♂️ Misstrauischer Beobachter",
  boastful: "🎓 Deutsch-Profi mit Stil"
}

const getRandMood = () => {
  const rand = getRand(1, 3)
  return STATE.moods[rand - 1]
}

const setChatbotMood = () => {
  STATE.currentMood = getRandMood()
  for(let i = 0; i < STATE.moods.length; i++){
    removeClass(CHAT_BOT_MOOD, STATE.moods[i])
  }
  addClass(CHAT_BOT_MOOD, STATE.currentMood)
  //CHAT_BOT_MOOD_VALUE.innerHTML = STATE.currentMood
  CHAT_BOT_MOOD_VALUE.innerHTML = moodLabels[STATE.currentMood] || STATE.currentMood;

}

const getRandGreeting = () => {
  let rand = 0
  switch(STATE.currentMood){
    case 'friendly':
      rand = getRand(1, greetings.friendly.length)
      return greetings.friendly[rand - 1]
    case 'suspicious':
      rand = getRand(1, greetings.suspicious.length)
      return greetings.suspicious[rand - 1]
    case 'boastful':
      rand = getRand(1, greetings.boastful.length)
      return greetings.boastful[rand - 1]
    default:
      break
  }
}

const getRandConvo = () => {
  let rand = 0
  switch(STATE.currentMood){
    case 'friendly':
      rand = getRand(1, convo.friendly.length)
      return convo.friendly[rand - 1]
    case 'suspicious':
      rand = getRand(1, convo.suspicious.length)
      return convo.suspicious[rand - 1]
    case 'boastful':
      rand = getRand(1, convo.boastful.length)
      return convo.boastful[rand - 1]
    default:
      break
  }
}

const createLetter = (cName, val) => {
  const letter = document.createElement('div')
  addClass(letter, cName)
  setAttr(letter, 'data-letter', val)
  letter.innerHTML = val
  return letter
}

const getAlphabet = isUpperCase => {
  let letters = []
  for(let i = 65; i <= 90; i++){
    let val = String.fromCharCode(i),
          letter = null
    if(!isUpperCase) val = val.toLowerCase()
    letter = createLetter('pool-letter', val)
    letters.push(letter)
  }
  return letters
}

const startNewLetterPath = (letter, nextRand, interval) => {
  clearInterval(interval)
  nextRand = getRandExcept(1, 4, nextRand)
  let nextPos = getRandPosOffScreen(nextRand),
          transitionPeriod = STATE.letterPool.transitionPeriod,
          delay = getRand(0, STATE.letterPool.transitionPeriod),
          transition = `left ${transitionPeriod}ms linear ${delay}ms, top ${transitionPeriod}ms linear ${delay}ms, opacity 0.5s`
  setElPos(letter, nextPos.x, nextPos.y)
  setStyle(letter, 'transition', transition)
  interval = setInterval(() => {
    startNewLetterPath(letter, nextRand, interval)
  }, STATE.letterPool.transitionPeriod + delay)
  STATE.letterPool.intervals.push(interval)
}

const setRandLetterPaths = letters => {
  for(let i = 0; i < letters.length; i++){
    let letter = letters[i],
          startRand = getRand(1, 4),
          nextRand = getRandExcept(1, 4, startRand),
          startPos = getRandPosOffScreen(startRand),
          nextPos = getRandPosOffScreen(nextRand),
          transitionPeriod = STATE.letterPool.transitionPeriod,
          delay = getRand(0, STATE.letterPool.transitionPeriod) * -1,
          transition = `left ${transitionPeriod}ms linear ${delay}ms, top ${transitionPeriod}ms linear ${delay}ms, opacity 0.5s`
          
    setElPos(letter, startPos.x, startPos.y)
    setStyle(letter, 'transition', transition)
    addClass(letter, 'invisible')
    LETTER_POOL.appendChild(letter)
    setTimeout(() => {
      setElPos(letter, nextPos.x, nextPos.y)
      removeClass(letter, 'invisible')
      let interval = setInterval(() => {
        startNewLetterPath(letter, nextRand, interval)
      }, STATE.letterPool.transitionPeriod + delay)
    }, 1)
  }
}

const fillLetterPool = (nSets = 1) => {
  for(let i = 0; i < nSets; i++){
    const lCaseLetters = getAlphabet(false),
          uCaseLetters = getAlphabet(true)
    setRandLetterPaths(lCaseLetters)
    setRandLetterPaths(uCaseLetters)
  }
}

const findMissingLetters = (letters, lCount, isUpperCase) => {
  let missingLetters = []
  for(let i = 65; i <= 90; i++){
    let val = isUpperCase ? String.fromCharCode(i) : String.fromCharCode(i).toLowerCase(),
        nLetter = letters.filter(letter => letter === val).length
    if(nLetter < lCount){
      let j = nLetter
      while(j < lCount){
        missingLetters.push(val)
        j++
      }
    }
  }
  return missingLetters
}

const replenishLetterPool = (nSets = 1) => {
  const poolLetters = LETTER_POOL.childNodes
  let charInd = 65,
      currentLetters = [],
      missingLetters = [],
      lettersToAdd = []
  
  for(let i = 0; i < poolLetters.length; i++){
    currentLetters.push(poolLetters[i].dataset.letter)
  }
  missingLetters = [...missingLetters, ...findMissingLetters(currentLetters, nSets, false)]
  missingLetters = [...missingLetters, ...findMissingLetters(currentLetters, nSets, true)]
  for(let i = 0; i < missingLetters.length; i++){
    const val = missingLetters[i]
    lettersToAdd.push(createLetter('pool-letter', val))
  }
  setRandLetterPaths(lettersToAdd)
}

const clearLetterPool = () => {
  removeAllChildren(LETTER_POOL)
}

const scrollToBottomOfMessages = () => {
  CHAT_MESSAGE_COLUMN_WRAPPER.scrollTop = CHAT_MESSAGE_COLUMN_WRAPPER.scrollHeight
}

const checkMessageColumnHeight = () => {
  if(CHAT_MESSAGE_COLUMN.clientHeight >= window.innerHeight){
    removeClass(CHAT_MESSAGE_COLUMN, 'static')
  }
  else{
    addClass(CHAT_MESSAGE_COLUMN, 'static')
  }
}

const appendContentText = (contentText, text) => {
  for(let i = 0; i < text.length; i++){
    const letter = document.createElement('span')
    letter.innerHTML = text[i]
    setAttr(letter, 'data-letter', text[i])
    contentText.appendChild(letter)
  }
}

const createChatMessage = (text, isReceived) => {
  let message = document.createElement('div'),
      profileIcon = document.createElement('div'),
      icon = document.createElement('i'),
      content = document.createElement('div'),
      contentText = document.createElement('h1'),
      direction = isReceived ? 'received' : 'sent'
  
  addClass(content, 'content')
  addClass(content, 'invisible')
  addClass(contentText, 'text')
  addClass(contentText, 'invisible')
  appendContentText(contentText, text)
  content.appendChild(contentText)
  
  addClass(profileIcon, 'profile-icon')
  addClass(profileIcon, 'invisible')
  profileIcon.appendChild(icon)
  
  addClass(message, 'message')
  addClass(message, direction)
  
  if(isReceived){
    addClass(icon, 'fab')
    addClass(icon, 'fa-cloudsmith')
    addClass(message, STATE.currentMood)
    message.appendChild(profileIcon)
    message.appendChild(content)
  }
  else{
    addClass(icon, 'far')
    addClass(icon, 'fa-user')
    message.appendChild(content)
    message.appendChild(profileIcon)
  }
  
  return message
}

const findLetterInPool = targetLetter => {
  let letters = LETTER_POOL.childNodes,
        foundLetter = null
  for(let i = 0; i < letters.length; i++){
    const nextLetter = letters[i]
    if(nextLetter.dataset.letter === targetLetter && !nextLetter.dataset.found){
      foundLetter = letters[i]
      setAttr(foundLetter, 'data-found', true)
      break
    }
  }
  return foundLetter
}

const createOverlayLetter = val => {
  const overlayLetter = document.createElement('span')
        addClass(overlayLetter, 'overlay-letter')
        addClass(overlayLetter, 'in-flight')
        overlayLetter.innerHTML = val
  return overlayLetter
}

const removePoolLetter = letter => {
  addClass(letter, 'invisible')
  setTimeout(() => {
    removeChild(LETTER_POOL, letter)
  }, 500)
}

const setElPosFromRight = (el, x, y) => {
  setStyle(el, 'right', x + 'px')
  setStyle(el, 'top', y + 'px')
}

const animateOverlayLetter = (letter, contentText, finalPos, isReceived) => {
  removePoolLetter(letter)
  const initPos = letter.getBoundingClientRect(),
        overlayLetter = createOverlayLetter(letter.dataset.letter)
  /*if(isReceived){
    setElPos(overlayLetter, initPos.left, initPos.top)
  }
  else{
    setElPosFromRight(overlayLetter, window.innerWidth - initPos.right, initPos.top)
  }*/
  setElPos(overlayLetter, initPos.left, initPos.top)

  LETTER_OVERLAY.appendChild(overlayLetter)
  setTimeout(() => {
    /*if(isReceived){
      setElPos(overlayLetter, finalPos.left, finalPos.top)
    }
    else{
      setElPosFromRight(overlayLetter, window.innerWidth - finalPos.right, finalPos.top)
    }*/
    setElPos(overlayLetter, finalPos.left, finalPos.top)
    setTimeout(() => {//asdf
      removeClass(contentText, 'invisible')
      addClass(overlayLetter, 'invisible')
      setTimeout(() => {
        removeChild(LETTER_OVERLAY, overlayLetter)
      }, 1000)
    }, 1500)
  }, 100)
}

const animateMessageLetters = (message, isReceived) => {
  const content = message.getElementsByClassName('content')[0];
  const contentText = content.getElementsByClassName('text')[0];
  const letters = contentText.childNodes;

  // Получаем позицию родительского контейнера сообщений
  const wrapperRect = CHAT_MESSAGE_COLUMN_WRAPPER.getBoundingClientRect();

  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];

    // Ищем букву из общего пула букв
    const targetLetter = findLetterInPool(letter.dataset.letter);

    // Финальные координаты буквы относительно окна браузера
    const letterRect = letter.getBoundingClientRect();

    // Пересчитываем координаты буквы относительно контейнера сообщений (с учетом скролла!)
    const correctedFinalPos = {
      top: letterRect.top - wrapperRect.top + CHAT_MESSAGE_COLUMN_WRAPPER.scrollTop,
      left: letterRect.left - wrapperRect.left
    };

    if (targetLetter) {
      animateOverlayLetter(targetLetter, contentText, correctedFinalPos, isReceived);
    } else {
      // Если буквы нет в пуле, создаем временную букву
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
};

const addChatMessage = (text, isReceived) => {
  const message = createChatMessage(text, isReceived),
        content = message.getElementsByClassName('content')[0],
        contentText = content.getElementsByClassName('text')[0],
        profileIcon = message.getElementsByClassName('profile-icon')[0]
  CHAT_MESSAGE_COLUMN.appendChild(message)
  toggleInput()
  setTimeout(() => {
    removeClass(profileIcon, 'invisible')
    setTimeout(() => {
      removeClass(content, 'invisible')
      setTimeout(() => {
        animateMessageLetters(message, isReceived)
        setTimeout(() => replenishLetterPool(STATE.nLetterSets), 500)
      }, 300)
    }, 250)
  }, 250)
}

const checkIfInputFieldHasVal = () => MESSAGE_INPUT_FIELD.value.length > 0

const clearInputField = () => {
  MESSAGE_INPUT_FIELD.value = ''
}

const disableInputField = () => {
  MESSAGE_INPUT_FIELD.blur()
  MESSAGE_INPUT_FIELD.value = ''
  MESSAGE_INPUT_FIELD.readOnly = true
}

const enableInputField = () => {
  MESSAGE_INPUT_FIELD.readOnly = false
  MESSAGE_INPUT_FIELD.focus()
}

const getChatbotMessageText = () => {
  if(STATE.chatbotMessageIndex === 0){
    return getRandGreeting()
  }
  else{
    return getRandConvo()
  }
}

const sendChatbotMessage = async (userMessage) => {
  showTypingIndicator(true);
  if (USE_STREAMING) {
    let result = '';
    try {
      const response = await fetch('/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userMessage,
          topic: topic,
          stream: true
        })
      });

      if (!response.ok || !response.body) throw new Error('No stream body');

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let result = '';
      const message = createChatMessage('', true);
      CHAT_MESSAGE_COLUMN.appendChild(message);
      const content = message.getElementsByClassName('content')[0];
      const contentText = content.getElementsByClassName('text')[0];
      const profileIcon = message.getElementsByClassName('profile-icon')[0];

      removeClass(profileIcon, 'invisible');
      removeClass(content, 'invisible');
      removeClass(contentText, 'invisible');

      let htmlStarted = false;
      let inTag = false;
      let tagBuffer = "";
      
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
      
        const chunk = value ? decoder.decode(value, { stream: true }) : "";
      
        if (chunk.includes("<|html|>")) {
          htmlStarted = true;
          result += chunk;
          continue;
        }
      
        for (let char of chunk) {
          result += char;
      
          if (htmlStarted) continue;
      
          if (char === "<") {
            inTag = true;
            tagBuffer = "<";
            continue;
          }
      
          if (inTag) {
            tagBuffer += char;
            if (char === ">") {
              inTag = false;
              tagBuffer = "";
            }
            continue;
          }
      
          const span = document.createElement("span");
          span.textContent = char;
          span.dataset.letter = char;
          contentText.appendChild(span);
      
          const targetLetter = findLetterInPool(char);
          const letterRect = span.getBoundingClientRect();
          const wrapperRect = CHAT_MESSAGE_COLUMN_WRAPPER.getBoundingClientRect();
          const correctedFinalPos = {
            top: letterRect.top - wrapperRect.top + CHAT_MESSAGE_COLUMN_WRAPPER.scrollTop,
            left: letterRect.left - wrapperRect.left
          };
      
          if (targetLetter) {
            animateOverlayLetter(targetLetter, contentText, correctedFinalPos, true);
          } else {
            const tempLetter = createLetter("temp-letter", char);
            const pos = getRandPosOffScreen();
            addClass(tempLetter, "invisible");
            setElPos(tempLetter, pos.x, pos.y);
            TEMP_LETTER_POOL.appendChild(tempLetter);
      
            animateOverlayLetter(tempLetter, contentText, correctedFinalPos, true);
            setTimeout(() => {
              removeChild(TEMP_LETTER_POOL, tempLetter);
            }, 100);
          }
      
          scrollToBottomOfMessages();
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      }
      
      htmlMarker = "<|html|>"
      showTypingIndicator(false);
      // Заменим побуквенные спаны на полноценный HTML-ответ
      if (result.includes(htmlMarker)) {
        const html = result.split(htmlMarker)[1];
        contentText.innerHTML = html;
        addSpeakExamplesButton(content);
      } else {
        contentText.innerHTML = result;
        // 🔕 Кнопку не добавляем — нет форматирования
      }
      
      //animateMessageLetters(message, true);
      //setTimeout(() => replenishLetterPool(STATE.nLetterSets), 1500);
    } catch (error) {
      console.error('Streaming error:', error);
      if (!result.trim()) {
        addMessage("Извините, произошла ошибка при получении ответа.", "received");
      }      
    } finally {      
      STATE.isChatBotSendingMessage = false;
      toggleInput();
    }
  } else {
    fetch('/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: userMessage,
        topic: topic
      })
    })
    .then(res => res.json())
    .then(data => {
      const botMessage = data.answer;
      STATE.isChatBotSendingMessage = true;
      addChatMessage(botMessage, true);
      STATE.chatbotMessageIndex++;
    })
    .catch(err => console.error(err))
    .finally(() => {
      showTypingIndicator(false);
      STATE.isChatBotSendingMessage = false;
      toggleInput();
    });
  }
};

const sendUserMessage = () => {
  const userMessage = MESSAGE_INPUT_FIELD.value;
  
  // Проверяем, нужно ли скрыть кнопки
  const hideButtons = new URLSearchParams(window.location.search).get("hide_buttons") === "true";
  
  // Если кнопки скрыты и это первое сообщение, отправляем пустое сообщение для старта диалога
  if (hideButtons && !userMessage.trim() && STATE.chatbotMessageIndex === 0) {
    STATE.isUserSendingMessage = true;
    sendChatbotMessage("");
    
    setTimeout(() => {
      STATE.isUserSendingMessage = false;
      toggleInput();
    }, 1000);
    return;
  }
  
  // Обычная логика для непустых сообщений
  if (!userMessage.trim()) return;

  STATE.isUserSendingMessage = true;
  addChatMessage(userMessage, false);
  clearInputField();
  toggleInput();

  sendChatbotMessage(userMessage);
  
  setTimeout(() => {
    STATE.isUserSendingMessage = false;
    toggleInput();
  }, 1000);
};


const onEnterPress = e => {
  sendUserMessage();
};


const initLetterPool = () => {
  clearLetterPool()
  fillLetterPool(STATE.nLetterSets)
}

const init = () => {
  setChatbotMood()
  initLetterPool()

  // Проверяем, нужно ли скрыть кнопки
  const hideButtons = new URLSearchParams(window.location.search).get("hide_buttons") === "true";
  
  // Если кнопки скрыты, не показываем приветствие и сценарии
  if (!hideButtons) {
    const greetingMessage = getRandGreeting();
    STATE.isChatBotSendingMessage = true;
    addChatMessage(greetingMessage, true);
    STATE.chatbotMessageIndex++;
    showQuickOptions();
    
    setTimeout(() => {
      STATE.isChatBotSendingMessage = false;
      toggleInput();
    }, 2000);
  } else {
    // Если кнопки скрыты, сразу включаем ввод и автоматически начинаем диалог
    toggleInput();
    
    // Автоматически отправляем первое сообщение, чтобы бот начал диалог
    setTimeout(() => {
      MESSAGE_INPUT_FIELD.value = "";
      sendUserMessage();
    }, 500);
  }

  setMoodInterval(getRandMoodInterval());

  if (STATE.chatbotMessageIndex === 0 && !hideButtons) {
    showWelcomeMessageAndOptions();
  }  
};

let resetTimeout = null
const resetLetterPool = () => {
  const intervals = STATE.letterPool.intervals
  for(let i = 0; i < intervals.length; i++){
    clearInterval(intervals[i])
  }
  clearTimeout(resetTimeout)
  clearLetterPool()
  resetTimeout = setTimeout(() => {
    initLetterPool()
  }, 200)
}

const toggleInput = () => {
  if(checkIfInputFieldHasVal() && canSendMessage()){
    addClass(MESSAGE_INPUT, 'send-enabled')
  }
  else{
    removeClass(MESSAGE_INPUT, 'send-enabled')
  }
}

const isValidLetter = e => {
  return !e.ctrlKey 
    && e.key !== 'Enter'
    && e.keyCode !== 8
    && e.keyCode !== 9
    && e.keyCode !== 13
}

const canSendMessage = () => !STATE.isUserSendingMessage && !STATE.isChatBotSendingMessage

const getRandMoodInterval = () => getRand(20000, 40000)

let moodInterval = null
const setMoodInterval = time => {
  moodInterval = setInterval(() => {
    clearInterval(moodInterval)
    setChatbotMood()
    setMoodInterval(getRandMoodInterval())
  }, time)
}

MESSAGE_INPUT_FIELD.onkeypress = e => {
  if (e.key === 'Enter') {
    e.preventDefault(); // ⬅️ предотвратит перенос строки
    if (checkIfInputFieldHasVal() && canSendMessage()) {
      removeClass(MESSAGE_INPUT, 'send-enabled');
      onEnterPress(e);
    }
  }
}

MESSAGE_INPUT_FIELD.onkeyup = () => {
  toggleInput()
}

MESSAGE_INPUT_FIELD.oncut = () => toggleInput()

// Функция для определения языка текста
function detectLanguage(text) {
  const germanWords = ["du", "bist", "nicht", "haben", "sein", "und", "ich", "wir", "ihr", "sie"];
  const lowercase = text.toLowerCase();
  const hits = germanWords.filter(word => lowercase.includes(word));
  return hits.length >= 2 ? "de-DE" : "ru-RU";
}

// Функция для синтеза речи
function speak(text, lang = "de-DE") {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 1;
  utterance.pitch = 1;
  speechSynthesis.speak(utterance);
}

window.onload = () => init()

document.getElementById("quick-options").addEventListener("click", (e) => {
  if (e.target.tagName === "BUTTON" && e.target.dataset.msg) {
    const message = e.target.dataset.msg;
    MESSAGE_INPUT_FIELD.value = message;
    sendUserMessage();
    hideQuickOptions();
  }

  if (e.target.id === "hide-options") {
    hideQuickOptions();
  }
});

const sendButton = document.getElementById('send-message-button');
sendButton.addEventListener('click', sendUserMessage);

window.onfocus = () => resetLetterPool()

window.onresize = _.throttle(resetLetterPool, 200)

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
}
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
}

const messageInput = document.getElementById('message-input-field');

messageInput.addEventListener('input', () => {
  messageInput.style.height = 'auto'; // Сброс текущей высоты
  messageInput.style.height = messageInput.scrollHeight + 'px'; // Установка новой
});

/* голосовой ввод-вывод */

function showWelcomeMessageAndOptions() {
  const greetingMessage = "Привет! Я помогу тебе с этим уроком. Вот что я умею:\n— Объяснить грамматику\n— Показать примеры\n— Провести тестирование\nС чего начнём?";
  addChatMessage(greetingMessage, true);
  showQuickOptions();
}

const quickOptions = document.getElementById("quick-options");
const toggleOptionsButton = document.getElementById("toggle-options-button");

function showQuickOptions() {
  quickOptions.classList.remove("hidden");
  if (toggleOptionsButton) toggleOptionsButton.textContent = "Скрыть сценарии";
}

function hideQuickOptions() {
  quickOptions.classList.add("hidden");
  if (toggleOptionsButton) toggleOptionsButton.textContent = "Показать сценарии";
}

toggleOptionsButton.onclick = () => {
  if (quickOptions.classList.contains("hidden")) {
    showQuickOptions();
  } else {
    hideQuickOptions();
  }
};

const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = navigator.language || "ru-RU" || "de-DE"; // например, "de-DE"
recognition.interimResults = false;
recognition.maxAlternatives = 1;

recognition.onresult = (event) => {
  const transcript = event.results[0][0].transcript;
  console.log("🎤 Распознано:", transcript);
  MESSAGE_INPUT_FIELD.value = transcript;
  toggleInput(); // обновляем активность кнопки отправки
};

recognition.onerror = (event) => {
  console.error("🎤 Ошибка распознавания:", event.error);
};

recognition.onend = () => {
  console.log("🎤 Распознавание завершено.");
};

document.getElementById("voice-input-button").onclick = () => {
  recognition.start();
};

// Функция для добавления кнопки "проговаривания" примеров из сообщения
function addSpeakExamplesButton(messageContent) {
  const button = document.createElement("button");
  button.textContent = "🔊 Произнести примеры";
  button.style.marginTop = "10px";
  button.style.padding = "5px 10px";
  button.style.fontSize = "14px";
  button.style.cursor = "pointer";
 
  button.onclick = () => {
    const examples = extractExamplesFromMessage(messageContent);
    if (examples.length > 0) {
      speakExamplesSequentially(examples);
    } else {
      alert("Примеры для произношения не найдены.");
    }
  };

  messageContent.appendChild(button);
}

// Функция для извлечения примеров из текста сообщения
function extractExamplesFromMessage(messageContent) {
  const examples = [];
  const blocks = messageContent.querySelectorAll("div.example");

  blocks.forEach(div => {
    const de = div.querySelector('span[lang="de"]')?.textContent.trim() || "";
    const ru = div.querySelector('span[lang="ru"]')?.textContent.trim() || "";
    if (de || ru) {
      examples.push({ de, ru });
    }
  });

  return examples;
}


async function speakExamplesSequentially(examples) {
  for (let example of examples) {
    if (example.de) await speakWithGoogleTTS(example.de, "de-DE");
    if (example.ru) await speakWithGoogleTTS(example.ru, "ru-RU");
  }
}


// Функция для отправки текста на сервер Google TTS
function speakWithGoogleTTS(text, lang = 'de-DE') {
  return fetch('/tts', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ text, lang })
  })
  .then(res => res.blob())
  .then(blob => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = resolve;
      audio.onerror = reject;
      audio.play();
    });
  })
  .catch(err => console.error("TTS error:", err));
}
