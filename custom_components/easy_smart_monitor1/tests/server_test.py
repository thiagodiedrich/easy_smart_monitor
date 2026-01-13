# salve como server_test.py e rode com: python server_test.py
from flask import Flask, request, jsonify

app = Flask(__name__)

@app.route('/api/login', methods=['POST'])
def login():
    return jsonify({"token": "token_de_teste_valido_123"})

@app.route('/api/monitor/batch', methods=['POST'])
def monitor():
    dados = request.json
    print(f"--- Recebido lote com {len(dados)} leituras ---")
    for item in dados:
        print(f"Equipamento: {item.get('equip_uuid')} | Valor: {item.get('status')}")
    return jsonify({"status": "success"}), 201

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)