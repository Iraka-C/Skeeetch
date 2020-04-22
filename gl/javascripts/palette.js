PALETTE={};

/**
 * Palette panel driver
 * RGB Mode: R(0~255), G(0~255), B(0~255)
 * HSV Mode: H(0~360), S(0~180), V(0~255)
 * For integer values, HSV covers 99.65% of the RGB space.
 */

// ====================== Palette Controller ==================
class PaletteSelector{ // Abstract!
	constructor(rgb){ // initColor
		// Fixed 256x256. Larger palette UI can be operated by css zooming.
		this.cv=$("#palette-canvas")[0];
		this.cv.width=256; // fixed size
		this.cv.height=256;
		this.ctx=this.cv.getContext("2d");
		// hue selector
		this.hcv=$("#palette-hue-selector-canvas")[0];
		this.hcv.width=360;
		this.hcv.height=120;
		this.hctx=this.hcv.getContext("2d");
		// Other settings
		this.cursor=$("#palette-cursor");
		this.colorRange="normal"; // normal, web, web-named, named, pantone
		// Init rgb, hsv
		// The purpose to maintain both rgb & hsv is that they aren't bijections
		this.setRGB(rgb||[134.0,194.0,224.0]);
	}
	_updateBanner(x){ // x: 0~1 is the position selected on banner

	}
	_updateSelector(){

	}
	_setCursor(){

	}
	_setInfo(){

	}
	_updatePaletteButton(){
		const button=$("#palette-button");
		button.css("background-color",PaletteSelector.getColorString(this.rgb));
		if(this.hsv[2]>150){
			button.css("color","#000000");
		}
		else{
			const textRGB=hsv2rgb([this.hsv[0],this.hsv[1],255]);
			button.css("color",PaletteSelector.getColorString(textRGB));
		}
		const $buttonText=$("#palette-button-text"); // shrink text width
		const k=button.width()/$buttonText.width();
		if(k<1){
			$buttonText.css("transform","scale("+k+", 1)");
		}
		else{
			$buttonText.css("transform","");
		}
	}
	/**
	 * 
	 * @param {String} s "normal"|"web-safe-color"|"web-named-color"|"named-color"|"8bit"
	 */
	// setColorRange(s){
	// 	this.colorRange=s;
	// }
	onSelectBanner(x){ // x: 0~1 on banner
	}
	onSelectSelector(x,y){ // (x,y): LU 0~1 in selector window
	}
	static getColorString(rgb){
		if(rgb[3]){
			return "rgba("+rgb[0]+","+rgb[1]+","+rgb[2]+","+rgb[3]+")";
		}
		else{
			return "rgb("+rgb[0]+","+rgb[1]+","+rgb[2]+")";
		}
	}
	getRGB(){
		return this.rgb;
	}
	getHSV(){
		return this.hsv;
	}
	setRGB(rgb){
		this.rgb=rgb;
		this.hsv=rgb2hsv(rgb);
		this._setCursor();
		this._updatePaletteButton();
		this._setInfo();
		CURSOR.updateColor(rgb);
	}
	setHSV(hsv){
		this.hsv=hsv;
		this.rgb=hsv2rgb(hsv);
		this._setCursor();
		this._updatePaletteButton();
		this._setInfo();
		CURSOR.updateColor(this.rgb);
	}
};

// ================== Render Palette ==========================

// PALETTE.setCursor=function(){
// 	PALETTE.colorSelector._setCursor(); // Used when palette size changed
	
	// const name=PALETTE.colorManager.rgb2namedColor(PALETTE.rgb)[0];
	// $("#palette-hue-value").text(Lang(name));
	//EventDistributer.footbarHint.showInfo(name);
	//$("#palette-hue-value").text(Math.round(PALETTE.hsv[0]));
// }

