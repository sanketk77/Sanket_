# Architecture Document - Real-Time Canvas Party

## 📋 Overview

Real-Time Canvas Party is a collaborative drawing application that allows multiple users to draw on a shared canvas simultaneously using WebSockets for real-time communication.

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER INTERACTION                         │
│  (Mouse draw, color change, brush size, undo/redo)             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT (canvas.js)                         │
│  • Handles DOM events                                            │
│  • Manages local stroke creation                                │
│  • Updates canvas rendering                                     │
│  • Maintains stroke history (allStrokes)                        │
│  • Tracks undo/redo stacks per user                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
        ┌───────────────────┐  ┌──────────────────┐
        │  LOCAL CANVAS     │  │  WebSocket       │
        │  ctx.stroke()     │  │  socket.send()   │
        │                   │  │                  │
        │  Immediate        │  │  Broadcasting    │
        │  Visual Feedback  │  │  to other users  │
        └───────────────────┘  └────────┬─────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
                    ▼                   ▼                   ▼
        ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐
        │  WebSocket       │  │  WebSocket       │  │ WebSocket    │
        │  Server          │  │  Server          │  │ Server       │
        │  (server.js)     │  │  (server.js)     │  │ (server.js)  │
        │                  │  │                  │  │              │
        │  Connection      │  │  Message Handler │  │ Disconnect   │
        │  Management      │  │  Broadcasting    │  │ Management   │
        └──────────────────┘  └────────┬─────────┘  └──────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
        ▼                              ▼                              ▼
┌──────────────────┐         ┌──────────────────┐         ┌──────────────────┐
│   CLIENT A       │         │   CLIENT B       │         │   CLIENT C       │
│  (canvas.js)     │         │  (canvas.js)     │         │  (canvas.js)     │
│                  │         │                  │         │                  │
│  • Receives      │         │  • Receives      │         │  • Receives      │
│    drawing data  │         │    drawing data  │         │    drawing data  │
│  • Updates local │         │  • Updates local │         │  • Updates local │
│    canvas        │         │    canvas        │         │    canvas        │
│  • Syncs state   │         │  • Syncs state   │         │  • Syncs state   │
└──────────────────┘         └──────────────────┘         └──────────────────┘
```

---

## 📡 WebSocket Protocol

### Message Types

#### 1. **Connection Messages**

**Welcome (Server → Client)**
```json
{
  "id": 1,
  "eventType": "welcome"
}
```

**Roster (Server → Client)**
```json
{
  "eventType": "roster",
  "users": [1, 2, 3]
}
```

**Connection (Server → All Clients)**
```json
{
  "id": 4,
  "eventType": "connection"
}
```

**Disconnect (Server → All Clients)**
```json
{
  "id": 2,
  "eventType": "disconnect"
}
```

#### 2. **Drawing Messages**

**Drawing Data (Client → Server → All Others)**
```json
{
  "eventType": "drawing",
  "initialX": 100,
  "initialY": 150,
  "finalX": 120,
  "finalY": 170,
  "color": "#FF5733",
  "lineWidth": 10,
  "isEraser": false,
  "strokeId": "1234567890-0.5",
  "userId": 1
}
```

**Mouse Movement (Client → Server → All Others)**
```json
{
  "eventType": "mouse",
  "x": 250,
  "y": 300
}
```

#### 3. **Undo/Redo Messages**

**Undo (Client → Server → All Others)**
```json
{
  "eventType": "undo",
  "strokeId": "1234567890-0.5"
}
```

**Redo (Client → Server → All Others)**
```json
{
  "eventType": "redo",
  "stroke": {
    "strokeId": "1234567890-0.5",
    "segments": [...],
    "color": "#FF5733",
    "lineWidth": 10,
    "isEraser": false,
    "userId": 1,
    "active": true
  }
}
```

### Server Broadcasting Logic
```
When server receives a message:
1. Parse the JSON message
2. Add sender's ID to the message
3. Send to ALL other connected clients (not the sender)
4. Clients receive and process based on eventType
```

---

## 🔙 Undo/Redo Strategy

### Local State Management

```javascript
// Per-client state
allStrokes = []              // All strokes from all users
redoStacksByUser = {
  1: [stroke1, stroke2],    // Undone strokes for user 1
  2: [stroke3],             // Undone strokes for user 2
  ...
}
```

### Undo Operation Flow

```
1. User clicks UNDO
   ↓
2. Find last active stroke by this user (traversing allStrokes backwards)
   ↓
3. Set stroke.active = false
   ↓
4. Push copy to redoStacksByUser[userId]
   ↓
5. Redraw canvas (skipping inactive strokes)
   ↓
6. Broadcast undo event to all users with strokeId
   ↓
7. Other users receive, find stroke, deactivate it, and redraw
```

### Redo Operation Flow

```
1. User clicks REDO
   ↓
2. Pop last stroke from redoStacksByUser[userId]
   ↓
3. Find stroke in allStrokes by strokeId and set active = true
   ↓
4. Redraw canvas (including reactivated stroke)
   ↓
5. Broadcast redo event with complete stroke object
   ↓
