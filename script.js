document.addEventListener('DOMContentLoaded', () => {
    const chessboard = document.getElementById('chessboard');
    const movesContainer = document.getElementById('moves');
    const resetBtn = document.getElementById('reset-btn');
    const undoBtn = document.getElementById('undo-btn');
    const exportBtn = document.getElementById('export-btn');
    const arrowsSvg = document.getElementById('arrows');
    const feedback = document.getElementById('feedback');
    const container = document.querySelector('.container');
    
    let selectedPiece = null;
    let moveHistory = [];
    let boardState = [];
    let touchStartX, touchStartY;
    let currentTurn = 'white'; // Track whose turn it is
    
    // Track pieces that have moved (for castling)
    let piecesHaveMoved = {
        whiteKing: false,
        blackKing: false,
        whiteRookA: false,
        whiteRookH: false,
        blackRookA: false,
        blackRookH: false
    };
    
    // Chess piece Unicode characters
    const pieces = {
        'white': {
            'pawn': '♙',
            'rook': '♖',
            'knight': '♘',
            'bishop': '♗',
            'queen': '♕',
            'king': '♔'
        },
        'black': {
            'pawn': '♟',
            'rook': '♜',
            'knight': '♞',
            'bishop': '♝',
            'queen': '♛',
            'king': '♚'
        }
    };
    
    // Initialize the board
    function initializeBoard() {
        chessboard.innerHTML = '';
        boardState = [];
        currentTurn = 'white'; // Reset to white's turn
        
        // Reset pieces moved tracking
        piecesHaveMoved = {
            whiteKing: false,
            blackKing: false,
            whiteRookA: false,
            whiteRookH: false,
            blackRookA: false,
            blackRookH: false
        };
        
        // Create the squares and initial pieces
        for (let row = 0; row < 8; row++) {
            boardState[row] = [];
            for (let col = 0; col < 8; col++) {
                const square = document.createElement('div');
                square.classList.add('square');
                square.classList.add((row + col) % 2 === 0 ? 'white' : 'black');
                square.dataset.row = row;
                square.dataset.col = col;
                
                // Add pieces to their initial positions
                let piece = null;
                
                if (row === 1) {
                    piece = createPiece('black', 'pawn', row, col);
                } else if (row === 6) {
                    piece = createPiece('white', 'pawn', row, col);
                } else if (row === 0 || row === 7) {
                    const color = row === 0 ? 'black' : 'white';
                    let type;
                    
                    if (col === 0 || col === 7) {
                        type = 'rook';
                    } else if (col === 1 || col === 6) {
                        type = 'knight';
                    } else if (col === 2 || col === 5) {
                        type = 'bishop';
                    } else if (col === 3) {
                        type = 'queen';
                    } else if (col === 4) {
                        type = 'king';
                    }
                    
                    piece = createPiece(color, type, row, col);
                }
                
                if (piece) {
                    square.appendChild(piece);
                    boardState[row][col] = {
                        color: piece.dataset.color,
                        type: piece.dataset.type
                    };
                } else {
                    boardState[row][col] = null;
                }
                
                chessboard.appendChild(square);
            }
        }
        
        // Clear move history
        moveHistory = [];
        clearArrows();
        updateMoveHistory();
        updateTurnIndicator();
    }
    
    // Create a chess piece element
    function createPiece(color, type, row, col) {
        const piece = document.createElement('div');
        piece.classList.add('piece');
        piece.dataset.color = color;
        piece.dataset.type = type;
        piece.dataset.row = row;
        piece.dataset.col = col;
        piece.innerHTML = pieces[color][type];
        
        // Add drag functionality
        piece.draggable = true;
        piece.addEventListener('dragstart', dragStart);
        
        // Add touch functionality for mobile
        piece.addEventListener('touchstart', touchStart, { passive: false });
        piece.addEventListener('touchmove', touchMove, { passive: false });
        piece.addEventListener('touchend', touchEnd);
        
        return piece;
    }
    
    // Drag and drop functionality
    function dragStart(e) {
        // Check if it's this player's turn
        const pieceColor = e.target.dataset.color;
        if (pieceColor !== currentTurn) {
            e.preventDefault();
            showFeedback('invalid');
            return false;
        }
        
        selectedPiece = e.target;
        e.target.classList.add('dragging');
        
        // Add a small delay to make the dragged piece semi-transparent
        setTimeout(() => {
            e.target.style.display = 'none';
        }, 0);
    }
    
    // Touch functionality for mobile
    function touchStart(e) {
        // Check if it's this player's turn
        const pieceColor = e.target.dataset.color;
        if (pieceColor !== currentTurn) {
            showFeedback('invalid');
            return;
        }
        
        e.preventDefault();
        selectedPiece = e.target;
        
        const touch = e.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        
        selectedPiece.classList.add('dragging');
    }
    
    function touchMove(e) {
        e.preventDefault();
        if (!selectedPiece) return;
        
        const touch = e.touches[0];
        const offsetX = touch.clientX - touchStartX;
        const offsetY = touch.clientY - touchStartY;
        
        selectedPiece.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
    }
    
    function touchEnd(e) {
        if (!selectedPiece) return;
        
        selectedPiece.classList.remove('dragging');
        selectedPiece.style.transform = '';
        
        const touch = e.changedTouches[0];
        const square = findDropSquare(touch.clientX, touch.clientY);
        
        if (square) {
            const fromRow = parseInt(selectedPiece.dataset.row);
            const fromCol = parseInt(selectedPiece.dataset.col);
            const toRow = parseInt(square.dataset.row);
            const toCol = parseInt(square.dataset.col);
            
            // Make the move
            makeMove(fromRow, fromCol, toRow, toCol);
        }
        
        selectedPiece = null;
    }
    
    // Handle drag over
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
    });
    
    // Handle drop
    document.addEventListener('drop', (e) => {
        e.preventDefault();
        
        if (!selectedPiece) return;
        
        selectedPiece.style.display = 'flex';
        selectedPiece.classList.remove('dragging');
        
        // Find the square that was dropped on
        const square = findDropSquare(e.clientX, e.clientY);
        
        if (square) {
            const fromRow = parseInt(selectedPiece.dataset.row);
            const fromCol = parseInt(selectedPiece.dataset.col);
            const toRow = parseInt(square.dataset.row);
            const toCol = parseInt(square.dataset.col);
            
            // Make the move
            makeMove(fromRow, fromCol, toRow, toCol);
        }
        
        selectedPiece = null;
    });
    
    // Find the square at the given coordinates
    function findDropSquare(x, y) {
        const elements = document.elementsFromPoint(x, y);
        for (const element of elements) {
            if (element.classList.contains('square')) {
                return element;
            }
        }
        return null;
    }
    
    // Check if a move is valid
    function isValidMove(fromRow, fromCol, toRow, toCol) {
        const piece = boardState[fromRow][fromCol];
        if (!piece) return false;
        
        const pieceType = piece.type;
        const pieceColor = piece.color;
        
        // Check if destination has a piece of the same color
        if (boardState[toRow][toCol] && boardState[toRow][toCol].color === pieceColor) {
            return false;
        }
        
        // Movement rules for each piece type
        switch (pieceType) {
            case 'pawn':
                // Direction depends on color
                const direction = pieceColor === 'white' ? -1 : 1;
                
                // Forward movement (no capture)
                if (fromCol === toCol && !boardState[toRow][toCol]) {
                    // Single square forward
                    if (toRow === fromRow + direction) {
                        return true;
                    }
                    // Double square forward from starting position
                    if ((pieceColor === 'white' && fromRow === 6 && toRow === 4) || 
                        (pieceColor === 'black' && fromRow === 1 && toRow === 3)) {
                        // Check if path is clear
                        if (!boardState[fromRow + direction][fromCol]) {
                            return true;
                        }
                    }
                }
                
                // Diagonal capture
                if (Math.abs(fromCol - toCol) === 1 && toRow === fromRow + direction) {
                    if (boardState[toRow][toCol] && boardState[toRow][toCol].color !== pieceColor) {
                        return true;
                    }
                    // TODO: En passant
                }
                
                return false;
                
            case 'rook':
                // Rooks move horizontally or vertically
                if (fromRow !== toRow && fromCol !== toCol) {
                    return false;
                }
                
                // Check if path is clear
                return isPathClear(fromRow, fromCol, toRow, toCol);
                
            case 'knight':
                // Knights move in an L-shape
                return (Math.abs(fromRow - toRow) === 2 && Math.abs(fromCol - toCol) === 1) ||
                       (Math.abs(fromRow - toRow) === 1 && Math.abs(fromCol - toCol) === 2);
                
            case 'bishop':
                // Bishops move diagonally
                if (Math.abs(fromRow - toRow) !== Math.abs(fromCol - toCol)) {
                    return false;
                }
                
                // Check if path is clear
                return isPathClear(fromRow, fromCol, toRow, toCol);
                
            case 'queen':
                // Queens move like rooks or bishops
                if (fromRow === toRow || fromCol === toCol || 
                    Math.abs(fromRow - toRow) === Math.abs(fromCol - toCol)) {
                    // Check if path is clear
                    return isPathClear(fromRow, fromCol, toRow, toCol);
                }
                return false;
                
            case 'king':
                // Normal king move (one square in any direction)
                if (Math.abs(fromRow - toRow) <= 1 && Math.abs(fromCol - toCol) <= 1) {
                    return true;
                }
                
                // Castling
                if (fromRow === toRow && Math.abs(fromCol - toCol) === 2) {
                    // Check if king has moved
                    if ((pieceColor === 'white' && piecesHaveMoved.whiteKing) ||
                        (pieceColor === 'black' && piecesHaveMoved.blackKing)) {
                        return false;
                    }
                    
                    // Kingside castling
                    if (toCol > fromCol) {
                        // Check if rook has moved
                        if ((pieceColor === 'white' && piecesHaveMoved.whiteRookH) ||
                            (pieceColor === 'black' && piecesHaveMoved.blackRookH)) {
                            return false;
                        }
                        
                        // Check if path is clear
                        return isPathClear(fromRow, fromCol, toRow, 7);
                    }
                    // Queenside castling
                    else {
                        // Check if rook has moved
                        if ((pieceColor === 'white' && piecesHaveMoved.whiteRookA) ||
                            (pieceColor === 'black' && piecesHaveMoved.blackRookA)) {
                            return false;
                        }
                        
                        // Check if path is clear
                        return isPathClear(fromRow, fromCol, toRow, 0);
                    }
                }
                
                return false;
        }
        
        return false;
    }
    
    // Check if the path between two squares is clear
    function isPathClear(fromRow, fromCol, toRow, toCol) {
        const rowStep = fromRow === toRow ? 0 : (toRow > fromRow ? 1 : -1);
        const colStep = fromCol === toCol ? 0 : (toCol > fromCol ? 1 : -1);
        
        let row = fromRow + rowStep;
        let col = fromCol + colStep;
        
        while (row !== toRow || col !== toCol) {
            if (boardState[row][col]) {
                return false;
            }
            
            row += rowStep;
            col += colStep;
        }
        
        return true;
    }
    
    // Make a move
    function makeMove(fromRow, fromCol, toRow, toCol) {
        // Get the piece being moved
        const piece = boardState[fromRow][fromCol];
        if (!piece) return;
        
        // Ensure it's the correct player's turn
        if (piece.color !== currentTurn) {
            showFeedback('invalid');
            return;
        }
        
        // Check if the move is valid
        if (!isValidMove(fromRow, fromCol, toRow, toCol)) {
            showFeedback('invalid');
            return;
        }
        
        // Check for castling
        let castling = null;
        if (piece.type === 'king' && Math.abs(fromCol - toCol) === 2) {
            // Kingside castling
            if (toCol > fromCol) {
                castling = 'kingside';
                // Move the rook too
                const rookCol = 7;
                const rookToCol = toCol - 1; // Place rook to the left of king
                
                // Update board state for rook
                boardState[toRow][rookToCol] = boardState[toRow][rookCol];
                boardState[toRow][rookCol] = null;
                
                // Update DOM for rook
                const squares = document.querySelectorAll('.square');
                const rookSquare = [...squares].find(sq => 
                    parseInt(sq.dataset.row) === toRow && 
                    parseInt(sq.dataset.col) === rookCol
                );
                const rookToSquare = [...squares].find(sq => 
                    parseInt(sq.dataset.row) === toRow && 
                    parseInt(sq.dataset.col) === rookToCol
                );
                
                const rookElement = rookSquare.querySelector('.piece');
                rookSquare.removeChild(rookElement);
                rookElement.dataset.row = toRow;
                rookElement.dataset.col = rookToCol;
                rookToSquare.appendChild(rookElement);
            } 
            // Queenside castling
            else {
                castling = 'queenside';
                // Move the rook too
                const rookCol = 0;
                const rookToCol = toCol + 1; // Place rook to the right of king
                
                // Update board state for rook
                boardState[toRow][rookToCol] = boardState[toRow][rookCol];
                boardState[toRow][rookCol] = null;
                
                // Update DOM for rook
                const squares = document.querySelectorAll('.square');
                const rookSquare = [...squares].find(sq => 
                    parseInt(sq.dataset.row) === toRow && 
                    parseInt(sq.dataset.col) === rookCol
                );
                const rookToSquare = [...squares].find(sq => 
                    parseInt(sq.dataset.row) === toRow && 
                    parseInt(sq.dataset.col) === rookToCol
                );
                
                const rookElement = rookSquare.querySelector('.piece');
                rookSquare.removeChild(rookElement);
                rookElement.dataset.row = toRow;
                rookElement.dataset.col = rookToCol;
                rookToSquare.appendChild(rookElement);
            }
            
            // Update castling availability
            if (piece.color === 'white') {
                piecesHaveMoved.whiteKing = true;
            } else {
                piecesHaveMoved.blackKing = true;
            }
        }
        
        // Check for pawn promotion
        let promotion = null;
        if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
            promotion = promptPromotion(piece.color);
        }
        
        // Check if there's a piece at the target square (capture)
        const targetPiece = boardState[toRow][toCol];
        
        // Don't allow capturing own pieces
        if (targetPiece && targetPiece.color === piece.color) return;
        
        // Update board state
        boardState[toRow][toCol] = promotion ? 
            { color: piece.color, type: promotion } : 
            { color: piece.color, type: piece.type };
        boardState[fromRow][fromCol] = null;
        
        // Update the DOM
        const squares = document.querySelectorAll('.square');
        const fromSquare = [...squares].find(sq => 
            parseInt(sq.dataset.row) === fromRow && 
            parseInt(sq.dataset.col) === fromCol
        );
        
        const toSquare = [...squares].find(sq => 
            parseInt(sq.dataset.row) === toRow && 
            parseInt(sq.dataset.col) === toCol
        );
        
        // Remove captured piece if any
        if (targetPiece) {
            const capturedPiece = toSquare.querySelector('.piece');
            if (capturedPiece) {
                toSquare.removeChild(capturedPiece);
            }
        }
        
        // Move the piece
        const pieceElement = fromSquare.querySelector('.piece');
        fromSquare.removeChild(pieceElement);
        
        // If promotion, create a new piece
        if (promotion) {
            const promotedPiece = createPiece(piece.color, promotion, toRow, toCol);
            toSquare.appendChild(promotedPiece);
        } else {
            pieceElement.dataset.row = toRow;
            pieceElement.dataset.col = toCol;
            toSquare.appendChild(pieceElement);
        }
        
        // Update tracking for castling
        if (piece.type === 'king') {
            if (piece.color === 'white') {
                piecesHaveMoved.whiteKing = true;
            } else {
                piecesHaveMoved.blackKing = true;
            }
        } else if (piece.type === 'rook') {
            if (piece.color === 'white') {
                if (fromCol === 0) piecesHaveMoved.whiteRookA = true;
                if (fromCol === 7) piecesHaveMoved.whiteRookH = true;
            } else {
                if (fromCol === 0) piecesHaveMoved.blackRookA = true;
                if (fromCol === 7) piecesHaveMoved.blackRookH = true;
            }
        }
        
        // Record the move
        const move = {
            from: { row: fromRow, col: fromCol },
            to: { row: toRow, col: toCol },
            color: piece.color,
            piece: piece.type,
            capture: targetPiece ? targetPiece.type : null,
            castling: castling,
            promotion: promotion
        };
        
        moveHistory.push(move);
        
        // Switch turns
        currentTurn = currentTurn === 'white' ? 'black' : 'white';
        
        updateMoveHistory();
        updateArrows();
        updateTurnIndicator();
        showFeedback('valid');
    }
    
    // Add function to prompt for promotion piece
    function promptPromotion(color) {
        const options = ['queen', 'rook', 'bishop', 'knight'];
        const choice = prompt('Promote pawn to: queen, rook, bishop, or knight', 'queen');
        
        if (options.includes(choice.toLowerCase())) {
            return choice.toLowerCase();
        }
        return 'queen'; // Default to queen if invalid choice
    }
    
    // Update turn indicator
    function updateTurnIndicator() {
        // Update background color based on current turn
        document.body.className = ''; // Clear existing classes
        document.body.classList.add(`${currentTurn}-turn`);
        
        // You could add a visual indicator here if desired
        document.title = `Chess Recorder - ${currentTurn.charAt(0).toUpperCase() + currentTurn.slice(1)}'s Turn`;
    }
    
    // Show feedback for valid/invalid moves
    function showFeedback(type) {
        feedback.className = 'feedback';
        feedback.classList.add(type);
        feedback.style.opacity = '1';
        
        setTimeout(() => {
            feedback.style.opacity = '0';
        }, 500);
    }
    
    // Update the move history display with colored boxes
    function updateMoveHistory() {
        movesContainer.innerHTML = '';
        
        for (let i = 0; i < moveHistory.length; i += 2) {
            const moveNumber = Math.floor(i / 2) + 1;
            const whiteMove = moveHistory[i];
            const blackMove = i + 1 < moveHistory.length ? moveHistory[i + 1] : null;
            
            const movePair = document.createElement('div');
            movePair.classList.add('move-pair');
            
            const numberSpan = document.createElement('span');
            numberSpan.classList.add('move-number');
            numberSpan.textContent = `${moveNumber}.`;
            
            const whiteMoveSpan = document.createElement('span');
            whiteMoveSpan.classList.add('move');
            
            // Add specific classes based on move type
            whiteMoveSpan.classList.add('white-move');
            if (whiteMove.capture) whiteMoveSpan.classList.add('capture-move');
            if (whiteMove.castling) whiteMoveSpan.classList.add('castling-move');
            if (whiteMove.promotion) whiteMoveSpan.classList.add('promotion-move');
            
            whiteMoveSpan.textContent = formatMoveChessCom(whiteMove);
            
            movePair.appendChild(numberSpan);
            movePair.appendChild(whiteMoveSpan);
            
            if (blackMove) {
                const blackMoveSpan = document.createElement('span');
                blackMoveSpan.classList.add('move');
                
                // Add specific classes based on move type
                blackMoveSpan.classList.add('black-move');
                if (blackMove.capture) blackMoveSpan.classList.add('capture-move');
                if (blackMove.castling) blackMoveSpan.classList.add('castling-move');
                if (blackMove.promotion) blackMoveSpan.classList.add('promotion-move');
                
                blackMoveSpan.textContent = formatMoveChessCom(blackMove);
                movePair.appendChild(blackMoveSpan);
            }
            
            movesContainer.appendChild(movePair);
        }
        
        // Scroll to the bottom
        movesContainer.scrollTop = movesContainer.scrollHeight;
    }
    
    // Format a move in chess.com style notation
    function formatMoveChessCom(move) {
        if (!move) return '';
        
        const files = 'abcdefgh';
        const ranks = '87654321';
        
        const fromSquare = files[move.from.col] + ranks[move.from.row];
        const toSquare = files[move.to.col] + ranks[move.to.row];
        
        let notation = '';
        
        // Special case for castling
        if (move.castling) {
            return move.castling === 'kingside' ? 'O-O' : 'O-O-O';
        }
        
        // Add piece letter (except for pawns)
        if (move.piece !== 'pawn') {
            notation += move.piece.charAt(0).toUpperCase();
        }
        
        // Add from square
        notation += fromSquare;
        
        // Add capture symbol if applicable
        if (move.capture) {
            notation += 'x';
        } else {
            notation += '-';
        }
        
        // Add to square
        notation += toSquare;
        
        // Add promotion if applicable
        if (move.promotion) {
            notation += '=' + move.promotion.charAt(0).toUpperCase();
        }
        
        return notation;
    }
    
    // Update the arrows showing recent moves
    function updateArrows() {
        clearArrows();
        
        // Get white and black moves separately
        const whiteMoves = moveHistory.filter(move => move.color === 'white');
        const blackMoves = moveHistory.filter(move => move.color === 'black');
        
        // Show up to the last 3 moves for each player
        const lastWhiteMoves = whiteMoves.slice(-3);
        const lastBlackMoves = blackMoves.slice(-3);
        
        // Draw white moves (blue arrows)
        lastWhiteMoves.forEach((move, index) => {
            const opacity = 0.5 + ((index / lastWhiteMoves.length) * 0.5); // Newer moves are more opaque
            drawArrow(move.from.row, move.from.col, move.to.row, move.to.col, '#0000ff', opacity);
        });
        
        // Draw black moves (red arrows)
        lastBlackMoves.forEach((move, index) => {
            const opacity = 0.5 + ((index / lastBlackMoves.length) * 0.5); // Newer moves are more opaque
            drawArrow(move.from.row, move.from.col, move.to.row, move.to.col, '#ff0000', opacity);
        });
    }
    
    // Clear all arrows
    function clearArrows() {
        arrowsSvg.innerHTML = '';
    }
    
    // Draw an arrow from one square to another
    function drawArrow(fromRow, fromCol, toRow, toCol, color, opacity) {
        const squareSize = chessboard.clientWidth / 8;
        
        // Calculate center points of the squares
        const fromX = (fromCol + 0.5) * squareSize;
        const fromY = (fromRow + 0.5) * squareSize;
        const toX = (toCol + 0.5) * squareSize;
        const toY = (toRow + 0.5) * squareSize;
        
        // Calculate the angle for the arrowhead
        const angle = Math.atan2(toY - fromY, toX - fromX);
        
        // Create the arrow line
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', fromX);
        line.setAttribute('y1', fromY);
        line.setAttribute('x2', toX);
        line.setAttribute('y2', toY);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '3');
        line.setAttribute('opacity', opacity);
        
        // Create the arrowhead
        const arrowSize = 10;
        const arrowhead = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const point1X = toX - arrowSize * Math.cos(angle - Math.PI / 6);
        const point1Y = toY - arrowSize * Math.sin(angle - Math.PI / 6);
        const point2X = toX - arrowSize * Math.cos(angle + Math.PI / 6);
        const point2Y = toY - arrowSize * Math.sin(angle + Math.PI / 6);
        
        arrowhead.setAttribute('points', `${toX},${toY} ${point1X},${point1Y} ${point2X},${point2Y}`);
        arrowhead.setAttribute('fill', color);
        arrowhead.setAttribute('opacity', opacity);
        
        // Add to SVG
        arrowsSvg.appendChild(line);
        arrowsSvg.appendChild(arrowhead);
    }
    
    // Reset the game
    resetBtn.addEventListener('click', () => {
        initializeBoard();
    });
    
    // Undo the last move
    undoBtn.addEventListener('click', () => {
        if (moveHistory.length === 0) return;
        
        const lastMove = moveHistory.pop();
        const { from, to, color, piece, capture } = lastMove;
        
        // Update board state
        boardState[from.row][from.col] = { color, type: piece };
        
        if (capture) {
            // If it was a capture, restore the captured piece
            const capturedColor = color === 'white' ? 'black' : 'white';
            boardState[to.row][to.col] = { color: capturedColor, type: capture };
        } else {
            boardState[to.row][to.col] = null;
        }
        
        // Update the DOM
        const squares = document.querySelectorAll('.square');
        const fromSquare = [...squares].find(sq => 
            parseInt(sq.dataset.row) === from.row && 
            parseInt(sq.dataset.col) === from.col
        );
        
        const toSquare = [...squares].find(sq => 
            parseInt(sq.dataset.row) === to.row && 
            parseInt(sq.dataset.col) === to.col
        );
        
        // Move the piece back
        const pieceElement = toSquare.querySelector('.piece');
        toSquare.removeChild(pieceElement);
        pieceElement.dataset.row = from.row;
        pieceElement.dataset.col = from.col;
        fromSquare.appendChild(pieceElement);
        
        // If it was a capture, restore the captured piece
        if (capture) {
            const capturedColor = color === 'white' ? 'black' : 'white';
            const capturedPiece = createPiece(capturedColor, capture, to.row, to.col);
            toSquare.appendChild(capturedPiece);
        }
        
        // Switch turn back
        currentTurn = color;
        
        updateMoveHistory();
        updateArrows();
        updateTurnIndicator();
    });
    
    // Export move history as PNG
    exportBtn.addEventListener('click', () => {
        if (moveHistory.length === 0) {
            alert('No moves to export!');
            return;
        }
        
        // Create a temporary div to render the move history
        const exportDiv = document.createElement('div');
        exportDiv.className = 'export-container';
        
        // Add a title
        const title = document.createElement('h2');
        title.textContent = 'Chess Game Move History';
        exportDiv.appendChild(title);
        
        // Add date and time
        const dateTime = document.createElement('p');
        const now = new Date();
        dateTime.textContent = `Recorded on ${now.toLocaleDateString()} at ${now.toLocaleTimeString()}`;
        exportDiv.appendChild(dateTime);
        
        // Add move history
        const movesList = document.createElement('div');
        movesList.className = 'export-moves';
        
        for (let i = 0; i < moveHistory.length; i += 2) {
            const moveNumber = Math.floor(i / 2) + 1;
            const whiteMove = moveHistory[i];
            const blackMove = i + 1 < moveHistory.length ? moveHistory[i + 1] : null;
            
            const moveEntry = document.createElement('div');
            moveEntry.className = 'export-move-entry';
            
            const numberSpan = document.createElement('span');
            numberSpan.className = 'export-move-number';
            numberSpan.textContent = `${moveNumber}.`;
            
            const whiteMoveSpan = document.createElement('span');
            whiteMoveSpan.className = 'export-move white-move';
            if (whiteMove.capture) whiteMoveSpan.classList.add('capture-move');
            if (whiteMove.castling) whiteMoveSpan.classList.add('castling-move');
            if (whiteMove.promotion) whiteMoveSpan.classList.add('promotion-move');
            whiteMoveSpan.textContent = formatMoveChessCom(whiteMove);
            
            moveEntry.appendChild(numberSpan);
            moveEntry.appendChild(whiteMoveSpan);
            
            if (blackMove) {
                const blackMoveSpan = document.createElement('span');
                blackMoveSpan.className = 'export-move black-move';
                if (blackMove.capture) blackMoveSpan.classList.add('capture-move');
                if (blackMove.castling) blackMoveSpan.classList.add('castling-move');
                if (blackMove.promotion) blackMoveSpan.classList.add('promotion-move');
                blackMoveSpan.textContent = formatMoveChessCom(blackMove);
                moveEntry.appendChild(blackMoveSpan);
            }
            
            movesList.appendChild(moveEntry);
        }
        
        exportDiv.appendChild(movesList);
        
        // Add to document temporarily (hidden)
        exportDiv.style.position = 'absolute';
        exportDiv.style.left = '-9999px';
        document.body.appendChild(exportDiv);
        
        // Use html2canvas to convert to image
        html2canvas(exportDiv, {
            backgroundColor: '#f8f8f8',
            scale: 2, // Higher resolution
            logging: false,
            width: 500,
            height: Math.min(800, 100 + moveHistory.length * 25)
        }).then(canvas => {
            // Convert to PNG and download
            const link = document.createElement('a');
            link.download = `chess-moves-${Date.now()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            // Clean up
            document.body.removeChild(exportDiv);
        }).catch(err => {
            console.error('Error generating image:', err);
            alert('Failed to generate image. Please try again.');
            document.body.removeChild(exportDiv);
        });
    });
    
    // Add this function to your existing code
    function handleOrientationChange() {
        // Recalculate board size if needed
        const gameContainer = document.querySelector('.game-container');
        const chessboard = document.querySelector('.chessboard');
        
        if (window.matchMedia("(max-width: 900px) and (orientation: landscape)").matches) {
            // In landscape mode on mobile
            const containerHeight = gameContainer.clientHeight;
            const boardSize = Math.min(containerHeight * 0.9, gameContainer.clientWidth * 0.9);
            chessboard.style.width = `${boardSize}px`;
            chessboard.style.height = `${boardSize}px`;
        } else {
            // Reset to default if not in landscape
            chessboard.style.width = '';
            chessboard.style.height = '';
        }
    }

    // Add event listeners for orientation changes
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    // Call once on page load
    document.addEventListener('DOMContentLoaded', function() {
        // ... existing initialization code ...
        handleOrientationChange();
    });
}); 