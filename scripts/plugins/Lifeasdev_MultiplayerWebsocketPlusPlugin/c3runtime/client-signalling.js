// Asegúrate de cargar primero socket.io.min.js antes de este script
import "./socketio-client.js";
export default class ClientSignalling {
	serverUrl;
	socket = null;
	room = null;
	isHost = false;
	connected = false;
	peers = new Map();
	options;
	messageTag = "";
	eventHandlers = {};
	lastRoomsList = [];
	lastMessage = "";
	relevantPeerId = "";
	myId = "";
	leaveReason = "";
	errorMessage = "";
	constructor(options = {}) {
		this.serverUrl = "";
		this.options = {
			path: options.path || "/signalling/socket.io",
			reconnect: options.reconnect !== false,
			autoConnect: options.autoConnect !== false,
		};
	}
	// 🔹 Conectar al servidor
	connect(serverUrl, path) {
		this.options.path = path || this.options.path;
		if (this.connected) return;
		this.serverUrl = serverUrl;
		this.socket = io(this.serverUrl, {
			path: this.options.path,
			transports: ["websocket"], // fuerza websocket directo
		});

		this.socket.on("signalling:connected", () => {
			this.connected = true;
			this.myId = this.socket.id;
			this._emitLocal("connected");
		});

		this.socket.on("signalling:disconnect", () => {
			this.connected = false;
			this._emitLocal("disconnect");
		});
		this.socket.on("disconnect", (reason) => {
			console.log("Desconectado del servidor:", reason);
			this.connected = false;
			this.room = null;

			this._emitLocal("disconnect");
		});

		this.socket.on("room_created", (data) => {
			this.room = data.room;
			this.isHost = true;
			this.peers.clear();
			data.peers.forEach((p) => this.peers.set(p.id, p));
			this._emitLocal("joined_room", data);
		});

		this.socket.on("room_joined", (data) => {
			this.room = data.room;
			this.isHost = this.myId === data.hostId; // confirmar si soy host
			this.peers.clear();

			// Guardar todos los peers
			data.peers.forEach((peer) => {
				this.peers.set(peer.id, peer);

				// Solo emitir "peer_joined" para otros, no para mí
				if (peer.id !== this.myId) {
					this.relevantPeerId = peer.id;
					this._emitLocal("peer_joined", peer);
				}
			});

			this._emitLocal("joined_room");
		});

		this.socket.on("message", (data) => {
			this.onMessage(data);
		});
		this.socket.on("signalling:rooms_list", (rooms) => {
			this.lastRoomsList = rooms;
			this._emitLocal("rooms_list");
		});

		this.socket.on("peer_joined", (peer) => {
			this.peers.set(peer.id, peer);
			if (peer.id !== this.myId) {
				this.relevantPeerId = peer.id;
				this._emitLocal("peer_joined", peer);
			}
		});

		this.socket.on("peer_left", (peerId) => {
			this.peers.delete(peerId);
			this.relevantPeerId = peerId;
			this._emitLocal("peer_left", peerId);
		});
		this.socket.on("error", (errorMessage) => {
			this.errorMessage = errorMessage;
			this._emitLocal("error", errorMessage);
		});
	}
	forceDisconnect() {
		this.socket.io.engine.close();
	}
	// 🔹 Crear sala (host)
	createRoom(roomName) {
		if (!this.connected || this.room) return;
		this.socket?.emit("create_room", roomName);
	}
	// 🔹 Unirse a sala
	joinRoom(roomName) {
		if (!this.connected || this.room) return;
		this.socket?.emit("join_room", roomName);
	}
	// 🔹 Desconectar de la sala
	disconnectFromRoom() {
		if (!this.connected || !this.room) return;
		this.socket?.emit("leave_room", this.room);
		this.room = null;
		this.isHost = false;
		this._emitLocal("disconnected_from_room");
	}
	// 🔹 Desconectar del servidor de señalización
	disconnectFromSignalling() {
		if (!this.connected) return;
		this.socket?.disconnect();
		this.connected = false;
		this.room = null;
		this.isHost = false;
		this._emitLocal("disconnected_from_signalling");
	}
	sendMessage(targetId, message, tag = "") {
		if (!this.socket || !this.room) return;
		this.socket.emit("send_message", {
			targetId: targetId === "" ? undefined : targetId,
			message,
			tag,
		});
	}
	broadcastMessage(fromId, message, tag = "") {
		if (!this.socket || !this.room || !this.isHost) return;
		this.socket.emit("broadcast_message", {
			fromId,
			message,
			tag,
		});
	}
	getListRooms() {
		this.socket?.emit("list_rooms");
	}
	// 🔹 Escuchar eventos locales
	on(event, callback) {
		if (!this.eventHandlers[event]) this.eventHandlers[event] = [];
		this.eventHandlers[event].push(callback);
	}
	_emitLocal(event, data) {
		const handlers = this.eventHandlers[event];
		if (handlers) handlers.forEach((cb) => cb(data));
	}
	// placeholder para el método que manejaba mensajes del servidor
	onMessage(data) {
		this.lastMessage = data.message;
		this.messageTag = data.tag || "";
		this.relevantPeerId = data.from || "";
		this._emitLocal("message", data);
	}
}
