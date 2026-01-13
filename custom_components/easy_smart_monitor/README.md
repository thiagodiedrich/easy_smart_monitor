Documentação oficial para a versão estável.

🧊 Easy Smart Monitor v1.0.12
Integração profissional para monitoramento industrial de freezers, geladeiras e câmaras frias no Home Assistant.

Desenvolvida com foco em integridade de dados, esta integração garante que nenhuma leitura crítica de temperatura ou energia seja perdida, mesmo que a conexão com a internet ou com o servidor API falhe.

✨ Funcionalidades Principais
🛡️ Persistência de Fila (Offline Queue):

Se a API cair, os dados são salvos imediatamente no disco local do Home Assistant.

Assim que a conexão retorna, a integração envia todos os dados acumulados em lote (bulk), garantindo zero perda de histórico.

⚙️ Controles de Hardware Nativos:

Switches para ativar/desativar equipamentos individualmente.

Controle de sirene integrado.

⚡ Sincronização Inteligente:

Envio otimizado para reduzir tráfego de rede.

Lógica de retry exponencial em caso de falhas de comunicação.

📊 Diagnósticos em Tempo Real:

Sensores dedicados para monitorar a saúde da conexão, tamanho da fila de envio e data da última sincronização.

🛠️ Painel de Controle (Novidade v1.0.12)
Cada equipamento adicionado ao Easy Smart Monitor ganha automaticamente uma área de configuração com 4 controles vitais:

Switch Equipamento Ativo:

ON: Coleta e envia dados normalmente.

OFF: Pausa a coleta imediatamente (útil para manutenção ou degelo).

Switch Sirene Ativa:

Habilita ou desabilita a lógica de disparo de alarme sonoro para este equipamento.

Number Intervalo de Coleta (segundos):

Define a frequência mínima de envio de dados. Evita que sensores muito ruidosos lotem a fila desnecessariamente.

Number Tempo Porta Aberta (segundos):

Define quanto tempo a porta pode ficar aberta antes de o sensor binary_sensor.sirene disparar o alerta.

🚀 Instalação
Pré-requisitos
Home Assistant Core 2024.1 ou superior.

Acesso à pasta custom_components.

Passo a Passo
Baixe o código fonte da versão mais recente.

Copie a pasta easy_smart_monitor para dentro do diretório /config/custom_components/ do seu Home Assistant.

Reinicie o Home Assistant.

Após reiniciar, vá em:

Configurações > Dispositivos e Serviços > Adicionar Integração.

Pesquise por "Easy Smart Monitor".

Siga o fluxo de configuração visual.

⚙️ Configuração
1. Conexão
Insira a URL do seu servidor API (Ex: http://192.168.1.100:5000) e as credenciais de autenticação.

2. Cadastro de Equipamentos
Defina o nome (ex: "Freezer Carnes") e o local (ex: "Cozinha").

3. Vínculo de Sensores (Seletores Visuais)
A partir da versão 1.0.11+, você não precisa digitar os IDs. Utilize os menus suspensos para selecionar as entidades do Home Assistant (Zigbee, ESPHome, Tuya, etc.) que correspondem a:

Temperatura

Energia (Watts)

Tensão (Volts)

Corrente (Amperes)

Porta (Contato Magnético)

📊 Arquitetura de Dados
Snippet de código

graph LR
    A[Sensores HA] -->|Leitura| B{Filtro & Switch}
    B -->|Ativo| C[Fila em Disco .json]
    C -->|Coordenador| D{API Online?}
    D -->|Sim| E[Servidor Easy Smart]
    D -->|Não| C
Persistência: Os dados são gravados atomicamente em /config/.storage/easy_smart_monitor_queue.json.

Protocolo: HTTP/POST com payload JSON em lote.

📝 Changelog Recente
v1.0.12 (Estável)
[x] Estabilização do Config Flow com seletores visuais.

[x] Renomeação do domínio para easy_smart_monitor.

[x] Desativação do modo de teste para produção.

v1.0.11
[x] Adição dos controles Switch e Number.

[x] Correção do erro de persistência em disco.

[x] Tradução completa PT-BR.

👤 Autor e Suporte
Desenvolvedor: Thiago Diedrich (@thiagodiedrich)

Licença: MIT

Easy Smart Monitor - Inteligência Industrial ao seu alcance.