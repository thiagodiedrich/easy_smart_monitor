"""Constantes para a integração Easy Smart Monitor."""

# Domínio da integração (Nome da pasta em custom_components)
DOMAIN = "easy_smart_monitor1"

# Modo de Operação
# True: Não exige API real, aceita qualquer login e simula envios no log.
# False: Modo de produção. Exige API funcional para autenticação e envio.
TEST_MODE = True

# Chaves de Configuração (ConfigEntry)
CONF_API_HOST = "api_host"
CONF_USERNAME = "username"
CONF_PASSWORD = "password"

# Configurações de Lógica e Performance
# Tempo (em segundos) que a porta deve ficar aberta para a sirene ativar
SIREN_DELAY = 60

# Intervalo padrão de sincronização com a API (em segundos)
DEFAULT_UPDATE_INTERVAL = 60

# Lista exata de tipos de sensores suportados
# Estas strings são usadas como chaves de tradução no pt-BR.json
SENSOR_TYPES = [
    "temperatura",
    "porta",
    "energia",
    "tensao",
    "corrente",
    "humidade",
    "sirene"
]

# Nome do arquivo de persistência local dentro da pasta /config/.storage/
STORAGE_FILE = "easy_smart_monitor1_queue.json"

# Versão da integração para logs e headers de API
VERSION = "1.0.8"