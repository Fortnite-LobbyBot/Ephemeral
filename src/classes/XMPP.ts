import WebSocket from 'ws';
import { v4 as uuidv4 } from 'uuid';
import * as querystring from 'querystring';
import type { Account } from '../types/Account';

export class XMPP {
    private server: string;
    private session: WebSocket;

    constructor(session: WebSocket | null = null) {
        this.server = "prod.ol.epicgames.com";
        this.session = session ?? new WebSocket(`wss://xmpp-service-${this.server}`, {
            protocol: 'xmpp'
        });
    }

    async closeSession() {
        if (this.session.readyState === WebSocket.OPEN)
            this.session.close();

    }

    async waitForReady() {
        return new Promise((resolve, reject) => {
            this.session.once('open', () => {
                this.session.send(`<open xmlns="urn:ietf:params:xml:ns:xmpp-framing" to="${this.server}" version="1.0" />`);
                this.session.once('message', () => resolve(true));
            });

            this.session.once('error', (err) => {
                reject(err);
            });
        });
    }

    async getReadyConnection(): Promise<WebSocket> {
        if (this.session && this.session.readyState === WebSocket.OPEN)
            return this.session;

        await this.waitForReady();

        return this.session;
    }

    async login({ accountId, accessToken }: Account): Promise<string> {
        const uid = uuidv4().toUpperCase();
        const login = Buffer.from(`\x00${accountId}\x00${accessToken}`).toString('base64');

        return new Promise((resolve, reject) => {
            this.session.send(`<auth mechanism="PLAIN" xmlns="urn:ietf:params:xml:ns:xmpp-sasl">${login}</auth>`);

            this.session.once('message', () => {
                this.session.send(`<open xmlns="urn:ietf:params:xml:ns:xmpp-framing" to="${this.server}" version="1.0" />`);

                this.session.once('message', () => {
                    this.session.send(`<iq id="_xmpp_bind1" type="set"><bind xmlns="urn:ietf:params:xml:ns:xmpp-bind"><resource>V2:Fortnite:WIN::${uid}</resource></bind></iq>`);

                    this.session.once('message', () => {
                        this.session.send('<iq id="_xmpp_session1" type="set"><session xmlns="urn:ietf:params:xml:ns:xmpp-session"/></iq>');

                        resolve(uid);
                    });
                });
            });

            this.session.once('error', reject);
        });
    }

    joinParty({ displayName, accountId }: Required<Account>, uid: string, partyId: string) {
        const name = querystring.escape(displayName);
        this.session.send(`<presence to="Party-${partyId}@muc.prod.ol.epicgames.com/${name}:${accountId}:V2:Fortnite:WIN::${uid}"><x xmlns="http://jabber.org/protocol/muc"><history maxstanzas="50"/></x></presence>`);
    }

    sendPartyMsg(partyId: string, msg: string) {
        this.session.send(`<message to="Party-${partyId}@muc.prod.ol.epicgames.com" type="groupchat"><body>${msg}</body></message>`);
    }

    sendWhisperMsg(friendId: string, msg: string) {
        this.session.send(`<message to="${friendId}@prod.ol.epicgames.com" type="chat"><body>${msg}</body></message>`);
    }

    setPresence(status: string) {
        const statusObj = { Status: status, ProductName: "Fortnite" };
        this.session.send(`<presence><status>${JSON.stringify(statusObj)}</status></presence>`);
    }

    startHeartbeats(jid: string) {
        const sendPing = () => {
            try {
                if (this.session.readyState === WebSocket.OPEN) {
                    this.session.send(`<iq id="${uuidv4().toUpperCase()}" type="get" to="${this.server}" from="${jid}"><ping xmlns="urn:xmpp:ping"/></iq>`);
                } else {
                    clearInterval(heartbeat);
                }
            } catch (err) {
                clearInterval(heartbeat);
            }
        };

        const heartbeat = setInterval(sendPing, 60000);

        this.session.on('close', () => clearInterval(heartbeat));
        this.session.on('error', () => clearInterval(heartbeat));
    }
}
