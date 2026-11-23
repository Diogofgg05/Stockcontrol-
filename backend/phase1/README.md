# StockControl · Fase 1 — Administração autenticada

**Estado:** base administrativa em desenvolvimento e demonstrável. Não está certificada para produção.

## Implementado na API

- Empresas com códigos únicos e consultas/alterações com escopo obrigatório por empresa
- Provisionamento por terminal (incluindo novas empresas) e primeira instalação via endpoint protegido por segredo
- Login com Argon2id, sessões Bearer aleatórias armazenadas apenas como SHA-256, expiração de 8 horas, logout e revogação
- Papéis Administrador, Gestor, Operador e Auditor verificados em cada endpoint sensível
- Gestão de utilizadores, perfis, suspensão, redefinição de palavra-passe e prevenção de remoção do último administrador ativo
- Armazéns por empresa, código único, ativação e prevenção de desativação do último armazém ativo
- Edição do nome e setor da empresa
- Histórico de auditoria persistente e segregado por empresa
- Painel web responsive para empresa, equipa, armazéns e auditoria

## Executar localmente

A partir da raiz do repositório, com Python 3.12 ou superior:

1. Criar virtualenv: python -m venv .venv
2. Ativar o ambiente: Linux/macOS source .venv/bin/activate; Windows .venv\Scripts\activate
3. Instalar: pip install -r backend/phase1/requirements.txt
4. Criar empresa: python -m backend.phase1.manage provision --code AECT --name "Fábrica AECT" --admin-name "Administrador" --admin-email "admin@example.com"
5. Executar: uvicorn backend.phase1.main:app --host 127.0.0.1 --port 8000
6. Abrir: http://127.0.0.1:8000/admin

O comando pede a palavra-passe sem a mostrar ou a colocar no histórico do terminal. A empresa e utilizadores de exemplo da interface V9 offline são fictícios e **não** são automaticamente copiados para a API.

A base de dados de desenvolvimento por defeito é SQLite no ficheiro stockcontrol-phase1.db (ignorado pelo Git). Também suporta SQLAlchemy URL PostgreSQL através da variável STOCKCONTROL_DATABASE_URL, por exemplo postgresql+psycopg://...; nunca publicar as credenciais.

A API admite também POST /api/v1/setup com variável STOCKCONTROL_SETUP_KEY e cabeçalho X-Setup-Key apenas antes de existir qualquer empresa. Depois devolve 409. O endpoint deve permanecer indisponível na Internet até revisão de segurança.

## Testes

Instalar pytest e httpx e executar:

- python -m pytest -q tests/test_phase1_api.py

O GitHub Actions valida a sintaxe e testes de autenticação, RBAC, isolamento entre empresas, auditoria e integridade de sessões.

## Matriz de permissões (backend)

| Operação | Administrador | Gestor | Operador | Auditor |
| --- | :---: | :---: | :---: | :---: |
| Ver empresa/armazéns | ✓ | ✓ | ✓ | ✓ |
| Editar empresa | ✓ | — | — | — |
| Ver utilizadores | ✓ | ✓ | — | ✓ |
| Criar/alterar utilizadores | ✓ | — | — | — |
| Criar/alterar armazéns | ✓ | ✓ | — | — |
| Consultar auditoria | ✓ | ✓ | — | ✓ |

Não existe ainda superadministrador de plataforma: novas empresas são provisionadas num terminal confiável sem dar aos clientes acesso entre empresas.

## Limitações e próximos passos obrigatórios

Não ativar na Internet sem TLS obrigatório, reverse proxy seguro, migrações Alembic, testes PostgreSQL em concorrência real, recuperação de palavra-passe, verificação de email, MFA, autenticação de sessões reforçada, rate limiting distribuído, política RGPD, backups cifrados com restauro testado, monitorização e testes de intrusão.

As tentativas falhadas de login são limitadas **apenas em memória por processo**, e por isso não bastam em múltiplos servidores. O frontend guarda o token **apenas em memória**, pelo que ao recarregar é necessário voltar a entrar; o token anterior permanece válido até expirar ou ser revogado. O registo de auditoria persistente não é imutável para administradores da base de dados. A inicialização automática de tabelas via create_all é só para desenvolvimento.

**A API fase 1 ainda não inclui inventário multiempresa, movimentações reais, integração com a V9, Stripe, uploads ou email.** A demo V9 continua isolada.
