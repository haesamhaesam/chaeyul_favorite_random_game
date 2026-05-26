const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const STATE_FILE = path.join(__dirname, 'game-state.json');

app.use(express.json({ limit: '5mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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
    prizeImg: null,
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

function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch (e) { console.error('State load error:', e.message); }
  const s = generateLadder();
  saveState(s);
  return s;
}

function saveState(s) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(s));
}

app.get('/api/state', (req, res) => {
  const s = loadState();
  res.json({
    bridges: s.bridges,
    selections: s.selections,
    numLines: s.numLines,
    numRows: s.numRows,
    hasPrize: !!s.prizeImg
  });
});

app.post('/api/prize', (req, res) => {
  const { image } = req.body;
  if (!image) return res.status(400).json({ error: '이미지 데이터가 없습니다.' });
  const s = loadState();
  if (s.selections.length > 0) return res.status(400).json({ error: '이미 게임이 시작되었습니다.' });
  s.prizeImg = image;
  saveState(s);
  res.json({ success: true });
});

app.get('/api/prize', (req, res) => {
  const s = loadState();
  res.json({ image: s.prizeImg });
});

app.post('/api/select', (req, res) => {
  const { name, position } = req.body;
  const s = loadState();
  if (!name || name.trim() === '') return res.status(400).json({ error: '이름을 입력해주세요.' });
  if (position === undefined || position < 0 || position >= s.numLines) return res.status(400).json({ error: '올바른 위치를 선택해주세요.' });
  if (s.selections.find(sel => sel.position === position)) return res.status(400).json({ error: '이미 선택된 위치입니다.' });
  if (s.selections.length >= s.numLines) return res.status(400).json({ error: '모든 자리가 선택되었습니다.' });

  const { path: tracedPath, endCol } = tracePath(s, position);
  const isWinner = endCol === s.winnerIndex;
  const selection = { name: name.trim(), position, endCol, isWinner, path: tracedPath };
  s.selections.push(selection);
  saveState(s);
  res.json({ selection, selections: s.selections });
});

app.post('/api/reset', (req, res) => {
  const s = generateLadder();
  saveState(s);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`사다리타기 게임: http://localhost:${PORT}`);
});
