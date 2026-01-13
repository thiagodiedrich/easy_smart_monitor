import logging
import asyncio
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

# Plataformas gerenciadas pela integração
PLATFORMS: list[Platform] = [Platform.SENSOR, Platform.BINARY_SENSOR]

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Configura o Easy Smart Monitor e limpa dispositivos removidos."""

    _LOGGER.debug("Iniciando setup da integração %s", DOMAIN)

    # 1. LIMPEZA DE ENTIDADES ÓRFÃS
    # Este bloco garante que, se um equipamento foi removido via menu 'Configurar',
    # suas entidades sejam deletadas do registro interno do Home Assistant.
    ent_reg = er.async_get(hass)
    entities_in_registry = er.async_entries_for_config_entry(ent_reg, entry.entry_id)

    # Mapeia todos os UUIDs de sensores que deveriam existir atualmente
    valid_unique_ids = []
    for equip in entry.data.get("equipments", []):
        for sensor in equip.get("sensors", []):
            # Formato do unique_id definido no sensor.py
            valid_unique_ids.append(f"esm_{sensor['uuid']}")
            if sensor["tipo"] == "sirene":
                valid_unique_ids.append(f"esm_siren_{sensor['uuid']}")

    # Remove do registro o que não está mais na configuração
    for entity in entities_in_registry:
        if entity.unique_id not in valid_unique_ids:
            _LOGGER.info("Removendo entidade órfã do registro: %s", entity.entity_id)
            ent_reg.async_remove(entity.entity_id)

    # 2. INICIALIZAÇÃO DO CLIENTE E COORDENADOR
    session = async_get_clientsession(hass)

    client = EasySmartClient(
        host=entry.data[CONF_API_HOST],
        username=entry.data[CONF_USERNAME],
        password=entry.data[CONF_PASSWORD],
        session=session,
        hass=hass
    )

    # Carrega dados salvos em disco (.storage)
    await client.load_queue_from_disk()

    # Autenticação inicial (respeita o TEST_MODE)
    if not await client.authenticate():
        if not TEST_MODE:
            _LOGGER.warning("Falha na autenticação inicial da API. Tentando em segundo plano.")

    # Configuração do Coordenador de Dados
    update_interval = entry.options.get("update_interval", 60)
    coordinator = EasySmartCoordinator(hass, client, update_interval)

    # Primeiro refresh para popular as entidades
    await coordinator.async_config_entry_first_refresh()

    # Armazena o coordenador globalmente
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = coordinator

    # 3. CARREGAMENTO DAS PLATAFORMAS (sensor.py e binary_sensor.py)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Registra listener para mudanças nas opções (configurar)
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
        _LOGGER.debug("Integração %s descarregada com sucesso.", DOMAIN)

    return unload_ok