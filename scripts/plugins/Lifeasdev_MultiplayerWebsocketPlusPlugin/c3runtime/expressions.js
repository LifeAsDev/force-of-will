const C3 = globalThis.C3;
C3.Plugins.Lifeasdev_MultiplayerWebsocketPlusPlugin.Exps = {
	/* 	Double(this: SDKInstanceClass, num: number) {
        return num * 2;
    }, */
	ErrorMessage() {
		return this.client.errorMessage;
	},
	CurrentRoom() {
		return this.client.room;
	},
	ListRoomCount() {
		return this.client.lastRoomsList.length;
	},
	ListRoomName(index) {
		return this.client.lastRoomsList[index] || "";
	},
	Message() {
		return this.client.lastMessage;
	},
	Tag() {
		return this.client.messageTag;
	},
	PeerID() {
		return this.client.relevantPeerId;
	},
	MyID() {
		return this.client.myId;
	},
	HostID() {
		for (const [peerId, peer] of this.client.peers) {
			if (peer.isHost) {
				return peerId;
			}
		}
		return "";
	},
	LeaveReason() {
		return this.client.leaveReason;
	},
	PeerCount() {
		return this.client.peers.size;
	},
};
export {};
