var mongojs = require('mongojs');
var config = require("./config");
var db = mongojs(config.dbConnectionString);
var dbMessages = db.collection('messages');

var i=0;
dbMessages.find({}).forEach(function(err,data) {
    if(err) console.log(err);
    var arr = [];
    if(data&&data.mention){
        data.mention.forEach(function(curr){
            arr.push(curr.toString());
        });
        dbMessages.update({_id:data._id},{$set:{mention:arr}},{},()=>{
            console.log(i++);
        });
    }else{
        console.log(i++);
    }
    
})