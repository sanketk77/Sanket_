/**
 * Canvas State Management Module
 * Manages the drawing state and stroke history for the collaborative canvas
 */

class DrawingStateManager {
    constructor() {
        this.allStrokes = [];
        this.redoStacksByUser = {};
    }

    addStroke(stroke) {
        this.allStrokes.push(stroke);
    }

    removeStroke(strokeId) {
        this.allStrokes = this.allStrokes.filter(s => s.strokeId !== strokeId);
    }

    getStrokeById(strokeId) {
        return this.allStrokes.find(s => s.strokeId === strokeId);
    }

    getAllStrokes() {
        return this.allStrokes;
    }

    getActiveStrokes() {
        return this.allStrokes.filter(s => s.active);
    }

    getUserStrokes(userId) {
        return this.allStrokes.filter(s => s.userId === userId);
    }

    deactivateStroke(strokeId) {
        const stroke = this.getStrokeById(strokeId);
        if (stroke) {
            stroke.active = false;
        }
    }

    reactivateStroke(strokeId) {
        const stroke = this.getStrokeById(strokeId);
        if (stroke) {
            stroke.active = true;
        }
    }

    addToRedoStack(userId, stroke) {
        if (!this.redoStacksByUser[userId]) {
            this.redoStacksByUser[userId] = [];
        }
        this.redoStacksByUser[userId].push(stroke);
    }

    popFromRedoStack(userId) {
        if (this.redoStacksByUser[userId]) {
            return this.redoStacksByUser[userId].pop();
        }
        return null;
    }

    clearRedoStack(userId) {
        this.redoStacksByUser[userId] = [];
    }

    clearAllState() {
        this.allStrokes = [];
        this.redoStacksByUser = {};
    }
}

module.exports = DrawingStateManager;
