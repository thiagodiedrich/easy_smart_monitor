"""Constantes para a integração Easy Smart Monitor."""

# Domínio da integração (Deve ser o nome exato da pasta em custom_components)
DOMAIN = "easy_smart_monitor1"

# Versão da Release
VERSION = "1.0.9"

# Modo de Operação
# True: Ignora validação real de API e simula envios no log (Desenvolvimento)
# False: Modo de produção com autenticação e sincronização real
TEST_MODE = True

# Chaves de Configuração de Dados (armazenadas no config_entry.data)
CONF_API_HOST = "api_host"
CONF_USERNAME = "username"
CONF_PASSWORD = "password"

# Configurações de Lógica de Sensores e Alertas
# Tempo (segundos) de porta aberta necessário para disparar a Sirene de segurança
SIREN_DELAY = 60

# Intervalo padrão de sincronização da fila com a API (segundos)
DEFAULT_UPDATE_INTERVAL = 60

# Lista exata de tipos de sensores suportados pela integração
# IMPORTANTE: Estes nomes devem ter chaves correspondentes no pt-BR.json
SENSOR_TYPES = [
    "temperatura",
    "energia",
    "tensao",
    "corrente",
    "humidade",
    "status",     # Suporte a textos (ex: power_on, standby, online)
    "porta",      # Binário (on/off)
    "sirene"      # Binário de segurança (triggered/off)
]

# Nome do arquivo de persistência local dentro da pasta /config/.storage/
# Garante que dados não enviados durante quedas de internet sejam salvos
STORAGE_FILE = "easy_smart_monitor1_queue.json"

# Cabeçalhos comuns para chamadas de API
HEADERS = {
    "Content-Type": "application/json",
    "User-Agent": f"EasySmartMonitor/{VERSION} (HomeAssistant)"
}