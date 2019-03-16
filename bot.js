const Telegraf = require('telegraf');
const request = require('request');
const WS = require('ws');
const ReconnectingWebSocket = require('reconnecting-websocket');
const { diff } = require('just-diff');
const dataService = require('./dataService');
const config = require('./config.json');

const wsOptions = {
  WebSocket: WS,
};

const newBlockHeaderSubscription = {
    "method": "subscribe",
    "params": ["tm.event='NewBlockHeader'"],
    "jsonrpc": "2.0"
}

const bot = new Telegraf(config.tokenbot, {
  telegram: {
    webhookReply: false,
  },
});
bot.telegram.getMe().then((botInfo) => {
    bot.options.username = botInfo.username;
    console.log("Initialized", botInfo.username);
});

dataService.loadUsers();
bot.launch();

let lastState = {};
let newState = {};
let changes = [];

const wsCyber = new ReconnectingWebSocket(config.cyberdnodeWS, [], wsOptions);

wsCyber.addEventListener('open', async () => {
    try { 
        request(config.cybernodeRPC+'/staking/validators', function (error, response, data) {
            data = JSON.parse(data).result;
            for(i = 0; i < data.length; i++) {
                newState[data[i].operator_address] = data[i];
            }
            lastState = newState;
            wsCyber.send(JSON.stringify(newBlockHeaderSubscription));
        });
    } catch (e) {
        console.log(e);
    }
});

wsCyber.addEventListener('message', async (msg) => {
    try {
        // console.log(JSON.parse(msg.data).result.data.value.header.last_block_id.hash);
        request(config.cybernodeRPC+'/staking/validators', function (error, response, data) {
            data = JSON.parse(data).result;
            for(i = 0; i < data.length; i++) {
                newState[data[i].operator_address] = data[i];
            }
            changes = diff(lastState, newState);
            if (changes.length != 0) {
                changes.forEach(function(item) {
                    if (item.op == 'replace') {
                        switch(item.path[1]) {
                            case 'jailed':
                                sendJailChangedMessage(item.path[0]);
                                break;
                            case 'delegator_shares':
                                sendDelegationChangedMessage(item.path[0]);
                                break;
                            case 'status':
                                sendStatusChangedMessage(item.path[0]);
                                break;
                            default:
                                console.log("not implemented handler");
                                break;
                        }
                    } else if (item.op == 'add') {
                        sendNewValidatorAdded(item.path[0]);
                    }
                });
            };
            lastState = newState;
            newState = {};
        });
    } catch (e) {
        console.log(e);
    }
});

function sendJailChangedMessage(address) {
    let jailed = newState[address].jailed ? "jailed 🔥. Go back online ASAP, man!" : "unjailed 😇. Welcome back validator!";
    let msg = `Validator ` + newState[address].description.moniker + ` 👽  now is ` + jailed;
    let userList = dataService.getUserList();
    userList.forEach(userId => {
        bot.telegram.sendMessage(userId, msg);
    });
}

function sendDelegationChangedMessage(address) {
    let msg = `Validator ` + newState[address].description.moniker + ` 👽 shares changed from: ` +
    parseInt(lastState[address].delegator_shares) + " CYB's to " + parseInt(newState[address].delegator_shares) + " CYB's 🚁";
    let userList = dataService.getUserList();
    userList.forEach(userId => {
        bot.telegram.sendMessage(userId, msg);
    });
}

function sendStatusChangedMessage(address) { }

function sendNewValidatorAdded(address) {
    let msg = ` New validator ` + newState[address].description.moniker + ` 👽  with stake ` + parseInt(newState[address].delegator_shares) + ` CYB's joined us 🔥 ! Welcome to CYBER and The Great Web 😇`;
    let userList = dataService.getUserList();
    userList.forEach(userId => {
        bot.telegram.sendMessage(userId, msg);
    });
}

bot.command('start', ctx => {
    dataService.registerUser(ctx);
    let startMsg = `Hello humanoids 👻, I'm cyberadmin robot which maintains 📡 CYBER network. I will ⚡️ send you notifications 📥 about network's state and you may also ask me about network stats 📊 with /stats anytime`
    ctx.reply(startMsg);
});

bot.command('stats', ctx => {
    let statsMsg;
    try {
        request(config.cybernodeRPC+'/index_stats', function (error, response, data) {
            data = JSON.parse(data).result;
            statsMsg = `Knowledge graph 🚀 have ` + data.cidsCount + ` ☝ CIDs, connected by ` + data.linksCount + ` links 🔗 powered by ` + data.accsCount + ` web3 agents.` + `\nNetwork on block ` + data.height + ` 🕐 in consensus between ` + Object.keys(lastState).length + ` 👽 validators.`;
            request(config.cybernodeRPC+'/status', function (error, response, data) {
                data = JSON.parse(data).result;
                statsMsg += `\nI'm Cyberadmin and I'm administrating ` + data.node_info.network + ` network of CYBER`;
                ctx.reply(statsMsg);
            });
        });
    } catch (e) {
        console.log(e);
    }
});