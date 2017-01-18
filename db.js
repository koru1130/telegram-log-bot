var mongojs = require('mongojs');
var config = require("./config");

var db, dbMessages;

function DB(ConnectionString) {
    db = mongojs(ConnectionString);
    dbMessages = db.collection('messages');
}

DB.prototype.saveMessage = function(message) {
    dbMessages.insert(message);
};


DB.prototype.findMention = function(username, userid) {
    username = "@" + (username || "");

    var selector = {
        $or: [{
            mention: username
        }, {
            mention: userid
        }],
        "chat.type": {
            $not: {
                $eq: "private"
            }
        }
    };
    return this.listView(selector);
};
DB.prototype.findHistory = function(msgid, chatid) {
    var selector = {
        message_id: msgid,
        "chat.id": chatid
    };
    return this.listView(selector);
};

DB.prototype.listFindMessage = function(pattern, options) {
    var selector = {
        text: {
            $regex: pattern,
            $options: options
        },
        "chat.id": {
            $nin: config.logIgnoreGroups
        },
        "chat.type": {
            $not: {
                $eq: "private"
            }
        }
    };
    return this.listView(selector);
};

DB.prototype.findRepliedIdByMessageId = function(msgid, cb) {
    dbMessages.findOne({
        message_id: msgid
    }, {
        reply_to_message: 1
    }, cb);
};

DB.prototype.findOriginalIdByFwdMsgId = function(id, cb) {
    dbMessages.findOne({
        fwd_id: id
    }, cb);
};

DB.prototype.listView = function(selector) {

    var offsetTime = Math.floor(Date.now() / 1000);
    selector.date = {
        $lt: offsetTime
    };

    var messages = [];
    var offset = -5;

    return {
        nextMessage: function(cb) {
            if (messages[offset]) {
                offset += 5;
                cb(messages.slice(offset, offset + 5));
            }
            else {
                dbMessages.find(selector).sort({
                    date: -1
                }).limit(100, function(err, docs) {
                    if (err) console.log(err);
                    if (docs[docs.length - 1]) {
                        offset += 5;
                        offsetTime = docs[docs.length - 1].date;
                        messages = messages.concat(docs);
                        cb(messages.slice(offset, offset + 5));
                    }
                    else {
                        cb(docs);
                    }
                });
            }
        },
        previousMessage: function(cb) {
            if (offset < 5) offset = 0;
            else offset -= 5;
            if (messages[offset]) {
                cb(messages.slice(offset, offset + 5));
            }
            else {
                cb([]);
            }
        }
    };

    //gen.next(docs);    
};


module.exports = DB;
