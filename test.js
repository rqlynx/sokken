var express = require('express');
var app = express();
var http = require('http').Server(app);
var isKeeper = true;
const io = require('socket.io')(http);
const PORT = process.env.PORT || 7000;

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
});

http.listen(PORT, function () {
	//Connection Check <PORT>
	console.log('server listening. Port:' + PORT);
});

io.on('connection', function (socket) {
	//Connection Check <Join User>
	if (isKeeper == true) {
		console.log("keeper is connected");
		isKeeper = false;
	} else {
	/*
		ここでHTMLを受け取りたい
	*/
		console.log("user is connected");
	}

	/* Client -> Server -> Client */

	//Sink <chat>
	socket.on('message', function (msg) {
		console.log('message: ' + msg);
		io.emit('message', msg);
	});
	//Sink <saveMemo>
	socket.on('saveMemo',function(context){
		//確認用
		console.log('update:memoContext' + context);
		io.emit('saveMemo',context);
	});
	//Sink <addMemo>
	socket.on('addMemo',function(html){
		console.log('Update:addMemo');
		io.emit('addMemo',html);
	});
});

io.on('disconnect', function() { 
    console.log('user has been disconnected');
  });
