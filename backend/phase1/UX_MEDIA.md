# StockControl — Inventário visual e fotografias privadas

## Interface

Esta melhoria acrescenta à **Fase 2 autenticada**:

- Miniaturas de materiais com fotografias reais quando fornecidas pela empresa; sem fotografia, apresenta uma **ilustração original de categoria**, claramente distinguível no título/tooltip.
- Pesquisa por SKU, nome e categoria, filtros por categoria, armazém e situação de stock, ordenação por nome, SKU, custo e quantidade disponível; paginação de 15 linhas.
- Pesquisa rápida nas outras tabelas (quando existem 4 ou mais linhas).
- Formulários de operações abertos em modais nativos `<dialog>`, com Escape, foco automático e fecho ao navegar.
- Formulário de fotografia por material, com pré-visualização e opção para substituir/eliminar. Só Admin/Gestor pode escrever.

**Dados:** cada vista é consultada na API autenticada existente, usando os saldos da empresa. Estes filtros correm no navegador **sobre as primeiras 500 referências devolvidas pela API**; ainda falta implementar paginação e pesquisa no servidor para armazéns grandes.

## Fotografias

- `POST /api/v2/materials/{id}/photo`: upload multipart, apenas Administrador e Gestor.
- `GET /api/v2/materials/{id}/photo`: fotografia privada para utilizadores autenticados da mesma empresa.
- `DELETE /api/v2/materials/{id}/photo`: elimina a fotografia.
- `GET /api/v2/materials` inclui `has_photo` em cada material.
- JPG, PNG e WEBP são aceites, até **4 MB** e **12 megapíxeis**. O servidor valida o conteúdo real, corrige a orientação EXIF, limita a imagem a 1400 píxeis e reencoda em WebP, descartando metadados.
- Os ficheiros são armazenados em `STOCKCONTROL_MEDIA_ROOT` (padrão: `./stockcontrol-media`) fora das pastas de ficheiros estáticos, organizados por UUIDs da empresa e material. **Não os colocar sob `portal_php/public` nem publicá-los na web**.
- Imagens são obtidas através de `fetch` com Bearer token em memória e um Blob URL temporário; nunca ficam públicas por URL estático.

## Testar

```bash
pip install -r backend/phase1/requirements.txt
pip install pytest httpx playwright
python -m pytest -q tests/test_phase1_api.py tests/test_phase2_api.py tests/test_phase2_media.py
python -m playwright install chromium
python -m pytest -q tests/test_phase2_browser.py
```

O workflow `stockcontrol-phase2-ux.yml` testa isolamento multiempresa, rejeição de conteúdo malicioso, reencodificação, UI desktop/mobile, filtros e modais.

## Pendências antes da produção

A funcionalidade é para ambiente de desenvolvimento e validação. Necessita de migrações Alembic para a nova tabela `material_photos`, armazenamento de objetos privado com políticas de retenção/backup, quota por empresa, limites de request no proxy, antivírus quando aplicável, tratamento transacional do ficheiro/metadata, testes de restauro e várias instâncias, revisão RGPD, TLS, MFA e monitorização. A implementação de ficheiros locais não deve ser usada em múltiplos servidores sem armazenamento centralizado.

As ilustrações SVG locais são desenhos genéricos de categorias industriais, **não fotografias reais de peças específicas**.

A Fase 2 permanece separada da antiga demonstração V9 offline.
