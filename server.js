const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

let gameState = null;

function generateLadder() {
  const numLines = 5;
  const numRows = 8;
  const bridges = [];
  for (let row = 0; row < numRows; row++) {
    const rowBridges = [];
    for (let col = 0; col < numLines - 1; col++) {
      if (col > 0 && rowBridges[col - 1]) rowBridges.push(false);
      else rowBridges.push(Math.random() > 0.4);
    }
    bridges.push(rowBridges);
  }
  return {
    bridges,
    winnerIndex: Math.floor(Math.random() * numLines),
    selections: [],
    prizeUrl: null,
    numLines,
    numRows
  };
}

function tracePath(state, startCol) {
  const { bridges, numLines } = state;
  let col = startCol;
  const pts = [{ row: -1, col }];
  for (let row = 0; row < bridges.length; row++) {
    pts.push({ row, col });
    if (col > 0 && bridges[row][col - 1]) { col--; pts.push({ row, col }); }
    else if (col < numLines - 1 && bridges[row][col]) { col++; pts.push({ row, col }); }
  }
  pts.push({ row: bridges.length, col });
  return { path: pts, endCol: col };
}

function getState() {
  if (!gameState) gameState = generateLadder();
  return gameState;
}

app.get('/api/state', (req, res) => {
  const s = getState();
  res.json({
    bridges: s.bridges,
    selections: s.selections,
    numLines: s.numLines,
    numRows: s.numRows,
    prizeUrl: s.prizeUrl || null
  });
});

app.post('/api/prize', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL을 입력해주세요.' });
  const s = getState();
  if (s.selections.length > 0) return res.status(400).json({ error: '이미 게임이 시작되었습니다.' });
  s.prizeUrl = url;
  res.json({ success: true });
});

app.post('/api/select', (req, res) => {
  const { name, position } = req.body;
  const s = getState();
  if (!name || name.trim() === '') return res.status(400).json({ error: '이름을 입력해주세요.' });
  if (position === undefined || position < 0 || position >= s.numLines) return res.status(400).json({ error: '올바른 위치를 선택해주세요.' });
  if (s.selections.find(sel => sel.position === position)) return res.status(400).json({ error: '이미 선택된 위치입니다.' });
  if (s.selections.length >= s.numLines) return res.status(400).json({ error: '모든 자리가 선택되었습니다.' });

  const { path: tracedPath, endCol } = tracePath(s, position);
  const isWinner = endCol === s.winnerIndex;
  const selection = { name: name.trim(), position, endCol, isWinner, path: tracedPath };
  s.selections.push(selection);
  const response = { selection, selections: s.selections };
  if (isWinner && s.prizeUrl) response.prizeUrl = s.prizeUrl;
  res.json(response);
});

app.post('/api/reset', (req, res) => {
  gameState = generateLadder();
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`사다리타기 게임: http://localhost:${PORT}`);
});
