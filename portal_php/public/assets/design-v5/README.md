# StockControl V5 — Offline Workspace

Esta versão é uma evolução **sem API e sem base de dados remota**, criada para testar operações de inventário e uma interface industrial compacta diretamente no navegador. A V4 permanece intacta na pasta `design-v4/`. A V5 não altera a aplicação de produção nem o código FastAPI/PHP original (não presente neste repositório).

## Executar

Abre `portal_php/public/assets/design-v5/index.html` no navegador ou serve a pasta com um servidor estático. **Não é necessário instalar Node, Python, PHP, React nem configurar credenciais para utilizar a interface.** A ligação à Internet não é necessária após carregar os ficheiros locais.

## Estrutura

```text
design-v5/
├── index.html                 Entrada da interface
├── styles.css                 Design system responsivo e compacto
├── model.js                   Regras de stock, reservas, movimentos e validação
├── backup.js                  Exportação/restauro JSON validado (offline)
├── app.js                     Bundle independente, gerado a partir de src/
├── src/
│   ├── 00-runtime.jsfrag      Configuração, estado e navegação inicial
│   ├── 10-persistence.jsfrag  Guardar/carregar, backups e validação
│   ├── 20-ui-shell.jsfrag     Sidebar, topbar, tabelas e componentes base
│   ├── 30-inventory-operations.jsfrag  Inventário, movimentos e reservas
│   ├── 40-reports-management.jsfrag   Relatórios, equipa, settings e website
│   ├── 50-router-dialogs.jsfrag       Páginas, modais e navegação
│   ├── 60-operation-commands.jsfrag  Comandos, aprovações e exportações
│   └── 70-event-binding.jsfrag       Eventos do navegador e teclado
└── tools/
    └── build.cjs              Builder determinístico sem dependências externas
```

As secções `.jsfrag` compõem um único módulo IIFE para preservar comportamento e compatibilidade com a V4. **É uma primeira divisão modular**, não um sistema ES Modules com dependências independentes. O `app.js` é o artefacto executável. Alterar os ficheiros de `src/` e executar `node portal_php/public/assets/design-v5/tools/build.cjs` apenas quando desenvolver; para executar o sistema, Node não é necessário.

## Fluxos disponíveis
- Dashboard com métricas calculadas e alertas por disponibilidade real.
- Catálogo com filtros, pesquisa, ordenação, paginação e estados de disponibilidade após reservas.
- Entradas, saídas, devoluções e movimentos de ajuste.
- Reservas, consumo parcial/total, cancelamento de saldo e rastreabilidade local.
- Contagens físicas com aprovação/rejeição e validação de saldo reservado.
- Registo **apenas de metadados** de ficheiros, relatórios demonstrativos e exportações CSV.
- Papéis Administrador, Operador e Auditor **apenas para visualizar o fluxo de permissões**.
- Exportação de backup JSON e restauro confirmado, validado por esquema e regras de inventário.

## Limites de segurança e durabilidade

- `localStorage` mantém os dados **neste navegador e nesta origem**, sem sincronização entre dispositivos. A V5 usa a chave `stockcontrol:v5:offline:v1` e lê os dados válidos da V4 como migração inicial quando ainda não tem dados próprios.
- Limpar os dados do navegador pode apagar os registos; exporta backups regularmente.
- O backup JSON **não é cifrado**. Deve ser guardado num local seguro. Se o browser não conseguir gravar o backup restaurado, o sistema avisa do erro.
- Não existe autenticação real, permissões de servidor, acesso multiempresa seguro, SQLite/PostgreSQL, backups automáticos na nuvem, upload/armazenamento de ficheiros, Stripe nem envio de emails.
- O bloqueio entre abas evita parte das perdas acidentais, mas não equivale a transações de base de dados.
- **Não introduzir informações confidenciais, dados reais de clientes ou segredos nesta demonstração.**

## Verificação

```sh
node portal_php/public/assets/design-v5/tools/build.cjs --check
node --check portal_php/public/assets/design-v5/app.js
node --test tests/stockcontrol_v5_model.test.cjs
```

A suite Playwright/Chromium `tests/stockcontrol_v5_browser.cjs` é executada no GitHub Actions (workflow `.github/workflows/stockcontrol-v5.yml`) e produz capturas de ecrã desktop e mobile. A suite depende de Playwright **apenas em CI**, não durante a utilização.

## Decisões de UX

A navegação e os ecrãs de operação seguem princípios observáveis em softwares de armazém e ERP, como Odoo Inventory e ERPNext: primeiro a operação e os dados, depois as ações contextuais, os estados de saldo e a rastreabilidade. O uso de componentes coerentes, tabelas com filtros, modais e sidebar compacta segue também padrões de design system semelhantes aos documentados em shadcn/ui. A implementação e o CSS desta V5 são próprios, não uma cópia de código dessas plataformas.

## Próximos módulos opcionais sem servidor

1. Importação CSV com pré-visualização e deteção de duplicados.
2. Localizações e armazéns com transferências entre zonas.
3. Leitura de QR por câmara (quando a permissão do browser e o contexto seguro permitirem).
4. Contagens por lote, ferramentas de inventário e guias imprimíveis.
5. Filtros de datas, pesquisa unificada e exportação de relatórios.
6. Migração futura para IndexedDB quando o volume ultrapassar os limites do localStorage, sem exigir API externa.

Estas funcionalidades futuras não são anunciadas como já implementadas.
