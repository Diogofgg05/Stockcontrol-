# PROMPT MASTER — STOCKCONTROL V6 «REFERENCE DARK»

> Referência visual obrigatória: a imagem enviada pelo utilizador na conversa de 20/11/2026. O objetivo é reproduzir **a linguagem visual em todas as páginas** do StockControl sem copiar o nome, a marca nem os dados da interface representada. Componentes novos devem herdar o design system automaticamente.

## Papel
Atua como Senior Product Designer, Design Systems Architect, Frontend Engineer e QA Engineer. Trabalha sobre `Diogofgg05/Stockcontrol-`, partindo da V5 Offline. Mantém intactas as regras e a persistência local de inventário; não introduzas API, base de dados externa, npm obrigatório em runtime ou páginas fictícias não identificadas como demonstração.

## Objetivo visual — máxima fidelidade à referência
1. **Composição geral:** fundo exterior azul-pervinca pastel, uma única aplicação central antracite quase preta com cantos grandes (~36px), sombra suave no exterior, sem cards brancos.
2. **Estrutura:** rail vertical estreito de ícones à esquerda (88px), header horizontal (~96px), centro com painéis delimitados por linhas finas, painel lateral direito (~296px) com Equipa e Atividade, sem sidebar tradicional larga.
3. **Paleta obrigatória** (só ajustar quando necessário para contraste AA):
   - `--sc-backdrop: #B4C8F6` — exterior.
   - `--sc-bg: #16151E` — aplicação e painéis.
   - `--sc-bg-deep: #13121A` — áreas discretas.
   - `--sc-surface: #201F29` — inputs e áreas elevadas.
   - `--sc-surface-hover: #2B2935` — hover.
   - `--sc-line: #383640` — todas as divisórias de 1px.
   - `--sc-text: #F7F5FB` — títulos e valores.
   - `--sc-muted: #AAA8B6` — metadados, labels e ajuda.
   - `--sc-lavender: #C9BCFF` — séries principais e seleção.
   - `--sc-lime: #D8F574` — série secundária, disponibilidade e etiquetas importantes.
   - `--sc-danger: #FD9DB0`, `--sc-warning: #F6C981` — exceções sem sobrecarga de cor.
4. **Bordas:** linhas horizontais e verticais 1px, finas, sem contornos duplicados; cards do dashboard devem parecer secções da mesma superfície, não várias caixas.
5. **Tipografia:** Inter/Arial/system, títulos médios nítidos com peso 500–650, números grandes finos, texto pequeno com alto contraste, labels discretos.
6. **Componentes:** um único padrão de botão, inputs, selects, checkboxes, segmented-control, toolbar, modal, tabela, badge, avatar, chart, form, tabs e tooltip. Herança através de tokens e classes; proibir cores hardcoded nos componentes novos.
7. **Gráficos:** linhas finas lilás/lima com pontos, grelha pouco visível, filtros pill, composição compacta e elegante. Números sempre derivados de dados locais reais da demo, jamais inventados.
8. **Dashboard:** Trend / perfil de stock, composição em duas ou três secções com divisórias, progress donut lilás/lima, barras verticais com extremos arredondados, lista de riscos/alarmes, coluna direita de equipa/últimas ações.
9. **Mobile/tablet:** rail recolhível, coluna de atividade pode colapsar abaixo do conteúdo, tabelas scroll horizontal, modais acessíveis e sem overflow da página.
10. **Interatividade e acessibilidade:** foco visível lilás, keyboard navigation, `aria-current`, `aria-pressed`, labels, estados de loading/vazio/erro, alinhamento consistente, contraste WCAG AA sempre que viável.

## Arquitetura
- Criar `reference-theme.css` como camada canónica de tokens e componentes, carregada depois da folha base.
- Atualizar `src/20-ui-shell.jsfrag` para rail/header/elementos comuns. Modificar `src/50-router-dialogs.jsfrag` para layout com insights lateral comum, sem duplicar markup por página.
- Criar `src/25-reference-visuals.jsfrag` com helpers reutilizáveis, gráfico SVG de dados calculados e componentes de visualização.
- Refatorar `src/30-inventory-operations.jsfrag` para dashboard do estilo da referência e componentes reutilizados.
- Adicionar página «Design system» dentro do StockControl com inventário vivo de componentes e demonstrações; todos os componentes devem ser produzidos pelas mesmas funções/classes usadas nas páginas reais.
- Atualizar o builder determinístico `tools/build.cjs` e regenerar `app.js`.
- Garantir que a V5 anterior permanece numa branch; esta V6 trabalha apenas numa branch nova e num PR próprio.

## Requisitos de aceitação
- NENHUMA página com cores claras antigas, bordas inconsistentes ou sidebar larga.
- Tokens de cor, raio, espaço, bordo, foco e tipografia documentados.
- Todos os componentes e páginas usam `--sc-*` ou classes primitivas únicas.
- Dashboard, inventário, movimentos, reservas, contagens, documentos, relatórios, equipa, definições, faturação e website com o mesmo tema dark.
- Abrir cada página e os modais em desktop e mobile, exportar CSV e backup, testar ações e confirmar ausência de erros JavaScript.
- Testes automáticos de invariantes CSS, visual (capturas Chromium) e regressões existentes.
- Anotar sem mentir as limitações: os dados são locais à demo, não há autenticação real nem backend.

## Entrega
Gerar prompt (este documento), implementar ficheiros reais na branch, validar GitHub Actions, fornecer link do PR, ficheiros, testes e imagens reais do navegador. Nunca declarar fidelidade pixel-perfect se os layouts/conteúdos diferirem; garantir **consistência visual 100% baseada no mesmo design system**.
