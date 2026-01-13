import logging
import asyncio
from datetime import datetime
from typing import Optional

from homeassistant.components.binary_sensor import (
    BinarySensorEntity,
    BinarySensorDeviceClass
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.helpers.entity import DeviceInfo

from .const import DOMAIN, SIREN_DELAY

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback
) -> None:
    """Configura as entidades binárias da integração."""
    coordinator = hass.data[DOMAIN][entry.entry_id]
    equipments = entry.data.get("equipments", [])

    entities = []
    for equip in equipments:
        for sensor_cfg in equip.get("sensors", []):
            if sensor_cfg.get("tipo") == "sirene":
                entities.append(EasySmartSirenEntity(coordinator, equip, sensor_cfg))

    if entities:
        async_add_entities(entities)

class EasySmartSirenEntity(CoordinatorEntity, BinarySensorEntity):
    """Representa a Sirene de Alerta de porta aberta."""

    def __init__(self, coordinator, equip, sensor_cfg):
        """Inicializa a sirene."""
        super().__init__(coordinator)
        self._equip = equip
        self._config = sensor_cfg
        self._attr_unique_id = f"esm_siren_{sensor_cfg['uuid']}"
        self._attr_name = f"Alerta Sirene {equip['nome']}"
        self._attr_device_class = BinarySensorDeviceClass.SAFETY
        self._is_on = False
        self._timer_task: Optional[asyncio.Task] = None

        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, equip["uuid"])},
            name=equip["nome"],
            manufacturer="Easy Smart",
            model="Monitor v1",
            suggested_area=equip.get("local"),
        )

    @property
    def is_on(self) -> bool:
        """Retorna o estado atual do alerta."""
        return self._is_on

    async def async_added_to_hass(self) -> None:
        """Configura o listener para monitorar a porta do equipamento."""
        await super().async_added_to_hass()

        @callback
        def _door_listener(event):
            new_state = event.data.get("new_state")
            if not new_state:
                return

            # Estados positivos para porta aberta
            if new_state.state in ["on", "open", "aberto", "true"]:
                if not self._timer_task or self._timer_task.done():
                    _LOGGER.debug("Iniciando timer de sirene para %s", self._equip["nome"])
                    self._timer_task = self.hass.async_create_task(self._run_siren_timer())
            else:
                self._reset_siren()

        # Localiza o sensor de porta associado a este mesmo equipamento
        porta_id = next(
            (s["ha_entity_id"] for s in self._equip["sensors"] if s["tipo"] == "porta"),
            None
        )

        if porta_id:
            self.async_on_remove(
                async_track_state_change_event(self.hass, porta_id, _door_listener)
            )
        else:
            _LOGGER.warning("Equipamento %s sem sensor de porta para a sirene.", self._equip["nome"])

    async def _run_siren_timer(self):
        """Aguardar delay antes de ativar."""
        try:
            await asyncio.sleep(SIREN_DELAY)
            self._is_on = True
            self.async_write_ha_state()

            # Envia o alerta para a fila da API
            self.coordinator.client.add_to_queue({
                "equip_uuid": self._equip["uuid"],
                "sensor_uuid": self._config["uuid"],
                "tipo": "alerta_sirene",
                "status": "triggered",
                "timestamp": datetime.now().isoformat()
            })
        except asyncio.CancelledError:
            _LOGGER.debug("Timer da sirene em %s cancelado.", self._equip["nome"])

    def _reset_siren(self):
        """Desativa a sirene e limpa o timer."""
        if self._timer_task:
            self._timer_task.cancel()
            self._timer_task = None

        if self._is_on:
            self._is_on = False
            self.async_write_ha_state()