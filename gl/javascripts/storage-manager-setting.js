/**
 * The setting manage part of local storage
 */
/* The definition of system setting as JSON:
sysSettingParams={
	paletteColor: [r,g,b], // (r,g,b) tuple from 0~255
	brush: [brushes], // refer to BrushManager.brushes
	lastWorkspace: { // last opened workspace
		file, // a reference in STORAGE.FILE, including the size of the paper
		window:{ // transformation status of the window
			trans:{x,y},
			rot,
			flip,
			scale
		}
	},
	preference:{ // user preferences
		language, // tag such as "en" or "zh-CN"
		channelBitDepth, // bit per channel
		displaySettings:{ // see ENV.displaySettings
			antiAlias,
			enableTransformAnimation
		}
	},
	windowParams // params from the url call
}
*/

STORAGE.SETTING={};

STORAGE.SETTING.init=function(callback){
	const windowParams=STORAGE.SETTING.initWindowParams();
	localforage.getItem("system-setting").then(v=>{
		// fill in missing objects
		v=v||{};
		v.preference=v.preference||{};
		v.preference.displaySettings=v.preference.displaySettings||{};
		v.preference.debugger=v.preference.debugger||{};
		v.windowParams=windowParams;
		callback(v);
	}).catch(function(err) {
		console.warn("Error when trying to load system settings at start!");
		console.log(err);
	});
}
STORAGE.SETTING.initWindowParams=function(){
	const query=window.location.search;
	const hash=window.location.hash.substring(1); // remove #
	const lang=window.navigator.language; // in RFC standard

	const urlParamsToObject=s=>{
		usp=new URLSearchParams(s);
		obj={};
		for(const kv of usp.entries()){
			obj[kv[0]]=kv[1];
		}
		return obj;
	};
	
	return {
		query: urlParamsToObject(query),
		hash: hash,
		lang: lang
	};
}

STORAGE.SETTING.saveAllSettings=function(){
	console.log("Try to save all system settings");
	localforage.setItem("system-setting",{ // system setting structure
		paletteColor: PALETTE.rgb,
		preference:{
			language: LANG.nowLang,
			channelBitDepth: CANVAS.rendererBitDepth,
			displaySettings: ENV.displaySettings
		}
	}).then(v=>{
		// successfully saved
	}).catch(err=>{
		console.error(err);
	});
}