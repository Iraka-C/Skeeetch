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
		callback(sysSettings);
	})
};

STORAGE.saveOnExit=function(){ // This must be synced function
	STORAGE.SETTING.saveAllSettings();
	if(ENV.displaySettings.isAutoSave){ // requires auto save on exit
		STORAGE.FILES.saveLayerTree();
	}
};