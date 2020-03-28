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
				gl.getExtension("EXT_color_buffer_float");
				gl.getExtension("EXT_float_blend");
				gl.HALF_FLOAT=ext.HALF_FLOAT_OES;
				this.dataFormat=gl.HALF_FLOAT;
				break;
			case 8:
				this.dataFormat=gl.UNSIGNED_BYTE;
				break;
			case 4:
				this.dataFormat=gl.UNSIGNED_SHORT_4_4_4_4;
				break;
		}

		// These setting influence the loading of textures
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true); // when loading image
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);

		// =================== Create Programs ====================
		this._initCircleProgram();
		this._initRenderCanvasProgram();
		this._initClearCanvasProgram();

		// ================= Create Framebuffer ================
		// for clear image data
		this.framebuffer=gl.createFramebuffer(); // create a new framebuffer from gl
		gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);
		this.tmpImageData=this.createImageData(this.viewport.width,this.viewport.height);

		// blender
		this.textureBlender=new GLTextureBlender(gl);
		this.imageDataFactory=new GLImageDataFactory(gl,this.dataFormat);
	}
	free() { // death
		const gl=this.gl;
		this.textureBlender.free();
		this.imageDataFactory.free();
		this.circleProgram.free();
		this.canvasProgram.free();
		this.clearProgram.free();
		gl.deleteFramebuffer(this.framebuffer);
		this.deleteImageData(this.tmpImageData);
	}

	getGPUMemUsage(){ // return GPU Memory usage in bytes
		return this.canvas.width*this.canvas.height*this.bitDepth*2; // ARGB, canvas and tmpImageData
	}
	getRAMUsage(){
		return 0;
	}


	_initCircleProgram() {
		// slice number of a circle divided
		const circleSliceN=64;

		// add the glsl codes inside a closure
		const vCircleShaderSource=glsl` // vertex shader for drawing a circle
			// circle id (not used) is the order of the circle to be drawn
			// face id is the order of the triangle in the circle
			// vertex id is the order of the vertex in a triangle (0,1,2)
			// OpenGL guarantees the primitive rasterization order same as VBO
			#define DBPI 6.2831853071795864769 // 2*PI

			attribute float a_id; // vertex id: faceid*3+vertexid

			uniform vec2 u_resolution; // canvas resolution
			uniform float u_circle_slice_N; // slice number of a circle divided

			uniform vec3 u_pos; // circle position (x,y,r) in pixels
			varying float rel; // linear opacity interpolation
			void main(){
				if(mod(a_id,3.0)<0.5){ // 0' vertex
					vec2 center_clip=(u_pos.xy/u_resolution*2.0-1.0)*vec2(1.0,-1.0);
					gl_Position=vec4(center_clip,0.0,1.0);
					rel=1.0;
				}
				else{ // 1',2' vertex
					float id=floor((a_id+1.0)/3.0);
					float u=id/u_circle_slice_N; // 0~1
					float angle=u*DBPI;
					vec2 d_pos=vec2(cos(angle),sin(angle))*u_pos.z;
					vec2 pos=u_pos.xy+d_pos;
					vec2 v_clip=(pos/u_resolution*2.0-1.0)*vec2(1.0,-1.0);
					gl_Position=vec4(v_clip,0.0,1.0);
					rel=0.0;
				}
			}
		`;

		const fCircleShaderSource=glsl`
			precision mediump float;
			uniform float u_softness; // circle edge softness
			uniform vec4 u_color; // rgba
			varying float rel;
			void main(){
				//float opa=smoothstep(0.0,u_softness,rel); // sharper than following
				if(rel>=u_softness){
					gl_FragColor=u_color;
				}
				else{ // sample on this function averages to 1/3
					float r=rel/u_softness;
					float opa=clamp(r*r,0.0,1.0); // prevent NaN operation
					gl_FragColor=u_color*opa;
				}
			}
		`;
		// ================= Create program ====================
		const program=new GLProgram(this.gl,vCircleShaderSource,fCircleShaderSource);
		this.circleProgram=program;
		// ================ Create buffer ================

		// prepare vertices id array
		const vertexIdArray=new Float32Array(circleSliceN*3);
		vertexIdArray.forEach((v,i) => {vertexIdArray[i]=i;});
		program.setAttribute("a_id",vertexIdArray,1);
		program.setUniform("u_circle_slice_N",circleSliceN);
	}

	_initRenderCanvasProgram() {
		// add the glsl codes inside a closure
		const vCanvasShaderSource=glsl` // vertex shader for drawing a circle
			attribute vec2 a_position; // vertex position
			varying vec2 v_position;
			void main(){
				v_position=a_position;
				gl_Position=vec4(a_position*2.0-1.0,0.0,1.0); // to clip space
			}
		`;
		const fCanvasShaderSource=glsl`
			precision mediump float;
			uniform sampler2D u_image;
			varying vec2 v_position;
			void main(){
				gl_FragColor=texture2D(u_image,v_position);
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
			varying vec2 v_position;
			void main(){
				gl_FragColor=vec4(1,1,1,1);
			}
		`;
		// ================= Create program ====================
		this.clearProgram=new GLProgram(this.gl,vClearShaderSource,fClearShaderSource);
		this.clearProgram.setAttribute("a_position",[0,0,1,0,0,1,0,1,1,0,1,1],2);
	}

	// Init on specifying a new texture to be rendered
	init(param) {
		super.init(param); // init canvas

		if(param.imageData.type!="GLTexture") { // not GL texture type
			throw new Error("ImageData "+param.imageData+" not GLTexture");
		}
		// init rendering environment

		// attach the target texture to fbo
		this.targetImageData=param.imageData;
	}

	// Init before every stroke: setting the rendering environment
	initBeforeStroke(param) {
		super.initBeforeStroke(param);
		//console.log(this.brush);
	}

	/**
	 * render a series of key points (plate shapes) into the buffer
	 * [wL,wH,hL,hH] is the range of plates to be rendered *Note: may exceed canvas size range!
	 * kPoints[v] = [x,y,r,a] *a in 0~1
	 */
	// @TODO: render circles according to the actual size & position of the texture
	// @TODO: dynamically grow texture size to save graphics memory!
	// Especially in large files
	renderPoints(wL,wH,hL,hH,kPoints) {
		const gl=this.gl;
		const program=this.circleProgram;

		// set blend mode
		let rgb=[this.rgb[0]/255,this.rgb[1]/255,this.rgb[2]/255]; // color to use: unmultiplied
		if(this.brush.blendMode==0) { // add: pen, brush, ...
			if(this.isOpacityLocked) { // destination opacity not change
				gl.blendFunc(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA); // a_dest doesn't change
			}
			else {
				gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA); // normal blend mode *Lossy when 8bit int!
			}
		}
		else { // erase: eraser
			if(this.isOpacityLocked) { // destination opacity not change
				rgb=[1,1,1]; // white
				gl.blendFunc(gl.DST_ALPHA,gl.ONE_MINUS_SRC_ALPHA); // a_dest doesn't change
			}
			else {
				gl.blendFunc(gl.ZERO,gl.ONE_MINUS_SRC_ALPHA); // no color
			}
		}
		const imgData=this.targetImageData;
		program.setTargetTexture(imgData.data); // render to this.texture
		program.setUniform("u_resolution",[imgData.width,imgData.height]);
		gl.viewport(0,0,imgData.width,imgData.height); // restore viewport // @TODO: position based on target

		// a soft edge with fixed pixel width for anti-aliasing
		const fixedSoftEdge=this.antiAlias? Math.min((this.brush.size+1)/4,2):0;
		for(let k=0;k<kPoints.length;k++) { // each circle in sequence
			const p=kPoints[k];
			const opa=p[3];
			const softRange=this.softness+fixedSoftEdge/p[2];

			// set circle size and radius, adjust position according to the imgData, radius+0.07 for gl clipping
			program.setUniform("u_pos",[p[0]-imgData.left,p[1]-imgData.top,p[2]+0.1]);
			program.setUniform("u_color",[rgb[0]*opa,rgb[1]*opa,rgb[2]*opa,opa]); // set circle color, alpha pre-multiply
			program.setUniform("u_softness",softRange);
			program.run();
		}
	}

	// source is a texture
	drawCanvas(imgData) {
		const gl=this.gl;
		const program=this.canvasProgram;
		const w=this.canvas.width;
		const h=this.canvas.height;
		const iw=imgData.width;
		const ih=imgData.height;

		program.setTargetTexture(null,w,h); // draw to canvas
		gl.viewport(0,0,w,h);
		gl.clearColor(0,0,0,0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		if(!(iw&&ih)) { // drawing an empty texture
			return;
		}

		program.setSourceTexture(imgData.data,iw,ih);
		gl.viewport(imgData.left,h-ih-imgData.top,iw,ih); // set viewport according to the image data
		gl.blendFunc(this.gl.ONE,this.gl.ONE_MINUS_SRC_ALPHA); // normal blend
		program.run();
	}

	// ============= ImageData (texture) Operation =============
	/**
	 * imagedata.type:
	 * "GLTexture": WebGL texture for GL renderer
	 * "GLRAMBuf": texture restored in RAM buffer, cannot be used directly
	 */
	createImageData(w,h) { // imagedata contains a texture
		const gl=this.gl;
		let texture=GLProgram.createAndSetupTexture(gl);
		// Using 0 means an empty texture at first and will grow according to the drawing
		// Using {width,height} means a texture sized of the whole viewport is provided, won't change in the life cycle
		//w=w||this.canvas.width;
		//h=h||this.canvas.height;
		w=w||0;
		h=h||0;
		gl.texImage2D( // setup texture format
			gl.TEXTURE_2D,0,gl.RGBA, // texture type, level(0), texture color format
			w,h,0, // size[w,h], border(0)
			gl.RGBA, // texel color format (==texture color format)
			this.dataFormat,null // 32bit/channel float for RGBA, empty
		);
		return { // a texture - image data type
			type: "GLTexture",
			data: texture,
			id: LAYERS.generateHash("t"), // for DEBUG ONLY!
			width: w, // width and ...
			height: h, // ... height are immutable: do not change by assignment!
			left: 0, // left & top can be changed directly: all relative to the viewport
			top: 0,
			tagColor: [Math.random()*0.8,Math.random()*0.7,Math.random()*0.9]
		};
	}

	deleteImageData(imgData) { // discard an image data after being used
		this.gl.deleteTexture(imgData.data);
	}

	// clear the contents with white
	clearImageData(target,range,isOpacityLocked) {
		if(!(target.width&&target.height)) { // No pixel, needless to clear
			return;
		}
		const gl=this.gl;
		if(isOpacityLocked) { // the opacity of each pixel doesn't change
			const program=this.clearProgram;
			program.setTargetTexture(target.data);
			gl.blendFunc(gl.DST_ALPHA,gl.ZERO);
			gl.viewport(0,0,target.width,target.height);
			program.run();
		}
		else { // Pre-multiply
			gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer); // render to a texture
			gl.framebufferTexture2D( // framebuffer target
				gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,target.data,0);
			gl.viewport(0,0,target.width,target.height);
			gl.clearColor(0,0,0,0); // Set clear color
			gl.clear(gl.COLOR_BUFFER_BIT); // Clear the color buffer with specified clear color
		}
	}
	/**
	 * Change src's size to newParam
	 * The pointer of src won't change
	 */
	resizeImageData(src,newParam,toCopy) {
		// copy to tmp
		const tmp=this.tmpImageData;
		if(toCopy) {
			this.clearImageData(tmp,null,false);
			tmp.left=Math.max(src.left,0);
			tmp.top=Math.max(src.top,0);
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

		// copy back
		if(toCopy) {
			this.blendImageData(tmp,src,{mode: BasicRenderer.SOURCE});
		}
	}

	/**
	 * Adjust the size/position of src imageData so that targetRange={width,height,left,top} fits in
	 * During adjustment, the contents in src will be cropped into the viewport
	 * **The memories aren't infinite!**
	 * **NOTE** This function does not certainly clear the src contents even if isPreservingContents==false
	 */
	adjustImageDataBorders(src,targetRange,isPreservingContents) {
		const BLOCK_SIZE=512; // pixels to extend when drawing out of an imageData, better to be 2^N to fit GPU memory
		// 512^2 takes each single block 4MB
		const tmp=this.tmpImageData;
		const gl=this.gl;

		let initSize; // the size {w,h,l,t} to be resized to
		if(isPreservingContents) {
			initSize=GLProgram.extendBorderSize(src,targetRange); // extend range
		}
		else {
			initSize=targetRange;
		}
		initSize=GLProgram.borderIntersection(initSize,this.viewport); // initial cut

		if(isPreservingContents){ // extend the contents in blocks
			let [sL,sR,sT,sB]=[src.left,src.left+src.width,src.top,src.top+src.height];
			let [tL,tR,tT,tB]=[initSize.left,initSize.left+initSize.width,initSize.top,initSize.top+initSize.height];
			let [dL,dR,dT,dB]=[sL-tL,tR-sR,sT-tT,tB-sB]; // change on each border

			// round to a block
			dL=Math.ceil(dL/BLOCK_SIZE)*BLOCK_SIZE;
			dR=Math.ceil(dR/BLOCK_SIZE)*BLOCK_SIZE;
			dT=Math.ceil(dT/BLOCK_SIZE)*BLOCK_SIZE;
			dB=Math.ceil(dB/BLOCK_SIZE)*BLOCK_SIZE;

			if(dL>0||dR>0||dT>0||dB>0){ // need to expand
				[tL,tR,tT,tB]=[sL-dL,sR+dR,sT-dT,sB+dB];
				// require the whole block when near the edge
				// also, if overflow, crop the border to viewport
				const HALF_BLOCK=BLOCK_SIZE/2;
				const w=this.viewport.width;
				const h=this.viewport.height;
				if(tL<HALF_BLOCK)tL=0;
				if(w-tR<HALF_BLOCK)tR=w;
				if(tT<HALF_BLOCK)tT=0;
				if(h-tB<HALF_BLOCK)tB=h;
				initSize={left: tL,top: tT,width: Math.max(Math.ceil(tR-tL),0),height: Math.max(Math.ceil(tB-tT),0)};
				
				// only copy the part in viewport
				tmp.left=Math.max(src.left,0);
				tmp.top=Math.max(src.top,0);
				this.clearImageData(tmp,null,false);
				this.blendImageData(src,tmp,{mode: BasicRenderer.SOURCE});
			
				console.log("New Texture");
				gl.bindTexture(gl.TEXTURE_2D,src.data);
				gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,initSize.width,initSize.height,0,gl.RGBA,this.dataFormat,null);
				src.width=initSize.width;
				src.height=initSize.height;
				src.left=initSize.left;
				src.top=initSize.top;

				// copy back
				this.clearImageData(src,null,false); // tmp might cover only part of src
				this.blendImageData(tmp,src,{mode: BasicRenderer.SOURCE});
			}
			// else: no need to expand, simply don't move at all
		}
		else if(initSize.width>src.width||initSize.height>src.height) {
			initSize.width=Math.ceil(initSize.width/BLOCK_SIZE)*BLOCK_SIZE;
			initSize.height=Math.ceil(initSize.height/BLOCK_SIZE)*BLOCK_SIZE;
			initSize=GLProgram.borderIntersection(initSize,this.viewport); // cut again within viewport

			// extend
			console.log("New Texture Change");
			gl.bindTexture(gl.TEXTURE_2D,src.data);
			gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,initSize.width,initSize.height,0,gl.RGBA,this.dataFormat,null);

			src.width=initSize.width;
			src.height=initSize.height;
			src.left=initSize.left;
			src.top=initSize.top;
		}
		else{ // no need to extend, only change position
			src.left=initSize.left;
			src.top=initSize.top;
		}
	}
	// ====================== Blend Functions =========================
	// add source to target (all imagedata),
	blendImageData(source,target,param) {
		this.textureBlender.blendTexture(source,target,param);
	}

	// debug: add wire frame
	// draw a 1px border wire frame of the source.color on the target
	drawEdge(src,tgt) {
		const WIDTH=4;
		const gl=this.gl;
		gl.enable(gl.SCISSOR_TEST);
		gl.bindFramebuffer(gl.FRAMEBUFFER,this.framebuffer);
		gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tgt.data,0);
		gl.viewport(0,0,tgt.width,tgt.height);

		const color=src.tagColor;
		gl.clearColor(color[0],color[1],color[2],1);

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

		gl.disable(gl.SCISSOR_TEST);
	}

	// ====================== Data type transforms =======================
	getUint8ArrayFromImageData(src,targetSize,targetRange) {
		return this.imageDataFactory.imageDataToUint8(src,targetSize,targetRange);
	}

	// Get a <canvas> element with a CanvasRenderingContext2D containing data in src
	// left & top are used for indicating the left/top bias on the canvas
	getContext2DCanvasFromImageData(src,width,height,left,top){
		const canvas=document.createElement("canvas");
		canvas.width=width||src.width;
		canvas.height=height||src.height;
		if(!(src.width&&src.height)){ // the src is empty
			return canvas; // return directly
		}
		const ctx2d=canvas.getContext("2d"); // Use Context2D mode
		const imgData2D=ctx2d.createImageData(src.width,src.height);
		const buffer=this.imageDataFactory.imageDataToUint8(src); // convert src into 8bit RGBA format
		let data=imgData2D.data;
		for(let i=0;i<buffer.length;i++){ // copy buffer
			data[i]=buffer[i];
		}
		ctx2d.putImageData(imgData2D,left||0,top||0); // put buffer data into canvas
		return canvas;
	}

	glTextureToRAM(src) { // in-place
		this.imageDataFactory.convertGLTextureToRAMBuf(src);
	}

	ramToGLTexture(src) { // in-place
		this.imageDataFactory.convertGLRAMBufToTexture(src);
	}

	loadImageToImageData(target,img) { // load img into target
		// img can be Context2D ImageData / HTMLImageElement / HTMLCanvasElement / ImageBitmap
		this.imageDataFactory.loadImageToImageData(target,img);
	}
}