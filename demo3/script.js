document.addEventListener('DOMContentLoaded', () => {
    const chessboard = document.getElementById('chessboard');
    const movesContainer = document.getElementById('moves');
    const resetBtn = document.getElementById('reset-btn');
    const undoBtn = document.getElementById('undo-btn');
    const exportBtn = document.getElementById('export-btn');
    const arrowsSvg = document.getElementById('arrows');
    const feedback = document.getElementById('feedback');
    const container = document.querySelector('.container');
    const permissionOverlay = document.getElementById('permission-overlay');
    const permissionOkBtn = document.getElementById('permission-ok');
    const decibelMeter = document.getElementById('decibel-meter');
    const decibelThreshold = document.getElementById('decibel-threshold');
    const pauseBtn = document.getElementById('pause-btn');
    
    let selectedPiece = null;
    let moveHistory = [];
    let boardState = [];
    let touchStartX, touchStartY;
    let currentTurn = 'white'; // Track whose turn it is
    let isPaused = false; // Track if voice recognition is paused
    
    // Audio analysis variables
    let audioContext = null;
    let analyser = null;
    let microphone = null;
    let javascriptNode = null;
    let audioVolume = 0;
    let volumeThreshold = 15; // Threshold for trigger detection (in dB)
    
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
    
    // Add speech recognition functionality
    let recognition = null;
    let isListening = false;
    let triggerWord = "mark"; // Default trigger word
    let isWaitingForMove = false; // Flag to track if we're waiting for a move command
    let pendingMove = null; // Store the pending move that needs confirmation
    const voiceBtn = document.getElementById('voice-btn');
    const voiceStatus = document.getElementById('voice-status');
    
    // Add event listeners for buttons
    resetBtn.addEventListener('click', resetGame);
    undoBtn.addEventListener('click', undoLastMove);
    exportBtn.addEventListener('click', exportMoves);
    
    // Show permission overlay
    permissionOkBtn.addEventListener('click', () => {
        permissionOverlay.classList.remove('visible');
    });
    
    // Change trigger word button
    voiceBtn.addEventListener('click', () => {
        const newTrigger = prompt('Enter a new trigger word:', triggerWord);
        if (newTrigger && newTrigger.trim() !== '') {
            triggerWord = newTrigger.trim().toLowerCase();
            voiceStatus.textContent = `Trigger word changed to "${triggerWord}". Say it to start a move.`;
            voiceStatus.className = 'voice-status success';
            setTimeout(() => {
                voiceStatus.className = 'voice-status';
            }, 2000);
        }
    });
    
    // Pause/resume voice recognition
    pauseBtn.addEventListener('click', () => {
        const decibelContainer = document.getElementById('decibel-container');
        
        if (isPaused) {
            // Resume recognition
            isPaused = false;
            pauseBtn.textContent = 'Pause Recognition';
            pauseBtn.classList.remove('paused');
            decibelContainer.classList.remove('paused');
            startContinuousRecognition();
            voiceStatus.textContent = `Voice recognition resumed. Say "${triggerWord}" to start a move.`;
            voiceStatus.className = 'voice-status success';
            setTimeout(() => {
                voiceStatus.className = 'voice-status';
            }, 2000);
        } else {
            // Pause recognition
            isPaused = true;
            pauseBtn.textContent = 'Resume Recognition';
            pauseBtn.classList.add('paused');
            decibelContainer.classList.add('paused');
            if (recognition) {
                try {
                    recognition.stop();
                    console.log('Voice recognition paused');
                } catch (e) {
                    console.error('Error stopping recognition:', e);
                }
            }
            document.body.classList.remove('voice-active');
            voiceStatus.textContent = 'Voice recognition is paused. Click "Resume Recognition" to continue.';
            voiceStatus.className = 'voice-status';
        }
    });
    
    // Initialize the board and set up event listeners
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
        
        // Remove the event listeners for drag and drop
        // We don't need drag and drop for voice control anyway
        
        // Initialize continuous speech recognition immediately
        console.log('Initializing continuous speech recognition from initializeBoard');
        setupContinuousVoiceRecognition();
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
            makeMove(fromRow, fromCol, toRow, toCol, true);
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
    function makeMove(fromRow, fromCol, toRow, toCol, fromVoice = false) {
        // Get the piece being moved
        const piece = boardState[fromRow][fromCol];
        if (!piece) {
            if (fromVoice) {
                voiceStatus.textContent = 'No piece at the starting position.';
                showFeedback('invalid');
            }
            return;
        }
        
        // Ensure it's the correct player's turn
        if (piece.color !== currentTurn) {
            if (fromVoice) {
                voiceStatus.textContent = `It's ${currentTurn}'s turn to move.`;
            }
            showFeedback('invalid');
            return;
        }
        
        // Check if the move is valid
        if (!isValidMove(fromRow, fromCol, toRow, toCol)) {
            if (fromVoice) {
                voiceStatus.textContent = 'Invalid move. Please try again.';
            }
            showFeedback('invalid');
            return;
        }
        
        // If we get here, the move is valid - proceed with the move
        
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
        if (targetPiece && targetPiece.color === piece.color) {
            if (fromVoice) {
                voiceStatus.textContent = 'Cannot capture your own piece.';
            }
            showFeedback('invalid');
            return;
        }
        
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
        
        // Show success feedback
        showFeedback('valid');
        
        // If this was a voice command, provide feedback and draw an arrow
        if (fromVoice) {
            // Format the move in algebraic notation for feedback
            const files = 'abcdefgh';
            const ranks = '87654321';
            const fromSquareNotation = files[fromCol] + ranks[fromRow];
            const toSquareNotation = files[toCol] + ranks[toRow];
            
            let moveText = '';
            if (castling) {
                moveText = castling === 'kingside' ? 'O-O' : 'O-O-O';
            } else {
                moveText = `${fromSquareNotation} to ${toSquareNotation}`;
                if (targetPiece) moveText += ` (captured ${targetPiece.type})`;
                if (promotion) moveText += ` promoted to ${promotion}`;
            }
            
            voiceStatus.textContent = `Move executed: ${moveText}`;
            
            // Draw an arrow to visualize the move
            drawArrow(fromRow, fromCol, toRow, toCol, '#4CAF50', 0.7); // Green arrow for successful moves
            setTimeout(() => {
                clearArrows();
            }, 2000); // Clear the arrow after 2 seconds
        }
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
    function resetGame() {
        console.log('Resetting game');
        
        // Clear the board
        while (chessboard.firstChild) {
            chessboard.removeChild(chessboard.firstChild);
        }
        
        // Reset variables
        boardState = [];
        moveHistory = [];
        currentTurn = 'white';
        piecesHaveMoved = {
            whiteKing: false,
            blackKing: false,
            whiteRookA: false,
            whiteRookH: false,
            blackRookA: false,
            blackRookH: false
        };
        
        // Initialize the board
        initializeBoard();
        
        // Update UI
        updateMoveHistory();
        updateTurnIndicator();
        clearArrows();
        
        // Show feedback
        showFeedback('valid');
        
        // Update status
        if (voiceStatus) {
            voiceStatus.textContent = 'Game reset. Ready for voice commands.';
        }
    }
    
    // Undo the last move
    function undoLastMove() {
        if (moveHistory.length > 0) {
            // Get the last move to determine whose turn it will be after undoing
            const lastMove = moveHistory[moveHistory.length - 1];
            
            // Remove the last move from history
            moveHistory.pop();
            
            // Clear the board
            while (chessboard.firstChild) {
                chessboard.removeChild(chessboard.firstChild);
            }
            
            // Reset the board state
            boardState = [];
            
            // Create the squares (without pieces)
            for (let row = 0; row < 8; row++) {
                boardState[row] = [];
                for (let col = 0; col < 8; col++) {
                    const square = document.createElement('div');
                    square.classList.add('square');
                    square.classList.add((row + col) % 2 === 0 ? 'white' : 'black');
                    square.dataset.row = row;
                    square.dataset.col = col;
                    boardState[row][col] = null;
                    chessboard.appendChild(square);
                }
            }
            
            // Set up the initial position
            setupInitialPosition();
            
            // Replay all moves except the last one
            replayMoves();
            
            // Update the move history display
            updateMoveHistory();
            
            // Update arrows
            updateArrows();
            
            // Set the turn to the player who made the last move (since we're undoing their move)
            currentTurn = lastMove.color;
            updateTurnIndicator();
            
            // Update status
            if (voiceStatus) {
                voiceStatus.textContent = 'Last move undone.';
            }
            
            // Show feedback
            showFeedback('valid');
        } else {
            // No moves to undo
            if (voiceStatus) {
                voiceStatus.textContent = 'No moves to undo.';
            }
        }
    }
    
    // Function to replay moves from history
    function replayMoves() {
        // Create a copy of the move history to work with
        const historyToReplay = [...moveHistory];
        
        // Reset the board state to initial position
        for (let row = 0; row < 8; row++) {
            for (let col = 0; col < 8; col++) {
                const square = document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
                const piece = square.querySelector('.piece');
                
                if (piece) {
                    square.removeChild(piece);
                }
                
                // Reset the board state
                if (boardState[row] && boardState[row][col]) {
                    boardState[row][col] = null;
                }
            }
        }
        
        // Set up the initial position
        setupInitialPosition();
        
        // Replay each move
        historyToReplay.forEach(move => {
            const { from, to, color, piece, capture, promotion, castling } = move;
            
            // Make the move on the board
            const fromSquare = document.querySelector(`.square[data-row="${from.row}"][data-col="${from.col}"]`);
            const toSquare = document.querySelector(`.square[data-row="${to.row}"][data-col="${to.col}"]`);
            
            if (fromSquare && toSquare) {
                const pieceElement = fromSquare.querySelector('.piece');
                
                if (pieceElement) {
                    // Remove any piece at the destination (capture)
                    const capturedPiece = toSquare.querySelector('.piece');
                    if (capturedPiece) {
                        toSquare.removeChild(capturedPiece);
                    }
                    
                    // Move the piece
                    fromSquare.removeChild(pieceElement);
                    pieceElement.dataset.row = to.row;
                    pieceElement.dataset.col = to.col;
                    toSquare.appendChild(pieceElement);
                    
                    // Update board state
                    boardState[to.row][to.col] = { color, type: promotion || piece };
                    boardState[from.row][from.col] = null;
                    
                    // Handle promotion
                    if (promotion) {
                        pieceElement.textContent = pieces[color][promotion];
                    }
                    
                    // Handle castling
                    if (castling) {
                        const isKingside = to.col > from.col;
                        const rookRow = from.row;
                        const rookFromCol = isKingside ? 7 : 0;
                        const rookToCol = isKingside ? 5 : 3;
                        
                        const rookFromSquare = document.querySelector(`.square[data-row="${rookRow}"][data-col="${rookFromCol}"]`);
                        const rookToSquare = document.querySelector(`.square[data-row="${rookRow}"][data-col="${rookToCol}"]`);
                        
                        if (rookFromSquare && rookToSquare) {
                            const rookElement = rookFromSquare.querySelector('.piece');
                            
                            if (rookElement) {
                                rookFromSquare.removeChild(rookElement);
                                rookElement.dataset.row = rookRow;
                                rookElement.dataset.col = rookToCol;
                                rookToSquare.appendChild(rookElement);
                                
                                // Update board state for rook
                                boardState[rookRow][rookToCol] = { color, type: 'rook' };
                                boardState[rookRow][rookFromCol] = null;
                            }
                        }
                    }
                    
                    // Update tracking for pieces that have moved (for castling)
                    if (piece === 'king') {
                        if (color === 'white') {
                            piecesHaveMoved.whiteKing = true;
                        } else {
                            piecesHaveMoved.blackKing = true;
                        }
                    } else if (piece === 'rook') {
                        if (color === 'white') {
                            if (from.col === 0) piecesHaveMoved.whiteRookA = true;
                            if (from.col === 7) piecesHaveMoved.whiteRookH = true;
                        } else {
                            if (from.col === 0) piecesHaveMoved.blackRookA = true;
                            if (from.col === 7) piecesHaveMoved.blackRookH = true;
                        }
                    }
                }
            }
        });
        
        // Update the current turn
        if (moveHistory.length > 0) {
            const lastMove = moveHistory[moveHistory.length - 1];
            currentTurn = lastMove.color === 'white' ? 'black' : 'white';
        } else {
            currentTurn = 'white';
        }
        
        updateTurnIndicator();
    }
    
    // Function to set up the initial position
    function setupInitialPosition() {
        // Set up pawns
        for (let col = 0; col < 8; col++) {
            // White pawns (row 6)
            const whitePawn = createPiece('white', 'pawn', 6, col);
            const whiteSquare = document.querySelector(`.square[data-row="6"][data-col="${col}"]`);
            if (whiteSquare) {
                whiteSquare.appendChild(whitePawn);
                boardState[6][col] = { color: 'white', type: 'pawn' };
            }
            
            // Black pawns (row 1)
            const blackPawn = createPiece('black', 'pawn', 1, col);
            const blackSquare = document.querySelector(`.square[data-row="1"][data-col="${col}"]`);
            if (blackSquare) {
                blackSquare.appendChild(blackPawn);
                boardState[1][col] = { color: 'black', type: 'pawn' };
            }
        }
        
        // Define piece positions
        const pieces = [
            { color: 'white', type: 'rook', row: 7, col: 0 },
            { color: 'white', type: 'knight', row: 7, col: 1 },
            { color: 'white', type: 'bishop', row: 7, col: 2 },
            { color: 'white', type: 'queen', row: 7, col: 3 },
            { color: 'white', type: 'king', row: 7, col: 4 },
            { color: 'white', type: 'bishop', row: 7, col: 5 },
            { color: 'white', type: 'knight', row: 7, col: 6 },
            { color: 'white', type: 'rook', row: 7, col: 7 },
            { color: 'black', type: 'rook', row: 0, col: 0 },
            { color: 'black', type: 'knight', row: 0, col: 1 },
            { color: 'black', type: 'bishop', row: 0, col: 2 },
            { color: 'black', type: 'queen', row: 0, col: 3 },
            { color: 'black', type: 'king', row: 0, col: 4 },
            { color: 'black', type: 'bishop', row: 0, col: 5 },
            { color: 'black', type: 'knight', row: 0, col: 6 },
            { color: 'black', type: 'rook', row: 0, col: 7 }
        ];
        
        // Place each piece on the board
        pieces.forEach(p => {
            const piece = createPiece(p.color, p.type, p.row, p.col);
            const square = document.querySelector(`.square[data-row="${p.row}"][data-col="${p.col}"]`);
            if (square) {
                square.appendChild(piece);
                if (!boardState[p.row]) boardState[p.row] = [];
                boardState[p.row][p.col] = { color: p.color, type: p.type };
            }
        });
        
        // Reset pieces moved tracking for castling
        piecesHaveMoved = {
            whiteKing: false,
            blackKing: false,
            whiteRookA: false,
            whiteRookH: false,
            blackRookA: false,
            blackRookH: false
        };
    }
    
    // Set up continuous voice recognition
    function setupContinuousVoiceRecognition() {
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            voiceStatus.textContent = 'Speech recognition not supported in this browser.';
            return;
        }
        
        recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = 'en-US';
        
        recognition.onstart = function() {
            console.log('Voice recognition started');
            isListening = true;
            document.body.classList.add('voice-active');
            voiceStatus.textContent = `Voice recognition is active. Say "${triggerWord}" to start a move.`;
            
            // Request microphone access for the decibel meter
            if (!audioContext) {
                navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(function(stream) {
                        setupAudioAnalyzer(stream);
                    })
                    .catch(function(err) {
                        console.error('Error getting microphone for audio analysis:', err);
                    });
            }
        };
        
        recognition.onend = function() {
            console.log('Voice recognition ended');
            isListening = false;
            document.body.classList.remove('voice-active');
            
            // Restart recognition if it ends unexpectedly and not paused
            if (document.visibilityState === 'visible' && !isPaused) {
                console.log('Restarting recognition...');
                setTimeout(() => {
                    startContinuousRecognition();
                }, 500);
            }
        };
        
        recognition.onerror = function(event) {
            console.error('Recognition error:', event.error);
            
            if (event.error === 'no-speech') {
                // This is common and not a critical error, just restart
                console.log('No speech detected, restarting recognition');
            } else {
                voiceStatus.textContent = `Error: ${event.error}. Restarting...`;
            }
            
            isListening = false;
            document.body.classList.remove('voice-active');
            
            // Restart after error if not paused
            if (!isPaused) {
                setTimeout(() => {
                    startContinuousRecognition();
                }, 1000);
            }
        };
        
        recognition.onresult = function(event) {
            const transcript = event.results[event.results.length - 1][0].transcript.trim().toLowerCase();
            console.log('Heard:', transcript);
            
            // Flash the decibel meter to indicate speech was recognized
            decibelMeter.style.backgroundColor = '#f1c40f';
            setTimeout(() => {
                decibelMeter.style.background = 'linear-gradient(90deg, #f1c40f, #f39c12)';
            }, 300);
            
            if (isWaitingForMove) {
                // We're waiting for a move command
                if (transcript.includes(triggerWord)) {
                    // Trigger word spoken again - execute the pending move
                    if (pendingMove) {
                        const { fromRow, fromCol, toRow, toCol } = pendingMove;
                        makeMove(fromRow, fromCol, toRow, toCol, true);
                        pendingMove = null;
                        
                        // Reset state
                        isWaitingForMove = false;
                        voiceStatus.textContent = `Move executed! Listening for trigger word: "${triggerWord}"`;
                        voiceStatus.className = 'voice-status success';
                        setTimeout(() => {
                            voiceStatus.className = 'voice-status';
                        }, 2000);
                    } else {
                        voiceStatus.textContent = `No move to execute. Listening for trigger word: "${triggerWord}"`;
                        voiceStatus.className = 'voice-status error';
                        isWaitingForMove = false;
                        setTimeout(() => {
                            voiceStatus.className = 'voice-status';
                        }, 2000);
                    }
                } else {
                    // Process as a potential move
                    processMoveCommand(transcript);
                }
            } else if (transcript.includes(triggerWord)) {
                // Trigger word detected - start listening for a move
                isWaitingForMove = true;
                pendingMove = null;
                voiceStatus.textContent = 'Trigger word detected! Speak your move now...';
                voiceStatus.className = 'voice-status waiting-for-move';
                showFeedback('valid');
            } else if (transcript.includes('reset') || transcript.includes('new game')) {
                // Special command that doesn't need the trigger word
                resetGame();
                voiceStatus.textContent = 'Game reset! Listening for trigger word.';
                voiceStatus.className = 'voice-status success';
                setTimeout(() => {
                    voiceStatus.className = 'voice-status';
                }, 2000);
            } else if (transcript.includes('undo')) {
                // Special command that doesn't need the trigger word
                undoLastMove();
                voiceStatus.textContent = 'Move undone! Listening for trigger word.';
                voiceStatus.className = 'voice-status success';
                setTimeout(() => {
                    voiceStatus.className = 'voice-status';
                }, 2000);
            }
        };
        
        // Start the continuous recognition if not paused
        if (!isPaused) {
            startContinuousRecognition();
        }
        
        // Add visibility change handler to restart recognition when tab becomes visible
        document.addEventListener('visibilitychange', function() {
            if (!document.hidden && !isListening && !isPaused) {
                console.log('Tab became visible, restarting recognition');
                startContinuousRecognition();
            }
        });
    }
    
    // Start continuous recognition
    function startContinuousRecognition() {
        if (isPaused) {
            console.log('Recognition is paused, not starting');
            return;
        }
        
        if (!recognition) {
            setupContinuousVoiceRecognition();
            return;
        }
        
        try {
            // Request microphone permission
            navigator.mediaDevices.getUserMedia({ audio: true })
                .then(function(stream) {
                    // Set up audio analyzer if not already set up
                    if (!audioContext) {
                        setupAudioAnalyzer(stream);
                    }
                    
                    // Start recognition
                    try {
                        recognition.start();
                        console.log('Continuous recognition started after permission granted');
                    } catch (e) {
                        console.error('Error starting recognition:', e);
                        voiceStatus.textContent = 'Error starting recognition. Retrying...';
                        
                        // Try again after a delay if not paused
                        if (!isPaused) {
                            setTimeout(() => {
                                startContinuousRecognition();
                            }, 1000);
                        }
                    }
                })
                .catch(function(err) {
                    console.error('Error getting microphone permission:', err);
                    voiceStatus.textContent = 'Microphone access denied. Please check your browser settings.';
                    permissionOverlay.classList.add('visible');
                });
        } catch (e) {
            console.error('Error requesting media:', e);
            voiceStatus.textContent = 'Error accessing microphone. Please try again.';
        }
    }
    
    // Process move commands
    function processMoveCommand(command) {
        console.log('Processing move command:', command);
        
        // Check for castling
        if (command.includes('castle kingside') || command.includes('o-o') || command.includes('0-0')) {
            const row = currentTurn === 'white' ? 7 : 0;
            pendingMove = { fromRow: row, fromCol: 4, toRow: row, toCol: 6 };
            voiceStatus.textContent = `Pending move: Castle kingside. Say "${triggerWord}" to confirm.`;
            voiceStatus.className = 'voice-status pending-move';
            // Draw a temporary arrow to show the pending move
            clearArrows();
            drawArrow(row, 4, row, 6, '#FFA500', 0.7); // Orange arrow for pending moves
            return;
        }
        
        if (command.includes('castle queenside') || command.includes('o-o-o') || command.includes('0-0-0')) {
            const row = currentTurn === 'white' ? 7 : 0;
            pendingMove = { fromRow: row, fromCol: 4, toRow: row, toCol: 2 };
            voiceStatus.textContent = `Pending move: Castle queenside. Say "${triggerWord}" to confirm.`;
            voiceStatus.className = 'voice-status pending-move';
            // Draw a temporary arrow to show the pending move
            clearArrows();
            drawArrow(row, 4, row, 2, '#FFA500', 0.7); // Orange arrow for pending moves
            return;
        }
        
        // Extract squares from the command
        const squares = extractSquaresFromCommand(command);
        
        if (squares) {
            const fromRow = 8 - parseInt(squares.from[1]);
            const fromCol = squares.from.charCodeAt(0) - 97; // 'a' is 97 in ASCII
            const toRow = 8 - parseInt(squares.to[1]);
            const toCol = squares.to.charCodeAt(0) - 97;
            
            // Check if the move is valid before setting it as pending
            const piece = boardState[fromRow] && boardState[fromRow][fromCol];
            if (!piece) {
                voiceStatus.textContent = `No piece at ${squares.from}. Try again.`;
                voiceStatus.className = 'voice-status error';
                return;
            }
            
            if (piece.color !== currentTurn) {
                voiceStatus.textContent = `It's ${currentTurn}'s turn. Try again.`;
                voiceStatus.className = 'voice-status error';
                return;
            }
            
            if (!isValidMove(fromRow, fromCol, toRow, toCol)) {
                voiceStatus.textContent = `Invalid move: ${squares.from} to ${squares.to}. Try again.`;
                voiceStatus.className = 'voice-status error';
                return;
            }
            
            // Valid move - set as pending
            pendingMove = { fromRow, fromCol, toRow, toCol };
            
            // Format the move in algebraic notation for feedback
            const files = 'abcdefgh';
            const ranks = '87654321';
            const fromSquareNotation = files[fromCol] + ranks[fromRow];
            const toSquareNotation = files[toCol] + ranks[toRow];
            
            voiceStatus.textContent = `Pending move: ${fromSquareNotation} to ${toSquareNotation}. Say "${triggerWord}" to confirm.`;
            voiceStatus.className = 'voice-status pending-move';
            
            // Draw a temporary arrow to show the pending move
            clearArrows();
            drawArrow(fromRow, fromCol, toRow, toCol, '#FFA500', 0.7); // Orange arrow for pending moves
        } else {
            voiceStatus.textContent = `Could not understand the move. Please try again.`;
            voiceStatus.className = 'voice-status error';
        }
    }
    
    // Extract chess squares from voice command
    function extractSquaresFromCommand(command) {
        // Remove spaces and convert to lowercase
        const cleanCommand = command.replace(/\s+/g, '').toLowerCase();
        
        // Regular expression to match two chess squares (e.g., "e2e4", "a7a8q")
        const squareRegex = /([a-h][1-8])([a-h][1-8])/;
        const match = cleanCommand.match(squareRegex);
        
        if (match) {
            return {
                from: match[1],
                to: match[2]
            };
        }
        
        // Try to match more verbose commands like "e2 to e4" or "e4 takes d5"
        const verboseRegex = /([a-h][1-8])(?:to|takes)([a-h][1-8])/;
        const verboseMatch = command.replace(/\s+/g, '').match(verboseRegex);
        
        if (verboseMatch) {
            return {
                from: verboseMatch[1],
                to: verboseMatch[2]
            };
        }
        
        return null;
    }
    
    // Export moves function
    function exportMoves() {
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
    }
    
    // Set up the audio analyzer for the decibel meter
    function setupAudioAnalyzer(stream) {
        try {
            // Create audio context
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create analyzer node
            analyser = audioContext.createAnalyser();
            analyser.smoothingTimeConstant = 0.3;
            analyser.fftSize = 1024;
            
            // Create microphone input
            microphone = audioContext.createMediaStreamSource(stream);
            microphone.connect(analyser);
            
            // Set up processing node
            javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);
            javascriptNode.connect(audioContext.destination);
            analyser.connect(javascriptNode);
            
            // Process audio data
            javascriptNode.onaudioprocess = function() {
                // Don't process if paused
                if (isPaused) return;
                
                const array = new Uint8Array(analyser.frequencyBinCount);
                analyser.getByteFrequencyData(array);
                
                // Calculate volume
                let values = 0;
                for (let i = 0; i < array.length; i++) {
                    values += array[i];
                }
                
                // Calculate average volume
                const average = values / array.length;
                
                // Convert to decibels (rough approximation)
                // Map 0-255 to 0-100 for display purposes
                audioVolume = average * 0.39; // Scale to roughly 0-100
                
                // Update the decibel meter
                updateDecibelMeter(audioVolume);
                
                // Highlight when above threshold
                if (audioVolume > volumeThreshold) {
                    decibelMeter.style.backgroundColor = '#f39c12';
                } else {
                    decibelMeter.style.background = 'linear-gradient(90deg, #f1c40f, #f39c12)';
                }
            };
            
            console.log('Audio analyzer set up successfully');
            
            // Set the threshold marker position (default 15%)
            decibelThreshold.style.left = (volumeThreshold) + '%';
            
        } catch (e) {
            console.error('Error setting up audio analyzer:', e);
        }
    }
    
    // Update the decibel meter display
    function updateDecibelMeter(volume) {
        // Don't update if paused
        if (isPaused) return;
        
        // Ensure volume is within 0-100 range
        volume = Math.max(0, Math.min(100, volume));
        decibelMeter.style.width = volume + '%';
    }
    
    // Initialize the board
    initializeBoard();
    
    // Handle window resize to update arrow positions
    window.addEventListener('resize', () => {
        updateArrows();
    });
    
    // Handle orientation changes
    window.addEventListener('orientationchange', () => {
        // Give time for the browser to adjust
        setTimeout(() => {
            // Redraw arrows after orientation change
            updateArrows();
        }, 300);
    });
}); 