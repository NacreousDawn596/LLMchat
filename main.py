from flask import Flask, request, Response, jsonify, render_template, send_file, send_from_directory
from werkzeug.utils import secure_filename
import time
from g4f.client import Client
from g4f.Provider import __providers__
import os
import certifi
import requests
import sys
import json

os.environ['SSL_CERT_FILE'] = certifi.where()

client = Client()
app = Flask(__name__, template_folder="./")

UPLOAD_FOLDER = 'temp_uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

MODELS = list({
    provider.default_model 
    for provider in __providers__ 
    if hasattr(provider, 'default_model') and provider.working
})

chat_sessions = {}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_session(session_id):
    if session_id not in chat_sessions:
        chat_sessions[session_id] = {
            'model': 'gpt-4o',
            'web_search': False,
            'messages': []
        }
    return chat_sessions[session_id]


def download_image(url, session_id):
    try:
        response = requests.get(url)
        if response.status_code == 200:
            filename = f"generated_{session_id}_{int(time.time())}.jpg"
            save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            with open(save_path, 'wb') as f:
                f.write(response.content)
            return filename
        return None
    except Exception as e:
        print(f"Error downloading image: {e}")
        return None

@app.route('/generate_image', methods=['POST'])
def handle_generate_image():
    data = request.get_json()
    session_id = data.get('session_id', 'default')
    prompt = data.get('prompt', '')
    
    session = get_session(session_id)
    
    session['messages'].append({
        'role': 'user',
        'content': f"/imagine {prompt}",
        'timestamp': time.time()
    })
    
    try:
        response = client.images.generate(
            model="flux",
            prompt=prompt,
            response_format="url"
        )
        image_url = response.data[0].url
        
        filename = download_image(image_url, session_id)
        if not filename:
            raise Exception("Failed to save image")
        
        session['messages'].append({
            'role': 'assistant',
            'content': f"Generated image for: {prompt}",
            'images': [filename],
            'timestamp': time.time()
        })
        
        return jsonify({"image_url": f"/assets/temp_uploads/{filename}"})
    
    except Exception as e:
        print(f"Image generation error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/")
def home():
    return render_template("index.html", MODELS=MODELS, PORT=sys.argv[1])

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
    
@app.before_request
def validate_image_paths():
    if request.path.startswith('/assets/temp_uploads/'):
        filename = request.path.split('/')[-1]
        if not allowed_file(filename):
            return "Invalid file type", 403
        if not os.path.exists(os.path.join(app.config['UPLOAD_FOLDER'], filename)):
            return "File not found", 404

@app.route('/chat', methods=['POST'])
def chat_stream():
    try:
        session_id = request.form.get('session_id', 'default')
        query = request.form.get('query', '')
        files = request.files.getlist('images')

        image_paths = []
        for file in files:
            if file and allowed_file(file.filename):
                filename = f"{int(time.time())}_{secure_filename(file.filename)}"
                save_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(save_path)
                image_paths.append(filename)  

        session = get_session(session_id)
        session['messages'].append({
            'role': 'user',
            'content': query,
            'images': image_paths,
            'timestamp': time.time()
        })

        def generate():
            full_response = ""
            try:
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

                for chunk in stream:
                    content = chunk.choices[0].delta.content or ""
                    full_response += content
                    yield f"data: {json.dumps({'content': content})}\n\n"

                session['messages'].append({
                    'role': 'assistant',
                    'content': full_response,
                    'timestamp': time.time(),
                    'web_search': session['web_search']
                })

            except Exception as e:
                print(f"Server error: {str(e)}")
                yield f"data: {json.dumps({'error': str(e)})}\n\n"

        return Response(generate(), mimetype='text/event-stream')
    
    except Exception as e:
        print(f"Critical error: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/history', methods=['GET'])
def get_history():
    session_id = request.args.get('session_id', 'default')
    session = get_session(session_id)
    
    valid_messages = []
    for msg in session['messages']:
        valid_images = []
        if 'images' in msg:
            valid_images = [
                img for img in msg['images']
                if os.path.exists(os.path.join(app.config['UPLOAD_FOLDER'], img))
            ]
        valid_msg = msg.copy()
        valid_msg['images'] = valid_images
        valid_messages.append(valid_msg)
    
    return jsonify({
        "model": session['model'],
        "messages": valid_messages
    })
    
@app.route('/assets/temp_uploads/<filename>')
def serve_uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

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
    # print(int(sys.argv[1]))
    app.run(port=int(sys.argv[1]))