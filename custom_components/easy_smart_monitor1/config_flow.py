import uuid
import voluptuous as vol
from typing import Any, Dict

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
    """Gerencia o fluxo inicial de instalação."""
    VERSION = 1

    def __init__(self):
        self.data_temp: Dict[str, Any] = {"equipments": []}
        self.current_equipment: Dict[str, Any] = {}

    async def async_step_user(self, user_input=None) -> FlowResult:
        """Passo 1: Login."""
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
        """Menu Inicial."""
        return self.async_show_menu(
            step_id="management",
            menu_options=["add_equipment", "finish"]
        )

    async def async_step_add_equipment(self, user_input=None) -> FlowResult:
        """Cadastro de Equipamento."""
        if user_input is not None:
            self.current_equipment = {
                "id": len(self.data_temp["equipments"]) + 1,
                "uuid": str(uuid.uuid4()),
                "nome": user_input["nome"],
                "local": user_input["local"],
                "intervalo_fila": user_input.get("intervalo_fila", 30),
                "sensors": []
            }
            return await self.async_step_add_sensor()

        return self.async_show_form(
            step_id="add_equipment",
            data_schema=vol.Schema({
                vol.Required("nome"): str,
                vol.Required("local"): str,
                vol.Optional("intervalo_fila", default=30): int,
            })
        )

    async def async_step_add_sensor(self, user_input=None) -> FlowResult:
        """Vínculo de Sensores."""
        if user_input is not None:
            sensor_data = {
                "id": len(self.current_equipment["sensors"]) + 1,
                "uuid": str(uuid.uuid4()),
                "ha_entity_id": user_input["ha_entity_id"],
                "tipo": user_input["tipo"],
            }
            self.current_equipment["sensors"].append(sensor_data)

            if user_input.get("add_another"):
                return await self.async_step_add_sensor()

            self.data_temp["equipments"].append(self.current_equipment)
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
        """Finaliza instalação."""
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
    """Gerencia Edição e Remoção Real de Dispositivos."""

    def __init__(self):
        self.current_equipment: Dict[str, Any] = {}

    async def async_step_init(self, user_input=None) -> FlowResult:
        """Menu de Opções."""
        return self.async_show_menu(
            step_id="init",
            menu_options=["add_more_equipment", "remove_equipment", "change_interval"]
        )

    async def async_step_remove_equipment(self, user_input=None) -> FlowResult:
        """Remove o equipamento, as entidades e o DISPOSITIVO do registro."""
        equipments = self.config_entry.data.get("equipments", [])

        if user_input is not None:
            equip_uuid = user_input["equip_uuid"]

            # 1. Localiza e remove o dispositivo do Device Registry do HA
            dev_reg = dr.async_get(self.hass)
            device = dev_reg.async_get_device(identifiers={(DOMAIN, equip_uuid)})
            if device:
                dev_reg.async_remove_device(device.id)

            # 2. Atualiza a lista de equipamentos na configuração
            new_equip_list = [e for e in equipments if e["uuid"] != equip_uuid]
            new_data = {**self.config_entry.data, "equipments": new_equip_list}

            self.hass.config_entries.async_update_entry(self.config_entry, data=new_data)

            # 3. Força o reload para limpar o Entity Registry via __init__.py
            await self.hass.config_entries.async_reload(self.config_entry.entry_id)

            return self.async_create_entry(title="", data=self.config_entry.options)

        equip_options = {e["uuid"]: f"{e['nome']} ({e['local']})" for e in equipments}
        return self.async_show_form(
            step_id="remove_equipment",
            data_schema=vol.Schema({
                vol.Required("equip_uuid"): vol.In(equip_options)
            })
        )

    async def async_step_add_more_equipment(self, user_input=None) -> FlowResult:
        """Passo 1 Expansão."""
        if user_input is not None:
            current_equipments = self.config_entry.data.get("equipments", [])
            self.current_equipment = {
                "id": len(current_equipments) + 1,
                "uuid": str(uuid.uuid4()),
                "nome": user_input["nome"],
                "local": user_input["local"],
                "intervalo_fila": 30,
                "sensors": []
            }
            return await self.async_step_add_more_sensor()

        return self.async_show_form(
            step_id="add_more_equipment",
            data_schema=vol.Schema({
                vol.Required("nome"): str,
                vol.Required("local"): str,
            })
        )

    async def async_step_add_more_sensor(self, user_input=None) -> FlowResult:
        """Passo 2 Expansão."""
        if user_input is not None:
            sensor_data = {
                "id": len(self.current_equipment["sensors"]) + 1,
                "uuid": str(uuid.uuid4()),
                "ha_entity_id": user_input["ha_entity_id"],
                "tipo": user_input["tipo"],
            }
            self.current_equipment["sensors"].append(sensor_data)

            if user_input.get("add_another"):
                return await self.async_step_add_more_sensor()

            current_data = dict(self.config_entry.data)
            updated_equipments = list(current_data.get("equipments", []))
            updated_equipments.append(self.current_equipment)

            self.hass.config_entries.async_update_entry(self.config_entry, data={**current_data, "equipments": updated_equipments})
            await self.hass.config_entries.async_reload(self.config_entry.entry_id)
            return self.async_create_entry(title="", data=self.config_entry.options)

        entities = sorted(self.hass.states.async_entity_ids())
        return self.async_show_form(
            step_id="add_more_sensor",
            data_schema=vol.Schema({
                vol.Required("ha_entity_id"): vol.In(entities),
                vol.Required("tipo"): vol.In(SENSOR_TYPES),
                vol.Optional("add_another", default=False): bool,
            })
        )

    async def async_step_change_interval(self, user_input=None) -> FlowResult:
        """Ajusta o intervalo global."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        current_interval = self.config_entry.options.get("update_interval", 60)
        return self.async_show_form(
            step_id="change_interval",
            data_schema=vol.Schema({
                vol.Optional("update_interval", default=current_interval): int,
            })
        )