// Help text for every printed title/column header (shown only with "Ajuda imediata" on).
// Each entry targets one label in src/labels.json:
//   p: page index, t: exact text, n: which occurrence on that page (sorted top-to-bottom, then left-to-right),
//   w: match a single word instead of a whole PDF text line (for lines that merge several headers).
// test/help.test.js fails if an entry doesn't resolve or a title is left without help.

const SKILL_COST = 'Custo pela dificuldade e nível relativo: Fácil (F) 0=1, +1=2, +2=4, +3=8 pts e depois +4 por nível; '
  + 'Média (M) começa em −1=1; Difícil (D) em −2=1; Muito Difícil (MD) em −3=1.';
const SPEED_RANGE = 'Some a distância (m) e a velocidade do alvo (m/s), procure a medida linear e aplique o modificador correspondente ao ataque. Tabela completa na pág. 550 do Módulo Básico.';
const VITALS = 'Ataques perfurantes podem mirar nos órgãos vitais (−3) ou nos olhos (−9) em vez dos locais da tabela.';

const at = (p, t, h, opts = {}) => ({ p, t, h, n: 0, w: false, ...opts });

export const HELP = [
  // ---------------- Página 1: cabeçalho ----------------
  at(0, 'PLANILHA DE PERSONAGEM', 'Ficha GURPS 4ª edição. Campos azuis são calculados; âmbar = valor digitado sobre o cálculo (apague para recalcular); cinza = não sai no PDF.'),
  at(0, 'Nome', 'Nome do personagem (repetido automaticamente na página 2).'),
  at(0, 'Jogador', 'Nome do jogador.'),
  at(0, 'Total de Pontos', 'Soma dos pontos gastos: atributos, vantagens, desvantagens, perícias e outros. Fica vermelho se passar de "Pontos p/ Gastar".'),
  at(0, 'Altura', 'Altura do personagem. Não afeta cálculos.'),
  at(0, 'Peso', 'Peso corporal do personagem (não é o peso carregado). Não afeta cálculos.'),
  at(0, 'Mod. de Tamanho', 'Modificador de Tamanho (MT): 0 para humanos. Com MT +1 ou mais, o custo de ST e PV recebe desconto de 10% por nível de MT (aplicado automaticamente; máx. 80% somando outros modificadores).'),
  at(0, 'Idade', 'Idade do personagem.'),
  at(0, 'Pontos p/ Gastar', 'Orçamento de pontos da campanha (ex.: 100 ou 150), definido pelo mestre. Não entra na soma do Total de Pontos.'),
  at(0, 'Aparência', 'Descrição física. O nível de Aparência (atraente, feio…) é vantagem/desvantagem e seu modificador vai em Modificadores de Reação.'),

  // ---------------- Atributos ----------------
  at(0, 'ST', 'Força. Padrão 10 (grátis); ±10 pts por nível. Define PV, Base de Carga e dano (GdP/GeB). Clique duas vezes no custo [ ] para aplicar ampliações/limitações.'),
  at(0, 'DX', 'Destreza. Padrão 10 (grátis); ±20 pts por nível. Base das perícias físicas e da Velocidade Básica.'),
  at(0, 'IQ', 'Inteligência. Padrão 10 (grátis); ±20 pts por nível. Base das perícias mentais, Vontade e Percepção.'),
  at(0, 'HT', 'Vitalidade. Padrão 10 (grátis); ±10 pts por nível. Base dos PF e da Velocidade Básica.'),
  at(0, 'PV', 'Pontos de Vida = ST. ±2 pts por PV (normalmente limitado a ±30% da ST).'),
  at(0, 'Vont', 'Vontade = IQ. ±5 pts por nível. Usada em testes de medo, resistência mental e para se manter consciente.'),
  at(0, 'Per', 'Percepção = IQ. ±5 pts por nível. Usada em testes de sentidos (visão, audição…) e perícias de observação.'),
  at(0, 'PF', 'Pontos de Fadiga = HT. ±3 pts por nível. Gastos com esforço extra, magia e cansaço.'),
  at(0, 'ATUAL', 'PV atuais: anote aqui os PV durante a sessão, conforme sofre dano.'),
  at(0, 'ATUAL', 'PF atuais: anote aqui os PF durante a sessão, conforme se cansa.', { n: 1 }),

  // ---------------- Línguas / cultura / RD ----------------
  at(0, 'Línguas', 'Idiomas conhecidos. Cada um tem nível falado e escrito; a língua materna em nível Nativo é grátis. Custo do idioma no colchete.'),
  at(0, 'Falada', 'Nível falado: Nenhum (0), Rudimentar (1), Sotaque (2) ou Nativo (3 pts).'),
  at(0, 'Escrita', 'Nível escrito: Nenhum (0), Rudimentar (1), Sotaque (2) ou Nativo (3 pts).'),
  at(0, 'NT:', 'Nível Tecnológico do personagem. ±5 pts por NT acima ou abaixo do NT da campanha.'),
  at(0, 'Familiaridades Culturais', 'Culturas que o personagem conhece além da sua (grátis): 1 pt cada (2 pts para culturas alienígenas).'),
  at(0, 'RD', 'Resistência a Dano por local do corpo (armadura + RD natural). É subtraída do dano recebido naquele local.'),

  // ---------------- Defesas e reação ----------------
  at(0, 'APARAR', 'Aparar = 3 + NH/2 (arredondado para baixo) da perícia cujo nome está no campo abaixo. Modificador da arma, DB do escudo e Reflexos em Combate não estão incluídos — digite o valor final se precisar.'),
  at(0, 'BLOQUEIO', 'Bloqueio = 3 + NH/2 da perícia Escudo ou Capa escrita no campo abaixo. Some o DB do escudo manualmente.'),
  at(0, 'Modificadores de Reação', 'Bônus e penalidades que afetam como os PdMs reagem ao personagem.'),
  at(0, 'Aparência', 'Nível de Aparência e seu modificador de reação (ex.: Atraente +1).', { n: 1 }),
  at(0, 'Status', 'Posição social. 5 pts por nível; cada nível dá modificador de reação diante de quem o reconhece.'),
  at(0, 'Reputação', 'Fama boa ou má: modificador de reação. O custo depende do modificador, de quem conhece e da frequência com que é reconhecido.'),

  // ---------------- Base de carga / dano / velocidade ----------------
  at(0, 'BASE DE CARGA (ST X ST)/10', 'Base de Carga (BC) em kg = ST × ST / 10, arredondada se ≥ 10. Peso que você ergue acima da cabeça com uma mão em 1 segundo.'),
  at(0, 'DANO GdP', 'Dano de Golpe de Ponta (estocada, soco, chute), pela ST. Some o modificador da arma.'),
  at(0, 'GeB', 'Dano de Golpe em Balanço (golpe girando a arma), pela ST. Some o modificador da arma.'),
  at(0, 'VEL. BÁSICA', 'Velocidade Básica = (DX + HT) / 4, sem arredondar. ±5 pts por 0,25. Define Esquiva e Deslocamento Básico.'),
  at(0, 'DESL. BÁSICO', 'Deslocamento Básico = Velocidade Básica arredondada para baixo (metros por segundo). ±5 pts por metro.'),
  at(0, 'BASE DE CARGA', 'Níveis de carga: compare o peso total carregado (Totais, pág. 2) com os limites abaixo para saber seu nível.'),
  at(0, 'DESLOCAMENTO', 'Deslocamento em cada nível de carga = Deslocamento Básico (DB) × fator, arredondado para baixo.'),
  at(0, 'ESQUIVA', 'Esquiva = Velocidade Básica arredondada para baixo + 3, com −1 por nível de carga. Aumenta comprando Velocidade Básica ou Defesa Aprimorada (Esquiva, 15 pts/nível).'),
  at(0, 'Nenhuma (0) = BC', 'Carga Nenhuma (0): peso carregado até 1 × BC. Deslocamento normal, sem penalidade na Esquiva.'),
  at(0, 'Leve (1) = 2xBC', 'Carga Leve (1): peso carregado até 2 × BC. Deslocamento × 0,8 e Esquiva −1.'),
  at(0, 'Média (2) = 3xBC', 'Carga Média (2): peso carregado até 3 × BC. Deslocamento × 0,6 e Esquiva −2.'),
  at(0, 'Pesada (3) = 6xBC', 'Carga Pesada (3): peso carregado até 6 × BC. Deslocamento × 0,4 e Esquiva −3.'),
  at(0, 'Mto Pesada (4) = 10xBC', 'Carga Muito Pesada (4): peso carregado até 10 × BC. Deslocamento × 0,2 e Esquiva −4.'),
  at(0, 'DB x 1', 'Deslocamento sem carga = Deslocamento Básico.'),
  at(0, 'DB x 0,8', 'Deslocamento com carga Leve = DB × 0,8, arredondado para baixo.'),
  at(0, 'DB x 0,6', 'Deslocamento com carga Média = DB × 0,6, arredondado para baixo.'),
  at(0, 'DB x 0,4', 'Deslocamento com carga Pesada = DB × 0,4, arredondado para baixo.'),
  at(0, 'DB x 0,2', 'Deslocamento com carga Muito Pesada = DB × 0,2, arredondado para baixo.'),
  at(0, 'Esquiva', 'Esquiva sem carga.'),
  at(0, 'Esquiva -1', 'Esquiva com carga Leve (−1).'),
  at(0, 'Esquiva -2', 'Esquiva com carga Média (−2).'),
  at(0, 'Esquiva -3', 'Esquiva com carga Pesada (−3).'),
  at(0, 'Esquiva -4', 'Esquiva com carga Muito Pesada (−4).'),

  // ---------------- Vantagens / desvantagens / perícias ----------------
  at(0, 'VANTAGENS E QUALIDADES', 'Vantagens (custo positivo no colchete) e Qualidades (pequenas vantagens de 1 pt cada).'),
  at(0, 'DESVANTAGENS E PECULIARIDADES', 'Desvantagens (custo negativo — digite com sinal −) e Peculiaridades (−1 pt cada, máx. 5). O Módulo Básico sugere limitar desvantagens a 50% dos pontos iniciais.'),
  at(0, 'PERÍCIAS', `Perícias aprendidas. Preencha nome, atributo + nível relativo e a dificuldade (campo cinza); NH e custo são calculados. ${SKILL_COST}`),
  at(0, 'Nome', 'Nome da perícia. É por este nome que os campos sob APARAR e BLOQUEIO encontram a perícia.', { n: 1 }),
  at(0, 'NH', 'Nível de Habilidade = atributo + nível relativo + bônus (calculado). Clique duas vezes no NH para adicionar bônus, como Talento (+1 por nível); valores manuais ficam fora das regras.'),
  at(0, 'NH Relativo', `Atributo base (ST, DX, IQ, HT, Vont, Per), nível relativo (ex.: +1, −2) e, no campo cinza, a dificuldade F/M/D/MD. ${SKILL_COST}`),

  // ---------------- Página 2 ----------------
  at(1, 'PLANILHA DE PERSONAGEM', 'Página 2: equipamento, tabelas de referência e resumo dos pontos.'),
  at(1, 'Nome', 'Nome do personagem (copiado da página 1).'),
  at(1, 'ARMAS DE COMBATE CORPO A CORPO', 'Armas de combate corpo a corpo e seus dados de jogo.'),
  at(1, 'Arma', 'Nome da arma de combate corpo a corpo.'),
  at(1, 'Dano', 'Dano: GdP ou GeB + modificador da arma e tipo (ex.: GeB+2 cort).'),
  at(1, 'Alcance', 'Alcance em metros: C = contato; 1, 2 ou faixas como 1-2.'),
  at(1, 'Aparar', 'Modificador de aparar da arma: 0, −1, D (desbalanceada: não apara se atacou no turno) ou N (não apara).'),
  at(1, 'Notas', 'Observações: ST mínima, peso, regras especiais.'),
  at(1, 'Custo', 'Preço da arma ($). Somado em Totais.'),
  at(1, 'Peso', 'Peso da arma (kg). Somado em Totais.'),
  at(1, 'ARMAS DE COMBATE À DISTÂNCIA', 'Armas de combate à distância e seus dados de jogo.'),
  at(1, 'Arma', 'Nome da arma de combate à distância.', { n: 1 }),
  at(1, 'Dano', 'Dano e tipo da arma de combate à distância.', { n: 1 }),
  at(1, 'Prec', 'Precisão: bônus somado ao NH depois de um turno de Mirar.'),
  at(1, 'Distância', 'Distância em metros: ½D (a partir dela o dano cai pela metade) / Máx.', { w: true }),
  at(1, 'CdT', 'Cadência de Tiro: quantos disparos por turno.', { w: true }),
  at(1, 'Tiros', 'Tiros antes de recarregar (entre parênteses, os turnos para recarregar).', { w: true }),
  at(1, 'ST', 'ST mínima para usar a arma sem penalidade.', { w: true }),
  at(1, 'Magnitude', 'Magnitude (volume): penalidade ao usar a arma em Mover e Atacar ou em espaços apertados.', { w: true }),
  at(1, 'RCO', 'Recuo: a cada múltiplo do Recuo pelo qual você passa no teste, acerta um disparo a mais (rajadas).', { w: true }),
  at(1, 'CL', 'Classe de Legalidade: de 0 (proibida) a 4 (livre).', { w: true }),
  at(1, 'Notas', 'Observações da arma de combate à distância.', { w: true, n: 1 }),
  at(1, 'Custo', 'Preço da arma ($). Somado em Totais.', { n: 1 }),
  at(1, 'Peso', 'Peso da arma (kg). Somado em Totais.', { n: 1 }),
  at(1, 'TABELA DE VELOCIDADE/', SPEED_RANGE),
  at(1, 'ALCANCE', SPEED_RANGE),
  at(1, 'Tabela completa na pág. 550.', SPEED_RANGE),
  at(1, 'Modificador', 'Modificador de acerto pela medida linear (distância + velocidade do alvo).', { n: 1 }),
  at(1, 'Velocidade/', 'Modificador de acerto pela medida linear (distância + velocidade do alvo).'),
  at(1, 'Alcance', 'Modificador de acerto pela medida linear (distância + velocidade do alvo).', { n: 1 }),
  at(1, 'Medida Linear', 'Distância + velocidade do alvo, em metros. Use a linha igual ou imediatamente maior.'),
  at(1, '(alcance/', 'Distância + velocidade do alvo, em metros. Use a linha igual ou imediatamente maior.'),
  at(1, 'velocidade)', 'Distância + velocidade do alvo, em metros. Use a linha igual ou imediatamente maior.'),
  at(1, 'LOCAL DE ACERTO', 'Penalidade para mirar em partes do corpo. Ataques sem local escolhido atingem o torso.'),
  at(1, 'Modificador', 'Penalidade no teste de ataque para acertar o local.'),
  at(1, 'Local', 'Parte do corpo visada.'),
  at(1, 'Ataques de Per e Pa podem', VITALS),
  at(1, 'visar pontos vitais por -3', VITALS),
  at(1, 'ou olhos por -9', VITALS),
  at(1, 'ARMADURA & POSSES', 'Armaduras e demais posses. O peso total define seu nível de carga (compare com a Base de Carga na página 1).'),
  at(1, 'Item', 'Nome do item, armadura ou equipamento.'),
  at(1, 'Posição', 'Onde o item está: local do corpo (para armaduras) ou onde é carregado (cinto, mochila…).'),
  at(1, 'Custo', 'Preço do item ($). Somado em Totais.', { n: 2 }),
  at(1, 'Peso', 'Peso do item (kg). Somado em Totais.', { n: 2 }),
  at(1, 'Totais:', 'Soma de todos os custos ($) e pesos (kg) da página. O peso total define o nível de carga.'),
  at(1, '$', 'Custo total de armas e posses.'),
  at(1, 'Kgs.', 'Peso total carregado, em kg: compare com a tabela de Base de Carga para achar o nível de carga.'),
  at(1, 'ANOTAÇÕES DO PERSONAGEM', 'Anotações livres: histórico, aliados, objetivos, ferimentos…'),
  at(1, 'RESUMO DOS PONTOS', 'Subtotais de pontos, calculados a partir da página 1. A soma vai para Total de Pontos.'),
  at(1, 'Atributos/Caracterísiticas Secundárias', 'Pontos em ST, DX, IQ, HT, PV, Vontade, Percepção, PF, Velocidade e Deslocamento Básicos.'),
  at(1, 'Vantagens/Qualidades/NT/Idiomas', 'Pontos em vantagens, qualidades, NT, idiomas e familiaridades culturais.'),
  at(1, 'Familiaridade Cultural', 'Pontos em vantagens, qualidades, NT, idiomas e familiaridades culturais.'),
  at(1, 'Desvantagens/Peculiaridades', 'Pontos (negativos) em desvantagens e peculiaridades.'),
  at(1, 'Perícias/Técnicas', 'Pontos em perícias (custo calculado de cada linha da página 1).'),
  at(1, 'Outros', 'Outros gastos de pontos não listados acima (digite o valor). Entra no Total de Pontos.'),
];

