class GLVRAMManager {
	constructor(renderer,maxSize) {
		this.renderer=renderer;
		this.bitDepth=renderer.bitDepth;
		this.maxVRAMSize=maxSize||(1024*1024*1024*4); // const, 4G at most @TODO: add settings
		this.vRAMUsage=0; // total vram usage verified by manager
		this.ramUsage=0;
		this.activeTextures=new Map(); // recently active textures -> size
		this.whiteList=new Map(); // white list: won't be compressed

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
			const prevSize=this.lastVerifiedSize;
			if(prevSize>=size) {
				this.vRAMUsage+=size-prevSize;
				this.lastVerifiedSize=size;
				return;
			}
		}

		if(this.activeTextures.has(imgData)) { // already active, should be normal
			const prevSize=this.activeTextures.get(imgData);
			this.activeTextures.delete(imgData); // anyway take it out first
			this.vRAMUsage-=prevSize;
		}

		const remainingSize=this.maxVRAMSize-this.vRAMUsage;
		let sizeToRelease=size-remainingSize; // how many space needed to release from VRAM

		if(sizeToRelease>0) { // need to release this much VRAM space into RAM
			for(const [imgData,imgSize] of this.activeTextures) { // Delete first
				// Even if imgData size has changed, use stored imgSize to update usage
				// The more you expanded, the more you will be frozen
				if(imgData.isDeleted) { // already deleted/released
					if(imgData.type=="GLTexture") {
						this.vRAMUsage-=imgSize;
						sizeToRelease-=imgSize;
						//console.log("Deleted Texture "+imgData.id+" release "+(imgSize/1048576).toFixed(2)+"MB");
					}
					else { // GLRAMBuf
						this.ramUsage-=imgSize;
					}
					this.activeTextures.delete(imgData); // Safely delete, as the for loop uses iterator
				}
				if(sizeToRelease<=0) { // get enough space
					break;
				}
			}
		}
		if(sizeToRelease>0) { // still need to release
			for(const [imgData,imgSize] of this.activeTextures) {
				this.renderer.freezeImageData(imgData); // move VRAM to RAM
				this.ramUsage+=size;
				console.log("Compressed "+(imgSize/1048576).toFixed(2)+"MB");
				this.activeTextures.delete(imgData); // Safely delete, as the for loop uses iterator
				this.vRAMUsage-=imgSize;
				sizeToRelease-=imgSize;
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
		this.whiteList.set(imgData,size);
		this.vRAMUsage+=size;
	}
}