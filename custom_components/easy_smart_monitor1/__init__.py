import logging
import asyncio
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.const import Platform

from .const import (
    DOMAIN,
    PLATFORMS,
    CONF_API_HOST,
    CONF_USERNAME,
    CONF_PASSWORD,
    CONF_EQUIPMENTS,
    TEST_MODE
)
from .client import EasySmartClient
from .coordinator import EasySmartCoordinator

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """
    Configura a integração Easy Smart Monitor v1.0.11.
    Versão robusta com proteção contra valores nulos (NoneType).
    """
    _LOGGER.info("Iniciando Easy Smart Monitor v1.0.12")

    # 1. Recuperação Segura de Credenciais (Resolve o erro do rstrip)
    # Tenta buscar pelas constantes ou pelas strings diretas caso o entry seja antigo
    api_host = entry.data.get(CONF_API_HOST) or entry.data.get("api_host")
    username = entry.data.get(CONF_USERNAME) or entry.data.get("username")
    password = entry.data.get(CONF_PASSWORD) or entry.data.get("password")

    # Validação preventiva para evitar quebra no client.py
    if api_host is None:
        _LOGGER.error("Falha ao iniciar: Host da API não encontrado nos dados da configuração")
        return False

    # 2. Inicialização do Cliente e Sessão
    session = async_get_clientsession(hass)

    try:
        client = EasySmartClient(
            host=str(api_host), # Força conversão para string
            username=str(username or ""),
            password=str(password or ""),
            session=session,
            hass=hass
        )

        # 3. Carga da Fila de Persistência
        # Carregamos do disco antes de qualquer refresh para garantir a telemetria offline
        await client.load_queue_from_disk()

    except Exception as err:
        _LOGGER.error("Erro ao inicializar o cliente Easy Smart: %s", err)
        raise ConfigEntryNotReady from err

    # 4. Configuração do Coordenador
    # Busca o intervalo das opções ou usa o padrão de 60 segundos
    update_interval = entry.options.get("update_interval", 60)
    coordinator = EasySmartCoordinator(hass, client, update_interval)

    # Refresh inicial (não trava o boot se falhar)
    try:
        await coordinator.async_config_entry_first_refresh()
    except Exception as err:
        _LOGGER.warning("API offline no boot. As entidades serão criadas, mas sem dados iniciais: %s", err)

    # 5. Armazenamento Centralizado
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = coordinator

    # 6. Limpeza de Entidades Obsoletas
    # Garante que entidades removidas no Config Flow sumam do Dashboard
    await async_cleanup_orphan_entities(hass, entry)

    # 7. Ativação das Plataformas (Switch, Number, Sensor, Binary Sensor)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    # Listener para recarregar se as opções mudarem
    entry.async_on_unload(entry.add_update_listener(async_reload_entry))

    return True

async def async_cleanup_orphan_entities(hass: HomeAssistant, entry: ConfigEntry):
    """Varre o registro e remove entidades que não existem mais no arquivo de equipamentos."""
    entity_reg = er.async_get(hass)
    entries_in_registry = er.async_entries_for_config_entry(entity_reg, entry.entry_id)

    valid_unique_ids = []
    # Busca equipamentos da chave nova ou antiga
    equipments = entry.data.get(CONF_EQUIPMENTS) or entry.data.get("equipments", [])

    for equip in equipments:
        uuid = equip["uuid"]

        # Unique IDs dos Controles v1.0.11
        valid_unique_ids.append(f"esm_sw_ativo_{uuid}")
        valid_unique_ids.append(f"esm_sw_sirene_ativa_{uuid}")
        valid_unique_ids.append(f"esm_num_intervalo_coleta_{uuid}")
        valid_unique_ids.append(f"esm_num_tempo_porta_{uuid}")

        # Unique IDs de Diagnóstico
        valid_unique_ids.append(f"esm_diag_conexao_{uuid}")
        valid_unique_ids.append(f"esm_diag_sincro_{uuid}")

        # Unique IDs de Telemetria e Sensores
        for sensor in equip.get("sensors", []):
            s_uuid = sensor["uuid"]
            valid_unique_ids.append(f"esm_{s_uuid}")
            if sensor.get("tipo") == "porta":
                valid_unique_ids.append(f"esm_porta_{s_uuid}")
                valid_unique_ids.append(f"esm_sirene_{uuid}")

    # Remove o que não está na lista de IDs válidos
    for entity in entries_in_registry:
        if entity.unique_id not in valid_unique_ids:
            _LOGGER.info("Removendo entidade órfã: %s", entity.entity_id)
            entity_reg.async_remove(entity.entity_id)

async def async_reload_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Recarrega a integração quando as opções são alteradas."""
    await hass.config_entries.async_reload(entry.entry_id)

async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Descarrega a integração e limpa a memória."""
    _LOGGER.info("Descarregando integração Easy Smart Monitor")

    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)

    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)

    return unload_ok