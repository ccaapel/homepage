---
name: corretor-planilha
description: Regras de padronização da planilha de agendamentos do CCAA Pelotas. Use quando o Pedro pedir para revisar, ajustar ou explicar o corretor automático (corretor-planilha.gs) ou o backend do painel (codigo.gs), ou quando pedir para auditar/corrigir a formatação da planilha. Contém TODAS as regras de correção combinadas e mantidas.
---

# Corretor da Planilha — CCAA Pelotas

Memória viva das regras de padronização da planilha de agendamentos. Estas regras
valem para **TODAS as abas** (exceto a aba de relatório e as ignoradas) e para os
**dois caminhos** em que dado entra na planilha:

1. **Corretor automático** — `apps-script/corretor-planilha.gs` (projeto Apps Script
   SEPARADO). Roda sozinho todo dia ~3h E a cada edição na planilha.
2. **Painel de agendamento** — `codigo.gs` (backend do `index.html`). Aplica as
   mesmas regras na hora de salvar, para o dado já nascer no padrão.

> ⚠️ Os dois `.gs` DEVEM ficar em projetos Apps Script separados (senão dá
> conflito de nomes, ex.: `SENHA_ADMIN já declarado`). Não dá para compartilhar
> código entre eles — as regras são duplicadas de propósito e precisam ser
> mantidas em sincronia nos dois arquivos.

## Como o robô roda sozinho (o "controle diário")

Quem dá o controle automático são os **gatilhos** (triggers) do Apps Script, não
uma skill. No projeto do corretor, rodar `instalarGatilhos()` UMA vez cria:
- um gatilho **diário** (~3h, fuso `America/Sao_Paulo`) → `corrigirPlanilha`;
- um gatilho **onChange** → `aoEditarPlanilha`, que roda a cada edição, protegido
  por `CacheService` (no máx. 1x a cada 30s) e `LockService` (nunca 2 ao mesmo tempo).

Esta skill NÃO roda sozinha de madrugada — ela é para uso manual, quando o Pedro
chamar `/corretor-planilha` para revisar regras ou pedir uma auditoria.

## Regras de padronização (a fonte de verdade)

### Estrutura / formatação visual
- **Cabeçalho é a fonte de verdade da estrutura.** O corretor lê as mesclas
  HORIZONTAIS do cabeçalho e replica a MESMA mescla em cada linha de dados
  (`gruposMescla` + `mergeAcross`). Colunas como **Situation** e **Agendado por**
  têm cabeçalho mesclado em 2 colunas → cada linha de dados também fica mesclada
  horizontalmente (uma célula larga, sem "partir ao meio", sem dropdown duplicado).
- **Mescla VERTICAL** (mais de uma linha) é o bug das "células pela metade":
  desfazer e reportar. **Mescla HORIZONTAL** é intencional: preservar/recriar.
- Fonte **Arial 10**, **negrito** (igual às linhas-referência 4/5), `wrap` ligado,
  alinhamento centralizado (vertical e horizontal), borda sólida em toda a área.
- Altura de linha automática (`autoResizeRows`), mínimo 24px.
- **NUNCA tirar o negrito** — todas as linhas de dados ficam em negrito.

### Texto
- **Lessons** e **Situation**: SEMPRE em **MAIÚSCULA** (`.toUpperCase()` no fim).
  Pendente NÃO vira maiúscula (mantém grafia mista).
- Frases canônicas (sempre maiúsculas): `conteúdo do apoio`/`material do apoio`
  → `MATERIAL DO APOIO`; `practice test` → `PRACTICE TEST`.
- Situations soltas: `s1` → `S1`. Grupos por lesson: `L7 (s1,2,3,4) L8 (s1,2)`
  → `L7 (S1,S2,S3,S4) E L8 (S1,S2)`.
- Lessons numéricas: ordenadas, sem repetição, unidas com vírgula e ` E ` no fim
  (`1, 3, 2` → `L1, L2 E L3`).
- Espaços extras das pontas e duplicados são removidos.

### Nomes
- Nome do aluno = primeiro nome + no máx. 1 sobrenome real. Partículas
  (de/da/do/dos/das/e/di/del) contam junto: `Juliana de Bem` → `Juliana de Bem`;
  `Carmem Laura Islabão Moraes` → `Carmem Laura`.

### Listas fixas (só corrige grafia, não o significado)
- Formato: `Equiparação, Apoio, Nivelamento, Prova`.
- Status: `Agendado, Realizado, Faltou, Cancelado, Remarcado`.
- Híbrido: `Presencial, Online, Híbrido`.

### Datas
- `d/m/aaaa` → `dd/mm/aaaa` (zero à esquerda). Data sem ano ou ambígua: NÃO
  inventa, só sinaliza no relatório para revisão manual.

### Ordenação cronológica (REORDENA linhas, NÃO altera horários)
- Linhas com conteúdo são **reordenadas** por Data e depois por Horário.
- É uma ordenação **estável**: empate (mesma data+hora) mantém a ordem original.
- Move a LINHA INTEIRA de posição — nunca reescreve o valor de um horário.
- Linhas sem data válida / em preenchimento vão para o FIM (não atrapalham quem
  está digitando), nunca pulam para o topo.

## Segurança (invariantes que nunca se quebram)
- NUNCA apaga linhas.
- NUNCA mexe na linha de título do topo.
- Toda alteração vai para a aba de relatório `🛠 Correções` com Antes/Depois e
  destaque de QUEM agendou a linha.

## Ao revisar/alterar o corretor
1. Editar SÓ `apps-script/corretor-planilha.gs` (corretor) e/ou `codigo.gs` (painel).
2. Se mudar uma regra de texto, mudar nos DOIS arquivos (eles não compartilham código).
3. Validar sintaxe: copiar para `/tmp/*.js` e `node --check`.
4. Commit + `git push origin <branch-local>:claude/brave-gates-KJ7UD`.
5. Entregar o conteúdo COMPLETO do(s) arquivo(s) para o Pedro colar no Apps Script
   (corretor: rodar `corrigirPlanilha` para testar, `instalarGatilhos` 1x;
   painel: Implantar > Gerenciar implantações > Nova versão).
6. Ensinar no MODO PROFESSOR (analogia → termo PT/EN → onde no código → por que importa).
