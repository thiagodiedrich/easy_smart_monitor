import logging
from datetime import datetime
from typing import Any, Optional

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

async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    """Configura as entidades de sensor numérico e de status."""
    coordinator = hass.data[DOMAIN][entry.entry_id]
    equipments = entry.data.get("equipments", [])

    entities = []
    for equip in equipments:
        for sensor_cfg in equip.get("sensors", []):
            # Filtra sensores que não são binários (porta/sirene ficam no binary_sensor.py)
            if sensor_cfg.get("tipo") not in ["sirene", "porta"]:
                entities.append(EasySmartMonitorEntity(coordinator, equip, sensor_cfg))

    if entities:
        async_add_entities(entities, update_before_add=True)

class EasySmartMonitorEntity(CoordinatorEntity, SensorEntity):
    """Entidade de monitoramento com suporte a dados numéricos e strings de status."""

    def __init__(self, coordinator, equip, sensor_cfg):
        """Inicializa o sensor com proteção de tipos."""
        super().__init__(coordinator)
        self._equip = equip
        self._config = sensor_cfg
        self._attr_unique_id = f"esm_{sensor_cfg['uuid']}"
        self._attr_name = f"{equip['nome']} {sensor_cfg['tipo'].capitalize()}"
        self._state = None
        self._tipo = sensor_cfg.get("tipo")
        self._ha_source_entity = sensor_cfg.get("ha_entity_id")

        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, equip["uuid"])},
            name=equip["nome"],
            manufacturer="Easy Smart",
            model="Monitor v1",
            suggested_area=equip.get("local"),
        )

        # Configura as características com base no tipo definido no config_flow
        self._setup_sensor_type()

    def _setup_sensor_type(self):
        """Define ícones, unidades e classes de dispositivo."""
        if self._tipo == "temperatura":
            self._attr_device_class = SensorDeviceClass.TEMPERATURE
            self._attr_native_unit_of_measurement = "°C"
            self._attr_state_class = SensorStateClass.MEASUREMENT
        elif self._tipo == "energia":
            self._attr_device_class = SensorDeviceClass.POWER
            self._attr_native_unit_of_measurement = "W"
            self._attr_state_class = SensorStateClass.MEASUREMENT
        elif self._tipo == "tensao":
            self._attr_device_class = SensorDeviceClass.VOLTAGE
            self._attr_native_unit_of_measurement = "V"
            self._attr_state_class = SensorStateClass.MEASUREMENT
        elif self._tipo == "corrente":
            self._attr_device_class = SensorDeviceClass.CURRENT
            self._attr_native_unit_of_measurement = "A"
            self._attr_state_class = SensorStateClass.MEASUREMENT
        elif self._tipo == "humidade":
            self._attr_device_class = SensorDeviceClass.HUMIDITY
            self._attr_native_unit_of_measurement = "%"
            self._attr_state_class = SensorStateClass.MEASUREMENT
        elif self._tipo == "status":
            # Tipo Status não tem unidade nem classe numérica, aceita strings puras
            self._attr_device_class = None
            self._attr_native_unit_of_measurement = None
            self._attr_state_class = None
            self._attr_icon = "mdi:information-variant"
        else:
            self._attr_state_class = None

    @property
    def native_value(self):
        """Retorna o estado atual processado."""
        return self._state

    async def async_added_to_hass(self) -> None:
        """Monitora a entidade original e trata exceções de valor."""
        await super().async_added_to_hass()

        @callback
        def _state_listener(event):
            new_state = event.data.get("new_state")
            if new_state is None or new_state.state in ["unknown", "unavailable"]:
                return

            raw_value = new_state.state

            # Lógica de validação para evitar ValueError
            if self._attr_native_unit_of_measurement is not None:
                try:
                    # Se o sensor espera unidade (W, °C), tentamos converter para float
                    self._state = float(raw_value)
                except (ValueError, TypeError):
                    # Se falhar (recebeu string num campo numérico), logamos o erro
                    # Mas mantemos a string para não travar a integração
                    _LOGGER.error(
                        "Conflito de tipo em %s: Esperado número para %s, recebeu '%s'. "
                        "Dica: Altere o tipo para 'status' nas configurações.",
                        self.entity_id, self._tipo, raw_value
                    )
                    self._state = raw_value
            else:
                # Se for tipo 'status', aceitamos qualquer valor sem conversão
                self._state = raw_value

            # Envia o dado (bruto) para a fila da API
            self.coordinator.client.add_to_queue({
                "equip_uuid": self._equip["uuid"],
                "sensor_uuid": self._config["uuid"],
                "tipo": self._tipo,
                "status": str(raw_value),
                "timestamp": datetime.now().isoformat()
            })

            self.async_write_ha_state()

        # Vincula a escuta à entidade real do Home Assistant
        self.async_on_remove(
            async_track_state_change_event(
                self.hass, self._ha_source_entity, _state_listener
            )
        )