const express = require('express');
const { createServer } = require("http");
const { Server } = require("socket.io");
const check = require('./checkFunctions');
const updateBoard = require('./updateBoard');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173"
    }
});

let rooms = {};
module.exports = { rooms, io };

const { intentional, accidental } = require('./disconnections');
const { switchPlayer } = require('./timer');

// דוגמה לאיך אובייקט של חדר אמור להיראות
let roomExample = {
    roomId: "roomId",              // Unique identifier for the room
    players: [{ id: 'player1', time: 0 }, { id: 'player2', time: 0 }],
    currentPlayerIndex: 0,         // Index of the current player in the players array
    intervalId: null,              // Interval ID to keep track of the setInterval
    board: [                       // 2D array representing the game board
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0]
    ],
    winner: null,                  // Player object representing the winner, null if no winner yet
    gameOver: false,               // Boolean indicating if the game is over
    creatorId: "socket.id"
}

io.on('connection', (socket) => {
    console.log("user connected " + socket.id);
    // Handle player moves
    socket.on('move', ({roomId, cIndex}) => {
        try {
            const room = rooms[roomId];
            if (!room || room.players.length !== 2 || room.gameOver) {
                throw { code: 401, msg: 'Room full or not found' }; // התעלמות ממהלכים לא חוקיים
            }

            // בדיקה אם בכלל תורו של השחקן ששלח את הבקשה לשחק
            const currentPlayer = room.players[room.currentPlayerIndex];
            if (currentPlayer.id !== socket.id) {
                throw { code: 410, msg: 'Not your turn' }; // התעלמות מהמהלך של השחקן שלא תורו
            }

            // עדכון הלוח ולמי לתת אנימציה
            const board = updateBoard(room.board, cIndex, room.currentPlayerIndex);

            // החלפת הטיימר בין השחקנים
            switchPlayer(room);

            const data = {...board, currentPlayerIndex: room.currentPlayerIndex};
            console.log("data: ", data);
            // שליחת מצב המשחק (כולל זמן ותור מי) לקליינטים
            io.to(roomId).emit('gameState', data);

            // בדיקת הלוח
            const winner = check(board.newBoard);
            if (winner.winner) {
                // console.log("the winner is " + winner.winner)
                io.to(roomId).emit('gameOver', winner)
            }
        } catch (err) {
            console.error(err);
            socket.emit('error', { code: err.code || 500, msg: err.msg || err.message });
        }
    });

    // כאשר שחקן מתנתק
    socket.on('disconnect', ({ roomId, reason }) => {
        try {
            console.log("A user disconnected", socket.id);
            const room = findRoomBySocketId(socket.id);
            let reason = 'intentional';
            // const room = rooms[roomId];
            // if (!room || room.gameOver) {
            //     throw { code: 401, msg: 'Room not found' }; // זריקת שגיאה במידה והחדר לא נמצא
            // }

            if (reason === 'intentional') {
                // השחקן התנתק באופן מכוון
                intentional(room, socket.id);
            } else {
                // השחקן התנתק שלא במכוון וטיימר התנתקות מופעל
                accidental(room, socket.id);
            }
        } catch (err) {
            console.error(err);
            socket.emit('error', { code: err.code || 500, msg: err.msg || err.message });
        }
    });

    // כאשר שחקן מתחבר מחדש אחרי שהתנתק באופן לא מכוון
    socket.on('reconnect', (roomId, playerId) => {
        try {
            const room = rooms[roomId];
            if (!room || room.gameOver) {
                throw { code: 401, msg: 'Room not found' }; // זריקת שגיאה במידה והחדר לא נמצא
            }
            if (room && room.disconnectTimeout) {
                // Cancel the disconnect timeout
                clearTimeout(room.disconnectTimeout);
                room.disconnectTimeout = null;

                // צירוף השחקן מחדש לחדר שהיה בו
                const player = room.players.find(player => player.id === playerId);
                if (player) {
                    socket.join(roomId);
                    // שליחת מצב המשחק לשחקן
                    socket.emit('gameState', room.board);
                }
            }
        } catch (err) {
            console.error(err);
            socket.emit('error', { code: err.code || 500, msg: err.msg || err.message });
        }
    });

    // Handle private room creation and joining
    socket.on('createPrivateRoom', () => {
        const roomId = generateRoomId();
        rooms[roomId] = {
            roomId: roomId,
            players: [{ id: socket.id, time: 0 }],
            currentPlayerIndex: 0,
            intervalId: null,
            board: [
                [0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0],
                [0, 0, 0, 0, 0, 0]
            ],
            winner: null,
            gameOver: false,
            creatorId: socket.id
        }
        socket.emit('privateRoomCreated', roomId);
    });

    socket.on('joinPrivateRoom', (roomId) => {
        try {
            const room = rooms[roomId];
            if (!room || room.players.length >= 2 || room.gameOver) {
                throw { code: 401, msg: 'Room full or not found' }; // זריקת שגיאה במידה והחדר לא נמצא
            }

            room.players.push({ id: socket.id, time: 0 });
            socket.join(roomId);
            io.to(roomId).emit('privateRoomJoined', roomId);
        } catch (err) {
            console.error(err);
            socket.emit('error', { code: err.code || 500, msg: err.msg || err.message });
        }
    });

    // Handle matchmaking for playing against a stranger
    socket.on('joinStrangersGame', () => {
        let matchedRoomId = null;
        Object.keys(rooms).forEach((roomId) => {
            const room = rooms[roomId];
            if (room.players.length === 1 && !room.gameOver) {
                matchedRoomId = roomId;
            }
        });

        if (matchedRoomId) {
            rooms[matchedRoomId].players.push({ id: socket.id, time: 0 });
            socket.join(matchedRoomId);
            console.log("room joined: ", rooms[matchedRoomId])
            io.to(matchedRoomId).emit('strangersGameJoined', rooms[matchedRoomId]);
            console.log("rooms: ", Object.keys(rooms));
        } else {
            let newRoomId = generateRoomId();
            // לא קיים כבר IDבדיקה שה
            while (rooms[newRoomId]) {
                newRoomId = generateRoomId();
            }
            rooms[newRoomId] = {
                roomId: newRoomId,
                players: [{ id: socket.id, time: 0 }],
                currentPlayerIndex: 0,
                intervalId: null,
                board: [
                    [0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0]
                ],
                winner: null,
                gameOver: false,
                creatorId: socket.id
            };
            socket.join(newRoomId);
            console.log("room created: ", rooms[newRoomId])
            socket.emit('strangersGameWaiting', rooms[newRoomId]);
            console.log("rooms: ", Object.keys(rooms));
        }
    });
});

function generateRoomId() {
    return Math.random().toString(36).substr(2, 6);
}

function findRoomBySocketId(socketId) {
    const roomId = Object.keys(rooms).find(roomId =>
        rooms[roomId].players.some(player => player.id === socketId)
    );
    return rooms[roomId] || null; // Return roomId if found, otherwise return null
}


httpServer.listen(3001, () => {
    console.log('Server running on port http://localhost:3001');
});
