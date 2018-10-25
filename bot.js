const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const config = require('./config');
const io = require('socket.io-client');


function TelegramBoter(token){
    var bot = new TelegramBot(token, { polling: true });
    var file = config.database.bot_watcher;
    var _watcher = {};

    if(fs.existsSync(file)){
        try{
            _watcher = JSON.parse(fs.readFileSync(file, 'utf-8'));
        }catch(e){
            _watcher = {};
        }
    }

    console.log('_watcher', _watcher)

    function newWatcher(type, chatId, value, isRemove){
        if(!value) return;
        value = value.trim();

        var directives = {};
        var extract = value.split(" ");
        if(extract.length > 1){
            value = extract.shift();
            extract.forEach((directive) => {
                directive = directive.split("=");
                directives[directive[0]] = directive[1]
            })
        }

        var threshold =  10000;
        if(directives.threshold){
            try{
                threshold = parseInt(directives.threshold);
            }catch(e){
                threshold = 10000;
            }
        }

        if(isRemove){
            if(_watcher[type] && _watcher[type][value]){
                delete _watcher[type][value][chatId];
            }
            return 'unwatch '+type+"="+value;
        }else{
            console.log(type, chatId, value);
            _watcher[type] = _watcher[type] || {};
            _watcher[type][value] = _watcher[type][value] || {};
            _watcher[type][value][chatId] = threshold;
            console.log(_watcher);
            return 'watch '+type+"="+value +" threshold="+threshold;
        }
    }

    (function loop(){
        fs.writeFileSync(file, JSON.stringify(_watcher));
        setTimeout(() => {
            loop();
        }, 30 * 1000)
    })();

    bot.onText(/\/producer (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        const resp = match[1];
        bot.sendMessage(chatId, newWatcher('producer', chatId, resp));
    });

    bot.onText(/\/proxy (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        const resp = match[1];
        bot.sendMessage(chatId, newWatcher('proxy', chatId, resp));
    });


    bot.onText(/\/producer_unwatch (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        const resp = match[1];
        bot.sendMessage(chatId, newWatcher('producer', chatId, resp, true));
    });

    bot.onText(/\/proxy_unwatch (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        const resp = match[1];
        bot.sendMessage(chatId, newWatcher('proxy', chatId, resp, true));
    });

    bot.onText(/\/start/, (msg, match) => {
        const chatId = msg.chat.id;
        const resp = match[1];
        bot.sendMessage(chatId, "You can control me by sending these commands:\n\n/producer {target} threshold={threshold} - "+
        "subscribe producer voters change\n"+
        "example: /producer eosmedinodes threshold=10000 "+"\n\n"+
        "/proxy {target} threshold={threshold} - "+
        "subscribe proxy voters change\n"+
        "example: /proxy lukeeosproxy threshold=10000 \n\n"+
        "/producer_unwatch {target} - unsubscribe\n"+
        "/proxy_unwatch {target} - unsubscribe\n"+
        "\n\n");
    });


    function getNeedNotifyChats(type, typeValue, voterStaked){
        var chatIds = [];
        if(_watcher[type] && _watcher[type][typeValue]){
            var allChatIds = Object.keys(_watcher[type][typeValue]);
            if(voterStaked){
                allChatIds.forEach((chatId) => {
                    var threshold = _watcher[type][typeValue][chatId];
                    if(voterStaked >= threshold){
                        chatIds.push(chatId);
                    }
                })
            }else{
                chatIds = allChatIds;
            }
        }
        return chatIds;
    }

    function sendMessageToChats(chatIds, message){
        chatIds.forEach((chatId) => {
            console.log('send message to', chatId, message);
            bot.sendMessage(chatId, message);
        })
    }

    var messageTemplate = {
        stake: `$(refType):$(to)'s voter $(voter) [$(action)] amount=$(staked) EOS \n\nhttps://votetracker.io/#/$(link)/$(to)`,
        vote: `$(voter) [$(action) $(target)] ->  [$(to)] amount=$(stake) EOS \n\nView Details in  https://votetracker.io/#/$(link)/$(to)`,
        rank: `$(producer) rank changed from $(lastRank) to $(rank) \n\nhttps://votetracker.io`,
    }

    function templateEngine(tpl, data) {
        // console.log(tpl, data);
        var re = /\$\(([^\)]+)?\)/g, match;
        while(match = re.exec(tpl)) {
            tpl = tpl.replace(match[0], data[match[1]])
            re.lastIndex = 0;
        }
        return tpl;
    }
    
    function getNotifyMessage(log){
        var template = "";
        if(log.staked && !log.type){
            log.stake = (log.staked / 10000).toFixed(2);
        }
        if(log.type){
            if(log.producer && log.proxy){
                log.refType = 'proxy';
                log.link = 'voter';
                log.to = log.proxy;
            }else if(log.producer){
                log.refType = 'producer';
                log.to = log.producer;
                log.link = 'producer';
            }else if(log.proxy){
                log.refType = 'proxy';
                log.link = 'voter';
                log.to = log.proxy;
            }
            template = messageTemplate.stake;
        }else if(log.lastRank){
            template = messageTemplate.rank;
        }else if(log.producer || log.proxy){
            var type = 'producer';
            log.to = log.producer;
            log.link = 'producer';
            if(log.proxy){
                type = 'proxy';
                log.to = log.proxy;
                log.link = 'voter';
            }
            log.target = type;
            template = messageTemplate.vote;
        }
    
        if(template){
            return templateEngine(template, log);
        }else{
            return template;
        }
    }

    function notify(log){
        var type = 'producer';
        if(log.proxy) type = 'proxy';
        var typeValue = log[type];

        var message = getNotifyMessage(log);
        // producer proxy stake log
        if(log.producer && log.proxy){
            type = "producer";
            typeValue = log[type];
        }

        var voterStaked = log.staked / 10000;
        if(log.type){
            voterStaked = log.staked;
        }

        var needNotifyChats = getNeedNotifyChats(type, typeValue, voterStaked);
        console.log('notify', { type, typeValue, voterStaked, message, needNotifyChats });
        if(message) sendMessageToChats(needNotifyChats, message);
    }


    function notify_OLD(log){
        var type = 'producer';
        if(log.proxy) type = 'proxy';
        var typeValue = log[type];
        var voterStaked = log.staked / 10000;

        if(log.lastRank){
            var message = typeValue+" rank changed from "+log.lastRank +" to "+log.rank;
        }else if(log.type){
            var messageType = "";
            if(log.producer && log.proxy){
                type = 'producer';
                typeValue = log.producer;
            }else if(log.proxy){
                type = 'proxy';
                typeValue = log.proxy;

            }else if(log.producer){
                type = 'producer';
                typeValue = log.producer;
            }

            var message = "["+type+"] "+typeValue+"'s voter "+log.voter +" ["+log.action+"] -> "+ "["+typeValue+"] staked="+(log.staked / 10000).toFixed(2)+' EOS';
        }else{
            var message = [
                log.voter+' -> ',
                    type == 'producer' ?
                        log.action ==  "add" ? '[vote producer] -> ' : '[remove producer] -> ' :
                    log.action ==  "add" ? '[set proxy] -> ' : '[remove proxy] -> ',
                '['+typeValue+']',
                "staked="+(log.staked / 10000).toFixed(2)+' EOS'
            ].join(" ");
            console.log(message)
        }

        if(_watcher[type] && _watcher[type][typeValue]){
            console.log(message, _watcher[type][typeValue]);
            Object.keys(_watcher[type][typeValue]).forEach((chatId) => {
                var threshold = _watcher[type][typeValue][chatId];
                if(log.lastRank){
                    bot.sendMessage(chatId, message);
                }else{
                    if(voterStaked >= threshold){
                        bot.sendMessage(chatId, message);
                    }else{
                        console.log('threshold limit');
                    }
                }
            })
        }
    }

    notifyProducer = function(producer, lastRank, index){
        var nowIndex = index+1;
        var lastIndex = lastRank.index+1;
        var diffIndex = lastIndex - nowIndex;

        var log = {
            producer: producer,
            rank: nowIndex,
            lastRank: lastIndex,
            pos: (diffIndex > 0) ? "+" : "-"
        }
        
        notify(log);
    }

    return {
        notify: (log) =>{
            try{
                notify(log)
            }catch(e){
                console.log('notify', e)
            }
        }
    }
}



var token = fs.readFileSync('.token', 'utf-8');
var botter = new TelegramBoter(token.trim());
var socket = io('http://api.votetracker.io/');
socket.on('log', (log) => {
    console.log('log', log);
    botter.notify(log);
})