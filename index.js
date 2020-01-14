var express = require('express');
var app = express();
var http = require('http').Server(app);
var isKeeper = true;
const io = require('socket.io')(http);
const PORT = process.env.PORT || 7000;

app.use(express.static('public'));

app.get('/', function (req, res) {
	res.sendFile(__dirname + '/index.html');
});

app.get('../css/main_style.css', function (req, res) {
	res.sendFile(__dirname + '/css/main_style.css');
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

		/* この辺からダイスロール用の処理がなんやかんや書いてある */
      	// この一行だけでココフォリアではできない空白付きのCCB <= 85の判定ができるので誇っていい
		var paragraph = msg.replace(/\s+/g, "");  // 空白を空文字に置き換えて代入
		var rolldice = generolldice(paragraph);
		var achieved_value_regex = /[0-9]+$/;     // 達成値切り取り用正規表現
		achval = achieved_value_regex.exec(rolldice); // 後ろのn桁の数字を取得するための正規表現　＄が末尾の意　nは1以上
		var secret_nDn_regex = /^S[0-9]+D[0-9]+/;	// シークレットダイス用正規表現

		if(secret_nDn_regex.test(rolldice)){	// シークレットダイスの時はこっちを通る
			var sec_nDn_cut_regex = /[0-9]+D[0-9]+[<>]?[=]?[0-9]*/;	// シークレットダイス切り取り用正規表現
			secretroll = sec_nDn_cut_regex.exec(rolldice);
			var id = socket.id;
			io.to(id).emit('message', msg);
			io.to(id).emit('secret_dice', diceroll_func(secretroll,paragraph));
			socket.broadcast.emit('secret_notice', 'シークレットダイス');
		}else{
			io.emit('message', msg);	// ここで元メッセージを送信する。
			var CCB_regex = /^CCB/;
			if(CCB_regex.test(rolldice)){	// CCBはこっち
				io.emit('dicebot', CCB(rolldice,achval));
			}
			var nDn_regex = /^[0-9]+D[0-9]+/;
			if(nDn_regex.test(rolldice)){	// 1D6とかはこっち
				var dicebot_msg = diceroll_func(rolldice,paragraph);
				io.emit('dicebot', dicebot_msg);
			}
		}  
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

// サイコロための関数たち
var diceroll_func = function(rolldice,paragraph){
	var units = [];
	var dicebot_msg = ""
	for(var i = 0;i < rolldice.length;i++){
		units[i] = nDn(rolldice[i]);
		if(units[i].length != 1){
			dicebot_msg += units[i][0] + "[";
			for(var j = 1; j < units[i].length; j++){
				dicebot_msg += units[i][j]
				if(j != units[i].length - 1){
					dicebot_msg += ",";
				}
			}
			dicebot_msg += "] ";
		}
	}
	dicebot_msg += ">";
	// "1D6+1 これ+何"と、書いた場合後ろの演算子も拾ってしまう。
	// 正規表現のmatchやexecが複数回使えないのでパッと解決方法が思いつかない
	var operator = paragraph.match(/[\+\-]/g);
	var total = parseInt(units[0][0]);
	try{
		for(i = 0;i < operator.length;i++){
			if(operator[i] == "+"){
				total += parseInt(units[i+1][0]);
			}
			else if(operator[i] == "-"){
				total -= parseInt(units[i+1][0]);
			}
		}
	}
	catch(ignored){

	}
	dicebot_msg += total;
	if(/[<>]?[=]?[0-9]*/.test(paragraph)){
		dicebot_msg += achieved_check(total,paragraph);
	}
	return dicebot_msg;
}

/* 	nDnやCCB関数に渡すためのダイスコマンドを切り取る関数
*	引数：msg　元の送信文からスペースを除いたもの
*	戻り値：rolldice ダイスのロール処理に都合のいい文字列、nDnの時だけ文字列配列
*/
function generolldice(msg){
	str = msg.toUpperCase();
	str = toHalfWidth(str);
	var rolldice
	if(/:CCB[<>]?[=]?[0-9]*/.test(str)){
	  rolldice = str.match(/CCB[<>]?[=]?[0-9]*/); // CCB,CCB<=85,CCB<=>=8,CCB<100,CCB>20とかを通す正規表現
	  console.log('CCB:' + str);
	}
	if(/:[0-9]+D[0-9]+([\+\-][0-9]+D[0-9]+){0,}([\+\-][0-9]+){0,}/.test(str)){
		rolldice = str.match(/[0-9]+D?[0-9]*/g); // 1D6,1D100<=50,1D100<20などを通す正規表現 [0-9]+D[0-9]+
		console.log('nDn+nDn:' + str);
	}
	if(/:S[0-9]+D[0-9]+[<>]?[=]?[0-9]*/.test(str)){
	  rolldice = str.match(/S[0-9]+D[0-9]+[<>]?[=]?[0-9]*/);
	  console.log('secret_dice:' + str);
	}
	return rolldice;
  }
  
/* 	1D6とか1D100のような[ダイスの個数]D[ダイスの面数]のロール関数
*	引数：rolldice 1D100や3D6のような形で送られてくる
*	戻り値：dices 配列で先頭に出目の合計値、二番目からダイスの出目を格納している
*/
  var nDn = function (rolldice){
	var dices = new Array();	// ダイスの出目と合計の配列
	if(/[0-9]+D[0-9]+/.test(rolldice)){
		console.log("rolldice "+ rolldice)
		var num = /^[0-9]+/.exec(rolldice);
		var faces = /D[0-9]+/.exec(rolldice);
		faces = /[0-9]+$/.exec(faces);

		var rawdice = 0;	// 生のダイスの出目
		var dicesum = 0;	// 出目の合計
		

		for(var i = 0; i < num; i++){
		rawdice = Math.floor(Math.random() * faces) + 1;
		dicesum += rawdice;
		dices.push(rawdice);
		}
		dices.unshift(dicesum);
	}else{
		dices.push(rolldice);
	}
	return dices
  };

/* ロールの判定関数
 * 引数：出目の合計値、判定値	　
 * 戻り値：comment(成功失敗の文字列)
*/
  var achieved_check = function(total,achieved){
	console.log(achieved)
	var comment = '';
	var achieved_value;
	// 成功失敗判定
	var regex = /<=/;
	console.log("aaa" + achieved)
	if(regex.test(achieved)){
		console.log("a" + achieved)
	  if(isNullOrUndefined(achieved_value = achieved.match(/[0-9]+$/)) == false){
		console.log("b" + achieved)
		if(total <= achieved_value){
		  comment += ' > 成功';
		}else{
		  comment += ' > 失敗';
		}
	  }
	}
	regex = />=/;
	if(regex.test(achieved)){
	  if(isNullOrUndefined(achieved_value) == false){
		if(total >= achieved_value){
		  comment += ' > 成功';
		}else{
		  comment += ' > 失敗';
		}
	  }
	}
	console.log('comment:' + comment);
	return comment;
  }
  
  // クリティカル、ファンブルありの1D100ロール関数
  var CCB = function (rolldice,achieved_value){
	var dice = Math.floor(Math.random() * 100) + 1;
	var comment = '(1D100) > ' + dice;
	// どう考えてもやばいのでリファクタリングが必要同じ処理をなんとか一つにしたい 頑張れ未来の自分
	// ココフォリアに実装されてないので精神衛生のために<,>の処理は作っていない。
	var regex = /<=/;
	if(regex.test(rolldice)){
	  if(isNullOrUndefined(achieved_value) == false){
		if(dice <= achieved_value){
		  comment = '(1D100<=' + achieved_value + ') > ' + dice + ' > 成功';
		}else{
		  comment = '(1D100<=' + achieved_value + ') > ' + dice + ' > 失敗';
		}
	  }
	}
	regex = />=/;
	if(regex.test(rolldice)){
	  if(isNullOrUndefined(achieved_value) == false){
		if(dice >= achieved_value){
		  comment = '(1D100>=' + achieved_value + ') > ' + dice + ' > 成功';
		}else{
		  comment = '(1D100>=' + achieved_value + ') > ' + dice + ' > 失敗';
		}
	  }
	}
	
	// クリティカル、ファンブルの判定とコメント付与
	if(dice <= 5){
	  comment += ' 決定的成功';
	}
	else if(dice > 95){
	  comment += ' 致命的失敗';
	}
	
	return comment;
  };
  
  // NullとUndefinedチェック
  function isNullOrUndefined(o){
	return (o === undefined || o === null);
  }

  /**
 * 全角から半角への変革関数
 * 入力値の英数記号を半角変換して返却
 * [引数]   strVal: 入力値
 * [返却値] String(): 半角変換された文字列
 */
function toHalfWidth(strVal){
	// 半角変換
	var halfVal = strVal.replace(/[！-～]/g,
	  function( tmpStr ) {
		// 文字コードをシフト
		return String.fromCharCode( tmpStr.charCodeAt(0) - 0xFEE0 );
	  }
	);
   
	// 文字コードシフトで対応できない文字の変換
	return halfVal.replace(/”/g, "\"")
	  .replace(/’/g, "'")
	  .replace(/‘/g, "`")
	  .replace(/￥/g, "\\")
	  .replace(/　/g, " ")
	  .replace(/〜/g, "~");
  }
