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
	const sysSettings=STORAGE.SETTING.init(); // sync
	STORAGE.FILES.init(); // sync: creating localForage instance
	// if(sysSettings.windowParams.query["clear"]){
	// 	STORAGE.FILES.removeContent();
	// }
	callback(sysSettings);
};

STORAGE.saveOnExit=function(){ // This must be synced function
	STORAGE.SETTING.saveAllSettings();
	if(ENV.displaySettings.isAutoSave){ // requires auto save on exit
		STORAGE.FILES.saveLayerTree();
	}
};