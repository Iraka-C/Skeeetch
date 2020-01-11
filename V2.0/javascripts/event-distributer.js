EventDistributer={};

EventDistributer.init=function(){
	EventDistributer.wheel._init();
	EventDistributer.button._init();
}

/**
 * addListener($DOMElement, callback)
 * callback function format: callback(wheelchange)
 * wheelchange: +1, 0, -1
 */
EventDistributer.wheel={
	_init:function(){
		$(window).on("wheel",EventDistributer.wheel._onwheel);
	},
	_nowListener:null, // a DOM Object
	_nowFunction:()=>{}, // a function
	/**
	 * callback(wY,wX): change on x & y: scroll up = +1, scroll down = -1
	 */
	addListener:function($element,callback){ // $element is a jQuery Object
		let el=$element[0];
		// The only hack: Deal with record during capture stage
		el.addEventListener("pointerover",event=>{
			//console.log("over");
			//console.log(event.target);
			
			EventDistributer.wheel._nowListener=el;
			EventDistributer.wheel._nowFunction=callback;
		},true);
		el.addEventListener("pointerout",event=>{ // @TODO: pointerup pointercancel?
			EventDistributer.wheel._nowListener=null;
			//console.log("out");
			//console.log(event.target);
			
		},true);
		// @TODO: Buggy! What if some events are missed or passed in the wrong order?
	},
	_onwheel:function(event){
		if(EventDistributer.wheel._nowListener&&EventDistributer.wheel._nowFunction){
			let e=event.originalEvent;
			let dx=e.wheelDeltaX;
			let dy=e.wheelDeltaY;
			let wX=dx>0?1:dx<0?-1:0;
			let wY=dy>0?1:dy<0?-1:0;
			EventDistributer.wheel._nowFunction(wY,wX); // Y first
		}
	}
};

// A button that can detect down-and-drag to its outside
/**
 * addListener($DOMElement, callback)
 * callback function format: callback(pointerchange)
 * pointerchange: {dx,dy} in pixel
 */
EventDistributer.button={
	// @TODO: Buggy! What if multitouch?
	// @TODO: Buggy! moving from one div to another while pressing also changes listener target
	_init:function(){
		$(window).on("pointermove",EventDistributer.button._onpointermove);
		$(window).on("pointerup pointercancel",EventDistributer.button._onpointerup);
	},
	isDragging:false,
	_origin:{x:NaN,y:NaN},
	_nowListener:null, // a DOM Object
	_nowFunction:()=>{}, // a function
	_nowInitValue:null,
	addListener:function($element,callback,initFunc){ // $element is a jQuery Object
		let el=$element[0];
		el.addEventListener("pointerdown",event=>{
			EventDistributer.button._nowListener=el;
			EventDistributer.button._nowFunction=callback;
			EventDistributer.button._nowInitValue=initFunc();
			EventDistributer.button._origin={x:event.clientX,y:event.clientY};
			EventDistributer.button.isDragging=true;
		},true);
	},
	_onpointermove:function(event){ // send the {dx,dy}
		if(EventDistributer.button._nowListener&&EventDistributer.button._nowFunction){
			// There is a pointer down
			// @TODO: disable drawing when dragging here
			let e=event.originalEvent;
			let dx=e.clientX-EventDistributer.button._origin.x;
			let dy=e.clientY-EventDistributer.button._origin.y;
			EventDistributer.button._nowFunction({x:dx,y:dy,initVal:EventDistributer.button._nowInitValue});
		}
	},
	_onpointerup:function(event){
		EventDistributer.button._nowListener=null;
		EventDistributer.button._origin={x:NaN,y:NaN};
		EventDistributer.button._nowInitValue={};
		EventDistributer.button.isDragging=false;
	}
}

// System hint
// Show a hint from infoFunc() when mouse over $el
EventDistributer.footbarHint=function($el,infoFunc){ // infoFunc put in closure
	$el.on("pointerover",event=>{
		EventDistributer.footbarHint.infoFunc=infoFunc; // record this function
		$("#front-info-box").html(EventDistributer.footbarHint.infoFunc());
		$("#front-info-panel").css("opacity","1");
	});
	$el.on("pointerout",event=>{
		EventDistributer.footbarHint.infoFunc=null;
		$("#front-info-panel").css("opacity","0");
	});
}
EventDistributer.footbarHint.infoFunc=null;
EventDistributer.footbarHint.update=function(){ // update when environment changes i.e. a key pressed
	if(EventDistributer.footbarHint.infoFunc){ // there's a function registered
		$("#front-info-box").html(EventDistributer.footbarHint.infoFunc());
	}
}