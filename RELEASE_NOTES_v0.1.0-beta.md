# CPDesk 0.1.0-beta

Primeira versão beta do CPDesk, sistema interno de estoque, agenda de compras recorrentes e controle de frota.

## Incluído

- Backend FastAPI com persistência SQLite, sessão de login e perfis administrador/operador.
- Interface React + Vite com tema claro/escuro, navegação lateral e painel operacional.
- Estoque com itens, saldo por histórico, entradas, consumo por setor e funcionário, ajustes, estornos e alertas por estoque mínimo.
- Importação de itens em Excel com possibilidade de registrar saldo inicial.
- Agenda recorrente de compras por fornecedor, sem pedidos ou recebimentos.
- Controle de veículos, abastecimentos e manutenções; hodômetros inconsistentes são aceitos e sinalizados.
- Relatórios de despesas/consumo da frota e consumo de produtos, com exportação Excel e PDF; CSV para frota e estoque.
- Instruções de desenvolvimento e instalação em Windows e Linux.

## Validação

- Suíte de fluxos backend: 2 testes passaram.
- Build frontend de produção: concluído.

## Limitações beta

- Importação Excel está disponível para itens e saldos iniciais; importação de veículos e agenda de compras ainda não está disponível.
- Implantação é para rede local e um único servidor CPDesk; clientes acessam somente pela API.
