# Exploração visual de dados de Body Pose

## Resumo

Visualizador 3D de finalizações com dados abertos da SkillCorner. Combina Body Pose e Game Intelligence para reproduzir cada chute com a pose dos jogadores, o rastreamento da bola, a orientação da cabeça do finalizador e um estádio de dois anéis. O explorador em `index.html` mostra:

- **Biblioteca.** Os 60 chutes das duas partidas disponíveis, filtráveis por partida, com gols destacados.
- **Cena 3D.** Poses, bola e cone de visão do finalizador sobre o campo, com câmera livre ou automática.
- **Visão do finalizador.** Uma câmera em primeira pessoa, posicionada na cabeça dele.
- **Reprodução.** Linha do tempo, 25 FPS, velocidades de 0,5×, 1× e 2× e avanço quadro a quadro.

## Estrutura

- `notebooks/00-data_collection.ipynb`: coleta, feita em quatro partes:
  - o download dos arquivos oficiais de Body Pose e Game Intelligence;
  - a seleção das posses que terminam em chute;
  - a compactação dos quadros de pose;
  - a exportação dos lances, do manifesto e da auditoria.

- `data/raw/`: arquivos de origem baixados pelo notebook (não versionados).
- `data/processed/`: tabelas prontas para a análise.
- `docs/`: notas sobre a direção visual do estádio.
- `index.html` e `html/`: visualizador com Three.js (local); os lances e o manifesto ficam em `html/data/`.

### Leitura do front-end

| arquivo                  | responsabilidade                                                    |
| ------------------------ | ------------------------------------------------------------------- |
| `index.html`             | estrutura semântica: abertura, biblioteca de chutes e cena 3D       |
| `html/styles.css`        | tema, componentes e responsividade, na ordem em que aparecem        |
| `html/app.js`            | estado, campo, poses, câmera, reprodução e biblioteca de chutes     |
| `html/stadium.js`        | estádio estático, construído com instâncias                         |
| `html/data/manifest.json`| lista de partidas, jogadores e chutes                               |
| `html/data/clips/`       | um JSON compacto por chute, com os quadros de pose e da bola        |
| `html/vendor/three/`     | cópia local do Three.js e do OrbitControls                          |

## Saídas

| arquivo                                | conteúdo                                                          |
| -------------------------------------- | ----------------------------------------------------------------- |
| `html/data/manifest.json`              | partidas, jogadores e chutes, lidos pelo visualizador             |
| `html/data/clips/<partida>_<evento>.json` | quadros de pose, rastreamento e bola de cada chute             |
| `data/processed/shots.csv`             | uma linha por chute, com jogador, time, gol, posição e cobertura  |
| `data/processed/collection_audit.csv`  | contagens e cobertura da coleta                                   |
