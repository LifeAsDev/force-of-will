const C3 = globalThis.C3;
const DOM_COMPONENT_ID = "LifeAsDevWebsocket_DOMMessaging";
import ClientSignalling from "./client-signalling.js";

class SingleGlobalInstance extends globalThis.ISDKInstanceBase {
	/* _testProperty: number;
	 */
	client = null;

	_wakerWorker = null;
	constructor() {
		super({ domComponentId: DOM_COMPONENT_ID });
		const properties = this._getInitProperties();
		if (properties) {
			// note properties may be null in some cases
			/* this._testProperty = properties[0] as number; */
		}

		this.client = new ClientSignalling();

		this.client.on("connected", () => {
			this._trigger(
				C3.Plugins.Lifeasdev_MultiplayerWebsocketPlusPlugin.Cnds
					.onConnectedToSgWs
			);
		});
		this.client.on("error", () => {
			this._trigger(
				C3.Plugins.Lifeasdev_MultiplayerWebsocketPlusPlugin.Cnds.onError
			);
		});

		this.client.on("joined_room", () => {
			this._trigger(
				C3.Plugins.Lifeasdev_MultiplayerWebsocketPlusPlugin.Cnds.onJoinedRoom
			);
		});

		this.client.on("rooms_list", () => {
			this._trigger(
				C3.Plugins.Lifeasdev_MultiplayerWebsocketPlusPlugin.Cnds.onRoomList
			);
		});

		this.client.on("message", () => {
			this._trigger(
				C3.Plugins.Lifeasdev_MultiplayerWebsocketPlusPlugin.Cnds.onPeerMessage
			);
			this._trigger(
				C3.Plugins.Lifeasdev_MultiplayerWebsocketPlusPlugin.Cnds
					.onAnyPeerMessage
			);
		});

		this.client.on("peer_joined", () => {
			this._trigger(
				C3.Plugins.Lifeasdev_MultiplayerWebsocketPlusPlugin.Cnds.onPeerConnected
			);
		});
		this.client.on("disconnect", () => {
			this._trigger(
				C3.Plugins.Lifeasdev_MultiplayerWebsocketPlusPlugin.Cnds
					.onDisconnectedFromSignalling
			);
		});
		this._InitWakerWorker();
	}
	_release() {
		super._release();
	}

	/* _setTestProperty(n: number) {
        this._testProperty = n;
    }

    _getTestProperty() {
        return this._testProperty;
    }
 */
	async _InitWakerWorker() {
		this._wakerWorker = new Worker("./waker.js", {
			type: "module",
			name: "MultiplayerWaker2",
		});
		// Suponiendo que 'runtime' es el objeto que emite esos eventos
		this.runtime.addEventListener("suspend", () => {
			this._OnSuspend();
		});
		this.runtime.addEventListener("resume", () => {
			this._OnResume();
		});
		this._wakerWorker.onerror = (e) => {
			console.error("ErrorEvent :", e);
		};
		this._wakerWorker.onmessage = (e) => {
			if (e.data === "tick" && this.runtime.isSuspended) {
				performance.now();
			}
		};
		this._wakerWorker.postMessage("");
	}
	_OnSuspend() {
		this._wakerWorker && this._wakerWorker.postMessage("start");
	}
	_OnResume() {
		this._wakerWorker && this._wakerWorker.postMessage("stop");
	}
	_saveToJson() {
		return {
			// data to be saved for savegames
		};
	}
	_loadFromJson(o) {
		// load state for savegames
	}
}
C3.Plugins.Lifeasdev_MultiplayerWebsocketPlusPlugin.Instance =
	SingleGlobalInstance;
