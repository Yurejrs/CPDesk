# CPDesk

Sistema interno de estoque, compras e frota. O backend é FastAPI + SQLite e a interface é React + Vite. O servidor guarda o banco; os navegadores da rede acessam os dados exclusivamente pela API.

## Primeira execução no Windows

1. Instale Python 3.11 ou superior e Node.js 20 ou superior no computador que hospedará o sistema.
2. Abra dois terminais na pasta do projeto.
3. No primeiro, instale e inicie a API:

   ```powershell
   cd backend
   py -m venv .venv
   .venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   $env:CPDESK_CORS_ORIGINS="http://localhost:5173"
   uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```

4. No segundo, inicie o frontend:

   ```powershell
   cd frontend
   corepack enable
   pnpm install
   pnpm dev --host 0.0.0.0
   ```

5. No computador servidor, abra `http://localhost:5173`. No primeiro acesso, crie a conta administradora. Outros computadores da rede acessam `http://IP-DO-SERVIDOR:5173`.

## Primeira execução no Linux

Instale Python 3.11 ou superior e Node.js 20 ou superior. Em dois terminais na pasta do projeto:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

```bash
cd frontend
corepack enable
pnpm install
pnpm dev --host 0.0.0.0
```

Abra `http://localhost:5173` no servidor e `http://IP-DO-SERVIDOR:5173` nas estações clientes. Para uso contínuo, prefira gerar o frontend com `pnpm build` e servir `frontend/dist` junto da API, executada como serviço do sistema.

Para distribuição sem servidor Vite, gere os arquivos estáticos com `pnpm build` e sirva a pasta `frontend/dist` junto à API, iniciando-a com `uvicorn app.main:app --host 0.0.0.0 --port 8000`. Nesse caso, a aplicação servida pela própria API não precisa de CORS.

## Configuração

Variáveis opcionais:

- `CPDESK_DATABASE_URL`: padrão `sqlite:///./data/cpdesk.db`, relativa ao diretório de execução do backend.
- `CPDESK_SECRET_KEY`: segredo de sessão fornecido pelo operador. Se omitido, o CPDesk gera e persiste uma chave em `data/session.key`.
- `CPDESK_CORS_ORIGINS`: origens permitidas separadas por vírgula; padrão `http://localhost:5173`.
- `CPDESK_ADMIN_USERNAME` e `CPDESK_ADMIN_PASSWORD`: permitem bootstrap automatizado do administrador na primeira inicialização. A senha não deve ser guardada em scripts versionados.

Mantenha `backend/data` em armazenamento persistente e inclua o arquivo SQLite e a chave de sessão no procedimento de backup do servidor. Faça cópia consistente do banco com SQLite online backup ou com o serviço parado.

## Módulos disponíveis

- **Estoque:** código interno, descrição, unidade, estoque mínimo, custo unitário, fornecedor e histórico de entradas, consumo, ajustes e estornos auditáveis. Alertas aparecem quando o saldo atinge ou fica abaixo do mínimo.
- **Compras:** agenda recorrente por fornecedor para organizar a rotina. Concluir uma rotina atualiza sua próxima data; a agenda não cria pedidos nem recebimentos.
- **Frota:** veículos, abastecimentos e manutenções previstas por data ou quilometragem. Hodômetros inconsistentes são aceitos com aviso; não há alertas de frota.
- **Relatórios:** consumo e custo estimado de produtos por setor e funcionário; despesas, consumo e eficiência da frota. Exportações em Excel e PDF, além de CSV para frota e estoque.
- **Acesso:** primeiro usuário administrador, login por cookie HTTP-only e cadastro de operadores via API.

Saídas de estoque exigem setor e funcionário responsável. Entradas registram fornecedor e valor total da nota fiscal, além do custo unitário quando conhecido. O saldo é calculado pelo histórico de movimentações.

Para importar itens, envie um arquivo `.xlsx` à rota autenticada `POST /api/v1/items/import`. A primeira linha contém cabeçalhos; a coluna `Descrição` é obrigatória. Colunas opcionais aceitas: `Código`, `Categoria`, `Unidade`, `Estoque mínimo`, `Saldo inicial`, `Valor unitário` e `Fornecedor`. Saldos iniciais importados são registrados como entradas no histórico. Veículos e rotinas de compra podem ser cadastrados pela interface ou pela API.

## Desenvolvimento e validação

Frontend:

```powershell
cd frontend
pnpm install
pnpm build
```

Backend e testes de fluxos:

```powershell
cd backend
python -m pip install -r requirements-dev.txt
python -m pytest -q
```

Documentação interativa da API: `/docs`.
