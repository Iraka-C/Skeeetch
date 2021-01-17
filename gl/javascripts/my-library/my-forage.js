/**
 * Dependent: localForage.js
 * Manage the stores by yourself!
 * dropInstance in localForage may be buggy! (stuck/not always successful)
 * 
 * NOTICE: no ":" in keywords! either storename or key
 */
"use strict";

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
		this.storeKeys={}; // the keys of this store, key -> size in bytes
		this.storage=localforage.createInstance({ // the db instance: all data in all stores
			name: name,
			storeName: "storage"
		});
		this.storeList=localforage.createInstance({ // the db instance: index of all stores
			name: name,
			storeName: "store"
		});
		this.size=0;

		this.savingKeyFlag=new Set(); // the keys that are under the process of saving
		this.savePendingItem=new Map(); // the (key,value) that are ready to save (the key is pending)
	}

	static _roughSizeOfObject(v){ // will never be 0
		const objectSet=new Set();
		const stack=[v];
		let bytes=8; // at least a pointer to itself
	
		while(stack.length){
			const value=stack.pop();
			if(typeof(value)==="boolean"){
				bytes+=4;
			}
			else if(typeof(value)==="string"){
				bytes+=value.length*2;
			}
			else if(typeof(value)==="number"){
				bytes+=8;
			}
			else if(value&&typeof(value)==="object"&&!objectSet.has(value)){
				// NOTE: typeof(null) is also "object"!
				if(value instanceof Element||value instanceof HTMLElement){
					continue; // do not count HTML element
				}
				if(value instanceof jQuery||value instanceof Sortable){
					continue; // do not count jQuery element
				}
				if(value instanceof Function){
					continue; // do not count functions, including arrow function
				}

				objectSet.add(value);
				if(value.byteLength){ // DataView, TypedArray, or ArrayBuffer
					bytes+=value.byteLength;
				}
				else if(value instanceof Blob){ // including File
					bytes+=value.size;
				}
				else if(value instanceof RegExp){ // worst size
					bytes+=value.toString().length*2;
				}
				else if(value instanceof Map){
					for(const [k,v] in value){
						stack.push(k,v);
					}
				}
				else if(value instanceof Set){
					for(const k in value){
						stack.push(k);
					}
				}
				else{
					for(const key in value){
						bytes+=key.length*2;
						stack.push(value[key]);
					}
				}
			}
		}
		return bytes;
	}

	/**
	 * Get the approximated storage quota in bytes
	 * @param {*} name the name of this instance
	 */
	static getDriveUsage(name){
		const storeList=localforage.createInstance({ // the db instance: index of all stores
			name: name,
			storeName: "store"
		});
		return storeList.keys().then(keys=>{
			const taskList=[];
			for(const key of keys){
				if(key.indexOf(":size")>-1){
					taskList.push(storeList.getItem(key));
				}
			}
			return Promise.all(taskList);
		}).then(sizes=>{
			let totalSize=0;
			for(const size of sizes){
				totalSize+=size;
			}
			return totalSize;
		});
	}

	static getStoreNames(name){
		const storeList=localforage.createInstance({ // the db instance: index of all stores
			name: name,
			storeName: "store"
		});
		return storeList.keys().then(keys=>{
			const nameList=[];
			for(const key of keys){
				if(key.indexOf(":size")==-1){ // a store name
					nameList.push(key);
				}
			}
			return Promise.resolve(nameList);
		});
	}

	init(){ // async!
		if(this.storeName.indexOf(":")>=0){
			this.storeName=""; // init
			return new Promise.reject("Illegal identifier : in store name",this.storeName);
		}
		this.storePrefix=this.storeName+":";

		const recalcStoreSize=keys=>{
			let totalSize=0;
			for(const size in keys){
				totalSize+=size;
			}
			return totalSize;
		};

		return this.storeList.getItem(this.storeName).then(val=>{
			if(val){ // already existing, read it
				this.storeKeys=val;
				return this.storeList.getItem(this.storeName+":size").then(val=>{
					if(isNaN(val)){
						// TODO: things are a bit hard: size not acquired.
						this.size=recalcStoreSize(this.storeKeys);
						// Really, this is the best u can do
						return this.storeList.setItem(this.storeName+":size",this.size);
					}
					else{
						this.size=val;
					}
				});
				// promise fulfilled
			}
			else{ // create storeList, write it
				return Promise.all([
					this.storeList.setItem(this.storeName,{}),
					this.storeList.setItem(this.storeName+":size",0)
				]);
			}
		});
	}

	__save(key,value){ // instant saving, no pending list
		// this function operates this.savingKeyFlag
		const itemName=this.storePrefix+key;
		this.savingKeyFlag.add(key);
		return this.storage.setItem(itemName,value).then(()=>{
			// set item successful, write keys to storage
			if(!this.storeKeys[key])this.storeKeys[key]=0;
			const prevSize=this.storeKeys[key];
			const nowSize=MyForage._roughSizeOfObject(value);
			const diff=nowSize-prevSize;
			if(diff){
				this.size+=diff;
				this.storeKeys[key]=nowSize;
				return Promise.all([
					this.storeList.setItem(this.storeName,this.storeKeys),
					this.storeList.setItem(this.storeName+":size",this.size)
				]);
			}
		}).then(()=>{
			this.savingKeyFlag.delete(key);
			if(this.savePendingItem.has(key)){ // there's a pending item
				const newValItem=this.savePendingItem.get(key);
				// newValItem is a {value:value, resolveFunc:func}
				// resolveFunc is to be called after saving key-value
				this.savePendingItem.delete(key);
				// async save the next item, and call resolveFunc
				this.__save(key,newValItem.value).then(newValItem.resolveFunc);
			}
			return value; // compatible to localForage method
		});
	}
	setItem(key,value){ // Dangerous: not thread-safe!
		if(key.indexOf(":")>=0){
			return Promise.reject("Illegal identifier : in key",key);
		}
		if(this.savingKeyFlag.has(key)){ // under saving process
			if(this.savePendingItem.has(key)){ // already pending
				const newValItem=this.savePendingItem.get(key);
				newValItem.resolveFunc(newValItem.value); // directly resolve
				// assume as saved (will be overwritten anyway)
			}
			return new Promise(resolve=>{ // only keep the last data
				this.savePendingItem.set(key,{
					value: value,
					resolveFunc: resolve
				}); // also record the resolve function and call when saved
			});
		}
		else{ // directly save
			return this.__save(key,value);
		}
	}

	getItem(key){ // can be safely called in worker: IDB will do all the queuing jobs
		const itemName=this.storePrefix+key;
		return this.storage.getItem(itemName);
	}

	removeItem(key){ // Dangerous: not thread-safe!
		const itemName=this.storePrefix+key;
		return this.storage.removeItem(itemName).then(()=>{
			// Successfully removed item
			const prevSize=this.storeKeys[key];
			this.size-=prevSize;
			delete this.storeKeys[key];
			return Promise.all([
				this.storeList.setItem(this.storeName,this.storeKeys),
				this.storeList.setItem(this.storeName+":size",this.size)
			]);
		});
	}

	clear(){
		const taskList=[];
		for(const key in this.storeKeys){
			const itemName=this.storePrefix+key;
			taskList.push(this.storage.removeItem(itemName));
		}
		return Promise.all(taskList).then(()=>{
			// Successfully removed item
			// update old keys
			this.storeKeys={};
			this.size=0;
			return Promise.all([
				this.storeList.setItem(this.storeName,{}),
				this.storeList.setItem(this.storeName+":size",0)
			]);
		});
	}

	keys(){ // return an array of keys, with promise
		return Promise.resolve(Object.keys(this.storeKeys));
	}

	size(){
		return this.size;
	}

	drop(){
		const taskList=[];
		for(const key in this.storeKeys){
			const itemName=this.storePrefix+key;
			taskList.push(this.storage.removeItem(itemName));
		}
		taskList.push(this.storeList.removeItem(this.storeName));
		taskList.push(this.storeList.removeItem(this.storeName+":size"));
		return Promise.all(taskList).then(()=>{ // updated
			this.storeKeys={}; // in fact invalid
		});
	}

	static organizeStorage(name){
		const storeList=localforage.createInstance({ // the db instance: index of all stores
			name: name,
			storeName: "store"
		});
		const storage=localforage.createInstance({ // the db instance: all contents
			name: name,
			storeName: "storage"
		});
		return Promise.all([storeList.keys(),storage.keys()]).then(([storeKeys,storageKeys])=>{
			const storeNameSet=new Set(storeKeys);
			const taskList=[];
			for(const key of storageKeys){ // organize storage
				const keyStoreName=key.substring(0,key.indexOf(":"));
				if(!storeNameSet.has(keyStoreName)){ // belong to no store
					taskList.push(storage.removeItem(key));
				}
			}
			return Promise.all(taskList).then(()=>taskList.length);
		});
	}
}