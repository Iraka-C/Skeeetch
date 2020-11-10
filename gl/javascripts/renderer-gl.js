/**
 * 32-bit webgl renderer
 * On common browsers, the maximum size of a texture should be 16384^2
 */
class GLRenderer extends BasicRenderer {
	/**
	 * Constructor: when starting the whole program or switching rendering method
	 * Only one canvas: set it as target
	 */
	constructor(param) {
		super(param);

		const gl=this.canvas.getContext("webgl",{
			premultipliedAlpha: true, // premult: (r,g,b,a)->(ar,ag,ab,a)
			antialias: true
		}); // webgl context
		this.canvas.addEventListener("webglcontextlost",e => {
			// something catastrophic happened
			LOGGING&&console.error(e);
		});
		this.canvas.addEventListener("webglcontextrestored",e => {
			// Rescue happened
			LOGGING&&console.log(e);
		},false);

		this.gl=gl;
		this.bitDepth=param.bitDepth||32; // init 32-bit, every pixel
		this.viewport={
			width: this.canvas.width,
			height: this.canvas.height,
			left: 0,
			top: 0
		};

		// ================= init settings ====================
		gl.disable(gl.DEPTH_TEST); // do not use depth buffer (2d rendering) @TODO: faster?
		gl.enable(gl.BLEND); // enable blend function
		gl.blendEquation(gl.FUNC_ADD); // always add: using gl.blendFunc to erase

		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false); // loading texture
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);

		// Device dependent: float texture
		switch(this.bitDepth) {
			case 32:
				gl.getExtension("OES_texture_float");
				gl.getExtension("OES_texture_float_linear");
				gl.getExtension("WEBGL_color_buffer_float");
				gl.getExtension("EXT_float_blend");
				this.dataFormat=gl.FLOAT;
				break;
			case 16:
				const ext=gl.getExtension("OES_texture_half_float");
				gl.getExtension("OES_texture_half_float_linear");
				gl.getExtension("EXT_color_buffer_half_float");
				gl.getExtension("WEBGL_color_buffer_float"); // fallback of EXT_color_buffer_half_float
				gl.getExtension("EXT_float_blend");
				gl.HALF_FLOAT=ext.HALF_FLOAT_OES;
				this.dataFormat=gl.HALF_FLOAT;
				break;
			default:
			case 8:
				this.dataFormat=gl.UNSIGNED_BYTE;
				break;
			// case 4: // Nope, LUMINOSITY not supported
			// 	this.dataFormat=gl.UNSIGNED_SHORT_4_4_4_4;
			// 	break;
		}

		// =================== Create Programs ====================
		this._initRenderCanvasProgram();
		this._initClearCanvasProgram();

		// ================= Create Framebuffer ================
		// for clear image data
		this.framebuffer=gl.createFramebuffer(); // create a new framebuffer from gl

		// tmp: for copying
		this.tmpImageData=this.createImageData(this.viewport.width,this.viewport.height);
		// originalImageData: for buffering stroke data
		//this.originalImageData=this.createImageData(this.viewport.width,this.viewport.height);
		//this.strokeImageData=this.createImageData(this.viewport.width,this.viewport.height);
		// storing the shape of brush tip //@TODO: LUMINOSITY
		//this.brushtipImageData=this.createImageData();

		// children renderers
		this.textureBlender=new GLTextureBlender(this);
		this.imageDataFactory=new GLImageDataFactory(this);
		this.brushRenderer=new GLBrushRenderer(this);
		this.vramManager=new GLVRAMManager(this,param.maxVRAMSize);

		this.vramManager.addWhiteList(this.tmpImageData);
		this.vramManager.addWhiteList(this.brushRenderer.brushtipImageData);
	}
	free() { // death
		const gl=this.gl;
		this.textureBlender.free();
		this.imageDataFactory.free();
		this.brushRenderer.free();
		this.canvasProgram.free();
		this.clearProgram.free();
		gl.deleteFramebuffer(this.framebuffer);
		this.deleteImageData(this.tmpImageData);
		//this.deleteImageData(this.originalImageData);
		//this.deleteImageData(this.strokeImageData);
		//this.deleteImageData(this.brushtipImageData);
	}

	getGPUMemUsage() { // return GPU Memory usage in bytes
		const pixMem=this.bitDepth/8*4; // 1 pixel(RGBA)
		const cMem=this.canvas.width*this.canvas.height*pixMem; // canvas
		const tMem=this.vramManager.vRAMUsage; // verified texture VRAM
		return cMem+tMem;
	}
	getRAMUsage() {
		return 0;
	}

	_initRenderCanvasProgram() {
		// add the glsl codes inside a closure
		const vCanvasShaderSource=glsl`
			attribute vec2 a_position; // vertex position
			varying vec2 v_position;
			void main(){
				v_position=a_position;
				gl_Position=vec4(a_position*2.0-1.0,0.0,1.0); // to clip space
			}
		`;
		const fCanvasShaderSource=glsl`
			precision mediump float;
			precision mediump sampler2D;
			uniform sampler2D u_image;
			uniform vec2 u_aa_step; // anti-alias pixel interval (x,y) in sampler coordinate, may be non-int
			uniform float u_aa_cnt; // how many steps to sample
			varying highp vec2 v_position;

			const float max_its=10.;
			void main(){
				float cnt=u_aa_cnt+1.;
				vec4 totalColor=texture2D(u_image,v_position)*cnt;
				float totalCnt=cnt;
				for(float i=1.;i<max_its;i++){
					if(i>=cnt)break; // counting finished
					vec2 dPos=u_aa_step*i;
					float k=cnt-i;
					totalColor+=texture2D(u_image,v_position+dPos)*k;
					totalColor+=texture2D(u_image,v_position-dPos)*k;
					totalCnt+=k+k;
				}
				gl_FragColor=totalColor/totalCnt; // average pixel
			}
		`;
		// ================= Create program ====================
		this.canvasProgram=new GLProgram(this.gl,vCanvasShaderSource,fCanvasShaderSource);
		this.canvasProgram.setAttribute("a_position",[0,0,1,0,0,1,0,1,1,0,1,1],2);
	}

	_initClearCanvasProgram() {
		// add the glsl codes inside a closure
		const vClearShaderSource=glsl` // vertex shader for drawing a circle
			attribute vec2 a_position; // vertex position
			varying vec2 v_position;
			void main(){
				v_position=a_position;
				gl_Position=vec4(a_position*2.0-1.0,0.0,1.0); // to clip space
			}
		`;
		const fClearShaderSource=glsl`
			precision mediump float;
			varying highp vec2 v_position;
			uniform vec4 u_clear_color;
			void main(){
				gl_FragColor=u_clear_color;
			}
		`;
		// ================= Create program ====================
		this.clearProgram=new GLProgram(this.gl,vClearShaderSource,fClearShaderSource);
		this.clearProgram.setAttribute("a_position",[0,0,1,0,0,1,0,1,1,0,1,1],2);
	}

	// Init on specifying a new texture to be rendered
	init(param) {
		super.init(param); // init canvas
		this.vramManager.verify(param.imageData); // verify Texture

		if(param.imageData.type!="GLTexture") { // not GL texture type
			// @TODO: check texture bitdepth
			LOGGING&&console.warn(param.imageData);
			throw new Error("ImageData not a GLTexture");
		}
		// init rendering environment

		// attach the target texture to fbo
		this.targetImageData=param.imageData;
	}

	// Init before every stroke: setting the rendering environment
	initBeforeStroke(param) {
		super.initBeforeStroke(param);
		//LOGGING&&console.log(this.brush);
		// pre-render the brushtip data
		this.lastCircleFromPrevStroke=null;
	}

	/**
	 * render a series of key points (plate shapes) into the buffer
	 * [wL,wH,hL,hH] is the range of plates to be rendered, in paper coordinate *Note: may exceed canvas size range!
	 * kPoints[v] = [x,y,r,a], (x,y):paper coord, *a in 0~1
	 */
	// @TODO: render circles according to the actual size & position of the texture
	// @TODO: dynamically grow texture size to save graphics memory!
	// Especially in large files
	renderPoints(wL,wH,hL,hH,kPoints) {
		const imgData=this.targetImageData;

		// set blend mode
		let rgb=[this.rgb[0]/255,this.rgb[1]/255,this.rgb[2]/255]; // color to use: unmultiplied

		// a soft edge with fixed pixel width (at most 2) for anti-aliasing
		const fixedSoftEdge=this.antiAlias? Math.min((this.brush.size+1)/4,2):0;
		this.vramManager.verify(imgData);
		for(let k=0;k<kPoints.length;k++) { // each circle in sequence
			const p=kPoints[k];
			const lastP=this.lastCircleFromPrevStroke;
			const prevP=k? kPoints[k-1]:lastP? lastP:p; // p as fallback
			const plateOpa=p[5]; // plate opacity
			const softRange=this.softness+fixedSoftEdge/p[2];
			let rad=p[2];
			if(this.antiAlias&&rad<2) {
				rad=0.6+rad*0.7; // thickness compensation for thin stroke
			}

			const pressure=p[3]; // pressure considered sensitivity

			// set circle size and radius, adjust position according to the imgData, radius+0.1 for gl clipping
			this.brushRenderer.render(
				imgData,this.brush,
				[p[0],p[1]],[prevP[0],prevP[1]],rad,
				rgb,plateOpa,pressure,
				this.isOpacityLocked,softRange
			);
		}

		// Adjusting valid area is done by this.brushRenderer.render

		// update last circle
		if(kPoints.length) {
			this.lastCircleFromPrevStroke=kPoints[kPoints.length-1];
		}
	}

	// source is a texture
	// the minimum scale is 0.1, at most 10px antialiasing (which is 21x merging)
	drawCanvas(imgData,antiAliasRadius) {
		antiAliasRadius=antiAliasRadius||0; // 0px as default

		const gl=this.gl;
		const program=this.canvasProgram;
		const w=this.canvas.width;
		const h=this.canvas.height;
		const iw=imgData.width;
		const ih=imgData.height;

		const isToDraw=iw&&ih;
		const tmp=this.tmpImageData;
		// horizontal blur
		if(isToDraw) {
			this.vramManager.verify(imgData);
			program.setTargetTexture(tmp.data); // draw to temp data
			gl.viewport(0,0,w,h);
			gl.clearColor(0,0,0,0);
			gl.clear(gl.COLOR_BUFFER_BIT);

			program.setSourceTexture("u_image",imgData.data);
			program.setUniform("u_aa_step",[1/w,0]);
			program.setUniform("u_aa_cnt",antiAliasRadius);
			gl.viewport(imgData.left,h-ih-imgData.top,iw,ih); // set viewport according to the image data
			gl.blendFunc(this.gl.ONE,this.gl.ZERO); // copy
			program.run();
		}

		// vertical blur
		program.setTargetTexture(null); // draw to canvas
		gl.viewport(0,0,w,h);
		gl.clearColor(0,0,0,0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		if(!isToDraw) { // drawing an empty texture
			return;
		}

		program.setSourceTexture("u_image",tmp.data);
		program.setUniform("u_aa_step",[0,1/h]);
		program.setUniform("u_aa_cnt",antiAliasRadius);
		gl.blendFunc(this.gl.ONE,this.gl.ZERO); // copy
		program.run();
	}

	// ============= ImageData (texture) Operation =============
	/**
	 * imagedata.type:
	 * "GLTexture": WebGL texture for GL renderer
	 * "GLRAMBuf": texture restored in RAM buffer, cannot be used directly
	 * "GLRAMBuf8": texture in RAM using 8bit format: created by filesaver (not this function)
	 */
	createImageData(w,h,param) { // imagedata contains a texture
		w=w||0;
		h=h||0;
		const isFrozen=!!(param&&param.isFrozen);

		let imgData=null;
		if(isFrozen) { // create array
			const SIZE=w*h*(this.dataFormat==gl.UNSIGNED_SHORT_4_4_4_4? 1:4);
			switch(this.dataFormat) {
				case gl.FLOAT: imgData=Float32Array(SIZE); break;
				case gl.UNSIGNED_SHORT_4_4_4_4:
				case gl.HALF_FLOAT: imgData=Uint16Array(SIZE); break;
				case gl.UNSIGNED_BYTE: imgData=Uint8Array(SIZE); break;
			}
		}
		else { // create gl texture
			const gl=this.gl;
			imgData=GLProgram.createAndSetupTexture(gl);
			gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,w,h,0,gl.RGBA,this.dataFormat,null);
		}

		return { // a texture - image data type
			type: isFrozen? "GLRAMBuf":"GLTexture",
			data: imgData,
			id: ENV?ENV.hash("t"):null, // for DEBUG ONLY! Does not guarantee uniqueness
			bitDepth: this.bitDepth,
			width: w, // width and ...
			height: h, // ... height are immutable: do not change by assignment!
			left: 0, // left & top can be changed directly: all relative to the viewport
			top: 0,
			tagColor: [
				Math.random()*0.6+0.2,
				Math.random()*0.7+0.1,
				Math.random()*0.7+0.2
			],
			validArea: { // area that has content, coordinate {w,h,l,t} same as `this`
				width: 0,
				height: 0,
				left: 0,
				top: 0
			}
		};
		// If you modify the structure here, also modify GLImageDataFactory.getRAMBufFromTexture
	}

	deleteImageData(imgData) { // discard an image data after being used
		this.vramManager.remove(imgData); // stop monitoring
		if(imgData.type=="GLTexture") {
			this.gl.deleteTexture(imgData.data);
		}
		//imgData.isDeleted=true; // set tag, ONLY HERE!
	}

	// clear the contents with transparent black or white
	// color is in [r,g,b,a], all 0~1 non-alpha-premultiplied
	// if color is null and opacity is not locked, the validArea will be reset
	// **NOTE** even if color is [0,0,0,0], the validArea won't change!
	clearImageData(target,color,isOpacityLocked) {
		if(!(target.width&&target.height)) { // No pixel, needless to clear
			return;
		}
		if(target.type=="GLRAMBuf") { // No need to de-compression
			if(!isOpacityLocked) { // clear to single color
				const tmpData=this.createImageData(target.width,target.height);
				target.data=tmpData.data; // transfer data
				tmpData.data=null; // release reference
				target.type="GLTexture";
			}
		}
		this.vramManager.verify(target);
		const gl=this.gl;
		const tmpColor=color? [...color]:isOpacityLocked? [1,1,1,1]:[0,0,0,0];
		tmpColor[0]*=tmpColor[3];
		tmpColor[1]*=tmpColor[3];
		tmpColor[2]*=tmpColor[3];
		if(isOpacityLocked) { // the opacity of each pixel doesn't change
			const program=this.clearProgram;
			program.setTargetTexture(target.data);
			program.setUniform("u_clear_color",tmpColor);
			gl.blendFunc(gl.DST_ALPHA,gl.ZERO);
			gl.viewport(0,0,target.width,target.height);
			program.run();
		}
		else { // Pre-multiply
			gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer); // render to a texture
			gl.framebufferTexture2D( // framebuffer target
				gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target.data,0);
			gl.viewport(0,0,target.width,target.height);
			gl.clearColor(...tmpColor); // Set clear color
			gl.clear(gl.COLOR_BUFFER_BIT); // Clear the color buffer with specified clear color
			target.validArea=color?
				{ // with full screen content
					width: target.width,
					height: target.height,
					left: target.left,
					top: target.top
				}:{ // fully transparent, no content
					width: 0,
					height: 0,
					left: 0,
					top: 0
				};
		}
	}

	clearScissoredImageData(target,range) { // target, range, all in paper coordinate
		if(!(target.width&&target.height)) { // No pixel, needless to clear
			return;
		}
		this.vramManager.verify(target);
		range=range||target; // default: clear all
		const gl=this.gl;
		gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer); // render to a texture
		gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target.data,0);
		gl.viewport(0,0,target.width,target.height); // @TODO: by directly changing viewport?
		gl.enable(gl.SCISSOR_TEST);
		gl.scissor(range.left-target.left,target.top+target.height-range.top-range.height,range.width,range.height);
		gl.clearColor(0,0,0,0); // Set clear color
		gl.clear(gl.COLOR_BUFFER_BIT); // Clear the color buffer with specified clear color
		gl.disable(gl.SCISSOR_TEST);
	}
	/**
	 * Change src's size to newParam, size may be smaller (will crop the src)
	 * The pointer of src won't change
	 * if is toCopy, only copy part contained within a viewport size
	 * // @TODO: use new image data to replace, regardless of viewport size
	 */
	resizeImageData(src,newParam,toCopy) {
		if(src.width==newParam.width
			&&src.height==newParam.height
			&&src.left==newParam.left
			&&src.top==newParam.top) { // No need to change
			return;
		}
		this.vramManager.verify(src);
		// copy to tmp
		const tmp=this.tmpImageData;
		if(src.width>tmp.width||src.height>tmp.height) {
			LOGGING&&console.warn("Resize Imagedata: Tmp texture ("
				+tmp.width+"x"+tmp.height+") smaller than target ("
				+src.width+"x"+src.height+"), may be cropped");
		}
		if(toCopy) { // Try the best to cover larger area
			this.clearImageData(tmp,null,false);
			const l1=src.validArea.left;
			const l2=src.validArea.left+src.validArea.width-tmp.width;
			tmp.left=0;
			if(l1>0) tmp.left=l1;
			if(l2<0) tmp.left=l2;

			const t1=src.validArea.top;
			const t2=src.validArea.top+src.validArea.height-tmp.height;
			tmp.top=0;
			if(t1>0) tmp.top=t1;
			if(t2<0) tmp.top=t2;

			tmp.validArea={...src.validArea}; // src.validArea may shrink
			this.blendImageData(src,tmp,{mode: BasicRenderer.SOURCE});
		}

		// resize
		const gl=this.gl;
		gl.bindTexture(gl.TEXTURE_2D,src.data);
		gl.texImage2D(
			gl.TEXTURE_2D,0,gl.RGBA,
			newParam.width,newParam.height,0, // size[w,h], border(0)
			gl.RGBA,this.dataFormat,null
		);
		src.width=newParam.width;
		src.height=newParam.height;
		src.left=newParam.left;
		src.top=newParam.top;
		src.validArea={width: 0,height: 0,left: 0,top: 0};

		// copy back
		if(toCopy) {
			this.blendImageData(tmp,src,{mode: BasicRenderer.SOURCE});
		}
	}

	/**
	 * Adjust the size/position of src imageData so that targetRange={width,height,left,top} fits in
	 * During adjustment, the contents in src will be CROPPED into the viewport
	 * **The memories aren't infinite!**
	 * **NOTE** This function does not certainly clear the src contents even if isPreservingContents==false
	 */
	adjustImageDataBorders(src,targetRange,isPreservingContents) {
		const BLOCK_SIZE=512; // pixels to extend when drawing out of an imageData, better to be 2^N to fit GPU memory
		// 512^2 takes each single block 4MB
		const tmp=this.tmpImageData; // always valid
		const gl=this.gl;

		let initSize; // the size {w,h,l,t} to be resized to
		if(isPreservingContents) {
			initSize=GLProgram.extendBorderSize(src.validArea,targetRange); // extend range containing all contents
		}
		else {
			initSize=targetRange;
		}
		initSize=GLProgram.borderIntersection(initSize,this.viewport); // initial cut

		if(src.type=="GLRAMBuf") { // No need to de-compression, creating new one is faster
			if(!isPreservingContents) { // clear image
				const tmpData=this.createImageData(initSize.width,initSize.height);
				src.data=tmpData.data; // transfer data
				tmpData.data=null; // release reference
				src.type="GLTexture";
				src.width=initSize.width;
				src.height=initSize.height;
				src.left=initSize.left;
				src.top=initSize.top;
				src.validArea={width: 0,height: 0,left: 0,top: 0}; // empty valid area
				this.vramManager.verify(src); // submit this to manager
				return;
			}
			// else? probably never happens...
		}

		this.vramManager.verify(src);
		if(isPreservingContents) { // extend the contents in blocks, valid area doesn't change
			let [sL,sR,sT,sB]=[src.left,src.left+src.width,src.top,src.top+src.height];
			let [tL,tR,tT,tB]=[initSize.left,initSize.left+initSize.width,initSize.top,initSize.top+initSize.height];

			let [dL,dR,dT,dB]=[sL-tL,tR-sR,sT-tT,tB-sB]; // change on each border

			// round to a block
			dL=Math.ceil(dL/BLOCK_SIZE)*BLOCK_SIZE;
			dR=Math.ceil(dR/BLOCK_SIZE)*BLOCK_SIZE;
			dT=Math.ceil(dT/BLOCK_SIZE)*BLOCK_SIZE;
			dB=Math.ceil(dB/BLOCK_SIZE)*BLOCK_SIZE;

			if(dL>0||dR>0||dT>0||dB>0) { // need to move
				//console.log(src.width,initSize.width,src.height,initSize.height);
				tmp.left=Math.max(src.left,0); // record source position
				tmp.top=Math.max(src.top,0);
				this.clearImageData(tmp,null,false); // record source content
				this.blendImageData(src,tmp,{mode: BasicRenderer.SOURCE});
				
				if(src.width>=initSize.width&&src.height>=initSize.height){ // able to contain, simply pan around
					//console.log("Preserve - Pan");
					src.left=initSize.left; // pan src area
					src.top=initSize.top;
				}
				else{ // create new texture
					//console.log("Preserve - New");
					// only copy the part in viewport

					[tL,tR,tT,tB]=[sL-dL,sR+dR,sT-dT,sB+dB];
					// require the whole block when near the edge
					// also, if overflow, crop the border to viewport
					const HALF_BLOCK=BLOCK_SIZE/2;
					const w=this.viewport.width;
					const h=this.viewport.height;
					if(tL<HALF_BLOCK) tL=0;
					if(w-tR<HALF_BLOCK) tR=w;
					if(tT<HALF_BLOCK) tT=0;
					if(h-tB<HALF_BLOCK) tB=h;
					initSize={left: tL,top: tT,width: Math.max(Math.ceil(tR-tL),0),height: Math.max(Math.ceil(tB-tT),0)};
	
					LOGGING&&console.log("New Texture");
					gl.bindTexture(gl.TEXTURE_2D,src.data);
					gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,initSize.width,initSize.height,0,gl.RGBA,this.dataFormat,null);
					src.width=initSize.width;
					src.height=initSize.height;
					src.left=initSize.left;
					src.top=initSize.top;
				}
				// copy back
				this.clearImageData(src,null,false); // tmp might cover only part of src
				this.blendImageData(tmp,src,{mode: BasicRenderer.SOURCE});
			}
			// else: simply don't move at all
		}
		else if(initSize.width>src.width||initSize.height>src.height) {
			//LOGGING&&console.log("New Texture Change");
			initSize.width=Math.ceil(initSize.width/BLOCK_SIZE)*BLOCK_SIZE;
			initSize.height=Math.ceil(initSize.height/BLOCK_SIZE)*BLOCK_SIZE;
			initSize=GLProgram.borderIntersection(initSize,this.viewport); // cut again within viewport

			// extend
			gl.bindTexture(gl.TEXTURE_2D,src.data);
			gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,initSize.width,initSize.height,0,gl.RGBA,this.dataFormat,null);

			src.width=initSize.width;
			src.height=initSize.height;
			src.left=initSize.left;
			src.top=initSize.top;
			src.validArea={width: 0,height: 0,left: 0,top: 0}; // empty valid area
		}
		else { // no need to extend, only change position
			const dx=src.left-initSize.left;
			const dy=src.top-initSize.top;
			src.left=initSize.left;
			src.top=initSize.top;
			src.validArea.left+=dx; // valid area panned
			src.validArea.top+=dy;
			src.validArea={width: 0,height: 0,left: 0,top: 0}; // empty valid area
		}
	}

	// swap the contents of the two image data
	// Do not swap directly like [s1,s2]=[s2,s1]: causing object reference changing!
	// Discarded: Not compatible with vRAMManager
	// swapImageData(s1,s2) {
	// 	[s1.type,s2.type]=[s2.type,s1.type];
	// 	[s1.data,s2.data]=[s2.data,s1.data];
	// 	[s1.id,s2.id]=[s2.id,s1.id];
	// 	[s1.width,s2.width]=[s2.width,s1.width];
	// 	[s1.height,s2.height]=[s2.height,s1.height];
	// 	[s1.left,s2.left]=[s2.left,s1.left];
	// 	[s1.top,s2.top]=[s2.top,s1.top];
	// 	[s1.tagColor,s2.tagColor]=[s2.tagColor,s1.tagColor];
	// 	[s1.validArea,s2.validArea]=[s2.validArea,s1.validArea];
	// }
	// ====================== Blend Functions =========================
	// add source to target (all imagedata),
	blendImageData(src,tgt,param) {
		this.vramManager.verify(src);
		this.vramManager.verify(tgt);
		this.textureBlender.blendTexture(src,tgt,param);
	}

	// debug: add wire frame
	// draw a border wire frame of the source.color on the target
	drawEdge(src,tgt,optArea) {
		this.vramManager.verify(src);
		this.vramManager.verify(tgt);
		const WIDTH=4;
		const VA_WIDTH=4;
		const gl=this.gl;
		gl.enable(gl.SCISSOR_TEST);
		gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tgt.data,0);
		gl.viewport(0,0,tgt.width,tgt.height);

		const color=src.tagColor;
		gl.clearColor(color[0],color[1],color[2],1);

		// Draw image data border
		let L1=src.left-tgt.left;
		let H1=tgt.top+tgt.height-src.top;
		let H2=H1-src.height;
		gl.scissor(L1,H1-WIDTH,src.width,WIDTH);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.scissor(L1,H2,WIDTH,src.height);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.scissor(L1,H2,src.width,WIDTH);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.scissor(L1+src.width-WIDTH,H2,WIDTH,src.height);
		gl.clear(gl.COLOR_BUFFER_BIT);

		// Draw valid area border
		L1=src.validArea.left-tgt.left;
		H1=tgt.top+tgt.height-src.validArea.top;
		H2=H1-src.validArea.height;
		for(let i=L1;i<L1+src.validArea.width-VA_WIDTH;i+=VA_WIDTH*2) {
			gl.scissor(i,H1-VA_WIDTH,VA_WIDTH,VA_WIDTH);
			gl.clear(gl.COLOR_BUFFER_BIT);
		}
		for(let i=H2;i<H2+src.validArea.height-VA_WIDTH;i+=VA_WIDTH*2) {
			gl.scissor(L1,i,VA_WIDTH,VA_WIDTH);
			gl.clear(gl.COLOR_BUFFER_BIT);
		}
		for(let i=L1;i<L1+src.validArea.width-VA_WIDTH;i+=VA_WIDTH*2) {
			gl.scissor(i,H2,VA_WIDTH,VA_WIDTH);
			gl.clear(gl.COLOR_BUFFER_BIT);
		}
		for(let i=H2;i<H2+src.validArea.height-VA_WIDTH;i+=VA_WIDTH*2) {
			gl.scissor(L1+src.validArea.width-VA_WIDTH,i,VA_WIDTH,VA_WIDTH);
			gl.clear(gl.COLOR_BUFFER_BIT);
		}

		if(optArea) { // Draw optional border
			const O_WIDTH=Math.floor(WIDTH/2);
			let L1=optArea.left-tgt.left;
			let H1=tgt.top+tgt.height-optArea.top;
			let H2=H1-optArea.height;
			gl.scissor(L1,H1-O_WIDTH,optArea.width,O_WIDTH);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.scissor(L1,H2,O_WIDTH,optArea.height);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.scissor(L1,H2,optArea.width,O_WIDTH);
			gl.clear(gl.COLOR_BUFFER_BIT);
			gl.scissor(L1+optArea.width-O_WIDTH,H2,O_WIDTH,optArea.height);
			gl.clear(gl.COLOR_BUFFER_BIT);
		}

		gl.disable(gl.SCISSOR_TEST);
	}

	/**
	 * Get a brushtip image from src
	 * returns a GLTexture, size no more than 500*500, OR null for failed
	 * OR, null for not successfully created any brushtip imagedata
	 * This function does not change the actual valid area of src (although it will recalculate)
	 * 
	 * BrushtipImageData: "GLTexture" type
	 * no more than 500*500 in size
	 * R channel: opacity
	 * G channel: erosion map
	 * B channel: <reserved>
	 * A channel: 1
	 * 
	 * @param {"GLTexture"} src GLTexture image data
	 */
	getBrushtipImageData(src) {
		this.vramManager.verify(src);
		const MAXL=500; // Not used now
		const nArea=this.imageDataFactory.recalculateValidArea(src,0);

		// create brushtip
		const nW=nArea.width;
		const nH=nArea.height;
		if(nW<3||nH<3){ // too few pixels
			return null; // empty
		}
		const nL=Math.max(nW,nH);

		const padW=(nL-nW)/2;
		const padH=(nL-nH)/2;

		// @TODO: add size limit and zooming

		// transfer image data (place at middle)
		const bImg=this.createImageData(nL,nL);
		bImg.left=nArea.left-padW;
		bImg.top=nArea.top-padH;
		this.vramManager.addWhiteList(bImg); // No need to freeze brushtip always
		this.blendImageData(src,bImg,{mode:GLTextureBlender.SOURCE});
		return bImg;
	}

	/**
	 * 
	 * @param {"GLTexture"} src brushtipImageData of a brush
	 */
	copyBrushtipImageData(src) {
		// transfer image data (place at middle)
		const bImg=this.createImageData(src.width,src.height);
		bImg.left=src.left;
		bImg.top=src.top;
		this.vramManager.addWhiteList(bImg); // No need to freeze brushtip always
		this.blendImageData(src,bImg,{mode:GLTextureBlender.SOURCE});
		return bImg;
	}

	// tgt is a RAMBuf8 but lack a real texture
	loadBrushtipImageData(tgt,data){
		if(tgt.type!="RAMBuf8"){
			LOGGING&&console.warn("Not RAMBuf8 brushtip imagedata!");
			return;
		}
		const bImg=this.createImageData(tgt.width,tgt.height);
		bImg.left=tgt.left;
		bImg.top=tgt.top;
		this.vramManager.addWhiteList(bImg); // No need to freeze brushtip always

		// loading
		tgt.data=data;
		this.loadToImageData(bImg,tgt);
		return bImg;
	}
	// ====================== Data type transforms =======================
	// Load/Get
	loadToImageData(target,img) { // load img into target
		this.vramManager.verify(target);
		const gl=this.gl;
		if(img.type) {
			if(img.type=="GLRAMBuf") { // load a buffer
				// Here, suppose that the size of target will always contain img @TODO: Buggy?
				// Setup temp texture for extracting data
				const tmpTexture=GLProgram.createAndSetupTexture(gl);
				gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,img.width,img.height,0,gl.RGBA,this.dataFormat,img.data);
				const tmpImageData={ // create a GLTexture copy of img
					type: "GLTexture",
					bitDepth: img.bitDepth,
					data: tmpTexture,
					width: img.width,
					height: img.height,
					left: img.left,
					top: img.top,
					validArea: img.validArea // borrow values
				}
				this.textureBlender.blendTexture(tmpImageData,target,{mode: GLRenderer.SOURCE});
				gl.deleteTexture(tmpTexture);
			}
			else if(img.type=="RAMBuf8") { // load a CTX2D ImageData, defined in Storage
				if(!(target.width&&target.height)) { // the target is empty
					return; // return directly
				}
				if(!(img.width&&img.height)) { // the img is empty
					return; // return directly
				}
				const canvas=document.createElement("canvas");
				canvas.width=img.width;
				canvas.height=img.height;
				const ctx2d=canvas.getContext("2d"); // Use Context2D mode @TODO: may cause context lost on large data!
				// @TODO: using texImage2D-ArrayBuffer as input
				const imgData2D=ctx2d.createImageData(canvas.width,canvas.height);
				imgData2D.data.set(img.data);
				this.loadToImageData(target,imgData2D);
			}
		}
		else {
			gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true); // non-premult img
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true); // normal Y-direction
			// img can be Context2DImageData/HTMLImageElement/HTMLCanvasElement/ImageBitmap
			this.imageDataFactory.loadToImageData(target,img);
			gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,false); // restore
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
		}
	}

	getBufferFromImageData(src,srcRange) {
		this.vramManager.verify(src);
		// get a RAM buffer copy of source
		// Note: this is a precise copy of texture!
		// To get a buffer used for CG, use getUint8ArrayFromImageData
		return this.imageDataFactory.getRAMBufFromTexture(src,srcRange);
	}

	getUint8ArrayFromImageData(src,srcRange,targetSize,param) {
		this.vramManager.verify(src);
		return this.imageDataFactory.imageDataToUint8(src,srcRange,targetSize,param);
	}

	// Get a <canvas> element with a CanvasRenderingContext2D containing data in src
	// left & top are used for indicating the left/top bias on the canvas
	// srcRange cuts out the part of src from the screen.
	getContext2DCanvasFromImageData(src,srcRange) {
		const canvas=document.createElement("canvas");
		srcRange=srcRange||src; // init all src range

		canvas.width=srcRange.width;
		canvas.height=srcRange.height;
		if(!(src.width&&src.height)) { // the src is empty
			return canvas; // return directly
		}

		this.vramManager.verify(src);
		const ctx2d=canvas.getContext("2d"); // Use Context2D mode
		const imgData2D=ctx2d.createImageData(canvas.width,canvas.height);
		const buffer=this.imageDataFactory.imageDataToUint8(src,srcRange); // convert src into 8bit RGBA format
		imgData2D.data.set(buffer);
		ctx2d.putImageData(imgData2D,0,0); // put buffer data into canvas
		return canvas;
	}

	// Freeze restore
	isImageDataFrozen(src) {
		return src.type=="GLRAMBuf";
	}
	freezeImageData(src) { // in-place
		// if(src.type!="GLTexture") { // only freezes GLTexture
		// 	return;
		// }
		this.imageDataFactory.convertGLTextureToRAMBuf(src);
	}
	restoreImageData(src) { // in-place
		// if(this.isImageDataFrozen(src)) { // only restore frozen data
		// 	return;
		// }
		this.imageDataFactory.convertGLRAMBufToTexture(src);
	}
}