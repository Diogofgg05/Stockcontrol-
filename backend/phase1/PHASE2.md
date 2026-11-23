# StockControl Fase 2 — Operações industriais

**Estado:** implementação funcional para desenvolvimento e testes locais. Não está certificada para produção.

Esta fase liga a **área autenticada** da Fase 1 a um inventário persistido no servidor, sem depender dos dados fictícios em `localStorage` da V9. A API fica sob `/api/v2/` e o painel sob `/admin`. Reutiliza autenticação Bearer, papéis, empresas e armazéns da Fase 1.

## O que foi implementado

| Módulo | Operações disponíveis |
|---|---|
| Materiais | Registar SKU único por empresa, categoria, unidade, custo e mínimo |
| Stock físico | Saldos por material/armazém, físico, reservado, disponível e revisão |
| Movimentos | Entrada, saída, devolução, perda; histórico de operações auditável |
| Transferências | Saída e entrada atómicas entre dois armazéns da mesma empresa |
| Reservas | Reservar por ordem, consumir parcialmente/totalmente e cancelar o restante |
| Fornecedores | Registar fornecedores com código único por empresa |
| Compras | Criar encomendas com várias linhas na API; receber parcialmente e atualizar stock |
| Inventário físico | Contar; aprovar/rejeitar; bloquear contagens desatualizadas ou inferiores às reservas |
| QR Code | Gerar SVG por material, consultar pelo código, com autenticação e isolamento |
| Interface web | Inventário, movimentos, reservas, fornecedores, compras, contagens e identificação QR |
| Administração | Dashboard com totais reais de referências, reservas e localizações |

As quantidades são guardadas como **milésimos inteiros** para evitar erros de arredondamento; custos em cêntimos inteiros. Unidades discretas, como `un`, não aceitam frações. Todos os saldos utilizam a relação **disponível = físico − reservado** e não podem ficar negativos. Os movimentos têm identificadores de pedido para reduzir duplicações em reenvios.

## Executar localmente

Na raiz do repositório, com Python 3.12+ e uma empresa provisionada conforme `backend/phase1/README.md`:

```bash
pip install -r backend/phase1/requirements.txt
uvicorn backend.phase1.main:app --host 127.0.0.1 --port 8000
```

Abrir `http://127.0.0.1:8000/admin` e iniciar sessão. A documentação de desenvolvimento está em `http://127.0.0.1:8000/docs`, sendo necessário fornecer o Bearer token após login para os endpoints privados. O QR descarregado é um SVG com o identificador do material, **não** uma credencial de acesso.

Para a primeira demonstração funcional: criar material e fornecedor, registar uma entrada em **Movimentos**, criar uma reserva por ordem, consumir uma parte da reserva, criar uma encomenda e aprovar uma contagem. As alterações ficam guardadas na base de dados do servidor, não na memória do navegador.

## Papéis

- Administrador e Gestor: gerir catálogo, fornecedores, compras e aprovar contagens; também podem operar stock.
- Operador: consultar dados, registar entradas/saídas, transferências, consumo de reservas, receção de encomendas e contagens.
- Auditor: consulta apenas, incluindo movimentos e histórico, sem poder escrever.

O backend aplica as regras; esconder um botão não constitui uma permissão.

## Verificação

```bash
pip install pytest httpx playwright
python -m pytest -q tests/test_phase1_api.py tests/test_phase2_api.py
python -m playwright install chromium
python -m pytest -q tests/test_phase2_browser.py
```

O workflow de GitHub Actions `stockcontrol-phase2.yml` executa a API e o navegador Chromium, publicando capturas como artefactos.

## Limitações críticas

1. **Não usar SQLite em produção com vários processos.** O bloqueio Python usado na demonstração só funciona dentro de um processo. Em PostgreSQL, a implementação usa um `SELECT ... FOR UPDATE` da empresa para serializar operações; validar a concorrência real e criar testes de carga no PostgreSQL.
2. A aplicação ainda utiliza `Base.metadata.create_all` como bootstrap de desenvolvimento. É necessário configurar migrações Alembic e um plano de atualização de bases existentes.
3. Falta MFA, rate limiting distribuído, email verificado, segredos geridos, TLS obrigatório, backups e recuperação, observabilidade e testes de intrusão.
4. O inventário **não tem lotes, números de série, fotografias reais, validade ou múltiplas localizações dentro do mesmo armazém**. Estas funções requerem expansão do modelo de saldos e reservas para rastreabilidade granular.
5. A interface de compras permite inicialmente **uma linha por encomenda**, embora a API suporte várias linhas. O leitor QR funciona com código introduzido/colado; integração direta com câmara necessita de testes de permissões e HTTPS.
6. Estados como rejeições, cancelamentos e autorização são verificados pelo servidor, mas não há ainda uma fila de aprovações de compras nem assinatura digital.
7. A demo de design V9 continua independente; **não misturar os seus dados offline com a API real** sem processo de migração controlado.

Não publicar como SaaS de produção até corrigir os pontos de segurança e validar isolamento e transações numa instância real de PostgreSQL.
