const C3 = globalThis.C3;
C3.Plugins.Lifeasdev_MultiplayerWebsocketPlusPlugin.Cnds = {
	/* 	IsLargeNumber(this: SDKInstanceClass, num: number) {
        return num > 100;
    }, */
	onConnectedToSgWs() {
		return true;
	},
	isConnected() {
		return this.client.connected;
	},
	isInRoom() {
		return this.client.room !== null;
	},
	onError() {
		return true;
	},
	onRoomList() {
		return true;
	},
	onJoinedRoom() {
		return true;
	},
	onPeerMessage(tag) {
		return this.client.messageTag === tag;
	},
	onPeerConnected() {
		return true;
	},
	isHost() {
		return this.client.isHost;
	},
	onDisconnectedFromSignalling() {
		return true;
	},
	onPeerDisconnected() {
		return true;
	},
	onAnyPeerMessage() {
		return true;
	},
};
export {};
