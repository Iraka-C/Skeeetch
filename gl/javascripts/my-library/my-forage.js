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
		this.storeKeys={}; // the keys of this store, key: size in bytes
		this.storage=localforage.createInstance({ // the db instance: all data in all stores
			name: name,
			storeName: "storage"
		});
		this.storeList=localforage.createInstance({ // the db instance: index of all stores
			name: name,
			storeName: "store"
		});
		this.size=0;
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
			else if(typeof(value)==="object"&&!objectSet.has(value)){
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
				if(value instanceof Int8Array||value instanceof Uint8Array||value instanceof Uint8ClampedArray){
					bytes+=value.length;
				}
				else if(value instanceof Int16Array||value instanceof Uint16Array){
					bytes+=value.length*2;
				}
				else if(value instanceof Int32Array||value instanceof Uint32Array||value instanceof Float32Array){
					bytes+=value.length*4;
				}
				else if(value instanceof Float64Array||value instanceof BigInt64Array||value instanceof BigUint64Array){
					bytes+=value.length*8;
				}
				else if(value instanceof ArrayBuffer){
					bytes+=value.byteLength;
				}
				else if(value instanceof Blob){ // including File
					bytes+=value.size;
				}
				else if(value instanceof RegExp){
					bytes+=value.toString().length*2;
				}
				else if(value instanceof Map){
					for(const [k,v] in value){
						stack.push(k);
						stack.push(v);
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

	init(){ // async!
		if(this.storeName.indexOf(":")>=0){
			this.storeName=""; // init
			return new Promise.reject("Illegal identifier : in store name",this.storeName);
		}
		this.storePrefix=this.storeName+":";
		return this.storeList.getItem(this.storeName).then(val=>{
			if(val){ // already existing, read it
				this.storeKeys=val;
				return this.storeList.getItem(this.storeName+":size").then(val=>{
					if(isNaN(val)){
						// TODO: things are a bit hard: size not acquired.
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

	setItem(key,value){ // Dangerous: not thread-safe!
		if(key.indexOf(":")>=0){
			return new Promise.reject("Illegal identifier : in key",key);
		}
		const itemName=this.storePrefix+key;
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
			console.log("Trying to remove "+itemName);
			
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

	stores(){
		// To be continued...
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
}