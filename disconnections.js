const { rooms, io } = require('./index');

// טיפול בהתנתקות מכוונת
function intentional(room, playerId) {
    // הסרת השחקן מהחדר
    room.players = room.players.filter(player => player.id !== playerId);

    // מחיקת החדר אם כל השחקנים פרשו
    if (room.players.length === 0) {
        delete rooms[room.roomId];
        console.log("rooms: ", Object.keys(rooms));
        return;
    }

    // יידוע השחקן שבפנים שהשחקן השני פרש וניצחון לו
    io.to(room.roomId).emit('playerDisconnected', playerId);
}

// טיפול בהתנתקות לא מכוונת
function accidental(room, playerId) {
    // התחלת טיימר שבסופו השחקן ייחשב שהתנתק בכוונה
    const timeout = setTimeout(() => {
        // אם השחקן עדיין מנותק אחרי 30 שניות ריפ
        intentional(room, playerId);
    }, 30000); // 30 seconds

    // שמירת הפונקציה באובייקט כדי שהשחקן יוכל להתחבר מחדש
    room.disconnectTimeout = timeout;
}

module.exports = { accidental, intentional }