import logging
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    DOMAIN,
    CONF_API_HOST,
    CONF_USERNAME,
    CONF_PASSWORD,
    TEST_MODE
)
from .client import EasySmartClient
from .coordinator import EasySmartCoordinator

_LOGGER = logging.getLogger(__name__)

# Plataformas suportadas
PLATFORMS: list[Platform] = [Platform.SENSOR, Platform.BINARY_SENSOR]

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Configura a integração a partir de uma entrada de configuração."""

    _LOGGER.debug("Iniciando setup da integração %s (v1.0.9)", DOMAIN)

    # 1. LIMPEZA DE ENTIDADES ÓRFÃS (Crucial para a v1.0.9)
    # Sempre que o config_flow adiciona ou remove um sensor, o reload chama este código.
    entity_reg = er.async_get(hass)
    entities_in_registry = er.async_entries_for_config_entry(entity_reg, entry.entry_id)

    # Criamos uma lista de todos os unique_ids que DEVERIAM existir conforme o JSON atual
    valid_unique_ids = []
    for equip in entry.data.get("equipments", []):
        for sensor in equip.get("sensors", []):
            # Unique IDs conforme definidos no sensor.py e binary_sensor.py
            valid_unique_ids.append(f"esm_{sensor['uuid']}")
            if sensor.get("tipo") == "sirene":
                valid_unique_ids.append(f"esm_siren_{sensor['uuid']}")

    # Removemos do Home Assistant qualquer entidade que não esteja mais no nosso JSON
    for entity in entities_in_registry:
        if entity.unique_id not in valid_unique_ids:
            _LOGGER.info("Removendo entidade órfã: %s", entity.entity_id)
            entity_reg.async_remove(entity.entity_id)

    # 2. INICIALIZAÇÃO DO CLIENTE COM PROTEÇÃO CONTRA KEYERROR
    # Usamos .get() com valores padrão para evitar travamentos se o JSON estiver incompleto
    api_host = entry.data.get(CONF_API_HOST, "http://localhost")
    username = entry.data.get(CONF_USERNAME, "admin")
    password = entry.data.get(CONF_PASSWORD, "")

    session = async_get_clientsession(hass)
    client = EasySmartClient(
        host=api_host,
        username=username,
        password=password,
        session=session,
        hass=hass
    )

    # Carrega a fila local do disco (resiliência de dados)
    await client.load_queue_from_disk()

    # Tenta autenticar (respeitando o modo de teste)
    if not await client.authenticate():
        if not TEST_MODE:
            _LOGGER.warning("Não foi possível autenticar na API Easy Smart. Operando em modo offline.")

    # 3. CONFIGURAÇÃO DO COORDENADOR
    # O intervalo pode ser ajustado nas opções da integração
    update_interval = entry.options.get("update_interval", 60)
    coordinator = EasySmartCoordinator(hass, client, update_interval)

    # Realiza o primeiro refresh de dados
    await coordinator.async_config_entry_first_refresh()

    # Armazena o coordenador para acesso das plataformas (sensor/binary_sensor)
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = coordinator

    # 4. CARREGA AS PLATAFORMAS (sensor.py e binary_sensor.py)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Adiciona listener para atualizações de opções (botão configurar)
    entry.async_on_unload(entry.add_update_listener(update_listener))

    return True

async def update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Atualiza a integração quando as opções mudam."""
    await hass.config_entries.async_reload(entry.entry_id)

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Descarrega a integração e limpa a memória."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
        _LOGGER.debug("Integração %s descarregada.", DOMAIN)
    return unload_ok