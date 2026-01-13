import uuid
import voluptuous as vol
from typing import Any, Dict, Optional, List

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers import device_registry as dr

from .const import (
    DOMAIN,
    CONF_API_HOST,
    SENSOR_TYPES,
    TEST_MODE,
    CONF_USERNAME,
    CONF_PASSWORD
)
from .client import EasySmartClient

class EasySmartConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Fluxo de configuração inicial (Instalação)."""
    VERSION = 1

    def __init__(self):
        """Inicializa variáveis temporárias para o fluxo de instalação."""
        self.data_temp: Dict[str, Any] = {
            CONF_API_HOST: "",
            CONF_USERNAME: "",
            CONF_PASSWORD: "",
            "equipments": []
        }
        self.current_equip: Dict[str, Any] = {}

    async def async_step_user(self, user_input=None) -> FlowResult:
        """Passo 1: Login e Validação da API."""
        errors = {}
        if user_input is not None:
            if TEST_MODE:
                self.data_temp.update(user_input)
                return await self.async_step_management()

            session = async_get_clientsession(self.hass)
            client = EasySmartClient(
                user_input[CONF_API_HOST],
                user_input[CONF_USERNAME],
                user_input[CONF_PASSWORD],
                session,
                self.hass
            )

            if await client.authenticate():
                self.data_temp.update(user_input)
                return await self.async_step_management()

            errors["base"] = "invalid_auth"

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(CONF_API_HOST, default="http://localhost"): str,
                vol.Required(CONF_USERNAME, default="admin"): str,
                vol.Required(CONF_PASSWORD, default="admin123"): str,
            }),
            errors=errors,
        )

    async def async_step_management(self, user_input=None) -> FlowResult:
        """Menu de navegação da instalação inicial."""
        return self.async_show_menu(
            step_id="management",
            menu_options=["add_equipment", "finish"]
        )

    async def async_step_add_equipment(self, user_input=None) -> FlowResult:
        """Adicionar novo equipamento durante a instalação."""
        if user_input is not None:
            self.current_equip = {
                "uuid": str(uuid.uuid4()),
                "nome": user_input["nome"],
                "local": user_input["local"],
                "sensors": []
            }
            return await self.async_step_add_sensor()

        return self.async_show_form(
            step_id="add_equipment",
            data_schema=vol.Schema({
                vol.Required("nome"): str,
                vol.Required("local"): str,
            })
        )

    async def async_step_add_sensor(self, user_input=None) -> FlowResult:
        """Vincular sensores ao equipamento (Loop de instalação)."""
        if user_input is not None:
            self.current_equip["sensors"].append({
                "uuid": str(uuid.uuid4()),
                "ha_entity_id": user_input["ha_entity_id"],
                "tipo": user_input["tipo"],
            })

            if user_input.get("add_another"):
                return await self.async_step_add_sensor()

            self.data_temp["equipments"].append(self.current_equip)
            return await self.async_step_management()

        entities = sorted(self.hass.states.async_entity_ids())
        return self.async_show_form(
            step_id="add_sensor",
            data_schema=vol.Schema({
                vol.Required("ha_entity_id"): vol.In(entities),
                vol.Required("tipo"): vol.In(SENSOR_TYPES),
                vol.Optional("add_another", default=False): bool,
            })
        )

    async def async_step_finish(self, user_input=None) -> FlowResult:
        """Conclui a instalação."""
        if not self.data_temp.get("equipments"):
            return self.async_abort(reason="no_equipments")

        return self.async_create_entry(
            title=f"Easy Smart Monitor ({self.data_temp.get(CONF_USERNAME)})",
            data=self.data_temp
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry) -> config_entries.OptionsFlow:
        return EasySmartOptionsFlowHandler()


class EasySmartOptionsFlowHandler(config_entries.OptionsFlow):
    """Gerencia o botão CONFIGURAR - CRUD Completo v1.0.9."""

    def __init__(self) -> None:
        """Inicializa sem conflito de propriedades."""
        self.selected_equip_uuid: Optional[str] = None

    async def async_step_init(self, user_input=None) -> FlowResult:
        """Menu inicial com detecção de dispositivo."""
        if "device_id" in self.context:
            dev_reg = dr.async_get(self.hass)
            device = dev_reg.async_get(self.context["device_id"])
            if device:
                for identifier in device.identifiers:
                    if identifier[0] == DOMAIN:
                        self.selected_equip_uuid = identifier[1]
                        return await self.async_step_sensor_menu()

        return self.async_show_menu(
            step_id="init",
            menu_options=[
                "manage_sensors",
                "add_more_equipment",
                "remove_equipment",
                "change_interval"
            ]
        )

    # --- GERENCIAMENTO DE SENSORES (CRUD) ---

    async def async_step_manage_sensors(self, user_input=None) -> FlowResult:
        """Selecionar equipamento para gerenciar sensores."""
        equips = self.config_entry.data.get("equipments", [])
        if user_input is not None:
            self.selected_equip_uuid = user_input["equip_uuid"]
            return await self.async_step_sensor_menu()

        options = {e["uuid"]: f"{e['nome']} ({e['local']})" for e in equips}
        return self.async_show_form(
            step_id="manage_sensors",
            data_schema=vol.Schema({vol.Required("equip_uuid"): vol.In(options)})
        )

    async def async_step_sensor_menu(self, user_input=None) -> FlowResult:
        """Menu de ação para sensores."""
        return self.async_show_menu(
            step_id="sensor_menu",
            menu_options=["add_sensor_to_equip", "remove_sensor_from_equip"]
        )

    async def async_step_add_sensor_to_equip(self, user_input=None) -> FlowResult:
        """Adiciona sensor a equipamento existente preservando login."""
        if user_input is not None:
            new_data = dict(self.config_entry.data)
            new_equips = []

            for equip in new_data.get("equipments", []):
                new_equip = dict(equip)
                if new_equip["uuid"] == self.selected_equip_uuid:
                    new_sensors = list(new_equip.get("sensors", []))
                    new_sensors.append({
                        "uuid": str(uuid.uuid4()),
                        "ha_entity_id": user_input["ha_entity_id"],
                        "tipo": user_input["tipo"],
                    })
                    new_equip["sensors"] = new_sensors
                new_equips.append(new_equip)

            new_data["equipments"] = new_equips
            self.hass.config_entries.async_update_entry(self.config_entry, data=new_data)
            return self.async_create_entry(title="", data=self.config_entry.options)

        entities = sorted(self.hass.states.async_entity_ids())
        return self.async_show_form(
            step_id="add_sensor_to_equip",
            data_schema=vol.Schema({
                vol.Required("ha_entity_id"): vol.In(entities),
                vol.Required("tipo"): vol.In(SENSOR_TYPES),
            })
        )

    async def async_step_remove_sensor_from_equip(self, user_input=None) -> FlowResult:
        """Remove sensor preservando login."""
        new_data = dict(self.config_entry.data)
        new_equips = [dict(e) for e in new_data.get("equipments", [])]
        equip = next((e for e in new_equips if e["uuid"] == self.selected_equip_uuid), None)

        if user_input is not None and equip:
            equip["sensors"] = [s for s in equip["sensors"] if s["uuid"] != user_input["sensor_uuid"]]
            new_data["equipments"] = new_equips
            self.hass.config_entries.async_update_entry(self.config_entry, data=new_data)
            return self.async_create_entry(title="", data=self.config_entry.options)

        if not equip or not equip.get("sensors"):
            return self.async_abort(reason="no_sensors_to_remove")

        options = {s["uuid"]: f"{s['tipo'].capitalize()} ({s['ha_entity_id']})" for s in equip["sensors"]}
        return self.async_show_form(
            step_id="remove_sensor_from_equip",
            data_schema=vol.Schema({vol.Required("sensor_uuid"): vol.In(options)})
        )

    # --- GERENCIAMENTO DE EQUIPAMENTOS ---

    async def async_step_add_more_equipment(self, user_input=None) -> FlowResult:
        """Adiciona novo freezer preservando login."""
        if user_input is not None:
            new_data = dict(self.config_entry.data)
            equips = list(new_data.get("equipments", []))
            equips.append({
                "uuid": str(uuid.uuid4()),
                "nome": user_input["nome"],
                "local": user_input["local"],
                "sensors": []
            })
            new_data["equipments"] = equips
            self.hass.config_entries.async_update_entry(self.config_entry, data=new_data)
            return self.async_create_entry(title="", data=self.config_entry.options)

        return self.async_show_form(
            step_id="add_more_equipment",
            data_schema=vol.Schema({
                vol.Required("nome"): str,
                vol.Required("local"): str,
            })
        )

    async def async_step_remove_equipment(self, user_input=None) -> FlowResult:
        """Remove freezer e dispositivo preservando login."""
        if user_input is not None:
            new_data = dict(self.config_entry.data)
            uuid_to_rem = user_input["equip_uuid"]

            dev_reg = dr.async_get(self.hass)
            device = dev_reg.async_get_device(identifiers={(DOMAIN, uuid_to_rem)})
            if device:
                dev_reg.async_remove_device(device.id)

            new_data["equipments"] = [e for e in new_data.get("equipments", []) if e["uuid"] != uuid_to_rem]
            self.hass.config_entries.async_update_entry(self.config_entry, data=new_data)
            return self.async_create_entry(title="", data=self.config_entry.options)

        options = {e["uuid"]: f"{e['nome']} ({e['local']})" for e in self.config_entry.data.get("equipments", [])}
        return self.async_show_form(
            step_id="remove_equipment",
            data_schema=vol.Schema({vol.Required("equip_uuid"): vol.In(options)})
        )

    async def async_step_change_interval(self, user_input=None) -> FlowResult:
        """Ajusta intervalo de envio."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)
        curr = self.config_entry.options.get("update_interval", 60)
        return self.async_show_form(
            step_id="change_interval",
            data_schema=vol.Schema({vol.Optional("update_interval", default=curr): int})
        )