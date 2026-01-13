Este README.md foi estruturado para servir tanto como um guia de instalação para você quanto como uma documentação técnica para o desenvolvedor do backend que receberá os dados da API.

🚀 Easy Smart Monitor v1.0.0
Easy Smart Monitor é uma integração personalizada para o Home Assistant projetada para monitorar equipamentos de refrigeração (freezers, câmaras frias, geladeiras). Ela coleta dados de sensores locais, gerencia alertas de segurança e sincroniza todas as informações com uma API REST externa de forma resiliente.

✨ Funcionalidades
Monitoramento Multimodal: Suporte para sensores de temperatura, energia (V, A, W, kWh), porta e botões físicos.

Fila Persistente: Os dados são salvos no disco local (.storage) e sobrevivem a reinicializações do sistema caso a API esteja offline.

Lógica de Sirene Inteligente: Disparo automático de sirene se a porta permanecer aberta por mais de 120 segundos.

Modo de Teste: Variável TEST_MODE no const.py para homologação de interface sem dependência de backend.

Configuração via WebUI: Cadastro dinâmico de múltiplos equipamentos e sensores através do Config Flow.

🛠️ Instalação
Copie a pasta easy_smart_monitor1 para o diretório custom_components/ do seu Home Assistant.

Certifique-se de que a estrutura de arquivos esteja correta:

Plaintext

config/custom_components/easy_smart_monitor1/
├── __init__.py
├── manifest.json
├── const.py
├── client.py
├── config_flow.py
├── coordinator.py
├── sensor.py
└── translations/pt-BR.json
Reinicie o Home Assistant.

Vá em Configurações > Dispositivos e Serviços > Adicionar Integração e pesquise por "Easy Smart Monitor".

📡 Documentação da API (Backend)
A integração espera comunicar-se com uma API REST que suporte autenticação JWT.

1. Autenticação
Endpoint: POST /api/login

Payload:

JSON

{
  "username": "admin",
  "password": "password123"
}
Resposta esperada (200 OK):

JSON

{
  "token": "seu_jwt_token_aqui"
}
2. Sincronização de Dados
A integração envia dados em lote (bulk) para otimizar o tráfego.

Endpoint: POST /api/sync

Headers: Authorization: Bearer <token>

Payload (Exemplo de Fila):

JSON

[
  {
    "equip_id": 1,
    "equip_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "sensor_id": 1,
    "sensor_uuid": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "tipo": "temperatura",
    "status": "4.5",
    "timestamp": "2026-01-12T21:40:00Z"
  },
  {
    "equip_id": 1,
    "equip_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "sensor_id": 2,
    "sensor_uuid": "b29c1d3e-...",
    "tipo": "porta",
    "status": "aberto",
    "timestamp": "2026-01-12T21:41:00Z"
  }
]
🧪 Desenvolvimento e Testes
Para testar a interface e os sensores sem uma API ativa:

Abra o arquivo const.py.

Defina TEST_MODE: Final = True.

A integração passará por qualquer login e simulará o envio de dados apenas no log do Home Assistant.

📝 Logs
Para depurar a integração, adicione o seguinte ao seu configuration.yaml:

YAML

logger:
  default: info
  logs:
    custom_components.easy_smart_monitor1: debug
Versão: 1.0.0

Licença: MIT

Desenvolvedor: Gemini AI Assistant