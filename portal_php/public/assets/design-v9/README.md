# StockControl V9 — Industrial Visual

Extensão visual da V8 Premium Light sem alteração das regras de inventário. O objetivo é contextualizar materiais e operações industriais com ilustrações vetoriais originais, mantendo a navegação e a performance.

## Como experimentar

Abre `portal_php/public/assets/design-v9/index.html` com todos os ficheiros do repositório presentes. Também podes servir `portal_php/public/` num servidor estático ou PHP para visualizar `/assets/design-v9/index.html`.

## Elementos novos

- Sete ilustrações SVG locais em `design-v9/assets/`: armazém, metais, fixação, resinas, rolamentos, cabos e quadros elétricos.
- Banner ilustrado contextual no dashboard, com ações reais da demonstração.
- Quatro cartões de categorias clicáveis no inventário, com filtro e imagens.
- Miniaturas ilustrativas para os materiais fictícios reconhecidos, sem adicionar URLs externas.
- Página de apresentação com imagem do armazém e três imagens associadas às funcionalidades.
- Estilo responsivo e texto alternativo para imagens informativas; imagens decorativas usam `alt=""`.

## Arquitetura

O `index.html` reaproveita `../design-v5/model.js`, `backup.js`, `app.js` e os temas da V8. `enhance.js` observa exclusivamente o contentor `#app` para decorar páginas após rerenders; não escreve em `localStorage`, não cria operações de stock e não executa pedidos de rede. As imagens são originais, armazenadas no repositório e funcionam offline.

## Verificação

O workflow `.github/workflows/stockcontrol-v9.yml` confirma o bundle, corre testes unitários de domínio e testa o carregamento efetivo das imagens, filtros e layouts mobile/desktop em Chromium. Capturas reais são anexadas ao GitHub Actions.

## Limites

**É uma demonstração offline.** As imagens são ilustrações e não fotografias dos materiais reais. Não há uploads reais, autenticação, isolamento multiempresa ou backend de produção. As referências de materiais usadas para os ícones iniciais são dados fictícios. A versão V8 mantém-se sem alterações; a V9 é acessível numa entrada independente. A V7 de integridade continua numa branch separada e requer integração validada.
