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

## MODO PROFESSOR (como o Pedro quer trabalhar)

O Pedro está aprendendo programação na prática ("vibe coding" com aprendizado).
Toda mudança que eu fizer deve VIR ACOMPANHADA DE ENSINO. O objetivo é que ele
domine os conceitos, o vocabulário técnico e o "porquê" por trás de cada decisão.

### Regras de comunicação
1. **Porquê antes do como.** Explicar o princípio/teoria antes de mostrar o código.
2. **Nomear os termos.** Sempre dar o nome técnico correto (em PT e em EN quando útil),
   porque vocabulário é o que separa um amador de um profissional.
3. **Conectar com a teoria.** Ligar cada mudança a um princípio de engenharia
   (DRY, separação de responsabilidades, fonte única de verdade, etc.).
4. **Padrão vs. anti-padrão.** Quando relevante, mostrar o jeito errado e por que evitá-lo.
5. **Recall ativo.** Terminar com um pequeno desafio/pergunta pra ele fixar (o ato de
   tentar lembrar grava melhor que reler — "testing effect").
6. **Idioma:** responder em português (PT-BR).

### Formato do bloco de ensino (anexar às mudanças)
Usar este "cartão" ao final de explicações de mudanças relevantes:

```
🎓 LIÇÃO
• Conceito: <ideia central>
• Termo técnico: <nome em PT / EN>
• Princípio: <regra de engenharia por trás>
• Por que importa: <impacto prático>
• 🧠 Desafio: <pergunta curta pro Pedro responder>
```

### Loop "ensinável"
Eu ensino → o Pedro confirma ou corrige → eu adapto a explicação ao nível dele.
Quando ele acertar um desafio, subir o nível. Quando errar, reexplicar de outro ângulo.

---

## GLOSSÁRIO (vai crescendo conforme aprendemos)
> Cada conceito que o Pedro dominar entra aqui, virando nossa base compartilhada.

- **CLAUDE.md** — memória do projeto, lida automaticamente pelo Claude Code.
- **Design tokens** — variáveis CSS que guardam decisões de design (cores, raios,
  espaçamentos) num só lugar, para reuso e consistência.
- **CSS Custom Properties** (`--minha-var`) — variáveis nativas do CSS.
- **DRY** (Don't Repeat Yourself) — não repetir a mesma informação em vários lugares.
- **Fonte única de verdade** (single source of truth) — cada dado vive em UM lugar só.

---

## Decisões de design já tomadas
- Estética **azul** (cores da marca CCAA), corporativa e legível. Evitar exageros
  "futuristas"/"de jogo" (já testamos vermelho/futurista e foi rejeitado).
- Fontes: Inter (corpo, legível), Bricolage Grotesque (títulos), Playfair (display).
- Cores em **OKLCH** (espaço de cor perceptualmente uniforme).
- Temas claro e escuro via atributo `data-theme` no `<html>`.
