var TGBOT = require("./tg");
var config = require("./config");
var bot = new TGBOT({
    token: config.token,
    help: true
});
var db = require("./db");
var DB = new db(config.dbConnectionString);

bot.on('message', function(message) {

    if (message.chat.id == config.consoleGroup) {
        if (message.reply_to_message && message.text && message.reply_to_message.forward_from) {
            DB.findOriginalIdByFwdMsgId(message.reply_to_message.message_id, function(err, doc) {
                if (err) console.log(err);
                if (doc) bot.sendMessage(doc.chat.id, message.text, {
                    reply_to_message_id: doc.message_id
                });
            });
        }
    }
    else {
        bot.forwardMessage(config.consoleGroup, message.chat.id, message.message_id, {}, function(err, result) {
            if (err) {
                console.log(err);
                DB.saveMessage(message);
            }
            else {
                message.fwd_id = result.message_id;
                message.mention = [];
                if (message.entities) {
                    message.entities.forEach(function(entity) {
                        switch (entity.type) {
                            case 'mention':
                                message.mention.push(message.text.slice(entity.offset, entity.offset + entity.length));
                                break;
                            case 'text_mention':
                                message.mention.push(entity.user.id.toString());
                                break;
                            default:
                                // code
                        }
                    });
                }
                if (message.reply_to_message) {
                    message.mention.push(message.reply_to_message.from.id.toString());
                }
                DB.saveMessage(message);
            }
        });
    }
});


bot.on('edited_message', function(message) {
    if (message.chat.id != config.consoleGroup) {
        bot.forwardMessage(config.consoleGroup, message.chat.id, message.message_id, {}, function(err, result) {
            if (err) console.log(err);
            if (result) message.fwd_id = result.message_id;
            DB.saveMessage(message);
        });
    }
});

bot.addCmd('wmmm', function(message, args) {
    listView(message, args, DB.findMention(message.from.username, message.from.id.toString()), function(docs) {
        var text = "";
        docs.forEach(function(doc, index) {
            text += (index + 1 + ". " + (doc.from.username || doc.from.first_name) + " : " + (doc.text || "[Not Text]") + "\n");
        });
        text = text || "Nothing";
        return text;
    }, function(i, messages, cbq) {
        if (messages[i]) {
            bot.replyMessage(messages[i].chat.id, messages[i].message_id, (cbq.from.username ? "@" + cbq.from.username : cbq.from.first_name) + " ^", {
                disable_notification: true
            });
            cbq.answer("請至 " + messages[i].chat.title + " 查看");
        }
    });
}, "查看有哪些訊息提到我");


bot.addCmd('mh', function(message, args) {
    if (message.reply_to_message) {

        listView(message, args, DB.findHistory(message.reply_to_message.message_id, message.chat.id), function(docs) {
            var text = "";
            docs.forEach(function(doc, index) {
                var dateString = new Date((doc.edit_date || doc.date) * 1000).toLocaleTimeString();
                text += (index + 1 + ". " + dateString + " : " + (doc.text || "[Not Text]") + "\n");

            });
            text = text || "Nothing";
            return text;
        }, function(i, messages, cbq) {
            if (messages[i]) bot.forwardMessage(cbq.from.id, config.consoleGroup, messages[i].fwd_id);
            cbq.answer();
        });
    }
}, "訊息歷史","reply要查看的訊息後 打 /mh");

bot.addCmd('wmr', (message, args) => {
    if (message.reply_to_message) DB.findRepliedIdByMessageId(message.reply_to_message.message_id, function(err, doc) {
        if (err) console.log(err);
        if (doc && doc.reply_to_message) {
            listView(message, args, DB.findHistory(doc.reply_to_message.message_id, doc.reply_to_message.chat.id), function(docs) {
                var text = "";
                docs.forEach(function(newdoc, index) {
                    var dateString = new Date((newdoc.edit_date || newdoc.date) * 1000).toLocaleTimeString();
                    text += (index + 1 + ". " + dateString + " : " + (newdoc.text || "[Not Text]") + "\n");

                });
                text = text || "Nothing";
                return text;
            }, function(i, messages, cbq) {
                if (messages[i]) bot.forwardMessage(cbq.from.id, config.consoleGroup, messages[i].fwd_id);
                cbq.answer();
            });
        }
    });
}, "查看該訊息回復了哪則訊息","reply要查看的訊息後 打 /wmr");

bot.addCmd('search', (message, args) => {
    if (args[1]) {
        var pattern = args[0],
            chatId  = message.chat.id;

        if (args[1] == '-g') {
            args.splice(0, 2);
            pattern = args.join(' ');
            chatId  = null;
        }

        if (message.chat.type == 'private') chatId = null;

        listView(message, args, DB.listFindMessage(pattern, 'i', chatId), function(docs) {
            var text = "";
            docs.forEach(function(doc, index) {
                text += (index + 1 + ". " + (doc.from.username || doc.from.first_name) + " : " + (doc.text || "[Not Text]") + "\n");

            });
            text = text || "Nothing";
            return text;
        }, function(i, messages, cbq) {
            if (messages[i]) bot.forwardMessage(cbq.from.id, config.consoleGroup, messages[i].fwd_id);
            cbq.answer();
        });
    }
}, "搜尋訊息","/search (regex)");

function listView(message, args, iterator, processToText, whenClickNumber) {

    var gen = function*() {
        var docs = yield iterator.nextMessage((docs) => gen.next(docs));
        var messages = docs;
        message.sendToUser(processToText(docs), {
            reply_markup: JSON.stringify({
                inline_keyboard: [
                    [{
                        text: "1",
                        callback_data: "1"
                    }, {
                        text: "2",
                        callback_data: "2"
                    }, {
                        text: "3",
                        callback_data: "3"
                    }, {
                        text: "4",
                        callback_data: "4"
                    }, {
                        text: "5",
                        callback_data: "5"
                    }],
                    [{
                        text: "<",
                        callback_data: "previous"
                    }, {
                        text: ">",
                        callback_data: "next"
                    }]
                ],
                disable_notification: true
            })
        }, function(err) {
            if (err) {
                try {
                    console.log(err.message);
                    err = JSON.parse(err.message);
                }
                catch (e) {
                    console.log(e);
                }
                if (err && (err.description == "Forbidden: bot can't initiate conversation with a user" || err.description == "Bot was blocked by the user")) {
                    message.replyMsg("您需要先私訊本機器人！ OwO", {
                        reply_markup: JSON.stringify({
                            inline_keyboard: [
                                [{
                                    text: "Start",
                                    url: "http://telegram.me/" + bot.username
                                }]
                            ]
                        })
                    });
                }
            }
        }).onCallbackQuery(function(cbq) {
            if (cbq.data.match(/^\d$/)) {
                var i = Number(cbq.data) - 1;
                whenClickNumber(i, messages, cbq);
            }
            else if (cbq.data == "previous") {
                iterator.previousMessage(function(docs) {
                    messages = docs;
                    cbq.message.editText(processToText(docs));
                    cbq.answer();
                });
            }
            else if (cbq.data == "next") {
                iterator.nextMessage(function(docs) {
                    messages = docs;
                    cbq.message.editText(processToText(docs));
                    cbq.answer();
                });
            }
        });

    }();

    gen.next();

}


bot.start();
