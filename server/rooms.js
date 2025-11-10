/**
 * Room Management Module
 * Handles creation, deletion, and user management for collaborative drawing rooms
 */

class RoomManager {
    constructor() {
        this.rooms = {};
    }

    createRoom(roomId) {
        if (!this.rooms[roomId]) {
            this.rooms[roomId] = {
                id: roomId,
                users: [],
                drawingState: [],
                createdAt: new Date()
            };
        }
        return this.rooms[roomId];
    }

    addUserToRoom(roomId, userId) {
        const room = this.rooms[roomId];
        if (room && !room.users.includes(userId)) {
            room.users.push(userId);
        }
    }

    removeUserFromRoom(roomId, userId) {
        const room = this.rooms[roomId];
        if (room) {
            room.users = room.users.filter(id => id !== userId);
            if (room.users.length === 0) {
                delete this.rooms[roomId];
            }
        }
    }

    getRoom(roomId) {
        return this.rooms[roomId];
    }

    getAllRooms() {
        return this.rooms;
    }
}

module.exports = RoomManager;
