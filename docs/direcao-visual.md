# Direção visual do estádio

## Conceito

O replay continua sendo o protagonista. Um estádio grande e contemporâneo o envolve como um
instrumento espacial discreto: uma arquibancada contínua dá escala, o gramado é a superfície
mais clara e o finalizador, em amarelo, é o único acento visual.

O estádio é estático para que o replay de Body Pose use sozinho o orçamento de movimento.
As partes repetidas são instanciadas para manter poucas chamadas de desenho.

## Arquitetura do estádio

Todas as camadas partem do mesmo contorno de retângulo arredondado. Isso evita as
sobreposições e as emendas que surgem ao unir quatro arquibancadas independentes.

- Área ocupada: cerca de 228 × 190 m, sobre um plano de 260 × 220 m.
- Anel inferior: 14 fileiras contínuas ao redor de uma abertura de 132 × 94 m.
- Esplanada: anel de circulação de cinco metros, com doze portais emoldurados.
- Anel superior: 10 fileiras contínuas nos quatro lados.
- Teto: uma cobertura contínua, levemente inclinada, com centro aberto e colunas externas.
- Iluminação: oito módulos de refletores abertos, de 3 × 6, fixados sob a borda interna do teto; não há torres isoladas.
- Beira do campo: placas de publicidade pretas e foscas, instanciadas, com aberturas nos gols.

Os assentos são abstraídos em peças instanciadas de poucos polígonos. Eles dão escala humana
sem virar uma textura de torcida ruidosa nem distrair do esqueleto das poses. Todos os assentos são
azuis, divididos em seções por corredores neutros.

## Hierarquia de materiais

- Gramado e atores do replay: maior contraste.
- Arquibancada de concreto: cinza quente de baixo contraste.
- Assentos: todos azuis, separados por corredores neutros.
- Teto e colunas: grafite médio sobre uma casca de concreto mais clara.
- Publicidade: quase preto fosco, para emoldurar o campo.
- Iluminação: lentes quentes emissivas dentro de uma moldura aberta de grafite.

## Limites de desempenho

- Reutilizar geometrias e materiais.
- Usar instâncias para assentos, colunas, nervuras do teto, publicidade e módulos de refletores.
- Manter os objetos do estádio estáticos e fora do grupo de atores, que é limpo a cada quadro.
- Não ativar sombras em centenas de assentos.
- Manter o renderizador da visão em primeira pessoa com resolução menor que a do principal.
- Preservar o comportamento de movimento reduzido e a regra de renderizar só quando visível.
