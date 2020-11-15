/**
 * Created by Iraka on 2020.04.18
 * Storage Manager for Skeeetch application
 */

STORAGE={};

/**
 * There are two parts of the storage:
 * the setting part
 * and the file part
 */
STORAGE.init=function(callback){
	STORAGE.SETTING.init().then(sysSettings=>{
		STORAGE.FILES.init(); // sync: creating localForage instance
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
			callback(sysSettings);
		});
	})
};

STORAGE.saveOnExit=function(){ // This must be synced function
	STORAGE.SETTING.saveAllSettings();
	if(ENV.displaySettings.isAutoSave){ // requires auto save on exit
		STORAGE.FILES.saveLayerTree();
	}
};