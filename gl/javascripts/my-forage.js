/**
 * Dependent: localForage.js
 * Manage the stores by yourself!
 * dropInstance in localForage may be buggy! (stuck/not always successful)
 * 
 * NOTICE: no "::" in keywords! either storename or key
 */

class MyForage{
	/**
	 * Using name to create a new database
	 * Simulate Store operation in database using your own manager
	 * @param String name 
	 */
	constructor(name){
		this.name=name;
		this.storage=localforage.createInstance({
			name: name,
			storeName: "storage"
		});
		this.keyList=localforage.createInstance({
			name: name,
			storeName: "keys"
		});
	}

	createStore(storeName){
		if(storeName.indexOf("::")>=0){
			return new Promise.reject("Illegal identifier :: in store name");
		}
		this.keyList.getItem(storeName).then(val=>{
			if(val===null){ // no such store, create one
				return this.keyList.setItem(storeName,{}).then(()=>true);
			}
			return false; // already existing
		});
	}

	setItem(storeName,key,value){
		if(storeName.indexOf("::")>=0){
			return new Promise.reject("Illegal identifier :: in store name");
		}
		if(key.indexOf("::")>=0){
			return new Promise.reject("Illegal identifier :: in key");
		}
		return this.keyList.getItem(storeName).then(oldKeys=>{
			if(oldKeys===null){ // no such store
				return new Promise.reject("Store "+storeName+" not found");
			}
			const itemName=storeName+"::"+key;
			return this.storage.setItem(itemName,value).then(()=>oldKeys);
		}).then(oldKeys=>{
			
		});


		this.storage.setItem(itemName,value).then(()=>{
			

		});
	}

	dropStore(storeName){
		
	}
}