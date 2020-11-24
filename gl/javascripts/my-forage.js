/**
 * Dependent: localForage.js
 * Manage the stores by yourself!
 * dropInstance in localForage may be buggy! (stuck/not always successful)
 * 
 * NOTICE: no ":" in keywords! either storename or key
 */

class MyForage{
	/**
	 * Using name to create a new database
	 * Simulate Store operation in database using your own manager
	 * @param String name
	 * @param String storeName, cannot include ":" !
	 */
	constructor(name,storeName){
		//this.name=name;
		this.storeName=storeName||"";
		this.storeKeys={}; // the keys of this store
		this.storage=localforage.createInstance({
			name: name,
			storeName: "storage"
		});
		this.storeList=localforage.createInstance({ // the db instance of all stores
			name: name,
			storeName: "store"
		});
	}

	init(){ // async!
		if(this.storeName.indexOf(":")>=0){
			this.storeName=""; // init
			return new Promise.reject("Illegal identifier : in store name",this.storeName);
		}
		this.storePrefix=this.storeName+":";
		return this.storeList.getItem(this.storeName).then(val=>{
			if(val){ // already existing, read it
				this.storeKeys=val;
				// promise fulfilled
			}
			else{ // create storeList, write it
				return this.storeList.setItem(this.storeName,{});
			}
		});
	}

	setItem(key,value){ // Dangerous: not thread-safe!
		if(key.indexOf(":")>=0){
			return new Promise.reject("Illegal identifier : in key",key);
		}
		const itemName=this.storePrefix+key;
		return this.storage.setItem(itemName,value).then(()=>{
			// set item successful, write keys to storage
			if(!this.storeKeys[key]){
				this.storeKeys[key]=1;
				return this.storeList.setItem(this.storeName,this.storeKeys);
			}
			// else: fulfilled
		}).then(()=>{ // set key valid
			return value; // compatible to localForage method
		});
	}

	getItem(key){
		const itemName=this.storePrefix+key;
		return this.storage.getItem(itemName);
	}

	removeItem(key){ // Dangerous: not thread-safe!
		const itemName=this.storePrefix+key;
		return this.storage.removeItem(itemName).then(()=>{
			// Successfully removed item
			delete this.storeKeys[key];
			return this.storeList.setItem(this.storeName,this.storeKeys);
		});
	}

	clear(){
		const taskList=[];
		for(const key in this.storeKeys){
			const itemName=this.storePrefix+key;
			console.log("Trying to remove "+itemName);
			
			taskList.push(this.storage.removeItem(itemName));
		}
		return Promise.all(taskList).then(()=>{
			// Successfully removed item
			// update old keys
			this.storeKeys={};
			return this.storeList.setItem(this.storeName,{});
		});
	}

	keys(){ // return an array of keys, with promise
		return Promise.resolve(Object.keys(this.storeKeys));
	}

	stores(){
		// To be continued...
	}

	drop(){
		const taskList=[];
		for(const key in this.storeKeys){
			const itemName=this.storePrefix+key;
			taskList.push(this.storage.removeItem(itemName));
		}
		taskList.push(this.storeList.removeItem(this.storeName));
		return Promise.all(taskList).then(()=>{ // updated
			this.storeKeys={}; // in fact invalid
		});
	}
}