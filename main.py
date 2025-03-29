from flask import Flask, request, Response, jsonify, render_template, send_file
import time
from g4f.client import Client
from g4f.Provider import __providers__
import os
import certifi
os.environ['SSL_CERT_FILE'] = certifi.where()

client = Client()
app = Flask(__name__, template_folder="./")

MODELS = list({
    provider.default_model 
    for provider in __providers__ 
    if hasattr(provider, 'default_model') and provider.working
})

chat_sessions = {}

def get_session(session_id):
    if session_id not in chat_sessions:
        chat_sessions[session_id] = {
            'model': 'gpt-4o',
            'web_search': False,
            'messages': []
        }
    return chat_sessions[session_id]

@app.route("/")
def home():
    return render_template("index.html", MODELS=MODELS)

@app.route('/health')
def health_check():
    return jsonify({
        "status": "ready" if len(MODELS) > 0 else "error",
        "models": MODELS
    })

@app.route('/set_config', methods=['POST'])
def set_config():
    data = request.get_json()
    session_id = data.get('session_id', 'default')
    session = get_session(session_id)
    
    if 'model' in data and data['model'] in MODELS:
        session['model'] = data['model']
        
    if 'web_search' in data:
        session['web_search'] = data['web_search']
    
    return jsonify({
        "status": "success",
        "config": {
            "model": session['model'],
            "web_search": session['web_search'],
            "history": session['messages']
        }
    })


@app.route('/chat', methods=['POST'])
def chat_stream():
    data = request.get_json()
    session_id = data.get('session_id', 'default')
    session = get_session(session_id)
    
    session['messages'].append({
        'role': 'user',
        'content': data['query'],
        'timestamp': time.time()
    })
    
    def generate():
        messages_for_api = [
            {"role": msg['role'], "content": msg['content']}
            for msg in session['messages'][-10:]
        ]
        
        stream = client.chat.completions.create(
            model=session['model'],
            messages=messages_for_api,
            stream=True,
            web_search=session['web_search'] 
        )
        
        full_response = ""
        for chunk in stream:
            content = chunk.choices[0].delta.content or ""
            content = content.replace(" ", "&nbsp;").replace("\n", "<br>")
            full_response += content
            yield f"data: {content}\n\n"
            time.sleep(0.05)
        
        session['messages'].append({
            'role': 'assistant',
            'content': full_response.replace("&nbsp;", " ").replace("<br>", "\n"),
            'timestamp': time.time(),
            'web_search': session['web_search']
        })
    
    return Response(generate(), mimetype='text/event-stream')

@app.route('/history', methods=['GET'])
def get_history():
    session_id = request.args.get('session_id', 'default')
    session = get_session(session_id)
    return jsonify({
        "model": session['model'],
        "messages": session['messages']
    })

@app.route('/clear_history', methods=['POST'])
def clear_history():
    session_id = request.get_json().get('session_id', 'default')
    if session_id in chat_sessions:
        chat_sessions[session_id]['messages'] = []
    return jsonify({"status": "success"})

@app.route("/assets/<path:file>")
def upload(file):
    return send_file(file)

if __name__ == '__main__':
    app.run(port=5000)