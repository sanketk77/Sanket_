// Dynamically determine WebSocket URL based on current host
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsHost = window.location.hostname;
const wsPort = window.location.port || '3000';
const socket = new WebSocket(`${wsProtocol}//${wsHost}:${wsPort}`);

// WebSocket connection error handling
socket.addEventListener('open', () => {
    console.log('WebSocket connected successfully');
});

socket.addEventListener('error', (error) => {
    console.error('WebSocket error:', error);
    alert('Failed to connect to WebSocket server. Make sure the server is running on port ' + wsPort);
});

socket.addEventListener('close', () => {
    console.log('WebSocket connection closed');
});

const canvas = document.querySelector("#draw");
const container = document.querySelector('.container');
const colorPicker = document.querySelector("#colorPicker");
const lineWidthSlider = document.querySelector("#lineWidth");
const lineWidthValue = document.querySelector("#lineWidthValue");
const toolToggle = document.querySelector("#toolToggle");
const eraserToggle = document.querySelector("#eraserToggle");
const undoBtn = document.querySelector("#undoBtn");
const redoBtn = document.querySelector("#redoBtn");
const toolbar = document.querySelector(".toolbar");
const ctx = canvas.getContext("2d");
let myUserId = null;
const onlineUsersEl = document.querySelector("#onlineUsers");
let onlineUsers = new Set();

function renderOnlineUsers() {
	if (!onlineUsersEl) return;
	const users = Array.from(onlineUsers).sort((a, b) => a - b);
	if (users.length === 0) {
		onlineUsersEl.innerHTML = '';
		return;
	}
	onlineUsersEl.innerHTML = users.map(id => {
		return `<span class="user-pill"><span class="user-dot"></span> User ${id}</span>`;
	}).join('');
}

// Set canvas size to fill container (below toolbar)
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight - 70; // Subtract toolbar height
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);
ctx.strokeStyle = colorPicker.value;
ctx.lineJoin = "round";
ctx.lineCap = "round";
ctx.lineWidth = parseInt(lineWidthSlider.value);

let isDrawing = false;
let lastX = 0
let lastY = 0;

// Store user's selected color and line width separately
let userSelectedColor = colorPicker.value;
let userSelectedLineWidth = parseInt(lineWidthSlider.value);
let isEraserMode = false;

// Global strokes list and per-user redo stacks
// Each stroke stores: userId, segments[], color, lineWidth, isEraser, strokeId, active
let allStrokes = []; // chronological list of all strokes from all users
let currentStroke = null; // Current stroke being drawn
let redoStacksByUser = {}; // { [userId]: Stroke[] }

// Update color when user selects a new color
colorPicker.addEventListener('change', (e) => {
    userSelectedColor = e.target.value;
    ctx.strokeStyle = userSelectedColor;
});

// Update line width when user changes the slider
lineWidthSlider.addEventListener('input', (e) => {
    userSelectedLineWidth = parseInt(e.target.value);
    ctx.lineWidth = userSelectedLineWidth;
    lineWidthValue.textContent = e.target.value;
});

// Tool toggle handlers
toolToggle.addEventListener('click', () => {
    isEraserMode = false;
    toolToggle.classList.add('active');
    eraserToggle.classList.remove('active');
    ctx.globalCompositeOperation = 'source-over';
});

eraserToggle.addEventListener('click', () => {
    isEraserMode = true;
    eraserToggle.classList.add('active');
    toolToggle.classList.remove('active');
    ctx.globalCompositeOperation = 'destination-out';
});


function draw(e) {
    if (!isDrawing || !currentStroke) return;
    // Don't draw if mouse is over toolbar area
    if (e.clientY < 70) {
        isDrawing = false;
        return;
    }
    
    // Set composite operation based on mode
    ctx.globalCompositeOperation = isEraserMode ? 'destination-out' : 'source-over';
    
    // For eraser, we don't need a color, but for brush we use selected color
    if (!isEraserMode) {
        ctx.strokeStyle = userSelectedColor;
    }
    ctx.lineWidth = userSelectedLineWidth;
    
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    
    // Add segment to current stroke
    currentStroke.segments.push({
        initialX: lastX,
        initialY: lastY,
        finalX: e.offsetX,
        finalY: e.offsetY
    });
    
    const drawingData = {
        eventType: 'drawing',
        initialX: lastX,
        initialY: lastY,
        finalX: e.offsetX,
        finalY: e.offsetY,
        color: isEraserMode ? null : userSelectedColor,
        lineWidth: userSelectedLineWidth,
        isEraser: isEraserMode,
		strokeId: currentStroke.strokeId,
		userId: myUserId
    };
    [lastX, lastY] = [e.offsetX, e.offsetY];
    socket.send(JSON.stringify(drawingData));
}

