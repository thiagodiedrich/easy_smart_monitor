README.md (v1.0.8)
Easy Smart Monitor 🌡️🔋
Integração profissional para o Home Assistant projetada para monitorar equipamentos de refrigeração e ativos críticos, enviando dados em tempo real para uma API centralizada.

🚀 Funcionalidades
Gestão de Múltiplos Equipamentos: Monitore vários freezers, câmaras frias ou máquinas em uma única instância.

Resiliência de Dados: Fila local persistente em disco (.storage). Se a internet cair, os dados são salvos e enviados automaticamente quando a conexão voltar.

Sincronização em Lote (Batch): Otimiza o tráfego de rede enviando múltiplas leituras em uma única requisição.

Sistema de Alerta de Sirene: Lógica inteligente integrada para disparar alertas baseados em sensores de porta com atraso configurável.

Gestão Completa (CRUD): Adicione, edite ou remova equipamentos e sensores diretamente pela interface visual do Home Assistant.

🛠️ Instalação
Manual
Acesse a pasta de configuração do seu Home Assistant (onde está o configuration.yaml).

Abra a pasta custom_components. Se não existir, crie-a.

Crie uma pasta chamada easy_smart_monitor1.

Cole todos os arquivos da v1.0.8 dentro desta pasta.

Reinicie o Home Assistant.

Vá em Configurações > Dispositivos e Serviços > Adicionar Integração e procure por Easy Smart Monitor.

📊 Estrutura de Dados da API
A integração espera uma API REST que aceite os seguintes endpoints:

1. Autenticação (POST /api/login)
Payload enviado:

JSON

{
  "username": "admin",
  "password": "sua_senha",
  "client_id": "ha_integration_v1"
}
Resposta esperada:

JSON

{
  "token": "seu_jwt_token_aqui"
}
2. Envio de Dados (POST /api/monitor/batch)
Os dados são enviados em uma lista (array) de objetos, usando o token Bearer no cabeçalho.

Payload enviado:

JSON

[
  {
    "equip_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "sensor_uuid": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "tipo": "temperatura",
    "status": "-18.5",
    "timestamp": "2024-05-20T14:30:05.123Z"
  },
  {
    "equip_uuid": "550e8400-e29b-41d4-a716-446655440000",
    "sensor_uuid": "a823-...",
    "tipo": "porta",
    "status": "on",
    "timestamp": "2024-05-20T14:30:10.000Z"
  }
]
⚙️ Configuração de Log (Debug)
Para acompanhar o envio de dados e possíveis erros de conexão, adicione ao seu configuration.yaml:

YAML

logger:
  default: info
  logs:
    custom_components.easy_smart_monitor1: debug
📋 Requisitos de Sistema
Home Assistant 2023.12.0 ou superior.

Acesso à rede para o endereço da API configurado.

Versão: 1.0.8

Desenvolvido por: [THIAGO DIEDRICH / DATACASE TECNOLOGIA]