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
	nowFileID, // the present fileID
	windowParams // params from the url call
}
*/

STORAGE.SETTING={};

STORAGE.SETTING.init=function(){ // synced
	let v={};
	const windowParams=STORAGE.SETTING.initWindowParams();

	if(windowParams.query["clear"]){ // requested contents clear
		STORAGE.FILES.clearLayerTree();
		localStorage.removeItem("files");
	}
	if(windowParams.query["reset"]){
		// Empty
	}
	else{
		try{
			v=JSON.parse(localStorage.getItem("system-setting"))||{};
			const version=v.version||0;
			if(version<ENV.version){ // low version settings
				console.log("Low version "+version+" to "+ENV.version);
			}
		}catch(err){
			console.warn("System Setting read-error",err);
		}
	}
	
	v.palette=v.palette||{};
	v.preference=v.preference||{};
	v.preference.displaySettings=v.preference.displaySettings||{};
	v.preference.debugger=v.preference.debugger||{};
	v.nowFileID=v.nowFileID||"deadbeef"; // init ID
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
		},
		version: ENV.version,
		nowFileID: ENV.fileID
	}));

	STORAGE.SETTING.saveBrushes();
	STORAGE.FILES.saveFilesStore();
}

STORAGE.SETTING.saveBrushes=function(){
	const defaultBrushJSON=BrushManager.brushes;

	const N=BrushManager.customBrushes.length;
	const customBrushJSON=new Array(N); // deep copy
	for(let i=0;i<N;i++){
		customBrushJSON[i]=Object.assign({},BrushManager.customBrushes[i]);
		if(customBrushJSON[i].brushtip){
			customBrushJSON[i].brushtip=Object.assign({},BrushManager.customBrushes[i].brushtip);
			Object.assign(customBrushJSON[i].brushtip,{
				type: "RAMBuf8",
				data: {}, // not yet, assign when loading
				bitDepth: 8
			});
		}
	}
	const activeJSON=BrushManager.activeBrush.isCustom?{
		isCustom: true,
		id: BrushManager.activeBrush.id
	}:{
		isCustom: false,
		id: BrushManager.activeBrush.proto
	};
	const brushJSON=JSON.stringify({
		default: defaultBrushJSON,
		custom: customBrushJSON, // imageData.data stored in localForage
		active: activeJSON
	});
	localStorage.setItem("brush-setting",brushJSON);
}

STORAGE.SETTING.getBrushes=function(){
	return JSON.parse(localStorage.getItem("brush-setting"));
}