import logging
from datetime import datetime
from typing import Any, Dict

from homeassistant.components.sensor import (
    SensorEntity,
    SensorStateClass,
    SensorDeviceClass
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_state_change_event
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.helpers.entity import DeviceInfo

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback
) -> None:
    """Configura as entidades de sensor baseadas nos equipamentos cadastrados."""
    coordinator = hass.data[DOMAIN][entry.entry_id]
    equipments = entry.data.get("equipments", [])

    entities = []
    for equip in equipments:
        for sensor_cfg in equip.get("sensors", []):
            # Apenas sensores numéricos (Sirene e Porta vão para binary_sensor.py)
            if sensor_cfg.get("tipo") not in ["sirene", "porta"]:
                entities.append(EasySmartMonitorEntity(coordinator, equip, sensor_cfg))

    if entities:
        async_add_entities(entities, update_before_add=True)

class EasySmartMonitorEntity(CoordinatorEntity, SensorEntity):
    """Representa um sensor de telemetria vinculado a um equipamento."""

    def __init__(self, coordinator, equip, sensor_cfg):
        """Inicializa o sensor com vínculo ao dispositivo pai."""
        super().__init__(coordinator)
        self._equip = equip
        self._config = sensor_cfg
        self._attr_unique_id = f"esm_{sensor_cfg['uuid']}"
        self._attr_name = f"{equip['nome']} {sensor_cfg['tipo'].capitalize()}"
        self._state = None

        # Agrupamento por Dispositivo no Home Assistant
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, equip["uuid"])},
            name=equip["nome"],
            manufacturer="Easy Smart",
            model="Monitor v1",
            suggested_area=equip.get("local"),
        )

        # Mapeamento de Classes e Unidades
        tipo = sensor_cfg.get("tipo")
        if tipo == "temperatura":
            self._attr_device_class = SensorDeviceClass.TEMPERATURE
            self._attr_state_class = SensorStateClass.MEASUREMENT
            self._attr_native_unit_of_measurement = "°C"
        elif tipo == "energia":
            self._attr_device_class = SensorDeviceClass.POWER
            self._attr_state_class = SensorStateClass.MEASUREMENT
            self._attr_native_unit_of_measurement = "W"
        elif tipo == "tensao":
            self._attr_device_class = SensorDeviceClass.VOLTAGE
            self._attr_state_class = SensorStateClass.MEASUREMENT
            self._attr_native_unit_of_measurement = "V"
        elif tipo == "corrente":
            self._attr_device_class = SensorDeviceClass.CURRENT
            self._attr_state_class = SensorStateClass.MEASUREMENT
            self._attr_native_unit_of_measurement = "A"
        elif tipo == "humidade":
            self._attr_device_class = SensorDeviceClass.HUMIDITY
            self._attr_state_class = SensorStateClass.MEASUREMENT
            self._attr_native_unit_of_measurement = "%"

    @property
    def native_value(self):
        """Retorna o valor atual coletado."""
        return self._state

    async def async_added_to_hass(self) -> None:
        """Configura a escuta de mudanças de estado da entidade vinculada."""
        await super().async_added_to_hass()

        @callback
        def _state_listener(event):
            new_state = event.data.get("new_state")
            if new_state is None or new_state.state in ["unknown", "unavailable"]:
                return

            # Atualiza o estado interno da entidade
            self._state = new_state.state

            # Encaminha o dado para a fila de sincronização da API
            self.coordinator.client.add_to_queue({
                "equip_uuid": self._equip["uuid"],
                "sensor_uuid": self._config["uuid"],
                "tipo": self._config["tipo"],
                "status": self._state,
                "timestamp": datetime.now().isoformat()
            })

            # Notifica o HA para atualizar a interface
            self.async_write_ha_state()

        # Monitora a entidade real do HA (Ex: sensor.thermometer_kitchen)
        self.async_on_remove(
            async_track_state_change_event(
                self.hass, self._config["ha_entity_id"], _state_listener
            )
        )