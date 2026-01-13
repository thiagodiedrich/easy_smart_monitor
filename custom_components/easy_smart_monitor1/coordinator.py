import logging
from datetime import timedelta
from typing import Any, Dict

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

class EasySmartCoordinator(DataUpdateCoordinator):
    """
    Coordenador centralizado para despacho de dados.
    Gerencia o ciclo de vida das transferências entre a fila local e a API.
    """

    def __init__(self, hass: HomeAssistant, client, update_interval: int):
        """
        Inicializa o coordenador de monitoramento.

        :param hass: Instância do Home Assistant.
        :param client: Instância do EasySmartClient (client.py).
        :param update_interval: Tempo em segundos definido nas opções do usuário.
        """
        self.client = client
        self.hass = hass
        self._last_sync_count = 0
        self._last_sync_status = "Iniciando"

        # Configura o intervalo de atualização do DataUpdateCoordinator
        super().__init__(
            hass,
            _LOGGER,
            name=f"{DOMAIN}_coordinator",
            update_interval=timedelta(seconds=update_interval),
        )

    async def _async_update_data(self) -> Dict[str, Any]:
        """
        Processa o despacho da fila para o servidor externo.
        Este método é chamado automaticamente pelo HA com base no update_interval.
        """
        _LOGGER.debug("Iniciando ciclo de processamento de dados do coordenador.")

        if not self.client.queue:
            _LOGGER.debug("Fila vazia. Nenhum dado para enviar neste ciclo.")
            return {
                "queue_size": 0,
                "status": "idle",
                "last_success": True
            }

        try:
            # Captura a quantidade atual antes de tentar o envio
            items_to_send = len(self.client.queue)

            # Tenta o envio via cliente (que gerencia autenticação e TEST_MODE)
            success = await self.client.send_queue()

            if success:
                self._last_sync_status = "Sucesso"
                self._last_sync_count = items_to_send
                _LOGGER.info(
                    "Sincronização concluída: %s registros enviados com sucesso",
                    items_to_send
                )
            else:
                self._last_sync_status = "Falha na API"
                _LOGGER.warning(
                    "A API não aceitou os dados. %s registros mantidos na fila local.",
                    len(self.client.queue)
                )

            # Retorna um dicionário de estado.
            # Isso é o que "alimenta" as entidades vinculadas ao coordenador.
            return {
                "queue_size": len(self.client.queue),
                "last_sync_status": self._last_sync_status,
                "items_sent_last_batch": self._last_sync_count,
                "test_mode_active": self.client.token == "fake_test_token"
            }

        except Exception as err:
            self._last_sync_status = f"Erro: {str(err)}"
            _LOGGER.error("Falha crítica no ciclo do coordenador: %s", err)
            # Não usamos 'raise UpdateFailed' aqui para evitar que os sensores
            # fiquem cinzas (unavailable) caso a internet caia.
            return {
                "queue_size": len(self.client.queue),
                "status": "error",
                "error_detail": str(err)
            }

    @callback
    def async_update_interval(self, new_interval: int) -> None:
        """
        Permite que o OptionsFlow altere o tempo de sincronia em tempo real.
        Chamado pelo listener de opções no __init__.py.
        """
        _LOGGER.info(
            "Ajustando intervalo de atualização do coordenador para %s segundos",
            new_interval
        )
        self.update_interval = timedelta(seconds=new_interval)
        # Força uma atualização imediata com o novo intervalo
        self.async_set_updated_data(self.data)