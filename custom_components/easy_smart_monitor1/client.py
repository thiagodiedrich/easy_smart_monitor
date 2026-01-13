import logging
import json
import os
import aiohttp
import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import TEST_MODE

_LOGGER = logging.getLogger(__name__)

class EasySmartClient:
    """
    Gerenciador de comunicação resiliente com a API Easy Smart.
    Responsável pela autenticação, gestão de fila em memória e persistência em disco.
    """

    def __init__(self, host: str, username: str, password: str, session: aiohttp.ClientSession, hass: HomeAssistant):
        """Inicializa o cliente com os parâmetros de conexão."""
        self.host = host.rstrip("/")
        self.username = username
        self.password = password
        self.session = session
        self.hass = hass
        self.token: Optional[str] = None
        self.queue: List[Dict[str, Any]] = []
        self._auth_lock = asyncio.Lock()

        # Caminho do arquivo de backup no diretório .storage para resiliência de dados
        self.storage_path = self.hass.config.path(".storage", "easy_smart_monitor1_queue.json")
        _LOGGER.debug("Cliente EasySmart inicializado. Storage: %s", self.storage_path)

    async def authenticate(self) -> bool:
        """
        Realiza a autenticação na API para obter o token Bearer.
        Implementa Lock para evitar múltiplas tentativas simultâneas.
        """
        if TEST_MODE:
            _LOGGER.info("[TEST MODE] Ignorando autenticação real. Token simulado gerado.")
            self.token = "fake_test_token_v1_0_6"
            return True

        async with self._auth_lock:
            _LOGGER.debug("Iniciando processo de autenticação para o usuário: %s", self.username)
            url = f"{self.host}/api/login"
            payload = {
                "username": self.username,
                "password": self.password,
                "client_id": "ha_integration_v1"
            }

            try:
                # Caso a sessão tenha sido perdida, recuperamos a global do HA
                if self.session is None or self.session.closed:
                    self.session = async_get_clientsession(self.hass)

                async with self.session.post(url, json=payload, timeout=15) as response:
                    if response.status == 200:
                        data = await response.json()
                        self.token = data.get("token")
                        if self.token:
                            _LOGGER.info("Autenticação bem-sucedida. Token armazenado.")
                            return True
                        _LOGGER.error("API retornou 200, mas o campo 'token' está ausente.")
                    elif response.status == 401:
                        _LOGGER.error("Credenciais inválidas fornecidas para a API.")
                    else:
                        _LOGGER.error("Falha na autenticação. Status: %s. Resposta: %s",
                                     response.status, await response.text())
            except asyncio.TimeoutError:
                _LOGGER.error("Timeout durante a autenticação na API.")
            except Exception as e:
                _LOGGER.error("Erro catastrófico durante a autenticação: %s", str(e))

            return False

    def add_to_queue(self, data: Dict[str, Any]) -> None:
        """
        Adiciona uma nova leitura à fila de processamento.
        Imediatamente agenda a persistência em disco para evitar perda de dados.
        """
        # Garante que o timestamp esteja presente
        if "timestamp" not in data:
            data["timestamp"] = datetime.now().isoformat()

        self.queue.append(data)
        _LOGGER.debug("Novo registro adicionado à fila. Tamanho atual: %s", len(self.queue))

        # Agenda a gravação em disco de forma não bloqueante
        self.hass.add_job(self.save_queue_to_disk)

    async def send_queue(self) -> bool:
        """
        Tenta despachar a fila acumulada para a API.
        Gerencia reautenticação automática e limpeza de fila após sucesso.
        """
        if not self.queue:
            _LOGGER.debug("Fila vazia, pulando ciclo de envio.")
            return True

        _LOGGER.debug("Iniciando despacho de fila com %s registros.", len(self.queue))

        if TEST_MODE:
            _LOGGER.info("[TEST MODE] Simulação de despacho em lote enviada com sucesso.")
            # Em modo teste, apenas limpamos a fila para simular sucesso
            self.queue.clear()
            self.save_queue_to_disk()
            return True

        # Garante que temos um token antes de prosseguir
        if not self.token:
            if not await self.authenticate():
                _LOGGER.warning("Despacho cancelado por falta de autenticação válida.")
                return False

        url = f"{self.host}/api/monitor/batch"
        headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "User-Agent": "HomeAssistant-EasySmart/1.0.6"
        }

        try:
            async with self.session.post(url, json=self.queue, headers=headers, timeout=30) as response:
                if response.status in [200, 201]:
                    count = len(self.queue)
                    self.queue.clear() # Sucesso total: limpa memória
                    self.save_queue_to_disk() # Sucesso total: limpa disco
                    _LOGGER.info("Sincronização concluída. %s registros processados pela API.", count)
                    return True

                if response.status == 401:
                    _LOGGER.warning("Token expirado detectado durante envio. Resetando credenciais.")
                    self.token = None
                    return False

                _LOGGER.warning("API rejeitou a fila. Status: %s. Detalhes: %s",
                               response.status, await response.text())
        except aiohttp.ClientConnectorError:
            _LOGGER.error("Erro de conexão: Não foi possível alcançar o host %s", self.host)
        except Exception as e:
            _LOGGER.error("Erro inesperado durante o envio da fila: %s", str(e))

        return False

    def save_queue_to_disk(self) -> None:
        """
        Sincroniza a fila em memória com o arquivo físico no diretório .storage.
        Utiliza escrita atômica simples para garantir integridade.
        """
        try:
            # Se a fila estiver vazia, removemos o arquivo para economizar espaço
            if not self.queue:
                if os.path.exists(self.storage_path):
                    os.remove(self.storage_path)
                return

            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(self.queue, f, ensure_ascii=False, indent=2)
            _LOGGER.debug("Backup da fila atualizado no disco.")
        except Exception as e:
            _LOGGER.error("Falha ao persistir fila no disco: %s", str(e))

    async def load_queue_from_disk(self) -> None:
        """
        Recupera a fila salva no disco após um reinício do Home Assistant.
        Essencial para o funcionamento resiliente prometido na v1.0.6.
        """
        if not os.path.exists(self.storage_path):
            _LOGGER.debug("Nenhum backup de fila encontrado para carregar.")
            return

        _LOGGER.info("Localizado backup de fila em disco. Iniciando recuperação...")

        try:
            def _read_file():
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    return json.load(f)

            data = await self.hass.async_add_executor_job(_read_file)
            if isinstance(data, list):
                self.queue = data
                _LOGGER.info("Recuperação concluída: %s registros voltaram para a fila.", len(self.queue))
            else:
                _LOGGER.warning("Arquivo de backup corrompido ou em formato inválido.")
        except Exception as e:
            _LOGGER.error("Erro ao carregar fila do disco: %s", str(e))