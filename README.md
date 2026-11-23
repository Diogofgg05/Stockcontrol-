## StockControl V8 — Premium Light (nova pré-visualização)

A versão [Premium Light](portal_php/public/assets/design-v8/) apresenta o mesmo workspace industrial offline com uma interface clara, azul e branca, mais legível e responsiva, sem substituir a V6 escura. Abre `portal_php/public/assets/design-v8/index.html`.

[Consultar limitações e testes da V8](portal_php/public/assets/design-v8/README.md). A interface continua com dados fictícios locais e não é um SaaS de produção.

---

# StockControl V6 — Reference Dark Design System

A V6 aplica a imagem de referência do utilizador a **todas as páginas e componentes**: app escura com rail vertical de ícones, fundo exterior pervinca, linhas de 1px, gráficos lilás/lima, coluna de atividade lateral e controles compactos. O design mantém o núcleo offline da V5.

- [**Abrir o ecrã V6**](portal_php/public/assets/design-v5/index.html)
- [Prompt mestre da imagem](portal_php/public/assets/design-v5/DESIGN_PROMPT_REFERENCE.md)
- [Guia do Design System (tokens e criação automática)](portal_php/public/assets/design-v5/DESIGN_SYSTEM.md)
- [CSS canónico](portal_php/public/assets/design-v5/reference-theme.css)
- [Source modular](portal_php/public/assets/design-v5/src/)
- [Gerador de páginas e componentes](portal_php/public/assets/design-v5/tools/scaffold.cjs)
- [CI V6](.github/workflows/stockcontrol-v6.yml)

**Nota:** a V6 evolui a pasta `design-v5/` **nesta branch**. A implementação V5 original está preservada na branch `feat/stockcontrol-v4-workspace`. Não há backend nem autenticação de produção.

---

# StockControl V5 — arquitetura offline sem API

A nova [**V5 Offline Workspace**](portal_php/public/assets/design-v5/) evolui a V4 para uma arquitetura modular, com um bundle executável diretamente no navegador, sem dependências de API ou de base de dados remota.

- [Abrir a V5](portal_php/public/assets/design-v5/index.html)
- [Manual de utilização](portal_php/public/assets/design-v5/README.md)
- [Arquitetura e responsabilidades](portal_php/public/assets/design-v5/ARCHITECTURE.md)
- [Código dividido em módulos](portal_php/public/assets/design-v5/src/)
- [Workflow de testes V5](.github/workflows/stockcontrol-v5.yml)

**Inclui:** inventário, movimentos, reservas/consumos, contagens, relatórios, backup/restauro JSON com validação, ordenação e paginação. Dados guardados no navegador. A V4 permanece intacta. A V5 **não substitui autenticação, permissões de servidor nem uma solução multiutilizador**.

---

# StockControl — protótipos de interface

## V4 Workspace — evolução de navegação e fluxos

A nova versão em [`portal_php/public/assets/design-v4/`](portal_php/public/assets/design-v4/) disponibiliza 11 páginas navegáveis, inventário de exemplo, movimentos, reservas, contagens físicas, relatórios e validações locais, com design responsivo e testes automatizados. Abre `portal_php/public/assets/design-v4/index.html` para testar no navegador.

**Importante:** a V4 é **um protótipo autónomo de demonstração**, não comunica com o backend nem substitui a distribuição completa. Os dados são fictícios e mantidos apenas no navegador. Consulta as [limitações, testes e integração futura](portal_php/public/assets/design-v4/README.md).

---

## Auditoria e próxima evolução

- [Relatório de bugs, alterações e bloqueadores de publicação](AUDITORIA_STOCKCONTROL_V4.md)
- [Prompt técnico completo para desenvolvimento, segurança, design e testes](PROMPT_MELHORIAS_STOCKCONTROL.md)
- [Testes unitários de integridade](tests/stockcontrol_v4_model.test.cjs) e [testes browser Chromium/Playwright](tests/stockcontrol_v4_browser.cjs).
- Os testes correm no [workflow StockControl V4](.github/workflows/stockcontrol-v4.yml); a execução mais recente determina o estado da validação.

**A V4 é apenas um protótipo.** O backend PHP/FastAPI, as migrações e o instalador não estão publicados neste repositório; não é adequado utilizar dados reais de clientes ou apresentar este projeto como SaaS comercial pronto.

---



# StockControl — design V3.0

Pré-visualização interativa do novo design do StockControl. Código em [`portal_php/public/assets/design-v3/`](portal_php/public/assets/design-v3/).

## Abrir

Para avaliar sem PHP, descarrega a pasta `design-v3` e abre `index.html`. Para testar a integração na estrutura StockControl completa, serve a pasta `portal_php/public` com PHP e acede a `/assets/design-v3/index.html`.

**Atenção:** este repositório ainda não contém o backend completo. A V3 é um protótipo com dados fictícios, não altera o stock, a base de dados, a autenticação nem os pagamentos reais. A aplicação completa permanece no ZIP entregue separadamente, até publicação segura e validada dos restantes módulos.

O Figma da versão anterior continua em https://www.figma.com/design/3Aw8l5pj4zRMulNz8LKLln — a V3 ainda não foi sincronizada.
