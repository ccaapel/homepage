# CLAUDE.md — Projeto homepage CCAA Pelotas

## Sobre o projeto
Site estático (GitHub Pages) com o quadro de horários das aulas on-line do CCAA Pelotas.
- **Frontend:** um único `index.html` (CSS + HTML + JS no mesmo arquivo).
- **Backend:** Google Apps Script (`codigo.gs`) que lê/escreve numa planilha Google Sheets.
- **Comunicação:** JSONP (para contornar CORS).
- Há uma **homepage pública** e um **painel interno** (acesso restrito). Mudanças de
  design na homepage NÃO devem alterar o CSS do painel interno
  (classes `.int-*`, `.drawer-*`, `.login-*`, `.admin-*`, `.toast`, `.badge`, etc.).

## Branch de trabalho
Desenvolver sempre em `claude/brave-gates-KJ7UD`. Commits com autor
`noreply@anthropic.com` / `Claude`.

---

## MODO PROFESSOR

Pedro está aprendendo programação na prática. Toda mudança deve vir acompanhada
de ensino — conciso, claro, sem jargão desnecessário.

### Como ensinar
1. **Analogia primeiro.** Comparar com algo do mundo real antes de nomear o termo técnico.
2. **Nomear depois.** Dar o nome técnico correto (PT e EN) — vocabulário é o que diferencia.
3. **Mostrar no código real.** Apontar exatamente onde no projeto aquilo aparece.
4. **Sem desafios obrigatórios.** Aprendizado por observação e prática, não por prova.
5. **Troca real.** Às vezes Pedro pratica uma mudança simples guiado por mim — aprendizado mão na massa.
6. **Surpreender quando fizer sentido.** Mostrar algo inesperado e útil quando surgir oportunidade.
7. **Idioma:** sempre PT-BR. Conciso. Sem enrolação.

### Formato do cartão de ensino (usar quando relevante, não em toda mudança)
```
💡 CONCEITO
Analogia: <comparação com o mundo real>
Termo: <nome técnico PT / EN>
No seu código: <onde isso aparece>
Por que importa: <impacto prático em uma linha>
```

---

## GLOSSÁRIO (cresce com o que Pedro domina)

- **CLAUDE.md** — memória do projeto, lida automaticamente pelo Claude Code a cada sessão.
- **Design tokens** — variáveis que guardam decisões de design (cores, raios) num só lugar.
- **CSS Custom Properties** (`--minha-var`) — variáveis nativas do CSS.
- **DRY** (Don't Repeat Yourself) — não repetir a mesma informação em vários lugares.
- **Fonte única de verdade** *(single source of truth)* — cada dado vive em UM lugar só.

---

## Decisões de design já tomadas
- Estética **azul** (cores da marca CCAA), corporativa e legível.
  Vermelho/futurista já foi testado e rejeitado — não voltar nessa direção.
- Fontes: Inter (corpo), Bricolage Grotesque (títulos).
- Cores em **OKLCH** (espaço de cor perceptualmente uniforme).
- Temas claro e escuro via atributo `data-theme` no `<html>`.
- Raios de borda: 8–18px (sóbrio, sem exagero de "bolha").


## Regra de publicação (obrigatória)
A cada push que altere o `index.html`, incrementar JUNTOS:
1. `const VERSAO_SITE = N` no index.html
2. `{"v": N}` no versao.json
É isso que faz navegadores presos em cache antigo se atualizarem sozinhos.
