from flask import Flask, render_template, request, jsonify, session, url_for
from flask import send_file
import openai
import os
from dotenv import load_dotenv
from pathlib import Path
from bs4 import BeautifulSoup
import json
import chardet

from flask_session import Session
from urllib.parse import unquote, quote
from flask import Response

from markdown import markdown
from google.oauth2 import service_account
from google.cloud import texttospeech
import io

# Загружаем API-ключ из .env
if os.environ.get("GOOGLE_ENV") != "render":
    env_path = Path(__file__).parent / ".env"
    load_dotenv(dotenv_path=env_path, override=True)
openai_key = os.getenv("OPENAI_API_KEY").strip()

# ключи - гугл
if os.environ.get("GOOGLE_ENV") == "render":
    # используем переменную среды
    credentials_info = json.loads(os.environ["GOOGLE_APPLICATION_CREDENTIALS_JSON"])
    credentials = service_account.Credentials.from_service_account_info(credentials_info)
else:
    # используем локальный файл
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = r"C:\Users\pbori\OneDrive\Документи\Phyton\Google keys\chatbot\propane-abbey-456722-s5-2b194ffb3411.json"
    credentials = None  # default load via env

#openai.api_key = openai_key
client = openai.OpenAI(api_key=openai_key)

app = Flask(__name__, static_folder="static")
app.secret_key = "mysecretkey"
# Включаем серверное хранилище сессии:
app.config['SESSION_TYPE'] = 'filesystem'  # или 'redis', если у тебя есть Redis
app.config['SESSION_PERMANENT'] = False
app.config['SESSION_COOKIE_SAMESITE'] = 'None'
app.config['SESSION_COOKIE_SECURE'] = True

Session(app)

LESSON_PATH = os.path.join("static", "lessons")  # Папка с HTML-уроками

@app.route('/embed_full')
def embed_full():
    topic = request.args.get("topic")
    file_type = request.args.get("file_type", "html")    
    print(f"▶️ embed_full: topic = {topic}, file_type = {file_type}")
    if topic:
        # Загрузка HTML-урока
        filename = topic + "." + file_type
        filepath = os.path.join("static","lessons", filename)
        print(f"📁 Путь к файлу: {filepath}")
        if os.path.exists(filepath):
            with open(filepath, encoding="utf-8") as f:
                if file_type == "html":
                    html = f.read()
                    soup = BeautifulSoup(html, 'html.parser')
                    text = soup.get_text(separator="\n")
                elif file_type == "txt":
                    text = f.read()
                else:
                    print(f"⚠️ Неизвестный тип файла: {file_type}")
                    text = ""

                session.clear()
                session['chat_context'] = text
                session['chat_topic'] = topic
                print("✅ Контекст загружен:")
                print(text[:500])
        else:
            print(f"❌ Файл не найден: {filepath}")
    else:
        print("⚠️ Нет параметра 'topic' в URL")          
    return render_template("chat_embed_fullstyle.html")

@app.after_request
def allow_iframe(response):
    response.headers["X-Frame-Options"] = "ALLOWALL"
    response.headers["Access-Control-Allow-Origin"] = "https://lernen.language-monster.com"  # ВАЖНО: укажи точный домен портала
    response.headers["Access-Control-Allow-Credentials"] = "true"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST"
    return response

# Функция загрузки текста урока
def load_lesson_html(topic):
    """Загрузка и очистка HTML-урока (.html или .htm)"""
    html_path = os.path.join(LESSON_PATH, f"{topic}.html")
    htm_path = os.path.join(LESSON_PATH, f"{topic}.htm")

    file_path = html_path if os.path.exists(html_path) else htm_path
    if not os.path.exists(file_path):
        return "<p>Тема не найдена.</p>"

    # Автоматическое определение кодировки
    with open(file_path, 'rb') as f:
        raw = f.read()
        encoding = chardet.detect(raw)['encoding']
    
    decoded = raw.decode(encoding, errors='replace')  # заменим ошибочные символы
    soup = BeautifulSoup(decoded, "html.parser")

    # Обработка <img src="...">
    for img in soup.find_all("img"):
        src = img.get("src", "")
        decoded_src = unquote(src)

        if topic in decoded_src:
            # Извлекаем имя папки и файла
            parts = decoded_src.split("/", 1)
            if len(parts) == 2:
                folder = parts[0]
                filename = parts[1]

                # Кодируем обратно в URL-вид (для браузера)
                encoded_folder = quote(folder)
                encoded_filename = quote(filename)

                img['src'] = f"/static/lessons/{encoded_folder}/{encoded_filename}"

    return str(soup.body)    
 
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/lesson")
def lesson():
    topic = request.args.get("topic", "")
    lesson_text_html = load_lesson_html(topic)

    session['chat_topic'] = topic
    session.pop('chat_history', None)

    return lesson_text_html