// Printed text that is table data or legal notice, not a title — intentionally without help.
export const NOT_TITLES = [
  /^-?\d+$/, /^\d+ m$/, /^2 m ou menos$/, /^\/$/,
  /^(Torso|Braço\/Perna|Virilha|Mão|Rosto|Crânio)$/,
  /^(Você pode copiar esta|planilha para uso|pessoal apenas\.|Esta e outras|planilhas de|GURPS podem|ser baixados no site|www\.devir\.com\.br\/gurps|Copyright © 2004|Steve Jackson Games Incorporated|Todos os direitos reservados)$/,
];

/** Resolves each HELP entry to a rect via labels.json; returns [{ page, x, y, w, h, help }]. Unresolved -> help: null. */
export function resolveHelp(labels, help = HELP) {
  const sorted = (list) => [...list].sort((a, b) => a[0] - b[0] || a[3] - b[3] || a[2] - b[2]);
  const lines = sorted(labels.lines);
  const words = sorted(labels.words);
  return help.map((e) => {
    const hits = (e.w ? words : lines).filter(([p, t]) => p === e.p && t === e.t);
    const hit = hits[e.n];
    if (!hit) return { entry: e, help: null };
    const [page, , x, y, w, h] = hit;
    return { entry: e, page, x, y, w, h, help: e.h };
  });
}
