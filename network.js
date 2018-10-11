NETWORK={
	// initParam: values, ...
};

// Network Interface
NETWORK.refreshInterval=33; // 1000ms / frame
NETWORK.init=function(){
	// Initialization, setup the callback functions
	// Start Working
	NETWORK.toInitTransform=false;
	NETWORK.isWorking=false;
	NETWORK.failCnt=0;
	NETWORK.url="192.168.43.208:2333";
	setInterval(NETWORK.loop,NETWORK.refreshInterval);
};

NETWORK.connect=function(url){
	NETWORK.url="http://"+url+"/board";
	NETWORK.isWorking=true;
	NETWORK.failCnt=0;
	console.log("Connecting "+NETWORK.url);
};

NETWORK.loop=function(){
	if(!NETWORK.isWorking){
		return;
	}
	//console.log("Send");
	try{
	    $.ajax({
	        url: NETWORK.url+"?reset="+(NETWORK.toInitTransform?1:0),//"http://192.168.1.118:2333/board"
	        type: "get",
	        dataType: "jsonp", //指定服务器返回的数据类型
	        success: function (data) {
				//console.log("Success");
				$("#ip_addr_input").css("color","#a0a0a0");
				$("#ip_hint_block").children(".setting-item-right").html("OK");
				NETWORK.failCnt=0;

				/*ENV.rotateTo(data["rotate"])
	            ENV.scaleTo(data["scale"])
	            ENV.translateTo(data["px"], data["py"])*/
				ENV.transformTo(data.px,data.py,data.rotate,data.scale);
				$("#brush_cursor_round").attr({
					"r":ENV.nowPen.size*ENV.window.scale/2
				});

	            if(parseInt(data.save)){
	            	var cv=PIXEL.blendLayers();
					ENV.downloadCanvas(cv,$("#filename_input")[0].value+".png");
	            }
				if(parseInt(data.undo)){
	            	LAYERS.undo();
	            }
				if(data.img){
					console.log("Receive Image");
					var img=new Image();
					img.src="data:image/jpeg;base64,"+data.img;
					console.log(img.src.substr(-32,32));
					img.onload=function(e){
						addNewImageLayer(this);
					}
					//console.log(data.img.substr(0,64));
				}
				else{
					//console.log("Null");
				}

	        },
	        error:function(data){
				NETWORK.failCnt++;
				if(NETWORK.failCnt>10){
					NETWORK.isWorking=false;
					$("#ip_addr_input").css("color","#ff6666");
					$("#ip_hint_block").children(".setting-item-right").html("Start");
				}
	            // console.log(data);
	            // console.log(data["info"])
	            // console.log(data["tag"])
	        },
			timeout: 2000
	    });
		if(NETWORK.toInitTransform){
			NETWORK.toInitTransform=false;
		}
	}catch(err){
		console.log(err);
	}

};
// ========= Use the following APIs to manipulate the Skeeetch =========

// scaleSize: ratio, 1.0 for the original size 100%
