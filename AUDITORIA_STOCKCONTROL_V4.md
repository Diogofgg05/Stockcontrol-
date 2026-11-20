# StockControl — auditoria técnica de regressões V4
**Data:** 20 de novembro de 2026 · **Âmbito:** `portal_php/public/assets/design-v4/`, `tests/` e CI, branch `feat/stockcontrol-v4-workspace`.

## Conclusão de âmbito
A versão publicada neste repositório é uma **demonstração autónoma** (HTML, CSS e JavaScript) com dados locais. O backend FastAPI, a aplicação PHP completa, a base de dados e o instalador Windows **não fazem parte deste repositório** e não puderam ser auditados nesta ronda. Isto não é uma certificação de produção. A presença de uma UI de permissões ou pagamentos não equivale a autenticação, isolamento por empresa ou cobranças reais.

## Falhas concretas identificadas e tratadas

| ID | Severidade | Problema | Alteração |
| --- | --- | --- | --- |
| SCV4-01 | Alta | Dados adulterados ou malformados em `localStorage` podiam ser carregados e propagados | Validação estrutural do estado, limites, SKUs únicos, referências cruzadas, quantidades tipadas e reservas coerentes |
| SCV4-02 | Alta | Quantidades persistidas como texto podiam ser aceites como numéricas | Tipagem obrigatória do estado persistido e regressão dedicada |
| SCV4-03 | Alta | Duas abas podiam substituir silenciosamente atualizações já guardadas | Verificação de versão serializada, notificação de eventos `storage` e interrupção de ações desatualizadas |
| SCV4-04 | Média | Erros de escrita em `localStorage` podiam surgir como sucessos duráveis | Mensagem diferenciada entre sessão em memória e persistência local |
| SCV4-05 | Alta | Aprovação de contagens não criava movimento de ajuste no histórico | Registo de `Ajuste` com `delta` positivo/negativo e respetiva exportação CSV |
| SCV4-06 | Média | Filtro de movimentos não incluía ajustes de inventário | Nova categoria Ajuste e quantidade com sinal na tabela |
| SCV4-07 | Média | Conversões implícitas de vazios, precisão elevada ou quantidades enormes | Limites explícitos, máximo de três casas decimais e controlo de overflow |
| SCV4-08 | Média | Campos CSV podiam iniciar fórmulas depois de espaços invisíveis | Neutralização adicional de fórmulas em CSV e testes de injeção |
| SCV4-09 | Média | Pesquisa global no telemóvel não disponibilizava input utilizável | Botão móvel que abre e foca a pesquisa de inventário |
| SCV4-10 | Média | Modais podiam deixar o fundo navegável ou rolável | Inertização do fundo, bloqueio de scroll, retenção de foco e Escape |
| SCV4-11 | Baixa | Uploads do protótipo eram descritos como se guardassem ficheiros | Texto alterado para registo de metadados; nenhuma transferência de conteúdo |
| SCV4-12 | Média | Ausência de testes de navegador do fluxo completo | Suite Chromium/Playwright em GitHub Actions, com capturas desktop/mobile |
| SCV4-13 | Baixa | GitHub Actions escolhia Ubuntu 26.04 sem suporte do Playwright utilizado | Runner de navegador fixado explicitamente em `ubuntu-24.04` |

## Proteções e comportamentos efetivos
- As saídas de inventário são rejeitadas quando excedem o disponível após reservas.
- Reservas ativas reduzem disponibilidade, mas não alteram o stock físico.
- Contagens físicas são registadas como pendentes; só o papel de demonstração Administrador as pode aprovar.
- Se o stock físico mudar depois de uma contagem, o acerto é recusado. As reservas também são verificadas antes do acerto.
- Entradas, saídas, devoluções e ajustes existem apenas no estado de exemplo, não na API.
- Strings renderizadas e exportações são escapadas; o teste de navegador tenta introduzir HTML malicioso como nome de material.
- A interface de telemóvel usa sidebar recolhível, tabelas com scroll próprio e pesquisa ativa.

## Limites de segurança ainda existentes
1. **Sem autenticação, sessões reais, RLS, ACL/API ou isolamento multiempresa.** Mudar o papel no protótipo é um controlo de interface, não uma barreira de segurança.
2. **Sem transações de base de dados nem locks de concorrência.** A proteção entre abas diminui sobrescritas acidentais, mas não garante atomicidade.
3. **Sem upload para Storage real, antivírus, controlo de tipos no servidor ou URLs assinadas.** O protótipo guarda só nomes e tamanhos.
4. **Sem webhooks Stripe, subscrições, trial, faturas reais ou pagamentos.** A faturação é informativa e não oferece checkout.
5. **Sem backup central, retenção, auditoria imutável, rastreabilidade regulamentar, assinatura digital ou notificações por email.**
6. **Sem código disponível do instalador Windows/APK Android,** pelo que a instalação e a plataforma móvel não foram retestadas.
7. A deteção de conflito entre abas é de melhor esforço; só um backend transacional pode fornecer garantias reais.

## Plano de verificação
- Unitários: `node --test tests/stockcontrol_v4_model.test.cjs`.
- Sintaxe: `node --check` em `model.js`, `app.js` e testes.
- E2E em Chromium: `node --test tests/stockcontrol_v4_browser.cjs` depois de instalar Playwright e o navegador.
- Abranger 11 páginas, criação/filtragem, HTML injection, saídas e reservas, acertos assinados e CSV, permissões demonstrativas, dados corruptos e mobile.
- Guardar capturas de dashboard, website e inventário mobile no artefacto do GitHub Actions.
- Os logs da última execução do CI são a fonte de verdade sobre aprovação; não inferir aprovação a partir da simples existência dos testes.

## Critérios antes de um lançamento comercial
Reunir a distribuição completa; implementar autorização por empresa e por operação no servidor, migrações seguras e transações de stock; criar uploads privados verificados; testar webhooks Stripe reais em sandbox, recuperação e faturação; executar ensaios E2E PHP/FastAPI e 30 utilizadores concorrentes; validar backup/recovery e instalador no Windows; completar uma revisão de segurança independente.

**Prioridade máxima:** integrar o código completo e auditar a proteção multiempresa em backend. Nenhuma correção puramente visual é substituto desta etapa.

## Ronda adicional — consumo parcial de reservas (20/11/2026)

**Problema encontrado:** a V4 tinha reservas e movimentos de stock independentes, mas não existia uma operação que permitisse consumir uma reserva de forma parcial e consistente. Isso impedia o acompanhamento real do saldo reservado em cada ordem de produção.

**Correções implementadas na demonstração:**
- Adicionado `consumed` à reserva, mantendo compatibilidade com registos anteriores em que o campo falta (interpretação como 0).
- Criado o cálculo `reservationRemaining` e o planeamento puro `planConsumption`. A operação rejeita consumos com quantidades inválidas, superiores ao saldo reservado ou sobre reservas canceladas/concluídas.
- Consumo parcial reduz stock físico e saldo de reserva pela mesma quantidade, sem alterar a disponibilidade livre de outras ordens.
- Consumo total define o estado `Concluída`. Cancelar após consumo parcial liberta apenas o saldo ainda ativo, sem repor stock já consumido.
- Criado movimento `Consumo`, com `reservationId`, referência de ordem, `qty` e `delta` negativo. Histórico e exportação CSV mostram a variação assinada.
- Acrescentados seis testes de domínio e dois testes de navegador (fluxo parcial/total e cancelamento após consumo).

**Limitação:** as alterações são locais ao navegador. O controlo de concorrência transacional entre trabalhadores reais e a autorização por empresa continuam dependentes do backend que não se encontra neste repositório.

