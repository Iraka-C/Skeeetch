/**
 * Created by Iraka on 2020.04.18
 * Storage Manager for Skeeetch application
 */
"use strict";
const STORAGE={};

/**
 * There are two parts of the storage:
 * the setting part
 * and the file part
 */
STORAGE.init=function(callback){
	STORAGE.SETTING.init().then(sysSettings=>{
		STORAGE.FILES.init(); // sync: creating localForage instance
		/**
		 * NOTICE!!
		 * Shall organize database before any other data is read
		 * this makes dropping database more robust.
		 * 
		 * organizeDatabase() won't be called if clear=1 url param is set
		 */
		STORAGE.FILES.organizeDatabase().then(v=>{ // organize database at startup
			if(v){
				console.log("cleared",v);
				localStorage.setItem("files",JSON.stringify(STORAGE.FILES.filesStore));
				window.location.reload(false); // do not pull again
				// !! will refresh page and won't reach finally
			}
		}).catch(err=>{
			console.warn("Error when organizing database.");
		}).finally(()=>{
			$("#body-mask-panel").css("display","none"); // databse organized
			callback(sysSettings);
		});
	})
};

STORAGE.saveOnExit=function(){ // This must be synced function
	if(ENV.displaySettings.isAutoSave){ // requires auto save on exit
		STORAGE.FILES.saveLayerTree();
	}
	STORAGE.SETTING.saveAllSettings();
	localStorage.setItem("is-run","false"); // last setting before exit
};