6. Other users receive, find/add stroke, set active = true, and redraw
```

### Key Design Decisions

- **Per-user undo/redo**: Each user can only undo their own strokes
- **Active flag**: Strokes are never deleted, just marked inactive
- **Global history**: Single `allStrokes` array maintains chronological order
- **Stroke preservation**: Complete stroke objects are broadcast during redo to ensure color/properties are preserved
- **New drawing clears redo**: Starting a new stroke clears that user's redo stack

---

## ⚡ Performance Decisions

### Why This Approach?

1. **Immediate Local Rendering**
   - User sees stroke immediately after drawing
   - No waiting for server round-trip
   - **Benefit**: Responsive UI, feels instant

2. **Per-Segment Broadcasting**
   - Each mouse movement segment is sent independently
   - Not waiting for stroke completion
   - **Benefit**: Other users see drawing in real-time, not after completion

3. **Strokes as Core Unit**
   - One stroke = one complete drawing action (entire mouse drag)
   - Stored with all properties (color, width, segments)
   - **Benefit**: Efficient undo/redo, clean history management

4. **Active Flag Instead of Deletion**
   - Strokes kept in `allStrokes` array, just marked inactive
   - **Benefit**: Can reconstruct any state, lighter on memory (single array), fast undo/redo

5. **Canvas Redraw on Undo/Redo**
   - Entire canvas cleared and redrawn from stroke history
   - Only happens when undo/redo triggered (not on every draw)
   - **Benefit**: Guarantees visual consistency, handles complex scenarios

6. **Color Stored at Stroke Creation**
   - Color captured when stroke starts, never changes
   - **Benefit**: Prevents color-change-during-redo bugs, accurate history

### What Could Be Optimized

- **Differential Canvas Updates**: Instead of full redraw, update only changed regions
- **Stroke Compression**: Combine multiple short segments into bezier curves
- **Server-Side State**: Move stroke history to server for persistence
- **Lazy Rendering**: Queue redraws to avoid excessive canvas operations

---

## 🚨 Conflict Resolution

### Simultaneous Drawing Scenarios

**Scenario 1: Two users drawing in overlapping areas**
```
User A: Draws at (100, 100)
User B: Draws at (105, 105) at same time

Resolution: 
- Both strokes exist in allStrokes
- Order preserved by chronological order
- Later stroke appears "on top" (drawn after)
- No conflict, strokes don't interfere with each other
```

**Scenario 2: Two users undo at same time**
```
User A: Undoes stroke SA
User B: Undoes stroke SB

Resolution:
- Each user manages their own redo stack
- User A broadcasts undo with strokeId
- User B broadcasts undo with different strokeId
- All clients receive both undos, apply both
- No conflict, independent operations
```

**Scenario 3: User A undoes, User B draws in same area**
```
User A: Undoes stroke SA
User B: Draws stroke SB

Resolution:
- SA marked inactive, SB added to allStrokes
- Order: SA (inactive) → SB (active)
- Visual: SB appears on top of erased area from SA
- Correct visual result
```

### Why This Works

1. **Stroke-level Granularity**: Operations target specific strokeId
2. **Immutable History**: Strokes never modified once created (only active flag changes)
3. **Independent User Stacks**: Each user's undo/redo doesn't affect others' stacks
4. **Chronological Order**: Single timeline prevents temporal conflicts
5. **Broadcast to All**: Everyone sees all operations in same order

### Potential Conflicts (Edge Cases)

**Issue**: If network latency varies, clients might see operations in different order
**Current Approach**: No explicit ordering guarantee (could be improved with timestamps)

**Issue**: If server broadcasts to client A before client A's own draw completes
**Current Approach**: Works because strokes have unique strokeId + userId combo

---

## 📊 System Components

### Client Side (`client/`)

| File | Purpose |
|------|---------|
| `index.html` | Main UI, toolbar, canvas element |
| `style.css` | Styling for toolbar and UI |
| `canvas.js` | All drawing logic, WebSocket handling, state management |

### Server Side (`server/`)

| File | Purpose |
|------|---------|
| `server.js` | Express server, WebSocket connection handling, message broadcasting |
| `rooms.js` | (Placeholder) Future room management |
| `drawing-state.js` | (Placeholder) Future server-side state management |

---

## 🔐 Data Consistency

### Guarantees Provided

✅ **Eventual Consistency**: All clients converge to same canvas state (after all messages received)
✅ **Chronological Order**: All clients see strokes in same order
✅ **User Isolation**: Each user's undo/redo independent

### Not Guaranteed

❌ **Immediate Consistency**: Brief moments where clients might show different states
❌ **Transaction Support**: No multi-stroke atomic operations
❌ **Persistence**: Canvas cleared on server restart

---

## 🎯 Future Improvements

1. **Server-side persistence** (database storage)
2. **Rooms/channels** (multiple independent canvases)
3. **Timestamps** (more robust ordering)
4. **Compression** (reduce network bandwidth)
5. **Authentication** (user accounts)
6. **Offline support** (local caching, sync when online)
7. **Shapes** (rectangles, circles, lines beyond just strokes)
8. **Layers** (organize drawings by layer)

---

## 📈 Scalability Notes

### Current Limitations

- **Single WebSocket server**: All clients connect to one server instance
- **In-memory state**: No database persistence
- **No horizontal scaling**: Adding servers would require load balancer + shared state

### For Production

- Use **Socket.io** with Redis adapter for multiple servers
- Move stroke history to **PostgreSQL/MongoDB**
- Implement **rate limiting** on drawing events
- Add **authentication** and **authorization**
- Use **CDN** for static assets

---

## 📝 Summary

This architecture provides a responsive, real-time collaborative drawing experience with:
- **Low latency** through immediate local rendering
- **Consistency** via chronological stroke ordering
- **Simplicity** through a single-server, in-memory design
- **Flexibility** for future enhancements
