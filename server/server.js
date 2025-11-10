const WebSocket = require('ws');
const express = require('express');
const http = require('http');
const app = express();
let lastId;

app.use(express.static('client'));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });


const assignClientId = function (lastId, clientsLength) {
    let newId;
    if (!clientsLength || clientsLength == 1) {
        newId = 1;
    } else if (clientsLength > 1) {
        newId = lastId + 1;
    }
    return newId;
}

// WebSocket event handling
wss.on('connection', (ws) => {
    console.log('Client connected');
    clientsLength = wss.clients.size;
    lastId = assignClientId(lastId, clientsLength);;
    ws.id = lastId;
	// Send the connecting client their own id
	if (ws.readyState === WebSocket.OPEN) {
		ws.send(JSON.stringify({ id: ws.id, eventType: 'welcome' }));
	}
	// Send the connecting client the current roster (including themselves)
	try {
		const roster = Array.from(wss.clients)
			.filter(c => c.readyState === WebSocket.OPEN && typeof c.id !== 'undefined')
			.map(c => c.id);
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ eventType: 'roster', users: roster }));
		}
	} catch (e) {
		console.error('Failed to send roster:', e);
	}
    wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ id: ws.id, eventType: 'connection' }));
        }
    });
    // Handle incoming messages from clients
    ws.on('message', (message) => {
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                const ObjMessage = JSON.parse(message.toString());
                ObjMessage.id = ws.id;
                client.send(JSON.stringify(ObjMessage));
            }
        });
    });
    // Handle client disconnections
    ws.on('close', () => {
        console.log('Client disconnected', ws.id);
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ id: ws.id, eventType: 'disconnect' }));
                console.log(`{ id: ${ws.id}, eventType: 'disconnect' }`);
            }
        });
    });
});


const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`WebSocket server is running on port ${PORT}`);
});
