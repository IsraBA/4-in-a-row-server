let turnP1 = true;
let winner;
let fourInaRow = [];
let redTime = 0;
let yellowTime = 0;
let runningRed = false;
let runningYellow = false;

const numToPlayer = (num) => {
    if (num == 1) { return "אדום" }
    else if (num == 2) { return "צהוב" };
};

const check = (board = []) => {
    // בדיקה אופקית
    if (checkHorizontal(board)) {
        return { winner, fourInaRow };
    }

    // בדיקה אנכית
    if (checkVertical(board)) {
        return { winner, fourInaRow };
    }

    // בדיקה אלכסונית
    if (checkDiagonal(board)) {
        return { winner, fourInaRow };
    }

    return false;
};

const checkHorizontal = (board) => {
    for (let rowI = 0; rowI < 6; rowI++) {
        for (let colI = 0; colI < 4; colI++) {
            if (board[colI][rowI] !== 0) {
                if (
                    board[colI][rowI] == board[colI + 1][rowI] &&
                    board[colI][rowI] == board[colI + 2][rowI] &&
                    board[colI][rowI] == board[colI + 3][rowI]
                ) {
                    winner = numToPlayer(board[colI][rowI]);
                    fourInaRow = [
                        { colI, rowI },
                        { colI: colI + 1, rowI },
                        { colI: colI + 2, rowI },
                        { colI: colI + 3, rowI }
                    ];
                    runningYellow = false;
                    runningRed = false;
                    return true;
                }
            }
        }
    }
};

const checkVertical = (board) => {
    board.forEach((column, index) => {
        for (let i = 0; i < 3; i++) {
            if (column[i] !== 0) {
                if (
                    column[i] == column[i + 1] &&
                    column[i] == column[i + 2] &&
                    column[i] == column[i + 3]
                ) {
                    winner = numToPlayer(column[i]);
                    fourInaRow = [
                        { colI: index, rowI: i },
                        { colI: index, rowI: i + 1 },
                        { colI: index, rowI: i + 2 },
                        { colI: index, rowI: i + 3 }
                    ];
                    runningYellow = false;
                    runningRed = false;
                    return true;
                }
            }
        }
    })
};

const checkDiagonal = (board) => {
    // בדיקה משמאל למעלה לימין למטה
    for (let colI = 0; colI < 4; colI++) {
        for (let rowI = 0; rowI < 3; rowI++) {
            if (board[colI][rowI] !== 0) {
                if (
                    board[colI][rowI] == board[colI + 1][rowI + 1] &&
                    board[colI][rowI] == board[colI + 2][rowI + 2] &&
                    board[colI][rowI] == board[colI + 3][rowI + 3]
                ) {
                    winner = numToPlayer(board[colI][rowI]);
                    fourInaRow = [
                        { colI, rowI },
                        { colI: colI + 1, rowI: rowI + 1 },
                        { colI: colI + 2, rowI: rowI + 2 },
                        { colI: colI + 3, rowI: rowI + 3 }
                    ];
                    runningYellow = false;
                    runningRed = false;
                    return true;
                }
            }
        }
    }
    // בדיקה מימין למעלה לשמאל למטה
    for (let colI = 6; colI > 2; colI--) {
        for (let rowI = 0; rowI < 3; rowI++) {
            if (board[colI][rowI] !== 0) {
                if (
                    board[colI][rowI] == board[colI - 1][rowI + 1] &&
                    board[colI][rowI] == board[colI - 2][rowI + 2] &&
                    board[colI][rowI] == board[colI - 3][rowI + 3]
                ) {
                    winner = numToPlayer(board[colI][rowI]);
                    fourInaRow = [
                        { colI, rowI },
                        { colI: colI - 1, rowI: rowI + 1 },
                        { colI: colI - 2, rowI: rowI + 2 },
                        { colI: colI - 3, rowI: rowI + 3 }
                    ];
                    runningYellow = false;
                    runningRed = false;
                    return true;
                }
            }
        }
    }
};

module.exports = check;