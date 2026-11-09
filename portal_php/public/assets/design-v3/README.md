# StockControl · Design V3.0 (protótipo visual)

Esta versão refaz o design da V2.1, com páginas de dashboard, inventário, website, login e faturação. É uma proposta visual autónoma em HTML, CSS e JavaScript. Não depende de bibliotecas npm ou serviços externos.

**Abrir no StockControl:** `http://127.0.0.1:8081/assets/design-v3/index.html` (com o servidor PHP da aplicação iniciado). Também funciona abrindo `index.html` diretamente no navegador; links para o login real requerem o servidor.

**Importante:** os dados e indicadores da V3 são *fictícios*, exclusivamente para demonstração. A pesquisa, filtros, exportação CSV e registo de movimento são interações de protótipo — não alteram o inventário, não consultam a base de dados e não constituem integração com a API. A autenticação, o portal PHP de produção, a API Python e os dados reais permanecem inalterados.

## Verificação

Executar `python tests_e2e/design_v3_visual.py` com PHP, Chromium e Playwright disponíveis. O ensaio compara bytes servidos por PHP, testa as interações básicas e grava capturas de ecrã renderizadas a partir do HTML/CSS distribuído. A prova não equivale a testes E2E da aplicação autenticada.

O Figma ainda não está sincronizado com a V3 devido ao limite de chamadas do plano Starter. Ficheiro da versão anterior: https://www.figma.com/design/3Aw8l5pj4zRMulNz8LKLln
