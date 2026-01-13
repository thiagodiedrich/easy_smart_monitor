import voluptuous as vol
import uuid
import logging
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
import homeassistant.helpers.config_validation as cv
from homeassistant.helpers import selector

from .const import (
    DOMAIN,
    CONF_API_HOST,
    CONF_USERNAME,
    CONF_PASSWORD,
    CONF_EQUIPMENTS,
    DEFAULT_INTERVALO_COLETA,
    DEFAULT_TEMPO_PORTA_ABERTA,
    DEFAULT_EQUIPAMENTO_ATIVO,
    DEFAULT_SIRENE_ATIVA,
    TEST_MODE
)
from .client import EasySmartClient

_LOGGER = logging.getLogger(__name__)

class EasySmartConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Gerencia o fluxo de configuração inicial."""

    VERSION = 1

    def __init__(self):
        """Inicializa as estruturas de dados temporárias do fluxo."""
        self.data = {}
        self.equipments = []

    async def async_step_user(self, user_input=None):
        """Passo 1: Credenciais da API (Com preenchimento automático para TEST_MODE)."""
        errors = {}

        # Valores padrão para facilitar o teste
        default_host = "http://localhost:5000" if TEST_MODE else ""
        default_user = "admin_teste" if TEST_MODE else ""
        default_pass = "senha_teste" if TEST_MODE else ""

        if user_input is not None:
            if TEST_MODE:
                _LOGGER.info("MODO TESTE ATIVO: Pulando validação real de API.")
                self.data = user_input
                return await self.async_step_add_equipment()

            # Validação Real (Só ocorre se TEST_MODE for False)
            session = async_get_clientsession(self.hass)
            client = EasySmartClient(
                user_input[CONF_API_HOST],
                user_input[CONF_USERNAME],
                user_input[CONF_PASSWORD],
                session,
                self.hass
            )

            try:
                if await client.authenticate():
                    self.data = user_input
                    return await self.async_step_add_equipment()
                errors["base"] = "invalid_auth"
            except Exception as e:
                _LOGGER.error("Erro de conexão no config_flow: %s", e)
                errors["base"] = "cannot_connect"

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(CONF_API_HOST, default=default_host): str,
                vol.Required(CONF_USERNAME, default=default_user): str,
                vol.Required(CONF_PASSWORD, default=default_pass): str,
            }),
            errors=errors,
        )

    async def async_step_add_equipment(self, user_input=None):
        """Passo 2: Cadastro de Freezer/Geladeira."""
        if user_input is not None:
            new_equip = {
                "uuid": str(uuid.uuid4()),
                "nome": user_input["nome"],
                "local": user_input["local"],
                "ativo": DEFAULT_EQUIPAMENTO_ATIVO,
                "sirene_ativa": DEFAULT_SIRENE_ATIVA,
                "intervalo_coleta": DEFAULT_INTERVALO_COLETA,
                "tempo_porta": DEFAULT_TEMPO_PORTA_ABERTA,
                "sensors": []
            }
            self.equipments.append(new_equip)
            return await self.async_step_add_sensor()

        return self.async_show_form(
            step_id="add_equipment",
            data_schema=vol.Schema({
                vol.Required("nome", default="Freezer Principal"): str,
                vol.Required("local", default="Cozinha"): str,
            }),
        )

    async def async_step_add_sensor(self, user_input=None):
        """Passo 3: Vínculo de sensores do Home Assistant."""
        if user_input is not None:
            current_equip = self.equipments[-1]
            current_equip["sensors"].append({
                "uuid": str(uuid.uuid4()),
                "ha_entity_id": user_input["ha_entity_id"],
                "tipo": user_input["tipo"]
            })

            if user_input.get("add_another"):
                # Se marcou o checkbox "Adicionar outro sensor", repete este passo
                return await self.async_step_add_sensor()

            # Se não, mostra o menu para decidir se cadastra outro equipamento ou finaliza
            return self.async_show_menu(
                step_id="post_add_menu",
                menu_options=["add_equipment", "finalizar"]
            )

        return self.async_show_form(
            step_id="add_sensor",
            data_schema=vol.Schema({
                vol.Required("ha_entity_id"): selector.EntitySelector(
                    selector.EntitySelectorConfig(multiple=False)
                ),
                vol.Required("tipo"): vol.In([
                    "temperatura", "energia", "tensao",
                    "corrente", "humidade", "porta"
                ]),
                vol.Optional("add_another", default=False): bool,
            }),
        )

    async def async_step_post_add_menu(self, user_input=None):
        """
        Handler OBRIGATÓRIO para o menu 'post_add_menu'.
        Processa a escolha do usuário: cadastrar novo equipamento ou finalizar.
        """
        if user_input == "add_equipment":
            return await self.async_step_add_equipment()

        # Se escolheu 'finalizar' ou qualquer outra coisa
        return await self.async_step_finalizar()

    async def async_step_finalizar(self, user_input=None):
        """Cria a entrada de configuração no HA."""
        self.data[CONF_EQUIPMENTS] = self.equipments
        title = f"Easy Smart ({self.data.get(CONF_API_HOST, 'Local')})"
        return self.async_create_entry(title=title, data=self.data)

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return EasySmartOptionsFlowHandler(config_entry)


class EasySmartOptionsFlowHandler(config_entries.OptionsFlow):
    """Gerencia as opções após a instalação (Manage Sensors)."""

    def __init__(self, config_entry):
        self.config_entry = config_entry
        self.updated_data = dict(config_entry.data)
        self.selected_equip_uuid = None

    async def async_step_init(self, user_input=None):
        """Menu principal de gerenciamento."""
        return self.async_show_menu(
            step_id="init",
            menu_options=["change_interval", "manage_sensors", "add_more_equipment", "remove_equipment"]
        )

    async def async_step_change_interval(self, user_input=None):
        """Altera o intervalo global de sincronia da fila."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        return self.async_show_form(
            step_id="change_interval",
            data_schema=vol.Schema({
                vol.Optional(
                    "update_interval",
                    default=self.config_entry.options.get("update_interval", 60)
                ): vol.All(vol.Coerce(int), vol.Range(min=10, max=3600)),
            }),
        )

    async def async_step_manage_sensors(self, user_input=None):
        """Inicia o gerenciamento de sensores de um equipamento."""
        if user_input is not None:
            self.selected_equip_uuid = user_input["equip_uuid"]
            return await self.async_step_sensor_action_menu()

        equips = {e["uuid"]: f"{e['nome']} ({e['local']})" for e in self.updated_data[CONF_EQUIPMENTS]}
        return self.async_show_form(
            step_id="manage_sensors",
            data_schema=vol.Schema({
                vol.Required("equip_uuid"): vol.In(equips),
            }),
        )

    async def async_step_sensor_action_menu(self, user_input=None):
        """Menu de ações para sensores."""
        return self.async_show_menu(
            step_id="sensor_action",
            menu_options=["add_sensor_to_equip", "remove_sensor_from_equip", "init"]
        )

    async def async_step_add_sensor_to_equip(self, user_input=None):
        """Adiciona um sensor a um equipamento existente."""
        if user_input is not None:
            for equip in self.updated_data[CONF_EQUIPMENTS]:
                if equip["uuid"] == self.selected_equip_uuid:
                    equip["sensors"].append({
                        "uuid": str(uuid.uuid4()),
                        "ha_entity_id": user_input["ha_entity_id"],
                        "tipo": user_input["tipo"]
                    })
                    break
            self.hass.config_entries.async_update_entry(self.config_entry, data=self.updated_data)
            return await self.async_step_sensor_action_menu()

        return self.async_show_form(
            step_id="add_sensor_to_equip",
            data_schema=vol.Schema({
                vol.Required("ha_entity_id"): selector.EntitySelector(
                    selector.EntitySelectorConfig(multiple=False)
                ),
                vol.Required("tipo"): vol.In(["temperatura", "energia", "tensao", "corrente", "humidade", "porta"]),
            }),
        )

    async def async_step_remove_sensor_from_equip(self, user_input=None):
        """Remove um sensor de um equipamento."""
        if user_input is not None:
            for equip in self.updated_data[CONF_EQUIPMENTS]:
                if equip["uuid"] == self.selected_equip_uuid:
                    equip["sensors"] = [s for s in equip["sensors"] if s["uuid"] != user_input["sensor_uuid"]]
                    break
            self.hass.config_entries.async_update_entry(self.config_entry, data=self.updated_data)
            return await self.async_step_sensor_action_menu()

        current_sensors = {}
        for equip in self.updated_data[CONF_EQUIPMENTS]:
            if equip["uuid"] == self.selected_equip_uuid:
                current_sensors = {s["uuid"]: f"{s['tipo']} ({s['ha_entity_id']})" for s in equip["sensors"]}
                break

        return self.async_show_form(
            step_id="remove_sensor_from_equip",
            data_schema=vol.Schema({
                vol.Required("sensor_uuid"): vol.In(current_sensors),
            }),
        )

    async def async_step_add_more_equipment(self, user_input=None):
        """Adiciona novo equipamento completo."""
        if user_input is not None:
            new_equip = {
                "uuid": str(uuid.uuid4()),
                "nome": user_input["nome"],
                "local": user_input["local"],
                "ativo": DEFAULT_EQUIPAMENTO_ATIVO,
                "sirene_ativa": DEFAULT_SIRENE_ATIVA,
                "intervalo_coleta": DEFAULT_INTERVALO_COLETA,
                "tempo_porta": DEFAULT_TEMPO_PORTA_ABERTA,
                "sensors": []
            }
            self.updated_data[CONF_EQUIPMENTS].append(new_equip)
            self.selected_equip_uuid = new_equip["uuid"]
            self.hass.config_entries.async_update_entry(self.config_entry, data=self.updated_data)
            return await self.async_step_add_sensor_to_equip()

        return self.async_show_form(
            step_id="add_more_equipment",
            data_schema=vol.Schema({
                vol.Required("nome"): str,
                vol.Required("local"): str,
            }),
        )

    async def async_step_remove_equipment(self, user_input=None):
        """Remove equipamento inteiro."""
        if user_input is not None:
            self.updated_data[CONF_EQUIPMENTS] = [
                e for e in self.updated_data[CONF_EQUIPMENTS]
                if e["uuid"] != user_input["equip_uuid"]
            ]
            self.hass.config_entries.async_update_entry(self.config_entry, data=self.updated_data)
            return await self.async_step_init()

        equips = {e["uuid"]: e["nome"] for e in self.updated_data[CONF_EQUIPMENTS]}
        return self.async_show_form(
            step_id="remove_equipment",
            data_schema=vol.Schema({
                vol.Required("equip_uuid"): vol.In(equips),
            }),
        )