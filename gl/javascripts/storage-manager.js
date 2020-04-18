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
	STORAGE.SETTING.init(callback); // async init!
	// @TODO: file init, this is an async loading
};

STORAGE.saveOnExit=function(){
	STORAGE.SETTING.saveAllSettings();
};