function displayCursor(e) {
    const mouseData = {
        eventType: 'mouse',
        x: e.offsetX,
        y: e.offsetY
    }
    socket.send(JSON.stringify(mouseData));
}

window.addEventListener("mousedown", (e) => {
    // Don't start drawing if clicking on toolbar or its children, or if mouse is in toolbar area
    if (toolbar.contains(e.target) || e.clientY < 70) {
        return;
    }
    // Only start drawing if clicking on the canvas
    if (e.target !== canvas) {
        return;
    }
    isDrawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
    
    // Start a new stroke for history tracking
    // CRITICAL: Store the exact color at the moment the stroke starts
    // This color will be used for ALL segments in this stroke and NEVER changes
    const strokeId = Date.now() + '-' + Math.random();
    // Ensure we always have a valid color, never undefined or null for non-eraser strokes
    const strokeColor = isEraserMode ? null : (userSelectedColor || document.querySelector("#colorPicker").value || '#000000');
    currentStroke = {
        strokeId: strokeId,
        segments: [],
        color: strokeColor, // Store the exact color - this is the color for the entire stroke
        lineWidth: userSelectedLineWidth,
        isEraser: isEraserMode,
        userId: myUserId,
        active: true
    };
    
    // Clear current user's redo stack when starting a new drawing
    if (myUserId != null) {
        redoStacksByUser[myUserId] = [];
    }
    updateUndoRedoButtons();
    
    // Add initial point to current stroke
    currentStroke.segments.push({
        initialX: lastX,
        initialY: lastY,
        finalX: e.offsetX,
        finalY: e.offsetY
    });
    
    // Set composite operation based on mode
    ctx.globalCompositeOperation = isEraserMode ? 'destination-out' : 'source-over';
    
    // For eraser, we don't need a color, but for brush we use selected color
    if (!isEraserMode) {
        ctx.strokeStyle = userSelectedColor;
    }
    ctx.lineWidth = userSelectedLineWidth;
    
    const drawingData = {
        eventType: 'drawing',
        initialX: lastX,
        initialY: lastY,
        finalX: e.offsetX,
        finalY: e.offsetY,
        color: isEraserMode ? null : userSelectedColor,
        lineWidth: userSelectedLineWidth,
        isEraser: isEraserMode,
        strokeId: strokeId,
        userId: myUserId
    }
    socket.send(JSON.stringify(drawingData));
});
window.addEventListener("mousemove", draw);
window.addEventListener("mouseup", () => {
    if (isDrawing && currentStroke && currentStroke.segments.length > 0) {
        // Save completed stroke to global list - make deep copy to preserve properties
        const completedStroke = JSON.parse(JSON.stringify({
            ...currentStroke,
            userId: myUserId,
            active: true
        }));
        allStrokes.push(completedStroke);
        currentStroke = null;
        updateUndoRedoButtons();
    }
    isDrawing = false;
});
window.addEventListener("mouseout", () => {
    if (isDrawing && currentStroke && currentStroke.segments.length > 0) {
        // Save completed stroke to global list - make deep copy to preserve properties
        const completedStroke = JSON.parse(JSON.stringify({
            ...currentStroke,
            userId: myUserId,
            active: true
        }));
        allStrokes.push(completedStroke);
        currentStroke = null;
        updateUndoRedoButtons();
    }
    isDrawing = false;
});
window.addEventListener('mousemove', displayCursor);

// Redraw entire canvas from strokes - uses exact stored colors
function redrawCanvas() {
    // Clear canvas completely
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Redraw all active strokes in chronological order
    for (let i = 0; i < allStrokes.length; i++) {
        const stroke = allStrokes[i];
        if (!stroke || !stroke.active || !stroke.segments || stroke.segments.length === 0) continue;
        
        // CRITICAL: Set the exact color for this stroke BEFORE drawing
        // This color was stored when the stroke was created and never changes
        if (!stroke.isEraser) {
            // For brush strokes, ALWAYS use the stored color
            // If somehow the color is missing (which shouldn't happen now), use the color picker's value
            ctx.strokeStyle = stroke.color || document.querySelector("#colorPicker").value || '#000000';
            
            // Log warning if a stroke is missing its color (for debugging)
            if (!stroke.color) {
                console.warn('Stroke missing color:', stroke.strokeId);
            }
        } else {
            // For eraser, color doesn't matter (we use destination-out)
            ctx.strokeStyle = '#000000';
        }
        
        // Set composite operation and line width for this stroke
        ctx.globalCompositeOperation = stroke.isEraser ? 'destination-out' : 'source-over';
        ctx.lineWidth = stroke.lineWidth;
        
        // Draw ALL segments in this stroke with the SAME color
        for (const segment of stroke.segments) {
            ctx.beginPath();
            ctx.moveTo(segment.initialX, segment.initialY);
            ctx.lineTo(segment.finalX, segment.finalY);
            ctx.stroke();
        }
    }
    
    // Restore current user's settings for future drawing
    ctx.globalCompositeOperation = isEraserMode ? 'destination-out' : 'source-over';
    if (!isEraserMode) {
        ctx.strokeStyle = userSelectedColor;
    }
    ctx.lineWidth = userSelectedLineWidth;
}

