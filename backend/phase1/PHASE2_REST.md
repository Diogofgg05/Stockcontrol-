# StockControl — Fase 2.2: restantes páginas administrativas e industriais

Esta atualização continua a aplicação autenticada em `http://127.0.0.1:8000/admin`, sem misturar dados com a demo offline V9.

## Funcionalidades implementadas

- **Movimentos:** histórico paginado e pesquisável, entradas, saídas, devoluções, perdas e transferências, bloqueadas quando o stock não é suficiente.
- **Reservas:** estado por ordem de produção, consumo parcial e cancelamento apenas do restante disponível.
- **Fornecedores:** novo formulário de criação e edição de nome, email e estado; alterações auditáveis; impossibilidade de desativar fornecedores com compras por receber.
- **Compras:** encomendas com até 60 linhas distintas, materiais e quantidades próprias, receções parciais e estados de processamento.
- **Contagens:** comparar contado vs. físico, bloquear contagens desatualizadas, aprovar ou rejeitar com permissões do gestor.
- **Utilizadores:** gestão de perfis, estado e redefinição de palavra-passe; última conta de administração protegida.
- **Armazéns:** criação, edição e indicadores de materiais, stock, estado e encomendas em aberto. Não se pode desativar um local com stock nem compras pendentes.
- **Empresa:** identidade, setor, configuração e notas sobre isolamento de dados.
- **Auditoria:** filtros `action` e `target_type` por empresa **no servidor**, ordenação decrescente, páginas de 40 eventos e CSV da página consultada com neutralização de fórmulas perigosas.
- **Interface:** componentes consistentes de navegação, cartões, estados, tabelas, filtros e modais para desktop e mobile.

## Segurança e integridade

As permissões continuam a ser validadas no servidor. A interface é apenas uma forma de executar operações autorizadas. Nenhum utilizador deve conseguir consultar ou editar dados de outra empresa.

Os identificadores únicos de operações diminuem o risco de registos duplicados. As quantidades são representadas em milésimos inteiros e a API impede saídas abaixo do stock reservado.

## Executar e testar

Seguir a instalação da Fase 2 em `backend/phase1/PHASE2.md`.

```bash
pip install -r backend/phase1/requirements.txt
pip install pytest httpx playwright
python -m pytest -q tests/test_phase1_api.py tests/test_phase2_api.py tests/test_phase2_media.py tests/test_phase2_rest.py
python -m playwright install chromium
python -m pytest -q tests/test_phase1_browser.py tests/test_phase2_browser.py
```

O workflow `.github/workflows/stockcontrol-phase2-rest.yml` automatiza estes testes e arquiva capturas reais do navegador.

## Limitações ainda relevantes

**Esta é uma versão para desenvolvimento e validação; não publicar como SaaS de produção.** Permanecem necessários:

- Migrações Alembic, estratégias de atualização da base de dados e testes de PostgreSQL com concorrência real.
- MFA, TLS obrigatório em deployment, rate limiting distribuído, gestão de segredos e monitorização.
- Backup cifrado com restauro testado, armazenamento de imagens privado e centralizado, quotas e política de retenção RGPD.
- Paginação e pesquisa no servidor para todas as coleções; alguns painéis ainda consultam um máximo de 500 registos, ou 100 movimentos.
- Gestão avançada de lotes e números de série, múltiplas posições dentro do mesmo armazém, formulários de devolução detalhados e aprovação formal de compras.

As fotografias reais dos materiais continuam a ser privadas e opcionais. As ilustrações de categorias não representam necessariamente o material específico.