#@app.route('/set_context', methods=['POST'])
#def set_context():
#    data = request.json
#    raw_html = data.get('context', '')
#    topic = data.get('topic', '')
#
#    soup = BeautifulSoup(raw_html, "html.parser")
#    clean_text = soup.get_text(separator="\n", strip=True)
#
#    #print("🔴 RAW HTML:", raw_html[:200]) # первые 200 символов для анализа
#    #print("🟢 CLEAN TEXT:", clean_text[:200]) # первые 200 символов для анализа
#
#    session['chat_context'] = clean_text
#    session['chat_topic'] = topic
#    session.pop('chat_history', None)
#
#    print("✅ Контекст сохранён:", clean_text[:100])
#
#    return {'status': 'ok'}


@app.route("/ask", methods=["POST"])
def ask():
    try:
        data = request.get_json()
        question = data.get("question")
        stream = data.get("stream", False)  # streming

        # Берём сохранённый текст и тему из сессии        
        topic = session.get('chat_topic', 'Немецкий язык')  # важно использовать chat_topic
        lesson_text = session.get('chat_context', '')       # важно использовать chat_context

        print(f"Получен вопрос: {question}, Тема: {topic}")

        if not lesson_text:
            session['chat_context'] = lesson_text

        print("=== CONTEXT PREVIEW ===")
        print("📌 session['chat_topic'] =", topic)
        print("📌 session['chat_context'] =", lesson_text[:300])        

        # Если истории нет, создаём первую запись с текстом урока
        if 'chat_history' not in session:
            session['chat_history'] = [
                {
                    "role": "system",
                    "content": f"""
                    Ты преподаватель немецкого языка. Ты ведешь диалог с учащимся.
                    Тема урока: '{topic}'.

                    Используй для ответов следующий текст урока:
                    {lesson_text}

                    🧾 Пожалуйста, оформляй ответы аккуратно:
                    - Используй списки (`1.`, `2.`, `-`) там, где это уместно.
                    - Выделяй важные слова с помощью **жирного текста**.
                    - Примеры всегда оборачивай в отдельный HTML-блок:
                    <div class="example">Du arbeitest. – Ты работаешь.</div>
                    - Если в ответе есть примеры, оборачивай каждую пару "немецкий — перевод" в тег <div class="example">.
                    - Немецкую часть оборачивай в <span lang="de">…</span>, а русскую — в <span lang="ru">…</span>
                    - Пример должен содержать как немецкий, так и русский вариант (или перевод).
                    - Не добавляй лишних приветствий и фраз, просто переходи к делу.
                    """
                }
            ]
        # Добавляем вопрос пользователя в историю            
        chat_history = session['chat_history']      
        chat_history.append({"role": "user", "content": question})

        print("💬 История чата:")
        for msg in session.get('chat_history', []):
            print(f"{msg['role']}: {msg['content'][:100]}")

        if stream:
            print("🔁 Включён режим stream")
            def generate():
                try:
                    response = client.chat.completions.create(
                        model="gpt-4",
                        messages=chat_history,
                        stream=True
                    )
                    collected = []
                    for chunk in response:
                        text = chunk.choices[0].delta.content or ""
                        if text:
                            collected.append(text)                            
                            yield text  # для побуквенной анимации

                    # После окончания — ещё раз отправим HTML-форму (можно в <MARKER> завернуть)
                    full_text = ''.join(collected)
                    html_version = markdown(full_text)
                    yield f"<|html|>{html_version}"
                    print("📨 Ответ в Markdown:\n", full_text)
                    print("🧾 Ответ в HTML:\n", html_version)                    
                except Exception as e:
                    print("Ошибка во время stream:", e)
                    yield "[STREAM ERROR]"

            return Response(generate(), content_type='text/plain')  # или 'text/event-stream' — зависит от клиента
        
        print("📦 Ответ без stream")

        response = client.chat.completions.create(
            model="gpt-4",
            messages=chat_history
        ) 

        answer_raw = response.choices[0].message.content
        answer_html = markdown(answer_raw)

        chat_history.append({"role": "assistant", "content": answer_raw})        
        session['chat_history'] = chat_history        

        print(f"Ответ от ChatGPT: {answer_html}")

        return jsonify({"answer": answer_html})

    except Exception as e:
        print(f"Ошибка: {str(e)}")
        return jsonify({"error": "Ошибка сервера"}), 500

