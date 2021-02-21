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
			enableTransformAnimation,
			... ...
		}
	},
	nowFileID, // the present fileID
	windowParams // params from the url call
}
*/
"use strict";
STORAGE.SETTING={};

STORAGE.SETTING.init=function(){ // async! returns a Promise
	let v={};
	const windowParams=STORAGE.SETTING.initWindowParams();

	if(windowParams.query["reset"]){
		localStorage.removeItem("is-run");
		localStorage.removeItem("start-report");
		localStorage.removeItem("oauth-login-info"); // for cloud storage login
	}
	else{
		try{
			v=JSON.parse(localStorage.getItem("system-setting"))||{};
			// if(version<ENV.version){ // low version settings
			// 	console.log("Low version "+version+" to "+ENV.version);
			// }
		}catch(err){
			console.warn("System Setting read-error",err);
		}
	}
	
	v.palette=v.palette||{};
	v.version=v.version||0;
	v.preference=v.preference||{};
	v.preference.displaySettings=v.preference.displaySettings||{};
	v.preference.stylusSettings=v.preference.stylusSettings||{};
	v.preference.debugger=v.preference.debugger||{};
	v.nowFileID=v.nowFileID||"deadbeef"; // init ID
	v.windowParams=windowParams;

	if(windowParams.query["clear"]){ // requested contents clear
		STORAGE.FILES.clearLayerTree(); // clear opened file layerTree in localStorage
		//const filesStore=JSON.parse(localStorage.getItem("files"));
		//filesStore.fileList={}; // clear all saved file info
		// unused image data will be cleared during loading
		// previous files will be saved in filesStore.undroppedList and cleared during loading
		return localforage.dropInstance({ // clear database
			name: "img" // delete all img contents
		})
		.then(()=>{ // successfully dropped, remove from undropped
			console.log("Image Database Dropped");
		})
		.catch(err=>{
			console.warn("Something happened when dropping "+fileID,err);
		})
		.finally(()=>{ // set the fileStore to empty. Use JSON.stringify for compatibility
			localStorage.setItem("files",JSON.stringify({fileList:{},undroppedList:{}}));
		})
		.then(()=>{
			// TODO: add url param jump afterwards?
			return v; // v as param
		});
	}
	else{
		return Promise.resolve(v);
	}
}
STORAGE.SETTING.initWindowParams=function(){
	const query=window.location.search;
	const hash=window.location.hash.substring(1); // remove #
	const lang=window.navigator.language||window.navigator.browserLanguage; // in RFC standard

	const urlParamsToObject=s=>{
		const usp=new URLSearchParams(s);
		const obj={};
		for(const kv of usp.entries()){
			obj[kv[0]]=kv[1];
		}
		return obj;
	};
	
	return {
		query: urlParamsToObject(query),
		hash: hash,
		lang: lang,
		href: window.location.href,
		host: window.location.host
	};
}

STORAGE.SETTING.saveAllSettings=function(){
	// save brushes and files
	STORAGE.SETTING.saveBrushes();
	STORAGE.FILES.saveFilesStore();
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
			displaySettings: ENV.displaySettings,
			stylusSettings: CURSOR.settings
		},
		version: ENV.version,
		nowFileID: ENV.fileID
	}));
}

STORAGE.SETTING.saveBrushes=function(){ // save on exit
	const M=BrushManager.brushes.length;
	const defaultBrushJSON=new Array(M); // deep copy
	for(let i=0;i<M;i++){
		defaultBrushJSON[i]=Object.assign({},BrushManager.brushes[i]);
		delete defaultBrushJSON[i].$row; // do not record ui
	}

	const N=BrushManager.customBrushes.length;
	const customBrushJSON=new Array(N); // deep copy
	for(let i=0;i<N;i++){
		customBrushJSON[i]=Object.assign({},BrushManager.customBrushes[i]);
		delete customBrushJSON[i].$row; // do not record ui
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