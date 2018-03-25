'use strict';

var os = require('os');
var nodeStatic = require('node-static');
var https = require('https');
var socketIO = require('socket.io');
var fs = require('fs');
var options = {
	key: fs.readFileSync('key.pem'),
	cert: fs.readFileSync('cert.pem')
};

var fileServer = new nodeStatic.Server();
var self = this;
var app = https
	.createServer(options, function(req, res) {
		fileServer.serve(req, res);
	})
	.listen(1794);

// User Model
var User = function(args) {
	var self = this;

	// Socket field
	self.socket = args.socket;
	// username field
	self.user = args.user;
};

self.users = [];
//socket
self.io = socketIO.listen(app);

//init function to establish connection
self.init = function() {
	//fired on connection
	self.io.on('connection', function(socket) {
		self.handleConnection(socket);
	});
};

//socket handler for incoming socket
self.handleConnection = function(socket) {
	//wait for login message
	socket.on('login', function(usernameProvided) {
		var nameBad =
			!username || usernameProvided.length < 3 || usernameProvided.length > 10;
		// check for badname
		if (nameBad) {
			socket.emit('loginNameBad', usernameProvided);
			return;
		}

		var nameExists = _.some(self.users, function(item) {
			return item.user == usernameProvided;
		});

		if (nameExists) {
			socket.emit('loginNameExist', usernameProvided);
		} else {
			//create a new user Model
			var newUser = new User({ user: usernameProvided, socket: socket });
			//push this user to users array
			self.users.push(newUser);
			// set response listeners for the new user
			self.setResponseListeners(newUser);
			//say hi to user after letting him in to room
			socket.emit('hi');
			// send user joined message to all users
			self.io.sockets.emit('userJoined', newUser.user);
		}
	});
};

//methods to set response listner
self.setResponseListeners = function(user) {
	//triggered when socket disconnects
	user.socket.on('disconnect', function() {
		// remove the user and send user left message to all sockets
		self.users.splice(self.users.indexOf(user), 1);
		self.io.sockets.emit('userLeft', user.user);
	});

	// triggered when socket requests online users
	user.socket.on('onlineUsers', function() {
		var users = _.map(self.users, function(item) {
			return item.user;
		});

		user.socket.emit('onlineUsers', users);
	});

	// triggered when socket send a chat message
	user.socket.on('chat', function(chat) {
		if (chat) {
			self.io.sockets.emit('chat', { sender: user.user, message: chat });
		}
	});
};
