const express = require('express');
const { createServer } = require("http");
const { Server } = require("socket.io");
const check = require('./checkFunctions');
const updateBoard = require('./updateBoard');
require('dotenv').config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.CLIENT
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
    creatorId: "socket.id",
    isPrivate: Boolean
}

io.on('connection', (socket) => {
    console.log("user connected " + socket.id);
    // Handle player moves
    socket.on('move', ({ roomId, cIndex }) => {
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

            // בדיקת הלוח
            const winner = check(board.newBoard);
            // החלפת הטיימר בין השחקנים אם אין מנצח עדיין
            winner.winner ? '' : switchPlayer(room);

            const data = { ...board, currentPlayerIndex: room.currentPlayerIndex };
            // console.log("data: ", data);
            // שליחת מצב המשחק (כולל זמן ותור מי) לקליינטים
            io.to(roomId).emit('gameState', data);

            // שליחה לשחקנים מי ניצח אם מישהו ניצח
            if (winner.winner) {
                // console.log("the winner is " + winner.winner)
                io.to(roomId).emit('gameOver', winner);
                delete rooms[roomId];
                console.log(`the room ${roomId} has been deleted cuz the game is over`)
            }
        } catch (err) {
            console.error(err);
            socket.emit('error', { code: err.code || 500, msg: err.msg || err.message });
        }
    });

    // כאשר שחקן מתנתק באופן לא מכוון
    socket.on('disconnect', () => {
        try {
            const room = findRoomBySocketId(socket.id);
            // console.log('room: ', room)

            // בדיקה שהחדר לא כבר נמחק
            if (room) {
                // אם שחקן התחבר ויצר חדר חדש ואז התנתק ישר - החדר נמחק
                if (room.players.length === 1) {
                    console.log(`room ${room.roomId} deleted`)
                    delete rooms[room.roomId];
                }
                console.log("A user disconnected by mistake", socket.id);
                // טיימר התנתקות מופעל
                accidental(room, socket.id);
            } else {
                console.log(`User ${socket.id} disconnected and the room already deleted`)
            }
        } catch (err) {
            console.error(err);
            socket.emit('error', { code: err.code || 500, msg: err.msg || err.message });
        }
    });

    // כאשר שחקן מתנתק באופן מכוון
    socket.on('leave', ({ roomId }) => {
        try {
            const room = rooms[roomId];
            if (room) {
                console.log("A user disconnected intentionally", socket.id);
                intentional(room, socket.id);
            } else {
                console.log(`User ${socket.id} left and the room already deleted`)
            }
        } catch (err) {
            console.error(err);
            socket.emit('error', { code: err.code || 500, msg: err.msg || err.message });
        }
    });

    // כאשר שחקן מתחבר מחדש אחרי שהתנתק באופן לא מכוון
    socket.on('reconnect', ({ roomId, playerId }) => {
        try {
            const room = rooms[roomId];
            if (!room || room.gameOver) {
                throw { code: 404, msg: 'Room not found' }; // זריקת שגיאה במידה והחדר לא נמצא
            }
            if (room && room.disconnectTimeout) {
                // Cancel the disconnect timeout
                clearTimeout(room.disconnectTimeout);
                room.disconnectTimeout = null;

                // צירוף השחקן מחדש לחדר שהיה בו
                const player = room.players.find(player => player.id === playerId);
                const playerIndex = room.players.findIndex(player => player.id === playerId);
                if (playerIndex !== -1) {
                    socket.join(roomId);
                    console.log('the player who reconnect: ', player)
                    // console.log('old room: ', room)
                    rooms[roomId].players[playerIndex].id = socket.id;
                    // של יוצר החדר אם הוא זה שהתנתק idשינוי ה
                    if (room.creatorId === playerId) {
                        rooms[roomId].creatorId = socket.id;
                    }
                    // console.log('new room: ', room)
                    // שליחת מצב המשחק לשחקן
                    io.to(roomId).emit('playerReconnect', {
                        roomId: room.roomId,
                        players: room.players,
                        currentPlayerIndex: room.currentPlayerIndex,
                        board: room.board,
                        winner: room.winner,
                        gameOver: room.gameOver,
                        creatorId: room.creatorId,
                        disconnectTimeout: room.disconnectTimeout,
                    });
                }
            }
        } catch (err) {
            console.error(err);
            socket.emit('error', { code: err.code || 500, msg: err.msg || err.message });
        }
    });

    // Handle private room creation and joining
    socket.on('createPrivateRoom', () => {
        let roomId = generateRoomId();
        // לא קיים כבר IDבדיקה שה
        while (rooms[roomId]) {
            roomId = generateRoomId();
        }
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
            creatorId: socket.id,
            isPrivate: true
        }
        socket.join(roomId);
        socket.emit('privateRoomCreated', rooms[roomId]);
        console.log(`User ${socket.id} ***created private*** room ${roomId}`);
    });

    socket.on('joinPrivateRoom', (privateRoomId) => {
        try {
            console.log("private Room Id: ", privateRoomId);

            const room = rooms[privateRoomId];
            if (!room || room.players.length >= 2 || room.gameOver) {
                throw { code: 401, msg: 'Room full or not found' }; // זריקת שגיאה במידה והחדר לא נמצא
            }

            room.players.push({ id: socket.id, time: 0 });
            socket.join(privateRoomId);
            io.to(privateRoomId).emit('privateRoomJoined', rooms[privateRoomId]);
            console.log(`User ${socket.id} ***joined private*** room ${privateRoomId}`);
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
            if (room.players.length === 1 && !room.gameOver && !room.isPrivate) {
                matchedRoomId = roomId;
            }
        });

        if (matchedRoomId) {
            rooms[matchedRoomId].players.push({ id: socket.id, time: 0 });
            socket.join(matchedRoomId);
            console.log(`User ${socket.id} joined room ${matchedRoomId}`)//: ", rooms[matchedRoomId])
            io.to(matchedRoomId).emit('strangersGameJoined', rooms[matchedRoomId]);
            // console.log("rooms: ", Object.keys(rooms));
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
                creatorId: socket.id,
                isPrivate: false,
            };
            socket.join(newRoomId);
            console.log(`User ${socket.id} created room ${newRoomId}`)
            socket.emit('strangersGameWaiting', rooms[newRoomId]);
            // console.log("rooms: ", Object.keys(rooms));
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