@app.route("/test", methods=["GET"])
def generate_test():
    topic = request.args.get("topic", "")
    
    if not topic:
        print("⚠️ Ошибка: параметр 'topic' не передан.")
        return jsonify({"error": "Тема не указана"}), 400

    # Загружаем HTML-версию урока
    lesson_html = load_lesson_html(topic)
    soup = BeautifulSoup(lesson_html, "html.parser")  

    # Извлекаем текстовый контент
    lesson_text = "\n".join([p.get_text() for p in soup.find_all("p")])      
    
    if not lesson_text:
        print(f"⚠️ Ошибка: текст урока для темы '{topic}' не найден.")
        return jsonify({"error": "Тема не найдена"}), 404

    print(f"✅ Генерируем тест по теме: {topic}")

    # Промпт для ChatGPT
    prompt = f"""
    Ты преподаватель немецкого языка. На основе следующего текста урока:
    ---
    {lesson_text}
    ---
    Составь 3 тестовых вопроса с 4 вариантами ответа, один из которых правильный.
    Ответ верни **строго** в формате JSON:
    {{
        "questions": [
            {{
                "question": "Текст вопроса",
                "options": ["Ответ 1", "Ответ 2", "Ответ 3", "Ответ 4"],
                "answer": "Правильный ответ"
            }}
        ]
    }}
    """

    try:
        response = client.chat.completions.create(
            model="gpt-4",
            messages=[{"role": "system", "content": prompt}]
        )

        test_data = response.choices[0].message.content
        print(f"✅ Сгенерированный тест: {test_data}")

        #return test_data
        #return jsonify(eval(test_data))  # Конвертируем строку JSON в объект Python
        return jsonify(json.loads(test_data))  # безопасный способ

    except Exception as e:
        print(f"❌ Ошибка генерации теста: {str(e)}")
        return jsonify({"error": "Ошибка сервера"}), 500
    
# text-to-speech
@app.route("/tts", methods=["POST"])
def tts():
    try:
        data = request.get_json()
        text = data.get("text", "")
        lang = data.get("lang", "de-DE")

        audio_content = synthesize_speech(text, lang)
        return send_file(
            io.BytesIO(audio_content),
            mimetype="audio/mpeg",
            as_attachment=False,
            download_name="output.mp3"
        )
    except Exception as e:
        print("TTS Error:", e)
        return jsonify({"error": "TTS synthesis failed"}), 500

def synthesize_speech(text, lang="de-DE", gender=texttospeech.SsmlVoiceGender.NEUTRAL):
    client = texttospeech.TextToSpeechClient(credentials=credentials)  # 👉 вот сюда передаём!

    synthesis_input = texttospeech.SynthesisInput(text=text)

    voice_name = {
        "de-DE": "de-DE-Wavenet-B",
        "ru-RU": "ru-RU-Wavenet-C",
    }.get(lang, None)

    voice = texttospeech.VoiceSelectionParams(
        language_code=lang,
        name=voice_name,
        ssml_gender=gender
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.MP3
    )

    response = client.synthesize_speech(
        input=synthesis_input,
        voice=voice,
        audio_config=audio_config
    )

    return response.audio_content

if __name__ == "__main__":
    app.run(debug=True)
