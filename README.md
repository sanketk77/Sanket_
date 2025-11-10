# Real-Time Canvas Party 🎨

A collaborative real-time drawing application where multiple users can draw together on a shared canvas simultaneously using WebSockets.

![Real-Time Canvas Party Preview]
## ✨ Features

- **Real-Time Collaborative Drawing**: Multiple users can draw simultaneously and see each other's work instantly
- **Drawing Tools**: Brush and eraser tools with customizable colors and stroke widths
- **User Presence**: See who's online with real-time user indicators showing cursor positions
- **Undo/Redo**: Global undo/redo functionality that works across all users
- **Keyboard Shortcuts**: 
  - `Ctrl+Z` or `Cmd+Z` - Undo
  - `Ctrl+Y` or `Cmd+Y` or `Ctrl+Shift+Z` - Redo
- **Responsive Design**: Canvas automatically resizes to fill the window

## 🚀 Quick Start

### Prerequisites
- Node.js (v12 or higher)
- npm (comes with Node.js)

### Installation & Setup

```bash
# Clone the repository
git clone https://github.com/AniBande/Colab_Canvas-.git
cd Real-Time-Canvas-Party

# Install dependencies
npm install

# Start the server
npm start
```

The server will start on `http://localhost:3000`

Open multiple browser windows/tabs and visit `http://localhost:3000` to see real-time collaboration!

## 📋 Project Structure

```
Real-Time-Canvas-Party/
├── client/
│   ├── index.html          # Main HTML interface
│   ├── style.css           # Styling
│   └── canvas.js           # Canvas drawing and WebSocket logic
├── server/
│   ├── server.js           # Express + WebSocket server
│   ├── rooms.js            # Room management (placeholder)
│   └── drawing-state.js    # State management (placeholder)
├── package.json
├── README.md               # This file
├── ARCHITECTURE.md         # Detailed architecture documentation
└── node_modules/
```

## 🎮 How to Test with Multiple Users

### Option 1: Multiple Browser Tabs
1. Start the server: `npm start`
2. Open `http://localhost:3000` in multiple tabs
3. Draw in one tab, see changes in others

### Option 2: Multiple Devices
1. Start the server on your machine: `npm start`
2. Find your machine's IP address (Windows: `ipconfig`, Mac: `ifconfig`)
3. On another device, visit: `http://<your-machine-ip>:3000`
4. Draw and collaborate!

## 🐛 Known Limitations & Bugs

### Current Limitations

1. **No Persistence**: Canvas clears on server restart (no database)
2. **Single Server**: Runs on one server instance (no scaling)
3. **No Authentication**: Anyone can connect and draw
4. **No Room System**: All users share same canvas
5. **In-Memory Only**: No stroke history storage

### Known Issues

1. **Performance**: May lag with 10+ users drawing heavily
2. **Browser Compatibility**: IE not supported (uses modern APIs)
3. **Canvas Size**: Fixed after page load

## 🔧 Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5 Canvas, CSS3
- **Backend**: Node.js, Express.js
- **Communication**: Native WebSockets (ws library)

## 📱 Browser Support

- ✅ Chrome v60+
- ✅ Firefox v55+
- ✅ Safari v11+
- ✅ Edge v79+
- ❌ Internet Explorer

## 📖 Architecture

For detailed architecture, data flow, WebSocket protocol, and conflict resolution, see [ARCHITECTURE.md](./ARCHITECTURE.md)

## ⏱️ Time Spent

- Initial implementation: ~4-6 hours
- Bug fixes & improvements: ~2-3 hours
- Documentation: ~1-2 hours
- **Total: ~7-11 hours**

## 🚀 Future Enhancements

- [ ] Database persistence
- [ ] User authentication
- [ ] Multiple rooms
- [ ] More drawing tools (shapes, text, layers)
- [ ] Export to image/PDF
- [ ] Offline mode with sync



See [ARCHITECTURE.md](./ARCHITECTURE.md) for technical details and design decisions.
