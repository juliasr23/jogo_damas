// Estabelece a conexão WebSocket com o servidor
const socket = new WebSocket(`ws://${location.host}`);
let playerId = null;

// Lida com mensagens recebidas do servidor
socket.onmessage = (event) => {
    const linha = event.data.trim(); // Remove o '\n' do final da linha
    const partes = linha.split(' '); // Separa a mensagem em partes pelo espaço

    // Mensagem de inicialização (ex: "init 1")
    if (partes[0] === 'init') {
        playerId = parseInt(partes[1]);
        console.log(` Você é o jogador ${playerId}`);
    }

    // Mensagem de movimento recebido (ex: "move 5 0 4 1")
    if (partes[0] === 'move') {
        const move = {
            from: { row: parseInt(partes[1]), col: parseInt(partes[2]) },
            to: { row: parseInt(partes[3]), col: parseInt(partes[4]) }
        };
        console.log(' Movimento recebido:', move);
        applyRemoteMove(move); // Aplica o movimento no tabuleiro
    }
};

// Seletores do DOM
const board = document.getElementById('board');
const score1El = document.getElementById('score1');
const score2El = document.getElementById('score2');
const currentPlayerEl = document.getElementById('currentPlayer');
const currentPlayerPlayer2El = document.getElementById('currentPlayerPlayer2');

// Variáveis do jogo
let currentPlayer = 1;
let score1 = 0, score2 = 0;
let selectedPiece = null;
let mustEndTurn = false;
let gameOver = false;

// Cria o tabuleiro inicial
function createBoard() {
    board.innerHTML = "";
    for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
            const square = document.createElement('div');
            square.classList.add('square', (row + col) % 2 === 0 ? 'dark' : 'light');
            square.dataset.row = row;
            square.dataset.col = col;
            square.addEventListener('click', handleMove);

            // Posiciona as peças dos jogadores
            if ((row + col) % 2 === 0 && row < 3) {
                const piece = document.createElement('div');
                piece.classList.add('piece', 'player2');
                piece.textContent = "O";
                square.appendChild(piece);
            } else if ((row + col) % 2 === 0 && row > 4) {
                const piece = document.createElement('div');
                piece.classList.add('piece', 'player1');
                piece.textContent = "X";
                square.appendChild(piece);
            }

            board.appendChild(square);
        }
    }
}

// Trata os cliques no tabuleiro
function handleMove(e) {
    // Impede jogar fora da vez ou após o fim do jogo
    if (mustEndTurn || gameOver || playerId !== currentPlayer) return;

    const target = e.target;

    // Seleciona a peça se for sua
    if (target.classList.contains('piece') && target.classList.contains(`player${currentPlayer}`)) {
        if (selectedPiece) selectedPiece.classList.remove('selected');
        selectedPiece = target;
        selectedPiece.classList.add('selected');
        highlightMoves(selectedPiece.parentElement); // Destaca as casas válidas
    } 
    // Move a peça se for uma casa válida e vazia
    else if (
        target.classList.contains('dark') &&
        selectedPiece &&
        !target.firstChild &&
        target.classList.contains('highlight')
    ) {
        document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));

        const oldSquare = selectedPiece.parentElement;
        const oldRow = parseInt(oldSquare.dataset.row);
        const oldCol = parseInt(oldSquare.dataset.col);
        const newRow = parseInt(target.dataset.row);
        const newCol = parseInt(target.dataset.col);

        const moved = movePiece(oldRow, oldCol, newRow, newCol);

        if (moved) {
            const mensagem = `move ${oldRow} ${oldCol} ${newRow} ${newCol}\n`;
            console.log(" Enviando para o servidor:", mensagem);
            socket.send(mensagem); // Envia o movimento para o servidor
        }
    }
}

// Lógica para movimentar a peça
function movePiece(oldRow, oldCol, newRow, newCol) {
    const fromSquare = document.querySelector(`[data-row="${oldRow}"][data-col="${oldCol}"]`);
    const toSquare = document.querySelector(`[data-row="${newRow}"][data-col="${newCol}"]`);
    const piece = fromSquare.firstChild;

    if (!piece || toSquare.firstChild) return false;

    const rowDiff = newRow - oldRow;
    const colDiff = newCol - oldCol;
    const isQueen = piece.classList.contains('queen');

    // Movimento simples
    if (!isQueen && Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 1) {
        toSquare.appendChild(piece);
        checkPromotion(piece, newRow);
        endTurn();
        return true;
    }

    // Captura
    if (!isQueen && Math.abs(rowDiff) === 2 && Math.abs(colDiff) === 2) {
        const midRow = (oldRow + newRow) / 2;
        const midCol = (oldCol + newCol) / 2;
        const midSquare = document.querySelector(`[data-row="${midRow}"][data-col="${midCol}"]`);
        const midPiece = midSquare?.firstChild;

        if (midPiece && midPiece.classList.contains(`player${3 - currentPlayer}`)) {
            midSquare.removeChild(midPiece);
            toSquare.appendChild(piece);
            updateScore();
            checkVictory();
            checkPromotion(piece, newRow);
            mustEndTurn = true;
            setTimeout(() => { mustEndTurn = false; if (!gameOver) endTurn(); }, 100);
            return true;
        }
    }

    // Movimento de dama
    if (isQueen) {
        const steps = Math.abs(rowDiff);
        const dx = rowDiff / steps;
        const dy = colDiff / steps;
        let foundEnemy = false;
        let capturedSquare = null;

        for (let i = 1; i < steps; i++) {
            const checkRow = oldRow + dx * i;
            const checkCol = oldCol + dy * i;
            const checkSquare = document.querySelector(`[data-row="${checkRow}"][data-col="${checkCol}"]`);

            if (checkSquare.firstChild) {
                if (checkSquare.firstChild.classList.contains(`player${3 - currentPlayer}`)) {
                    if (foundEnemy) return false;
                    foundEnemy = true;
                    capturedSquare = checkSquare;
                } else {
                    return false;
                }
            }
        }

        if (foundEnemy && capturedSquare) {
            capturedSquare.removeChild(capturedSquare.firstChild);
            toSquare.appendChild(piece);
            updateScore();
            checkVictory();
            checkPromotion(piece, newRow);
            mustEndTurn = true;
            setTimeout(() => { mustEndTurn = false; if (!gameOver) endTurn(); }, 100);
            return true;
        } else if (!foundEnemy) {
            toSquare.appendChild(piece);
            checkPromotion(piece, newRow);
            endTurn();
            return true;
        }
    }

    return false;
}

