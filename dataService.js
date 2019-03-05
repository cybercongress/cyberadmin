const fs = require('fs');
var usrFileName = "./users.json";

var users = {};
var fileLocked = false;

function loadUsers() {
    fs.readFile(usrFileName, (err, data) => {
        if (err) throw err;
        users = JSON.parse(data);
    });
}

function saveUsers() {
	if(!fileLocked){
		fileLocked = true;
		var json = JSON.stringify(users);
		fs.writeFile(usrFileName, json, 'utf8', function (err) {
			if (err) throw err;
			fileLocked = false;
		})
	}
}

function registerUser(msg) {
    var uid = msg.chat.id;
    var usr = {enabled: true, data: {from: msg.from, chat: msg.chat}};
    users[uid] = usr;
    saveUsers();
}

function getUserList() {
    return Object.keys(users);
}

module.exports = {
    loadUsers,
    registerUser,
    getUserList
};