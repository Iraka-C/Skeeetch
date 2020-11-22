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
	 * @param String storeName, cannot include "::" !
	 */
	constructor(name,storeName){
		//this.name=name;
		this.storeName=storeName||"";
		this.keys={}; // the keys of this store
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
		if(this.storeName.indexOf("::")>=0){
			this.storeName=""; // init
			return new Promise.reject("Illegal identifier :: in store name",this.storeName);
		}
		return this.storeList.getItem(this.storeName).then(val=>{
			if(val){ // already existing, read it
				this.keys=val;
				// promise fulfilled
			}
			else{ // create storeList, write it
				return this.storeList.setItem(this.storeName,{});
			}
		});
	}

	setItem(key,value){
		if(key.indexOf("::")>=0){
			return new Promise.reject("Illegal identifier :: in key",key);
		}
		const itemName=this.storeName+"::"+key;
		return this.storage.setItem(itemName,value).then(()=>{
			// set item successful, write keys to storage
			return this.storeList.setItem(this.storeName,this.keys);
		}).then(()=>{ // set key valid
			this.keys[key]=1;
		});
	}

	getItem(key){
		const itemName=this.storeName+"::"+key;
		return this.storage.getItem(itemName);
	}

	removeItem(key){
		const itemName=this.storeName+"::"+key;
		return this.storage.removeItem(itemName).then(()=>{
			// Successfully removed item
			return this.storeList.setItem(this.storeName,this.keys);
		}).then(()=>{
			// update old keys, only after successfully deleted from db
			delete this.keys[key];
		});
	}

	clear(){
		const taskList=[];
		for(const key in this.storeList){
			const itemName=this.storeName+"::"+key;
			taskList.push(this.storage.removeItem(itemName));
		}
		return Promise.all(taskList).then(()=>{
			// Successfully removed item
			// update old keys
			return this.storeList.setItem(this.storeName,{});
		}).then(()=>{ // updated
			this.keys={};
		});
	}

	keys(){ // return an array of keys, sync!
		return Object.keys(this.keys);
	}

	stores(){
		// To be continued...
	}

	drop(){
		this.clear().then(()=>{
			// Successfully removed all item
			// delete oldKeys
			return this.storeList.removeItem(this.storeName);
		}).then(()=>{ // updated
			this.keys={}; // in fact invalid
		});
	}
}