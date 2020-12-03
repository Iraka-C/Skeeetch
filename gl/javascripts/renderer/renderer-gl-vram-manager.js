class GLVRAMManager {
	constructor(renderer,maxSize) {
		this.renderer=renderer;
		this.bitDepth=renderer.bitDepth;
		this.maxVRAMSize=maxSize||(1024*1024*1024*4); // const, 4G at most
		this.vRAMUsage=0; // total vram usage verified by manager
		this.ramUsage=0;
		this.activeTextures=new Map(); // recently active textures -> size, all GLTexture
		this.whiteList=new Map(); // white list: won't be compressed, all GLTexture

		this.lastVerified=null;
		this.lastVerifiedSize=0;
	}
	verify(imgData) {

		const size=imgData.width*imgData.height*4*imgData.bitDepth/8; // in bytes
		if(this.whiteList.has(imgData)) { // The size won't take much
			const prevSize=this.whiteList.get(imgData);
			this.vRAMUsage+=size-prevSize;
			return;
		}

		if(this.lastVerified==imgData) { // needn't move to rear
			// update size only
			// @TODO: what if this.vRAMUsage surpassed limit?
			this.vRAMUsage+=size-this.lastVerifiedSize;
			this.lastVerifiedSize=size;
			return;
		}

		if(this.activeTextures.has(imgData)) { // already active, should be normal
			const prevSize=this.activeTextures.get(imgData);
			// @TODO: if remaining size is enough, do not delete (causes Map reorganize)
			this.activeTextures.delete(imgData); // anyway take it out first
			this.vRAMUsage-=prevSize;
		}

		const remainingSize=this.maxVRAMSize-this.vRAMUsage;
		let sizeToRelease=size-remainingSize; // how many space needed to release from VRAM

		if(sizeToRelease>0) { // still need to release
			for(const [oldData,oldSize] of this.activeTextures){ // release old first
				this.renderer.freezeImageData(oldData); // move VRAM to RAM
				this.ramUsage+=size;
				console.log("Compressed VRAM"+(oldSize/1048576).toFixed(2)+"MB");
				this.activeTextures.delete(oldData); // Safely delete, as the for loop uses iterator
				this.vRAMUsage-=oldSize;
				sizeToRelease-=oldSize;
				if(sizeToRelease<=0) { // get enough space
					break;
				}
			}
		}

		if(imgData.type=="GLRAMBuf") { // frozen texture to be added
			this.renderer.restoreImageData(imgData);
			this.ramUsage-=size;
			//console.log("Released Texture ",imgData);
		}

		if(imgData.type=="GLTexture") { // normal texture to be added
			this.activeTextures.set(imgData,size); // set new size
			this.vRAMUsage+=size; // update usage
		}

		this.lastVerified=imgData;
		this.lastVerifiedSize=size;
		//console.log("Verified Texture ",imgData," vRAMUsage = "+(this.vRAMUsage/1048576).toFixed(2)+"MB");
	}

	// imgData won't be compressed
	addWhiteList(imgData) {
		const size=imgData.width*imgData.height*4*imgData.bitDepth/8; // in bytes
		if(this.whiteList.has(imgData)){ // already in whitelist
			const prevSize=this.whiteList.get(imgData);
			this.vRAMUsage+=size-prevSize;
		}
		else{ // not added yet
			this.whiteList.set(imgData,size);
			this.vRAMUsage+=size;
		}

		if(this.activeTextures.has(imgData)){ // remove from active texture
			const prevSize=this.activeTextures.get(imgData);
			this.activeTextures.delete(imgData); // anyway take it out first
			this.vRAMUsage-=prevSize;
		}
	}

	remove(imgData){
		const size=imgData.width*imgData.height*4*imgData.bitDepth/8; // in bytes
		if(imgData.type=="GLRAMBuf") { // frozen texture to be added
			this.ramUsage-=size;
		}
		else if(imgData.type=="GLTexture"){
			if(this.whiteList.has(imgData)){ // already in whitelist
				const prevSize=this.whiteList.get(imgData);
				this.vRAMUsage-=prevSize;
				this.whiteList.delete(imgData);
			}
			else if(this.activeTextures.has(imgData)){ // already in active
				const prevSize=this.activeTextures.get(imgData);
				this.vRAMUsage-=prevSize;
				this.activeTextures.delete(imgData);
			}
			else{
				// not recorded, do not change this.vRAMUsage
			}
		}
	}
}