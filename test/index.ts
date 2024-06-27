import XMPP from '../src/index'
import { Account } from '../src/types/Account';

const account: Required<Account> = {
    accountId: process.env.ACCOUNT_ID ?? '',
    accessToken: process.env.ACCESS_TOKEN ?? '',
    displayName: process.env.DISPLAY_NAME ?? ''
};

const partyId = process.env.PARTY_ID ?? '';

console.log('Starting...')

const xmpp = new XMPP();
await xmpp.waitForReady();

const jid = await xmpp.login(account);

xmpp.startHeartbeats(jid);

xmpp.setPresence("Battle Royale Lobby - 1/16");

xmpp.joinParty(account, jid, partyId);

xmpp.sendPartyMsg(partyId, "hi");