// Aplica movimento recebido pela rede
function applyRemoteMove(move) {
    movePiece(move.from.row, move.from.col, move.to.row, move.to.col);
}

// Destaca casas válidas para movimentação
function highlightMoves(square) {
    document.querySelectorAll('.highlight').forEach(el => el.classList.remove('highlight'));

    const row = parseInt(square.dataset.row);
    const col = parseInt(square.dataset.col);
    const isQueen = selectedPiece.classList.contains('queen');
    const isPlayer1 = selectedPiece.classList.contains('player1');

    if (!isQueen) {
        const directions = isPlayer1 ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
        directions.forEach(([dx, dy]) => {
            const newRow = row + dx;
            const newCol = col + dy;
            const jumpRow = row + dx * 2;
            const jumpCol = col + dy * 2;

            const midSquare = document.querySelector(`[data-row="${newRow}"][data-col="${newCol}"]`);
            const targetSquare = document.querySelector(`[data-row="${jumpRow}"][data-col="${jumpCol}"]`);

            if (
                midSquare?.firstChild &&
                midSquare.firstChild.classList.contains(`player${3 - currentPlayer}`) &&
                targetSquare &&
                !targetSquare.firstChild
            ) {
                targetSquare.classList.add('highlight');
            }

            const moveSquare = document.querySelector(`[data-row="${newRow}"][data-col="${newCol}"]`);
            if (moveSquare && !moveSquare.firstChild) {
                moveSquare.classList.add('highlight');
            }
        });
        return;
    }

    // Destaca movimentos de dama
    const directions = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
    directions.forEach(([dx, dy]) => {
        let step = 1;
        let foundEnemy = false;

        while (true) {
            const newRow = row + dx * step;
            const newCol = col + dy * step;
            const targetSquare = document.querySelector(`[data-row="${newRow}"][data-col="${newCol}"]`);

            if (!targetSquare || !targetSquare.classList.contains('dark')) break;

            if (!targetSquare.firstChild) {
                if (!foundEnemy || isQueen) {
                    targetSquare.classList.add('highlight');
                } else {
                    break;
                }
            } else {
                const pieceOnPath = targetSquare.firstChild;

                if (pieceOnPath.classList.contains(`player${3 - currentPlayer}`)) {
                    if (foundEnemy) break;
                    foundEnemy = true;
                } else {
                    break;
                }
            }

            step++;
        }
    });
}

// Verifica se peça deve virar dama
function checkPromotion(piece, row) {
    if ((piece.classList.contains('player1') && row === 0) ||
        (piece.classList.contains('player2') && row === 7)) {
        piece.classList.add('queen');
        piece.textContent = "👑";
    }
}

// Atualiza o placar
function updateScore() {
    if (currentPlayer === 1) {
        score1++;
        score1El.textContent = score1;
    } else {
        score2++;
        score2El.textContent = score2;
    }
}

// Verifica se algum jogador venceu
function checkVictory() {
    const pieces = document.querySelectorAll('.piece');
    let player1Count = 0;
    let player2Count = 0;

    pieces.forEach(piece => {
        if (piece.classList.contains('player1')) player1Count++;
        if (piece.classList.contains('player2')) player2Count++;
    });

    if (player1Count === 0) {
        gameOver = true;
        alert("🏆 Jogador 2 venceu!");
        resetGame();
    } else if (player2Count === 0) {
        gameOver = true;
        alert("🏆 Jogador 1 venceu!");
        resetGame();
    }
}

// Alterna a vez entre os jogadores
function endTurn() {
    selectedPiece?.classList.remove('selected');
    selectedPiece = null;

    currentPlayer = 3 - currentPlayer;
    currentPlayerEl.textContent = currentPlayer === 1 ? 'Sim' : 'Não';
    currentPlayerPlayer2El.textContent = currentPlayer === 2 ? 'Sim' : 'Não';
}

// Reinicia o jogo
function resetGame() {
    score1 = 0;
    score2 = 0;
    score1El.textContent = 0;
    score2El.textContent = 0;
    currentPlayer = 1;
    currentPlayerEl.textContent = 'Sim';
    currentPlayerPlayer2El.textContent = 'Não';
    mustEndTurn = false;
    gameOver = false;
    selectedPiece = null;
    createBoard();
}

// Inicializa o jogo ao carregar
createBoard();
currentPlayerEl.textContent = 'Sim';
currentPlayerPlayer2El.textContent = 'Não';