// Undo function
function performUndo() {
    if (myUserId == null) return;
    // Find last active stroke by this user
    for (let i = allStrokes.length - 1; i >= 0; i--) {
        const s = allStrokes[i];
        if (s.userId === myUserId && s.active) {
            // Deactivate and push to this user's redo stack
            s.active = false;
            if (!redoStacksByUser[myUserId]) redoStacksByUser[myUserId] = [];
            redoStacksByUser[myUserId].push(JSON.parse(JSON.stringify(s)));
            redrawCanvas();
            // Broadcast undo to all users
            socket.send(JSON.stringify({
                eventType: 'undo',
                strokeId: s.strokeId
            }));
            updateUndoRedoButtons();
            return;
        }
    }
}

// Redo function
function performRedo() {
    if (myUserId == null) return;
    const stack = redoStacksByUser[myUserId] || [];
    if (stack.length === 0) return;
    // Restore last undone stroke for this user
    const restoredStroke = JSON.parse(JSON.stringify(stack.pop()));
    // Find the stroke by id in allStrokes and reactivate, or append if missing
    let found = allStrokes.find(s => s.strokeId === restoredStroke.strokeId);
    if (found) {
        found.active = true;
    } else {
        restoredStroke.active = true;
        allStrokes.push(restoredStroke);
    }
    redrawCanvas();
    // Broadcast redo to all users - send complete stroke with color preserved
    socket.send(JSON.stringify({
        eventType: 'redo',
        stroke: restoredStroke
    }));
    updateUndoRedoButtons();
}

// Update undo/redo button states
function updateUndoRedoButtons() {
    const userId = myUserId;
    const canUndo = userId != null && allStrokes.some(s => s.userId === userId && s.active);
    const canRedo = userId != null && (redoStacksByUser[userId] && redoStacksByUser[userId].length > 0);
    
    undoBtn.disabled = !canUndo;
    redoBtn.disabled = !canRedo;
    
    if (undoBtn.disabled) {
        undoBtn.style.opacity = '0.5';
        undoBtn.style.cursor = 'not-allowed';
    } else {
        undoBtn.style.opacity = '1';
        undoBtn.style.cursor = 'pointer';
    }
    
    if (redoBtn.disabled) {
        redoBtn.style.opacity = '0.5';
        redoBtn.style.cursor = 'not-allowed';
    } else {
        redoBtn.style.opacity = '1';
        redoBtn.style.cursor = 'pointer';
    }
}

// Undo/Redo button handlers
undoBtn.addEventListener('click', performUndo);
redoBtn.addEventListener('click', performRedo);

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
    // Don't trigger if user is typing in an input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        performUndo();
    } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        performRedo();
    }
});

// Initialize button states
updateUndoRedoButtons();

