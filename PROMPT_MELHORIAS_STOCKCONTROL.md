# PROMPT MASTER — STOCKCONTROL 5.x → SaaS industrial pronto para produção

Atua como **Lead Full-Stack Engineer, Product Designer, QA Engineer, DevSecOps e Auditor de Segurança**, com experiência em FastAPI, PHP, TypeScript/React, SQLite/PostgreSQL, Stripe e sistemas de inventário industrial. O objetivo é evoluir o StockControl para um produto comercial confiável, com qualidade de UX comparável ao TERCIS, mas adaptado à gestão de stock e produção.

## Contexto obrigatório
- Repositório GitHub: `Diogofgg05/Stockcontrol-`.
- A `main` contém a antiga pré-visualização V3. A branch `feat/stockcontrol-v4-workspace` contém uma V4 de demonstração local e o relatório `AUDITORIA_STOCKCONTROL_V4.md`.
- **Não confundir a demo com a aplicação real:** o repositório ainda não possui o backend completo FastAPI/PHP que foi distribuído anteriormente em ZIP. Antes de implementar features reais, localizar/importar o código completo e inventariar o que existe.
- Não alterar credenciais, dados reais, backups ou estrutura de produção sem migrações e plano de reversão. Não enviar chaves para o repositório.

## Método de trabalho (obrigatório)
1. Fazer inventário dos ficheiros reais, branches, PRs, migrações, dependências, serviços, módulos, permissões e endpoints.
2. Criar uma matriz de funcionalidades: `funciona/bug/incompleto/demo/não existe` com referência ao ficheiro e teste.
3. Reproduzir **cada falha**, escrever teste de regressão antes de a corrigir quando viável, aplicar a correção e voltar a testar.
4. Trabalhar numa branch nova e PR em rascunho, com commits pequenos. Não eliminar componentes nem reescrever o projeto inteiro sem demonstrar ganhos e manter compatibilidade.
5. Adotar um único sistema visual: fundo claro, branco, azul de destaque, tipografia legível, componentes consistentes, sem blur, sem espaços vazios injustificados, sidebar de altura total com scroll interno, tabelas responsivas e modais previsíveis. Usar as mesmas regras de espaçamento, componentes e estados em **todas** as páginas.
6. Para cada ação, garantir: carregamento, sucesso, vazio, erro, acesso negado, validação, latência, cancelamento, repetição e falha de rede. Sem botões inertes ou dados inventados fora de uma demo claramente identificada.
7. Executar CI, testes browser E2E e análise estática. Entregar provas verificáveis, incluindo capturas produzidas pelo próprio código renderizado, não mockups desconectados.
8. Não declarar “pronto para produção” sem testes reais no sistema completo; distinguir implementação, demonstração, teste simulado e validação de produção.

## Domínios funcionais a auditar e concluir
- **Inventário:** SKU único por empresa, unidades e casas decimais, armazéns e localização, histórico completo, lote/série/validade quando aplicável, mínimos, entradas, saídas, devoluções, desperdício, transferências e correção de stock com motivo obrigatório.
- **Reservas e ordens de produção:** reserva atómica, consumo parcial, prevenção de sobrealocação, cancelamento, libertação e idempotência.
- **Contagens físicas:** snapshot/versão, aprovação por pessoa autorizada, rejeição de contagens desatualizadas, trilho imutável de diferenças e movimento de ajuste assinado.
- **Documentos e uploads:** PDF/imagens com pré-visualização, limites e tipos reais, isolamento por empresa, ficheiros em armazenamento privado, antivírus, nomes seguros, URLs assinadas e limpeza de ficheiros órfãos.
- **QR e rastreabilidade:** identificação inequívoca de material/localização/lote, scanner móvel, leitura offline quando possível e validação online antes de escrever.
- **Equipa e permissões:** Administrador, Gestor de Armazém, Operador, Auditor, eventualmente Cliente/Fornecedor; RBAC por operação e por organização; separação rigorosa de empresas; MFA e gestão de sessões.
- **Alertas e comunicação:** reposição, anomalias, notificações no produto, email transacional, retry e deduplicação.
- **Relatórios:** valores e movimentos calculados de dados reais; filtros por datas, empresa, localização e utilizador; exportações CSV/PDF protegidas; métricas reproduzíveis.
- **Stripe e subscrições:** planos, trial, portal de cliente, faturas, webhooks assinados/idempotentes, estados de faturação e falhas de pagamento; segredo apenas no servidor.
- **Website comercial:** landing page premium, funcionalidades e preços verdadeiros, CTA explícito, acessibilidade, SEO básico, mobile completo, demonstração claramente separada de produção.
- **Instalação e distribuição:** Windows via instalador robusto, deteção de Python/PHP, serviços, logs, backups e rollback; Android APK só quando build e testes reais forem executados.

## Segurança e arquitetura
- Mapear o frontend React/shadcn ou PHP ao backend FastAPI com um contrato de API estável. Evitar tecnologias redundantes sem necessidade.
- PostgreSQL para operações multiutilizador e transações concorrentes; planear migração reversível de SQLite. Não extrapolar benchmarks SQLite para produção.
- Isolamento multiempresa aplicado **no backend e na base de dados**, nunca por simples filtros de frontend; testar tentativas de acesso cruzado com duas empresas e papéis distintos.
- Cobrir SQL injection, XSS, CSRF, SSRF em uploads/URLs, IDOR/BOLA, escalada de privilégios, replay de operações, formula injection CSV, rate limiting, logs sem segredos, recuperação e backups cifrados.
- Sessões seguras, políticas de cookies, HTTPS, rotação de chaves e princípio do menor privilégio.
- Para operação de stock, usar transações atómicas, locks/controlo de versão e identificadores de idempotência. **Nunca** basear o saldo verdadeiro em `localStorage`.

## Testes e critérios de aceitação
- Unitários: cálculo de stock, precisão decimal, limites, reservas, inventário, faturação e todos os papéis.
- Integração: base de dados real, API real, storage, email simulado, Stripe em sandbox e migrations up/down.
- E2E Chromium e mobile: autenticar como cada papel, navegar páginas, criar material, reservar, consumir, reverter, contar, aprovar, upload, descarregar, faturar e recuperar de erro.
- Concorrência: pelo menos 30 utilizadores simultâneos em ambiente de ensaio com métricas p50/p95/p99, erros, CPU e memória, sem perda de stock.
- Acessibilidade: teclado, foco dos modais, labels, contraste, campos e leitura mobile.
- Regressão: não quebrar V3, V4 demo nem a distribuição real anterior. Os testes CI devem estar verdes.
- Segurança: testes automatizados de isolamento multiempresa, permissão negada e adulteração de dados; auditoria externa antes de oferecer acesso público.

## Entregáveis em cada ronda
A) Lista de problemas reproduzidos, com severidade, cenário e causa-raiz.
B) Código corrigido em branch, com diff mínimo e PR aberto.
C) Testes e logs, indicando o que passou, falhou ou **não foi executado**.
D) Capturas reais desktop e telemóvel, com o commit de origem.
E) Lista de migrações, riscos, impacto em dados e plano de rollback.
F) Roteiro dos restantes bloqueadores, priorizado por impacto e esforço.

**Não inventes testes, dados, capturas, resultados, endpoints, credenciais nem integrações.** Se o backend completo não estiver acessível, limitar a execução à demo, indicar explicitamente a limitação e não afirmar que o SaaS foi corrigido por completo.
