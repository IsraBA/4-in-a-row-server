let animatingR = Number;
let animatingC = Number;

const updateBoard = (board, cIndex, currentPlayerIndex) => {
    let cellToFill = board[cIndex].findIndex(cell => cell === 1 || cell === 2);
    if (cellToFill == 0) throw { code: 401, msg: 'This column is full' };
    if (cellToFill === -1) {
        animatingR = 5;
        animatingC = cIndex;
        let newBoard = [...board];
        if (currentPlayerIndex == 0) { newBoard[cIndex][5] = 1 }
        else { newBoard[cIndex][5] = 2 };

        return { newBoard, animatingR, animatingC };

    } else {
        animatingR = cellToFill - 1;
        animatingC = cIndex;
        let newBoard = [...board];
        if (currentPlayerIndex == 0) { newBoard[cIndex][cellToFill - 1] = 1 }
        else { newBoard[cIndex][cellToFill - 1] = 2 };

        return { newBoard, animatingR, animatingC };

    }
};

module.exports = updateBoard;
