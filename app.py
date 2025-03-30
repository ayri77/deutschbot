from flask import Flask, render_template, request, jsonify, session, url_for
import openai
import os
from dotenv import load_dotenv
from pathlib import Path
from bs4 import BeautifulSoup
import json
import chardet

from flask_session import Session
from urllib.parse import unquote, quote

# Загружаем API-ключ из .env
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)
openai_key = os.getenv("OPENAI_API_KEY").strip()

#openai.api_key = openai_key
client = openai.OpenAI(api_key=openai_key)

app = Flask(__name__, static_folder="static")
app.secret_key = "mysecretkey"
# Включаем серверное хранилище сессии:
app.config['SESSION_TYPE'] = 'filesystem'  # или 'redis', если у тебя есть Redis
app.config['SESSION_PERMANENT'] = False
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
 
# Функция общения с ChatGPT
#def ask_chatgpt(question, topic):
#    messages = [
#        {"role": "system", "content": f"Ты преподаватель немецкого языка. Помогаешь ученикам изучать '{topic}'."},
#        {"role": "user", "content": question}
#    ]
#    response = client.chat.completions.create(
#        model="gpt-4",
#        messages=messages
#    )    
#    return response.choices[0].message.content

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
                {"role": "system", "content": f"Ты преподаватель немецкого языка. Ты ведешь диалог с учащимся. Тема урока '{topic}'. Используй для ответов следующий текст урока:\n{lesson_text}"}
            ]

        chat_history = session['chat_history']      
        chat_history.append({"role": "user", "content": question})

        print("💬 История чата:")
        for msg in session.get('chat_history', []):
            print(f"{msg['role']}: {msg['content'][:100]}")


        response = client.chat.completions.create(
            model="gpt-4",
            messages=chat_history
        )  

        answer = response.choices[0].message.content

        chat_history.append({"role": "assistant", "content": answer})        
        session['chat_history'] = chat_history        

        print(f"Ответ от ChatGPT: {answer}")

        return jsonify({"answer": answer})

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
    
if __name__ == "__main__":
    app.run(debug=True)
