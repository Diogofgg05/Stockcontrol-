# StockControl V4 Workspace — protótipo interativo

Esta versão é uma evolução **isolada** da V3 para avaliação de interface e fluxos de trabalho. Está em `portal_php/public/assets/design-v4/` e não substitui a V3 nem a aplicação completa distribuída anteriormente por ZIP.

## Executar

Abre `index.html` num navegador recente. Não requer Node.js, PHP, npm ou servidor. Também podes servir a pasta com um servidor estático. O endereço na estrutura do portal PHP, se configurado, será `/assets/design-v4/index.html`.

## Incluído

- Layout limpo e responsivo, sidebar com altura integral e scroll próprio, topbar, cards e tabela com scroll horizontal em ecrãs pequenos.
- Páginas navegáveis: visão geral, inventário, movimentos, reservas, inventário físico, documentos, relatórios, equipa e permissões, definições, faturação e website.
- Dados de exemplo calculados: inventário, esgotados, stock baixo, reservas, stock disponível e valor de catálogo.
- Pesquisa e filtros; adição de materiais fictícios; entradas, saídas e devoluções; reservas e cancelamentos; contagens com aprovação/rejeição; histórico básico de auditoria.
- Proteção contra saídas de stock reservado, reservas superiores ao disponível, quantidades inválidas, acertos desatualizados e contagens inferiores às reservas ativas.
- **Consumo parcial de reservas:** consumos descontam a mesma quantidade ao stock físico e ao saldo reservado; consumo total conclui a reserva, e cancelamento posterior só liberta o saldo ainda não consumido. O movimento `Consumo` mantém a referência à reserva, a ordem e a variação negativa assinada.
- Compatibilidade com reservas antigas da V4 que ainda não possuam o campo `consumed` (interpretado como zero). Testes unitários e testes Chromium demonstram consumo parcial, total e cancelamento após consumo.
- Exportação CSV de inventário e movimentos com neutralização de fórmulas, escaping HTML e tratamento de erros.
- Pré-visualização de papéis Administrador, Operador e Auditor. Testes unitários no Node `node --test tests/stockcontrol_v4_model.test.cjs`.

## Limites importantes

**Esta versão é um protótipo e não um SaaS em produção.** Não inclui login real, API FastAPI, base de dados centralizada, autorização de backend, sincronização entre empresas, QR scanner, assinatura digital, antivírus, webhooks Stripe, checkout, armazenamento de anexos ou envio de emails. Os papéis definidos nesta interface não são um mecanismo de segurança. Não introduzir credenciais reais nem dados de clientes no protótipo.

As alterações de inventário são guardadas em `localStorage` do navegador sob a chave `stockcontrol:v4:demo:v1`. Não são auditáveis nem transacionais como uma base de dados. O botão **Repor dados fictícios** elimina as alterações locais. Os anexos apenas registam *metadados locais* (nome, tamanho, categoria e material): o conteúdo do ficheiro nunca é enviado, armazenado ou carregado noutro local.

Os totais iniciais correspondem aos materiais realmente incluídos na amostra, sem números promocionais falsos. A faturação não apresenta preços nem processos de pagamento inventados.

## Guia de integração futura

1. Localizar e importar a distribuição completa atualizada do StockControl (API FastAPI, portal PHP, migrações, scripts de instalação e testes). Atualmente **não se encontra no repositório GitHub público**.
2. Mapear cada ecrã para endpoints reais e definir contratos e estados de carregamento/erro, distinguindo simulação de produção.
3. Introduzir autenticação segura de sessões/CSRF, controlo de permissões no backend, `tenant_id` em todas as operações e testes de isolamento entre empresas.
4. Substituir os movimentos simulados por transações reais e atómicas com registos imutáveis, concorrência controlada, reservas e auditoria.
5. Implementar uploads para storage privado com validação por tipo/tamanho, verificação antivírus e URLs de acesso autorizadas.
6. Integrar Stripe somente após validar webhooks idempotentes, associação ao cliente/empresa e os estados de trial/assinatura; manter indisponível até configurar.
7. Realizar testes PHP + FastAPI, fluxos E2E em navegador, testes de segurança e instalador Windows **num Windows real** antes de lançar.

## Validação

- `node --check portal_php/public/assets/design-v4/model.js`
- `node --check portal_php/public/assets/design-v4/app.js`
- `node --test tests/stockcontrol_v4_model.test.cjs`

O workflow `.github/workflows/stockcontrol-v4.yml` executa esses comandos no GitHub Actions. Esta verificação **não** substitui testes E2E nem valida um backend de produção.