// ================== init ======================
PALETTE.colorSelector=null;
PALETTE.init=function(sysSettingParams){
	// Init palette color
	let rgb;
	if(sysSettingParams.paletteColor&&sysSettingParams.paletteColor.length>=3){
		rgb=sysSettingParams.paletteColor.slice(0,3);
	}
	else{ // initRGB
		rgb=[134.0,194.0,224.0];
	}
	PALETTE.colorSelector=new H_SVSelector(rgb);

	// colorManagement
	PALETTE.colorManager.init(PALETTE.namedColorList);
	//PALETTE.colorManager.init(PALETTE.pantoneColorList);
	//PALETTE.colorManager.init();

	// for selector event
	PALETTE.refreshUIParam();

	// Flags
	PALETTE.isSelectingSV=false;
	PALETTE.isSelectingHue=false;
	
	PALETTE.initPaletteWindow();

	// Palette top button
	EventDistributer.setClick($("#palette-button"),event=>{
		$("#palette-panel").animate({"height":"toggle"},300); // == .slideToggle(300)
		// The params may be changed before expanding, redraw the items
		// PALETTE.refreshUIParam();
		// PALETTE.drawHueSelector();
		// PALETTE.setCursor();
	});
};

PALETTE.initPaletteWindow=function(){
	// Not a global event: handle by palette itself
	$("#palette-panel").on("pointerdown pointermove",event=>{
		if(CURSOR.isDown){ // is drawing
			return false;
		}
		let e=event.originalEvent;
		
		// make sure to select pure color
		let x=Math.min(Math.max(e.pageX-PALETTE.offset.left,0),PALETTE.width-1)/(PALETTE.width-1);
		let y=Math.min(Math.max(e.pageY-PALETTE.offset.top,0),PALETTE.height-1)/(PALETTE.height-1);
		if(e.buttons){ // is pressing
			PALETTE.isSelectingSV=true;
			PALETTE.colorSelector.onSelectSelector(x,y);
		}
		else{
			PALETTE.isSelectingSV=false;
		}
		e.stopPropagation(); // no drawing on canvas
		return false;
	});
	$("#palette-selector").on("pointerdown",event=>{
		if(CURSOR.isDown){ // is drawing
			return false;
		}
		let e=event.originalEvent;
		PALETTE.isSelectingSV=true;

		// make sure to select pure color
		let x=Math.min(Math.max(e.pageX-PALETTE.offset.left,0),PALETTE.width-1)/(PALETTE.width-1);
		let y=Math.min(Math.max(e.pageY-PALETTE.offset.top,0),PALETTE.height-1)/(PALETTE.height-1);
		PALETTE.colorSelector.onSelectSelector(x,y);
		e.stopPropagation(); // no drawing on canvas
		return false;
	});

	// Hue selector
	const $hcv=$("#palette-hue-selector-canvas");
	$("#palette-hue-selector-canvas").on("pointerdown pointermove",event=>{
		let e=event.originalEvent;
		if(!PALETTE.isSelectingHue&&!PALETTE.isSelectingSV){
			PALETTE.isSelectingHue=true;
		}
		if(e.buttons&&PALETTE.isSelectingHue){ // is selecting
			e.stopPropagation(); // do not pass this event to SV selector
			// select
			let x=e.offsetX/$hcv.width();
			PALETTE.colorSelector.onSelectBanner(x);
			//PALETTE.setHue(360*PALETTE.hueSelectorFunc(x));
			//PALETTE.drawHueSelector(e.offsetX);
		}
		
	});
	$("#palette-hue-selector-canvas").on("pointerup",event=>{
		// recover solid selector
		//PALETTE.drawHueSelector();
	});
	$("#palette-hue-selector-canvas").on("pointerout pointercancel",event=>{
		PALETTE.isSelectingHue=false;
		//PALETTE.drawHueSelector();
	});

	//PALETTE.initHueSelector();
}

PALETTE.refreshUIParam=function(){
	const cvp=$("#palette-canvas"); // Fixed 256x256. Larger palette UI can be operated by css zooming.
	PALETTE.width=cvp.width();
	PALETTE.height=cvp.height();
	PALETTE.offset=cvp.offset();

	PALETTE.colorSelector._setCursor(); // UI changed set cursor position again
}