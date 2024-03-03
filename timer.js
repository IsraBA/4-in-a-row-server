const { io } = require('./index');

function startTimer(room) {
    if (!room) throw { code: 404, msg: 'Room not found' };

    const currentPlayer = room.players[room.currentPlayerIndex];
    room.intervalId = setInterval(() => {
        currentPlayer.time++;
        // console.log(`Player ${currentPlayer.id} Time: ${formatTime(currentPlayer.time)}`);
        io.to(room.roomId).emit('timeUpdate', room.players);
    }, 1000);
}

function stopTimer(room) {
    if (!room) throw { code: 404, msg: 'Room not found' };
    if (room.intervalId === null) return;

    clearInterval(room.intervalId);
    room.intervalId = null;
}

function switchPlayer(room) {
    if (!room) throw { code: 404, msg: 'Room not found' };

    // Stop current player's timer
    stopTimer(room);

    // Switch to the next player
    room.currentPlayerIndex = 1 - room.currentPlayerIndex;

    // Start the new player's timer
    startTimer(room);
}

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
    const remainingSeconds = (seconds % 60).toString().padStart(2, '0');

    return `${minutes}:${remainingSeconds}`;
}

module.exports = { startTimer, stopTimer, switchPlayer }


// Example usage
// const roomId = Object.keys(rooms)[0];
// startTimer(roomId); // Start the timer for player1