// event listener to handle WebSocket messages
socket.addEventListener('message', (e) => {
    const drawingData = JSON.parse(e.data);
    if (drawingData.eventType === 'welcome') {
        myUserId = drawingData.id;
        // Initialize redo stack for this user
        redoStacksByUser[myUserId] = redoStacksByUser[myUserId] || [];
		// Track self online
		onlineUsers.add(myUserId);
		renderOnlineUsers();
        updateUndoRedoButtons();
        return;
    }
	if (drawingData.eventType === 'roster') {
		onlineUsers = new Set(Array.isArray(drawingData.users) ? drawingData.users : []);
		renderOnlineUsers();
		return;
	}
    if (drawingData.eventType === 'drawing') {
        // Check if this is part of a new stroke or existing stroke
        let stroke = allStrokes.find(s => s.strokeId === drawingData.strokeId);
        
        if (!stroke) {
            // New stroke - create it with the exact color from the drawing data
            // CRITICAL: Store the color exactly as received - this is the color for the entire stroke
            const strokeColor = drawingData.isEraser ? null : (drawingData.color || '#000000');
            stroke = {
                strokeId: drawingData.strokeId,
                segments: [],
                color: strokeColor, // Store the exact color - never change this
                lineWidth: drawingData.lineWidth,
                isEraser: drawingData.isEraser,
                userId: drawingData.id || drawingData.userId || null,
                active: true
            };
            allStrokes.push(stroke);
            // Clear redo stack for the author when new drawing comes in
            const authorId = stroke.userId;
            if (authorId != null) {
                redoStacksByUser[authorId] = [];
            }
            updateUndoRedoButtons();
        }
        
        // IMPORTANT: Never modify the stroke's color after it's created
        // The color is set once when the stroke is first created and must remain constant
        
        // Add segment to stroke
        stroke.segments.push({
            initialX: drawingData.initialX,
            initialY: drawingData.initialY,
            finalX: drawingData.finalX,
            finalY: drawingData.finalY
        });
        
        // Draw the segment using the stroke's stored color
        ctx.globalCompositeOperation = drawingData.isEraser ? 'destination-out' : 'source-over';
        ctx.lineWidth = drawingData.lineWidth;
        if (!drawingData.isEraser && drawingData.color) {
            ctx.strokeStyle = drawingData.color;
        }
        
        ctx.beginPath();
        ctx.moveTo(drawingData.initialX, drawingData.initialY);
        ctx.lineTo(drawingData.finalX, drawingData.finalY);
        ctx.stroke();
        
        // Restore composite operation based on current user's mode
        ctx.globalCompositeOperation = isEraserMode ? 'destination-out' : 'source-over';
        if (!isEraserMode) {
            ctx.strokeStyle = userSelectedColor;
        }
        ctx.lineWidth = userSelectedLineWidth;
    } else if (drawingData.eventType === 'mouse') {
        const { x, y, id } = drawingData;
        let userElement = document.querySelector(`div[data-id="${id}"]`);
        if (userElement == null) {
            const randHexColor = '#' + (Math.random() * 0xFFFFFF << 0).toString(16).padStart(6, '0');
            const cursorDiv = document.createElement('div');
            cursorDiv.innerHTML = `<i class="fa-solid fa-arrow-pointer" style="color:${randHexColor} "></i><span>User ${id}</span>`;
            cursorDiv.classList.add('user-cursor');
            cursorDiv.dataset.id = id;
            container.appendChild(cursorDiv);
        }
        userElement.style.top = y + "px";
        userElement.style.left = x + "px";

    } else if (drawingData.eventType === 'connection') {
        const { id } = drawingData;
        console.log("New user connect: ", id);
		onlineUsers.add(id);
		renderOnlineUsers();
        const randHexColor = '#' + (Math.random() * 0xFFFFFF << 0).toString(16).padStart(6, '0');
        const cursorDiv = document.createElement('div');
        cursorDiv.innerHTML = `<i class="fa-solid fa-arrow-pointer" style="color:${randHexColor} "></i><span>User ${id}</span>`;
        cursorDiv.classList.add('user-cursor');
        cursorDiv.dataset.id = id;
        container.appendChild(cursorDiv);

    } else if (drawingData.eventType === 'disconnect') {
        const { id } = drawingData;
		onlineUsers.delete(id);
		renderOnlineUsers();
        let userElement = document.querySelector(`div[data-id="${id}"]`);
        if (userElement != null) {
            userElement.remove();
        }
    } else if (drawingData.eventType === 'undo') {
        // Handle undo from another user: deactivate only the specified stroke
        const stroke = allStrokes.find(s => s.strokeId === drawingData.strokeId);
        if (stroke && stroke.active) {
            stroke.active = false;
            const authorId = stroke.userId != null ? stroke.userId : drawingData.id;
            if (authorId != null) {
                if (!redoStacksByUser[authorId]) redoStacksByUser[authorId] = [];
                // Push a copy to the author's redo stack
                redoStacksByUser[authorId].push(JSON.parse(JSON.stringify(stroke)));
            }
            redrawCanvas();
            updateUndoRedoButtons();
        }
    } else if (drawingData.eventType === 'redo') {
        // Handle redo from another user
        if (drawingData.stroke) {
            // Ensure stroke has user info, is active, and preserve color
            const restoredStroke = JSON.parse(JSON.stringify({
                ...drawingData.stroke,
                userId: drawingData.stroke.userId != null ? drawingData.stroke.userId : (drawingData.id || null),
                active: true,
                // Ensure color is preserved exactly as it was
                color: drawingData.stroke.isEraser ? null : (drawingData.stroke.color || document.querySelector("#colorPicker").value || '#000000')
            }));
            // Find and reactivate or append
            let found = allStrokes.find(s => s.strokeId === restoredStroke.strokeId);
            if (found) {
                found.active = true;
            } else {
                allStrokes.push(restoredStroke);
            }
            // Remove from the author's redo stack if present
            const authorId = restoredStroke.userId;
            if (authorId != null && redoStacksByUser[authorId]) {
                const idx = redoStacksByUser[authorId].findIndex(s => s.strokeId === restoredStroke.strokeId);
                if (idx !== -1) redoStacksByUser[authorId].splice(idx, 1);
            }
            redrawCanvas();
            updateUndoRedoButtons();
        }
    }
});
