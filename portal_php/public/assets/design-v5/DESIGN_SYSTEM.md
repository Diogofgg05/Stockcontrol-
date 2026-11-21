# StockControl V6 — Design System «Reference Dark»

A imagem enviada em 20/11/2026 é a **fonte visual principal**. A V6 replica a linguagem estética — azul-pervinca exterior, interior quase preto, rail de ícones, linhas divisórias, tipografia discreta, lilás e lima — na app industrial, sem copiar a marca ou os dados apresentados no exemplo.

## Ficheiros canónicos
- `DESIGN_PROMPT_REFERENCE.md`: prompt mestre visual e critérios.
- `reference-theme.css`: **fonte de verdade** de tokens e primitivas de estilo; carrega **depois** de `styles.css`.
- `src/20-ui-shell.jsfrag`: sidebar estreita, topbar, páginas e componentes comuns.
- `src/25-reference-visuals.jsfrag`: SVG do stock, donut, barras, atividade lateral e galeria de componentes.
- `src/30-inventory-operations.jsfrag`: dashboard construído a partir dos componentes do design system e saldos reais da demo.
- `src/40-reports-management.jsfrag`: rotas das páginas, incluindo `design`.
- `src/50-router-dialogs.jsfrag`: shell `app-shell > sidebar + app-body > header + body-columns > main + right-insights`.
- `tools/build.cjs`: assembler determinístico que descobre `src/components/*.jsfrag` e `src/pages/*.jsfrag`.
- `tools/scaffold.cjs`: cria o esqueleto de novas páginas ou componentes e regenera `app.js` automaticamente.

## Tokens fundamentais

| Token | Valor | Papel |
|---|---|---|
| `--sc-backdrop` | `#B4C8F6` | Fundo exterior |
| `--sc-bg` | `#16151E` | App e secções |
| `--sc-bg-deep` | `#13121A` | Subsuperfícies |
| `--sc-surface` | `#201F29` | Campos, pills e controlo |
| `--sc-line` | `#383640` | Separadores de 1 px |
| `--sc-text` | `#F7F5FB` | Títulos e texto |
| `--sc-muted` | `#AAA8B6` | Metadados |
| `--sc-lavender` | `#C9BCFF` | Séries primárias e seleção |
| `--sc-lime` | `#D8F574` | Série secundária e destaque |
| `--sc-danger` | `#FD9DB0` | Erros |
| `--sc-warning` | `#F6C981` | Atenção |

## Componentes reutilizáveis
`pageHeader`, `button`, `stat`, `pill`, `table`, `empty`, `field`, `materialSelect`, `stockTrendChart`, `stockDonut`, `riskBars`, `activityAside`, `componentCatalog`, `sidebar`, `header`.

Classes oficiais: `.panel`, `.btn.primary`, `.btn.secondary`, `.btn.plain`, `.field`, `.filter-btn`, `.pill.good`, `.pill.warning`, `.pill.bad`, `.stat-card`, `.table-wrap`, `.modal`, `.rail-tooltip`, `.right-insights`, `.dashboard-chart-panel`.

## Criar uma página — sempre com o mesmo estilo

```bash
node portal_php/public/assets/design-v5/tools/scaffold.cjs page "Inspeções"
```

O gerador:
1. Cria `src/pages/inspecoes.jsfrag` usando `pageHeader`, `.panel` e os tokens existentes.
2. Regista o nome e o menu na navegação e a rota em `additionalPages`.
3. Regenera `app.js` automaticamente. **Não** coloca CSS isolado na nova página.
4. Gera apenas o esqueleto visual; os fluxos reais da página continuam a ser responsabilidade de quem a desenvolve.

## Criar um componente — reutilizar os tokens

```bash
node portal_php/public/assets/design-v5/tools/scaffold.cjs component "Cartao de estado"
```

O gerador cria `src/components/cartao-de-estado.jsfrag` com a função `component_cartao_de_estado`, baseada em `.stat-card`. O builder descobre-a automaticamente e disponibiliza-a no mesmo escopo das páginas; só precisa de a chamar nas páginas pretendidas.

## Regras para futuras alterações
- **Não adicionar** cores hexadecimais, bordas, fontes nem sombras específicos a novas páginas. Se faltar um estilo, adicioná-lo à folha de tema e reutilizar a classe correspondente.
- **Não repetir** a sidebar, o header ou a coluna de atividade em cada página; o layout injeta-os uma vez.
- **Não inventar métricas** nos gráficos; a V6 usa quantidades calculadas dos dados locais.
- Manter `aria-label`, `aria-current`, `aria-pressed`, `role="img"` e foco de teclado.
- Manter tabelas com scroll interno e a coluna direita oculta em ecrãs estreitos.
- Validar sempre as 12 páginas, modais e o modo mobile antes de aceitar um PR.

## Testes
```bash
node portal_php/public/assets/design-v5/tools/build.cjs --check
node --test tests/stockcontrol_v5_model.test.cjs tests/stockcontrol_v6_theme.test.cjs
```

O workflow `.github/workflows/stockcontrol-v6.yml` executa ainda os testes Chromium, recolhe capturas reais desktop/mobile e testa a geração de um novo ecrã e de um novo componente.

**Nota de fidelidade:** os estilos, cores, proporções e componentes são inspirados na referência. A aplicação mantém o conteúdo real do StockControl, por isso a composição não é uma cópia pixel-a-pixel de uma aplicação diferente.

**Nota técnica:** continua a ser demonstração offline; sem autenticação, RLS, armazenamento de ficheiros ou pagamentos reais.

## Adaptação para aplicação WEB (full viewport)

Esta versão é uma **aplicação web no navegador**, não um executável de desktop nem um mockup com moldura.

- `html`, `body` e `#app` ocupam 100% da área do navegador. `.app-shell` usa `width:100%; height:100dvh; margin:0; border-radius:0; box-shadow:none`.
- O rail de navegação mantém 72 px no desktop; o header ocupa 68 px, e o resto é dividido em conteúdo flexível e painel de atividade de 274 px.
- Em largura até 1050 px, o painel de atividade recolhe para libertar espaço ao conteúdo; até 820 px, o rail passa a menu móvel.
- O scroll vertical é **interno ao conteúdo** e ao painel de atividade. O documento não recebe margens exteriores nem scroll duplicado. As tabelas usam scroll horizontal apenas dentro da respetiva caixa.
- A altura mínima artificial de 600 px foi retirada. O contêiner `.route-view` mantém o conteúdo de cada página no mesmo padrão flexível sem obrigar a preencher com elementos decorativos.
- Cards, gráficos, títulos, painéis e filtros utilizam paddings menores e densidade coerente. A área lateral apresenta estatísticas e ações reais da demonstração em vez da ilustração decorativa.
- Testes Chromium comprovam o viewport real em 1440×900, 1920×1080 e 390×844, incluindo navegação pelas 12 páginas e ausência de overflow do documento.

**Mantém-se offline**: pode ser servido estaticamente por um website; não necessita de instalador Windows, PHP, FastAPI, API ou base de dados remota. Os dados ficam no browser, não há autenticação real nem sincronização entre equipamentos.
