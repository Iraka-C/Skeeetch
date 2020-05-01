/**
 * The setting manage part of local storage
 */
/* The definition of system setting as JSON:
sysSettingParams={
	palette:{
		color: [r,g,b], // (r,g,b) tuple from 0~255
		selector: 0, // H-SV selector
		info: 0 // normal info
	}
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

STORAGE.SETTING.init=function(){ // synced
	let v={};
	const windowParams=STORAGE.SETTING.initWindowParams();
	if(windowParams.query.reset){
		STORAGE.FILES.clearLayerTree(); // Do not get files
	}
	else{
		try{
			v=JSON.parse(localStorage.getItem("system-setting"))||{};
		}catch(err){
			console.warn("System Setting read-error",err);
		}
	}
	
	v.palette=v.palette||{};
	v.preference=v.preference||{};
	v.preference.displaySettings=v.preference.displaySettings||{};
	v.preference.debugger=v.preference.debugger||{};
	v.windowParams=windowParams;
	return v;
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
	/**
	 * localForage uses async function, not guaranteed to save data before closing!
	 * Save important settings in localStorage (Sync calling).
	 * See http://vaughnroyko.com/offline-storage-indexeddb-and-the-onbeforeunloadunload-problem/
	 */
	localStorage.setItem("system-setting",JSON.stringify({ // system setting structure
		palette:{
			color: PALETTE.colorSelector.getRGB(),
			selector: PALETTE.colorSelector.typeID,
			info: PALETTE.colorSelector.getColorInfoManager().typeID
		},
		preference:{
			language: LANG.nowLang,
			channelBitDepth: CANVAS.rendererBitDepth,
			displaySettings: ENV.displaySettings
		}
	}));
}