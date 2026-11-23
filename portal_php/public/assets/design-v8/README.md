# StockControl V8 — Premium Light

Uma alternativa visual **clara, azul e branca**, mais legível e compacta, baseada na versão web V6.

## Experimentar

Abrir `portal_php/public/assets/design-v8/index.html` no navegador. Também podes servir `portal_php/public/` num servidor estático/PHP local e navegar para `/assets/design-v8/index.html`.

A versão V8 carrega o mesmo núcleo de demonstração da V5/V6 (`../design-v5/model.js`, `backup.js`, `app.js`) e acrescenta somente um tema CSS final. As alterações de tradução são feitas nos fragmentos fonte V5 e replicadas no bundle. **Não duplica a lógica de inventário e não altera os dados existentes.**

## Melhorias

- Paleta Apple-inspired, base clara, azul de destaque, verde para disponibilidade e contraste mais legível.
- Sidebar de 74 px, cabeçalho de 68 px e ocupação integral do viewport; scroll interno sem moldura exterior.
- Dashboard e relatórios com tipografia mais forte, indicadores em destaque, gráficos azul/verde, tabelas e filtros consistentes.
- Dashboard com títulos em português: Visão geral, Disponibilidade de stock, Estado do inventário e Materiais que precisam de atenção.
- Inventário responsivo, com último indicador a ocupar a segunda linha completa no telemóvel, sem célula vazia.
- Modais, estados, botões e acessibilidade do núcleo anterior preservados.

## Validação

O teste `tests/stockcontrol_v8_visual.cjs` abre a V8 com Chromium em 1440×900, 1920×1080 e 390×844, verifica fundo/overflow/navegação e guarda screenshots reais. Exercita também o fluxo de criação de material. O GitHub Actions `stockcontrol-v8.yml` executa ainda os testes existentes da V5/V6.

## Limites

**É um protótipo offline.** Não contém autenticação real, autorização multiempresa, API FastAPI/PHP, pagamentos, uploads físicos, transações centrais ou sincronização entre equipamentos. Os dados de exemplo são fictícios e guardados apenas no navegador.

A V6 escura permanece disponível em `design-v5/index.html`. Não misturar com dados de produção. A fusão deste tema não implica integrar automaticamente os PRs de integridade V7.
