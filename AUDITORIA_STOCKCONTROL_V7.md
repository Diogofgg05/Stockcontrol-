# StockControl V7 — auditoria de integridade de dados offline

Data: 21/11/2026. Base: `feat/stockcontrol-v6-reference-dark`. Alterações propostas em `feat/stockcontrol-v7-integrity` / PR #3.

## Âmbito efetivamente analisado

O código V6/V5 da demonstração offline: `model.js`, `backup.js`, `src/60-operation-commands.jsfrag`, `tools/build.cjs`, testes Node, Chromium e GitHub Actions. O backend FastAPI/PHP, banco de dados PostgreSQL/SQLite e instalador Windows **não estão presentes neste repositório** e não foram auditados.

## Falhas e correções

| Identificador | Severidade | Cenário | Correção |
| --- | --- | --- | --- |
| V7-001 | Alta | JSON válido de backup com `users` ausente, `null`, texto, nome numérico, papel desconhecido ou `name` da organização não string podia passar o esquema e provocar exceção ao renderizar a equipa | `validateWorkspace()` verifica `users`, nomes, papéis, estados e organização; importações inválidas são recusadas |
| V7-002 | Média | Frações de materiais discretos (ex. 0,5 parafuso) podiam entrar no stock, reservas, saídas, contagens e consumos | `isDiscreteUnit()` e `assertUnitQuantity()`; regra para `un`, `pcs`, `peças`, etc., mantendo casas decimais para `kg`, `m`, `L` |
| V7-003 | Média | A criação de material aplicava `assertCount({sku}, ...)`, sem a `unit` selecionada | Validação passa agora o objeto `{sku,unit}` antes de criar a referência |
| V7-004 | Média | As regressões não reproduziam os casos acima | Testes de domínio e caso Chromium de criação/reserva de materiais discretos |

## Compatibilidade

Os dados offline mais antigos são carregados com a mesma chave do browser e o formato de backup JSON mantém a versão 1. Quantidades fracionárias históricas em unidades não foram alteradas automaticamente: a rejeição de frações é aplicada a **operações novas**. Uma limpeza/migração destrutiva automática seria inadequada sem decisão do utilizador.

## Validação e limitações

- Os testes da V7 estão em `tests/stockcontrol_v5_model.test.cjs` e `tests/stockcontrol_v5_browser.cjs`.
- `app.js` é recomposto dos mesmos nove módulos `src/*.jsfrag`; `tools/build.cjs --check` verifica correspondência.
- O workflow V6 foi estendido à branch V7 para executar testes em Node e Chromium e guardar screenshots.
- A aprovação deve ser confirmada no GitHub Actions no commit final. Não assumir sucesso antes da execução.
- O sistema permanece exclusivamente demonstrativo, sem autenticação forte, API, banco de dados transacional ou isolamento entre empresas.
- A comparação do stock no dashboard deve ser interpretada **por referência e respetiva unidade**; não se devem somar kg, litros e unidades como se fossem uma grandeza física homogénea.

## Próximos bloqueadores de produção

1. Obter e versionar de forma segura o pacote original FastAPI/PHP e esquema de BD, sem segredos.
2. Implementar stock transacional com reservas/consumos e isolamento por `tenant_id` no backend.
3. Definir política de unidades por material e migração dos dados legados num ambiente de staging.
4. Executar testes concorrentes, backups com recuperação, permissões reais, uploads privados e fluxos Stripe sandbox.
5. Validar com testes E2E desktop/mobile, auditoria independente e instalador Windows antes de lançar.
