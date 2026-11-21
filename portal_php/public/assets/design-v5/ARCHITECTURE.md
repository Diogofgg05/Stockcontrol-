# V5 — Arquitetura e decisões técnicas

## Objetivo
Entregar um StockControl utilizável como **demonstração de inventário industrial sem serviços externos**: zero chamadas de API, zero configuração de base de dados, zero dependências JavaScript de execução. Preservar a integridade de saldos e fornecer uma base coerente para futuras funcionalidades offline.

## Princípios
1. **Fonte da verdade:** `model.js` define quantidades, validação, reservas, contagens e indicadores; as páginas apenas apresentam os resultados.
2. **Estado controlado:** um `workspace` em memória, persistido sob `stockcontrol:v5:offline:v1`. O estado anterior é validado antes da migração.
3. **Persistência tolerante a falhas:** comparação do estado guardado para detetar edições entre abas, rollback de comandos inválidos, aviso quando armazenamento falha.
4. **Interações por comandos:** ações de botões em `60-operation-commands.jsfrag`; listeners delegados em `70-event-binding.jsfrag`.
5. **UI consistente:** os componentes visuais em `20-ui-shell.jsfrag` usam tokens e estilos de `styles.css`, sem dependência de React/npm durante a execução.
6. **Resolução local:** backups em `backup.js` aceitam apenas JSON válido e formato/versionamento conhecidos; nenhum dado é enviado a servidores.
7. **Compatibilidade:** `design-v4/` permanece intacto; a V5 tem origem de armazenamento separada.
8. **Build reproduzível:** o artefacto `app.js` é a concatenação exata das oito secções; o CI usa `--check` para detetar divergências.

## Fluxo de dados

```text
CLI build (desenvolvimento)              Navegador
src/*.jsfrag --build--> app.js  --> Eventos / ações
                                   |
                              Validar papel (demo)
                                   |
                              Modelo (model.js)
                                   |
                         Validar workspace integral
                                   |
                 Compare-and-set best effort / localStorage
                                   |
                       Renderização + feedback visual

backup.js: exportBackup / parseBackup
  -> descarregar JSON / restaurar com confirmação
```

## Riscos documentados
- `localStorage` não dá atomicidade entre abas; o compare-and-set é uma mitigação.
- Papéis do frontend não garantem autorização contra um utilizador com acesso ao browser.
- Backups JSON são ficheiros não cifrados; não usar para dados sensíveis.
- Persistência local de longo prazo não é garantida; o browser pode eliminar dados conforme as políticas de armazenamento.
- O tamanho do bundle (`app.js`) ainda concentra o runtime numa IIFE. A divisão em módulos reais será necessária para evolução extensiva, mas implicaria gerir ciclos de dependências e migrar os testes; não é apresentada como feita.
- A interface não substitui um ERP com trilho de auditoria certificado ou controlo transacional multiutilizador.

## Referências de inspiração, não de dependência
- Odoo Inventory: organização por operações e disponibilidade
- ERPNext Stock: movimentos de stock, pedidos, contagens e armazéns
- shadcn/ui: consistência visual, sidebar e data tables
- GitHub Actions/Playwright: QA automatizado do mesmo código apresentado no navegador

## Critérios de integração futura
Não adicionar backend por mera conveniência. Caso o projeto passe a requerer equipas distribuídas, operações simultâneas entre dispositivos, backups centrais, autenticação ou pagamentos, criar uma camada de repositório e sincronização opcional mantendo o núcleo de domínio independente.
