import uuid
import voluptuous as vol
from typing import Any, Dict

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers.aiohttp_client import async_get_clientsession

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
    """Gerencia o fluxo de configuração do Easy Smart Monitor."""

    VERSION = 1

    def __init__(self):
        """Inicializa o fluxo."""
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
        """Passo 2: Menu Principal."""
        return self.async_show_menu(
            step_id="management",
            menu_options=["add_equipment", "finish"]
        )

    async def async_step_add_equipment(self, user_input=None) -> FlowResult:
        """Passo 3: Cadastro de Equipamento."""
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
        """Passo 4: Vínculo de Sensores."""
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
        """Finaliza a configuração."""
        if not self.data_temp.get("equipments"):
            return self.async_abort(reason="no_equipments")

        return self.async_create_entry(
            title=f"Easy Smart Monitor ({self.data_temp.get(CONF_USERNAME)})",
            data=self.data_temp
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry) -> config_entries.OptionsFlow:
        """Retorna o manipulador de opções."""
        return EasySmartOptionsFlowHandler()


class EasySmartOptionsFlowHandler(config_entries.OptionsFlow):
    """Gerencia as opções da integração (Botão Configurar)."""

    async def async_step_init(self, user_input: Dict[str, Any] = None) -> FlowResult:
        """Gerencia o passo inicial das opções."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        # Usamos self.config_entry (herdado) para ler os valores atuais
        current_interval = self.config_entry.options.get("update_interval", 60)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Optional("update_interval", default=current_interval): int,
            })
        )